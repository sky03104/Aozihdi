// ════════════════════════════════════════════════════════════
// 天鷹保全 · 施工單管理 SQL遷移【一次性歷史資料搬遷腳本】
// ────────────────────────────────────────────────────────────
// 用途：把「施工單查詢」「動火申請查詢」兩個分頁的現有資料，轉存進
//       Supabase 的 construction_orders / fire_permits。
//
// ⚠️ 這支要貼在「施工單時間修正_完整修正版.gs」所在的 Apps Script 專案
//    裡（該專案是綁定這份試算表的容器繫結腳本，用 getActiveSpreadsheet()
//    就能直接拿到，不用另外開試算表ID）。
//
// 去重規則刻意跟現有 doPost 的 _buildKeys 邏輯完全一致（B~K十欄，字串trim
// 後用 § 串接），確保搬過去的資料跟未來新寫入的資料用同一套唯一鍵，
// 不會出現「舊資料一套規則、新資料一套規則」的落差。
//
// 使用前置：
//   1. 專案設定 → Script Properties 設定 SUPABASE_URL / SUPABASE_SECRET_KEY
//      （這是獨立的Apps Script專案，要重新設定一次，不會沿用班表管理那邊的）
//   2. 執行 遷移施工單資料到Supabase()，看執行紀錄確認結果
//
// 不會動到 Sheets 原始資料，只讀不寫，執行幾次都安全（重複執行會因為
// dedupe_key唯一鍵被Supabase擋掉，不會重複灌資料）。
// ════════════════════════════════════════════════════════════

// 用gid（分頁內部代號，不受名稱裡看不見的特殊字元影響）抓分頁，
// 比 getSheetByName() 穩定。gid由診斷目前試算表()確認過：
// 施工單查詢=0、動火申請查詢=294199656。
function 依gid取分頁_(gid) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  throw new Error('找不到 gid=' + gid + ' 的分頁');
}

function supabaseConfig2_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_URL');
  var key = props.getProperty('SUPABASE_SECRET_KEY');
  if (!url || !key) {
    throw new Error('請先在「專案設定 → Script Properties」設定 SUPABASE_URL 與 SUPABASE_SECRET_KEY');
  }
  return { url: url.replace(/\/+$/, ''), key: key };
}

function supabaseRequest2_(method, path, body, extraHeaders) {
  var cfg = supabaseConfig2_();
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

// 把儲存格值（可能是Date物件、"yyyy/M/d"字串、或空白）轉成Postgres date格式 "yyyy-MM-dd"
function 轉為ISO日期_(cellValue) {
  if (!cellValue) return null;
  if (cellValue instanceof Date) {
    return Utilities.formatDate(cellValue, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  var s = String(cellValue).trim();
  var m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    var mm = ('0' + m[2]).slice(-2), dd = ('0' + m[3]).slice(-2);
    return m[1] + '-' + mm + '-' + dd;
  }
  return null; // 格式看不懂，寧可留空也不要亂猜
}

// 把「報到時間戳」欄位（存的是 "yyyy-MM-dd HH:mm" 字串）轉成ISO timestamptz
function 轉為ISO時間戳_(cellValue) {
  if (!cellValue) return null;
  var s = String(cellValue).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  return m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':00+08:00';
}

// 跟 doPost 的 _buildKeys 完全一致的去重鍵：B~K十欄，字串trim後用§串接
function 算去重鍵_(row) {
  // row是從getRange讀出的完整列（0-index），B~K對應 index 1~10
  return [row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10]]
    .map(function (v) { return String(v == null ? '' : v).trim(); })
    .join('§');
}

function 批次寫入_(path, rows) {
  var BATCH = 200;
  var inserted = 0;
  for (var i = 0; i < rows.length; i += BATCH) {
    var chunk = rows.slice(i, i + BATCH);
    // on_conflict + resolution=ignore-duplicates：等同 ON CONFLICT DO NOTHING，
    // 重複執行腳本時不會產生錯誤也不會重複灌資料
    supabaseRequest2_('POST', path + '?on_conflict=dedupe_key', chunk,
      { Prefer: 'resolution=ignore-duplicates' });
    inserted += chunk.length;
  }
  return inserted;
}

// ============================
// 搬遷「施工單查詢」（A~O，15欄）
// ============================
function 遷移施工單查詢_() {
  var sheet = 依gid取分頁_(0);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rows: [], skippedEmpty: 0, skippedDup: [] };

  var data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  var seen = {};
  var rows = [];
  var skippedEmpty = 0;
  var skippedDup = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var sheetRowNum = i + 2;

    // B、C皆空 → 過去去重bug殘留的孤兒空殼列，不搬
    if (String(row[1]).trim() === '' && String(row[2]).trim() === '') {
      skippedEmpty++;
      continue;
    }

    var key = 算去重鍵_(row);
    if (seen[key]) {
      skippedDup.push({ row: sheetRowNum, key: key, reason: '與第' + seen[key] + '列的去重鍵相同' });
      continue;
    }
    seen[key] = sheetRowNum;

    rows.push({
      apply_unit: String(row[1] || ''),
      vendor: String(row[2] || ''),
      work_date: 轉為ISO日期_(row[11]),
      entry_time: String(row[5] || ''),
      exit_time: String(row[6] || ''),
      headcount: row[7] === '' || row[7] == null ? null : Number(row[7]),
      supervisor: String(row[8] || ''),
      location: String(row[9] || ''),
      item: String(row[10] || ''),
      exit_date: 轉為ISO日期_(row[12]),
      note: String(row[13] || ''),
      checked_in_at: 轉為ISO時間戳_(row[14]),
      dedupe_key: key
    });
  }
  return { rows: rows, skippedEmpty: skippedEmpty, skippedDup: skippedDup };
}

// ============================
// 搬遷「動火申請查詢」（B~N，13欄，跳過A欄ARRAYFORMULA）
// 欄位對應：B申請單位 C廠商 D月 E日 F進場 G退場 H人數 I監工 J地點 K項目
//           L動火器具 M施工日期 N退場日期
// ============================
function 遷移動火申請查詢_() {
  var sheet = 依gid取分頁_(294199656);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rows: [], skippedEmpty: 0, skippedDup: [] };

  // 讀 B~N，共13欄（起始欄位2）
  var data = sheet.getRange(2, 2, lastRow - 1, 13).getValues();
  var seen = {};
  var rows = [];
  var skippedEmpty = 0;
  var skippedDup = [];

  for (var i = 0; i < data.length; i++) {
    var r = data[i]; // r[0]=B申請單位 ... r[9]=K項目 r[10]=L動火器具 r[11]=M施工日期 r[12]=N退場日期
    var sheetRowNum = i + 2;

    if (String(r[0]).trim() === '' && String(r[1]).trim() === '') {
      skippedEmpty++;
      continue;
    }

    // 去重鍵沿用跟施工單查詢一樣的邏輯，但索引對應到這個13欄陣列（B~K = r[0]~r[9]）
    var key = [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]]
      .map(function (v) { return String(v == null ? '' : v).trim(); })
      .join('§');

    if (seen[key]) {
      skippedDup.push({ row: sheetRowNum, key: key, reason: '與第' + seen[key] + '列的去重鍵相同' });
      continue;
    }
    seen[key] = sheetRowNum;

    rows.push({
      apply_unit: String(r[0] || ''),
      vendor: String(r[1] || ''),
      work_date: 轉為ISO日期_(r[11]),
      entry_time: String(r[4] || ''),
      exit_time: String(r[5] || ''),
      headcount: r[6] === '' || r[6] == null ? null : Number(r[6]),
      supervisor: String(r[7] || ''),
      location: String(r[8] || ''),
      item: String(r[9] || ''),
      equipment: String(r[10] || ''),
      exit_date: 轉為ISO日期_(r[12]),
      dedupe_key: key
    });
  }
  return { rows: rows, skippedEmpty: skippedEmpty, skippedDup: skippedDup };
}

// ============================
// 診斷用：這個專案實際綁定的是哪份試算表、有哪些分頁
// ============================
function 診斷目前試算表() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return '這個專案沒有綁定任何試算表（getActiveSpreadsheet()回傳null，代表這是獨立腳本不是容器繫結腳本）';
  var names = ss.getSheets().map(function (s) { return s.getName() + '（gid=' + s.getSheetId() + '）'; });
  var msg = '試算表名稱：' + ss.getName() + '\n試算表ID：' + ss.getId() + '\n分頁清單：\n' + names.join('\n');
  Logger.log(msg);
  return msg;
}

// ============================
// 主流程
// ============================
function 遷移施工單資料到Supabase() {
  var 結果 = [];

  var con = 遷移施工單查詢_();
  var conInserted = 批次寫入_('/rest/v1/construction_orders', con.rows);
  結果.push('施工單查詢：讀到' + (con.rows.length + con.skippedEmpty + con.skippedDup.length) + '列，'
    + '略過空殼' + con.skippedEmpty + '筆，略過重複' + con.skippedDup.length + '筆，'
    + '實際寫入' + conInserted + '筆');
  if (con.skippedDup.length > 0) {
    結果.push('　重複明細：' + con.skippedDup.map(function (d) { return '第' + d.row + '列'; }).join('、'));
  }

  var fire = 遷移動火申請查詢_();
  var fireInserted = 批次寫入_('/rest/v1/fire_permits', fire.rows);
  結果.push('動火申請查詢：讀到' + (fire.rows.length + fire.skippedEmpty + fire.skippedDup.length) + '列，'
    + '略過空殼' + fire.skippedEmpty + '筆，略過重複' + fire.skippedDup.length + '筆，'
    + '實際寫入' + fireInserted + '筆');
  if (fire.skippedDup.length > 0) {
    結果.push('　重複明細：' + fire.skippedDup.map(function (d) { return '第' + d.row + '列'; }).join('、'));
  }

  var msg = 結果.join('\n');
  Logger.log(msg);
  return msg;
}

// ============================
// 驗證用：核對Supabase筆數
// ============================
function 核對施工單遷移結果() {
  var con = supabaseRequest2_('GET', '/rest/v1/construction_orders?select=id');
  var fire = supabaseRequest2_('GET', '/rest/v1/fire_permits?select=id');
  var msg = '施工單查詢 Supabase共 ' + con.length + ' 筆\n動火申請查詢 Supabase共 ' + fire.length + ' 筆';
  Logger.log(msg);
  return msg;
}
