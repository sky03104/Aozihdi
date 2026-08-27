// ════════════════════════════════════════════════════════════
// 天鷹保全 · 物流車輛統計 SQL遷移【一次性歷史資料搬遷腳本】
// ────────────────────────────────────────────────────────────
// 用途：把「物流車輛紀錄」分頁的現有資料，轉存進 Supabase 的
//       logistics_records。
//
// ⚠️ 這支要貼在 tool_logistics.html 的 BUILT_IN_GAS_URL 對應的
//    Apps Script 專案裡（容器繫結腳本，getActiveSpreadsheet() 直接
//    拿到物流車輛統計試算表）。
//
// 使用前置：
//   1. 專案設定 → Script Properties 設定 SUPABASE_URL / SUPABASE_SECRET_KEY
//   2. 執行 遷移物流車輛資料到Supabase()，看執行紀錄確認結果
//
// 不會動到 Sheets 原始資料，只讀不寫。
//
// ⚠️ 沿用打烊/開店踩過的坑：不用 legacy_id 當唯一鍵防重複執行（A欄流水號
// 若曾出過重複/溢位問題，唯一約束會把不同筆真實紀錄誤判成重複而silently
// 丟棄）。改用「執行前檢查Supabase是否已有資料」擋下重複執行；真的要重跑
// 需先手動truncate。
// ════════════════════════════════════════════════════════════

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
  var headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' };
  if (extraHeaders) { for (var k in extraHeaders) headers[k] = extraHeaders[k]; }
  var options = { method: method, headers: headers, muteHttpExceptions: true };
  if (body !== undefined) options.payload = JSON.stringify(body);
  var resp = UrlFetchApp.fetch(cfg.url + path, options);
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code >= 400) throw new Error('Supabase請求失敗（' + code + '）：' + text + '｜path=' + path);
  return text ? JSON.parse(text) : null;
}

// 用 Prefer: count=exact 標頭問總筆數，不用真的把資料全撈下來，
// 才不會撞到 Supabase 單次 GET 預設上限 1000 筆的限制
function supabaseCount_(path) {
  var cfg = supabaseConfig_();
  var headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, Prefer: 'count=exact', Range: '0-0' };
  var resp = UrlFetchApp.fetch(cfg.url + path, { method: 'get', headers: headers, muteHttpExceptions: true });
  var code = resp.getResponseCode();
  if (code >= 400) throw new Error('Supabase請求失敗（' + code + '）：' + resp.getContentText() + '｜path=' + path);
  var contentRange = resp.getHeaders()['Content-Range'] || resp.getHeaders()['content-range'] || '';
  var total = parseInt(contentRange.split('/')[1], 10);
  return isNaN(total) ? -1 : total;
}

function 批次寫入_(path, rows) {
  var BATCH = 200;
  var inserted = 0;
  for (var i = 0; i < rows.length; i += BATCH) {
    var chunk = rows.slice(i, i + BATCH);
    supabaseRequest_('post', path, chunk);
    inserted += chunk.length;
  }
  return inserted;
}

// 判斷是否為日期物件（跟原本GAS_CODE的isDate_一樣，用toString判斷避免跨realm誤判）
function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]';
}

// 取一列的建立時間：優先用H欄（絕對時間戳），沒有才用B+C欄組出來
function 算建立時間_(row) {
  if (isDate_(row[7])) return Utilities.formatDate(row[7], 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ssXXX");
  var dateStr = isDate_(row[1]) ? Utilities.formatDate(row[1], 'Asia/Taipei', 'yyyy/M/d') : String(row[1] || '').trim();
  var timeStr = isDate_(row[2]) ? Utilities.formatDate(row[2], 'Asia/Taipei', 'HH:mm:ss') : String(row[2] || '00:00:00').trim();
  var m = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null; // 日期格式看不懂，寧可留空也不要亂猜
  var yyyy = m[1], mm = ('0' + m[2]).slice(-2), dd = ('0' + m[3]).slice(-2);
  var tm = timeStr.match(/^(\d{1,2}):(\d{2})(:(\d{2}))?$/);
  var hh = tm ? ('0' + tm[1]).slice(-2) : '00', mi = tm ? tm[2] : '00', ss = tm && tm[4] ? tm[4] : '00';
  return yyyy + '-' + mm + '-' + dd + 'T' + hh + ':' + mi + ':' + ss + '+08:00';
}

// ============================
// 搬遷「物流車輛紀錄」（A~H，8欄）
// ============================
function 遷移物流車輛紀錄_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('物流車輛紀錄');
  if (!sheet) throw new Error('找不到分頁：物流車輛紀錄');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rows: [], skippedEmpty: 0 };

  var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  var rows = [];
  var skippedEmpty = 0;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (String(row[3]).trim() === '' && (row[4] === '' || row[4] == null)) {
      skippedEmpty++;
      continue;
    }
    rows.push({
      legacy_id: (typeof row[0] === 'number' && isFinite(row[0])) ? Math.floor(row[0]) : null,
      category: String(row[3] || ''),
      count: row[4] === '' || row[4] == null ? 0 : Number(row[4]),
      emp_id: String(row[5] || ''),
      emp_name: String(row[6] || ''),
      created_at: 算建立時間_(row)
    });
  }
  return { rows: rows, skippedEmpty: skippedEmpty };
}

// ============================
// 診斷用：這個專案實際綁定的是哪份試算表、有哪些分頁
// ============================
function 診斷目前試算表() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return '這個專案沒有綁定任何試算表（getActiveSpreadsheet()回傳null）';
  var names = ss.getSheets().map(function (s) { return s.getName() + '（gid=' + s.getSheetId() + '）'; });
  var msg = '試算表名稱：' + ss.getName() + '\n試算表ID：' + ss.getId() + '\n分頁清單：\n' + names.join('\n');
  Logger.log(msg);
  return msg;
}

// ============================
// 診斷用：A欄流水號（legacy_id）在原始資料裡是否有重複值
// ============================
function 診斷物流legacyId重複() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('物流車輛紀錄');
  if (!sheet) throw new Error('找不到分頁：物流車輛紀錄');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return '無資料';

  var data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var seen = {};
  var dups = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (String(row[3]).trim() === '' && (row[4] === '' || row[4] == null)) continue;
    var raw = row[0];
    if (typeof raw !== 'number' || !isFinite(raw)) continue;
    var id = Math.floor(raw);
    var sheetRowNum = i + 2;
    if (seen[id]) {
      dups.push('A欄=' + id + '：第' + seen[id] + '列 與 第' + sheetRowNum + '列');
    } else {
      seen[id] = sheetRowNum;
    }
  }
  var msg = dups.length === 0 ? '無重複' : dups.join('\n');
  Logger.log(msg);
  return msg;
}

// ============================
// 主流程
// ⚠️ 執行前會檢查Supabase是否已有資料，避免重複執行造成重複灌資料。
//    真的要重跑，先到Supabase SQL Editor執行
//    truncate table logistics_records restart identity; 再跑這支。
// ============================
function 遷移物流車輛資料到Supabase() {
  var existing = supabaseCount_('/rest/v1/logistics_records?select=id');
  if (existing > 0) {
    throw new Error('logistics_records 已有 ' + existing + ' 筆資料，為避免重複灌資料已中止。'
      + '若確定要重跑，請先在Supabase SQL Editor執行 truncate table logistics_records restart identity; 再重新執行這支。');
  }
  var con = 遷移物流車輛紀錄_();
  var inserted = 批次寫入_('/rest/v1/logistics_records', con.rows);
  var msg = '物流車輛紀錄：讀到' + (con.rows.length + con.skippedEmpty) + '列，'
    + '略過空殼' + con.skippedEmpty + '筆，'
    + '實際寫入' + inserted + '筆';
  Logger.log(msg);
  return msg;
}

// ============================
// 驗證用：核對Supabase筆數
// ============================
function 核對物流遷移結果() {
  var total = supabaseCount_('/rest/v1/logistics_records?select=id');
  var msg = 'logistics_records Supabase共 ' + total + ' 筆';
  Logger.log(msg);
  return msg;
}
