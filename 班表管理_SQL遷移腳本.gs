// ════════════════════════════════════════════════════════════
// 天鷹保全 · 班表管理 SQL遷移【一次性搬遷腳本】
// ────────────────────────────────────────────────────────────
// 用途：把 SHIFT_CONFIG（早班／晚班）目前線上班表、所有 _備份_ 隱藏分頁、
//       _待生效 分頁，全部搬進 Supabase 的 schedule_versions / schedule_entries。
//
// ⚠️ 使用前置（缺一不可）：
//   1. 這個檔案要跟 班表管理_後端_GAS_v2.13.gs 貼在「同一個」Apps Script 專案裡，
//      才能直接呼叫裡面已經寫好的 SHIFT_CONFIG / 讀班表分頁_ / resolveTargetSheet /
//      備份分頁前綴_ 等函式，不重複寫一份解析邏輯（重複寫容易兩邊改到不一致）。
//   2. 專案設定（左側齒輪圖示）→ Script Properties → 新增兩個屬性：
//        SUPABASE_URL          = https://narilpgjmjncladkquly.supabase.co
//        SUPABASE_SECRET_KEY   = （sb_secret_ 開頭那把金鑰）
//   3. 在 Apps Script 編輯器的函式下拉選單選 遷移班表資料到Supabase，按執行，
//      看「執行紀錄」（Logger）確認結果。
//
// 這支只「讀」現有 Sheets、「寫」Supabase，完全不動 Sheets 內容，執行幾次都安全——
// 重複執行前會先檢查 Supabase 該版本明細是否已存在，不會重複灌資料。
// ════════════════════════════════════════════════════════════

// SHIFT_CONFIG 的 key 是 night/morning，但 Supabase schema_entries.shift_type
// 的 check 限制是 'day'/'night'，這裡做對應轉換。
var SHIFT_TYPE_MAP_ = { night: 'night', morning: 'day' };

// ============================
// Supabase 連線基礎函式
// ============================
function supabaseConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_URL');
  var key = props.getProperty('SUPABASE_SECRET_KEY');
  if (!url || !key) {
    throw new Error('請先在「專案設定 → Script Properties」設定 SUPABASE_URL 與 SUPABASE_SECRET_KEY');
  }
  return { url: url.replace(/\/+$/, ''), key: key };
}

function supabaseRequest_(method, path, body, extraHeaders) {
  var cfg = supabaseConfig_();
  // 2026-08-27 踩坑：Supabase 新版 secret key（sb_secret_開頭）會偵測 User-Agent，
  // 判斷像瀏覽器就401拒絕；GAS 的 UrlFetchApp 沒辦法自訂 User-Agent（Google 平台
  // 長年限制，設定值會被忽略），永遠會被誤判。改用「Legacy service_role key」
  // （JWT格式，eyJ開頭），這把沒有瀏覽器偵測機制，GAS 呼叫完全正常。
  var headers = {
    apikey: cfg.key,
    Authorization: 'Bearer ' + cfg.key,
    'Content-Type': 'application/json'
  };
  if (extraHeaders) {
    for (var k in extraHeaders) headers[k] = extraHeaders[k];
  }
  var options = { method: method, headers: headers, muteHttpExceptions: true };
  if (body !== undefined) options.payload = JSON.stringify(body);

  var resp = UrlFetchApp.fetch(cfg.url + path, options);
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code >= 400) {
    throw new Error('Supabase 請求失敗（' + code + '）：' + text + '｜path=' + path);
  }
  return text ? JSON.parse(text) : null;
}

// ============================
// 格式轉換小工具
// ============================
function 轉為橫線年月_(slashYm) {
  return String(slashYm || '').trim().replace('/', '-');
}

function 算日期_(ym, day) {
  var parts = ym.split('-');
  var dd = day < 10 ? '0' + day : String(day);
  return parts[0] + '-' + parts[1] + '-' + dd;
}

// 原始試算表固定31欄（對應每月最多31天），但月份不足31天時（如9月只有30天、
// 2月更少）多出來的欄位是不存在的日期，不能硬存進去。
function 該月實際天數_(ym) {
  var parts = ym.split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  return new Date(y, m, 0).getDate(); // 下個月第0天＝這個月最後一天
}

// ============================
// 建立或取得版本紀錄（避免重複執行時建立重複版本）
// ============================
function 建立或取得版本_(shiftTypeForDb, ym, status, sourceLabel) {
  var existing = supabaseRequest_('GET',
    '/rest/v1/schedule_versions?shift_type=eq.' + shiftTypeForDb +
    '&year_month=eq.' + ym + '&status=eq.' + status);
  if (existing && existing.length > 0) {
    return existing[0].id;
  }
  var created = supabaseRequest_('POST', '/rest/v1/schedule_versions', {
    shift_type: shiftTypeForDb,
    year_month: ym,
    status: status,
    source_file_name: sourceLabel || null
  }, { Prefer: 'return=representation' });
  return created[0].id;
}

// 把 讀班表分頁_() 回傳的 rows（{roleStr,name,shifts:[31格]}）攤平成明細列
// 2026-08-27 修正：原本跳過空白格不存，會導致「整個月都沒排班的人」在資料庫裡
// 完全消失，讀取時無法重組出這個人，跟原始試算表對不起來。資料量很小，
// 全部存起來（空白格 shift_code 存空字串）換取讀取時能完整還原，划算。
function 轉為Entries_(rows, shiftTypeForDb, ym, versionId) {
  var entries = [];
  var 天數 = 該月實際天數_(ym);
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    for (var i = 0; i < row.shifts.length; i++) {
      var day = i + 1;
      if (day > 天數) continue; // 該月不存在的日期（例：9月的31號），跳過
      entries.push({
        shift_type: shiftTypeForDb,
        year_month: ym,
        work_date: 算日期_(ym, day),
        day_of_month: day,
        row_index: r,
        role: row.roleStr,
        emp_name: row.name,
        shift_code: row.shifts[i] || '',
        version_id: versionId
      });
    }
  }
  return entries;
}

// 分批寫入，避免單次請求塞太多筆
function 批次寫入Entries_(entries) {
  var BATCH = 500;
  for (var i = 0; i < entries.length; i += BATCH) {
    supabaseRequest_('POST', '/rest/v1/schedule_entries', entries.slice(i, i + BATCH));
  }
}

// 遷移單一分頁（線上／備份／待生效 共用同一套流程）
function 遷移單一分頁_(sh, shiftTypeForDb, slashYm, status, sourceLabel) {
  if (!slashYm) {
    return '略過（' + sourceLabel + '）：月份為空';
  }
  var ym = 轉為橫線年月_(slashYm);
  var versionId = 建立或取得版本_(shiftTypeForDb, ym, status, sourceLabel);

  var already = supabaseRequest_('GET',
    '/rest/v1/schedule_entries?version_id=eq.' + versionId + '&limit=1');
  if (already && already.length > 0) {
    return '跳過（已搬過）：' + sourceLabel + ' ' + ym + '（versionId=' + versionId + '）';
  }

  var rows = 讀班表分頁_(sh);
  var entries = 轉為Entries_(rows, shiftTypeForDb, ym, versionId);
  批次寫入Entries_(entries);
  return '完成：' + sourceLabel + ' ' + ym + '（' + status + '）共 ' + entries.length + ' 筆明細，versionId=' + versionId;
}

// ============================
// 主流程
// ============================
function 遷移班表資料到Supabase() {
  var 結果 = [];
  for (var key in SHIFT_CONFIG) {
    var cfg = SHIFT_CONFIG[key];
    var shiftTypeForDb = SHIFT_TYPE_MAP_[key];
    var ss = SpreadsheetApp.openById(cfg.targetSsId);

    // 1. 線上目前這份
    try {
      var live = resolveTargetSheet(cfg);
      var liveYm = String(live.getRange('Z1').getValue() || '').trim();
      結果.push(遷移單一分頁_(live, shiftTypeForDb, liveYm, 'live', cfg.label + '-線上-' + liveYm));
    } catch (err) {
      結果.push(cfg.label + ' 線上：失敗 ' + err.toString());
    }

    // 2. 所有備份分頁
    var 前綴 = 備份分頁前綴_ + cfg.targetSheetName + '_';
    var sheets = ss.getSheets();
    for (var s = 0; s < sheets.length; s++) {
      var name = sheets[s].getName();
      if (name.indexOf(前綴) !== 0) continue;
      var ym = name.substring(前綴.length).replace(/-/g, '/');
      try {
        結果.push(遷移單一分頁_(sheets[s], shiftTypeForDb, ym, 'superseded', cfg.label + '-備份-' + ym));
      } catch (err) {
        結果.push(cfg.label + ' 備份 ' + ym + '：失敗 ' + err.toString());
      }
    }

    // 3. 待生效分頁（如果有）
    try {
      var staging = ss.getSheetByName(cfg.targetSheetName + '_待生效');
      if (staging) {
        var stagingYm = String(staging.getRange('Z1').getValue() || '').trim();
        結果.push(遷移單一分頁_(staging, shiftTypeForDb, stagingYm, 'staged', cfg.label + '-待生效-' + stagingYm));
      }
    } catch (err) {
      結果.push(cfg.label + ' 待生效：失敗 ' + err.toString());
    }
  }
  var msg = 結果.join('\n');
  Logger.log(msg);
  return msg;
}

// ============================
// 驗證用：核對 Supabase 各版本的明細筆數
// ============================
function 核對遷移結果() {
  var 結果 = [];
  for (var key in SHIFT_CONFIG) {
    var cfg = SHIFT_CONFIG[key];
    var shiftTypeForDb = SHIFT_TYPE_MAP_[key];
    var versions = supabaseRequest_('GET',
      '/rest/v1/schedule_versions?shift_type=eq.' + shiftTypeForDb + '&select=id,year_month,status&order=year_month.asc');
    結果.push(cfg.label + ' 共 ' + versions.length + ' 個版本：');
    for (var i = 0; i < versions.length; i++) {
      var v = versions[i];
      var entries = supabaseRequest_('GET',
        '/rest/v1/schedule_entries?version_id=eq.' + v.id + '&select=id');
      結果.push('　' + v.year_month + '（' + v.status + '）：' + entries.length + ' 筆明細');
    }
  }
  var msg = 結果.join('\n');
  Logger.log(msg);
  return msg;
}
