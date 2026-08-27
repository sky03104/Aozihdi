// ════════════════════════════════════════════════════════════
// 天鷹保全 · 開店前管理 SQL遷移【一次性歷史資料搬遷腳本】
// ────────────────────────────────────────────────────────────
// 用途：把開店工具「進出資料表」的現有資料，轉存進 Supabase 的
//       opening_gate_logs。
//
// ⚠️ 這支要貼在 tool_opening.html 的 BUILT_IN_GAS_URL 對應的
//    Apps Script 專案裡（容器繫結腳本，getActiveSpreadsheet() 直接
//    拿到開店試算表——跟打烊是不同的試算表、不同的Apps Script專案）。
//
// 使用前置：
//   1. 專案設定 → Script Properties 設定 SUPABASE_URL / SUPABASE_SECRET_KEY
//      （獨立的Apps Script專案，要重新設定一次，不會沿用其他工具的）
//   2. 執行 遷移開店資料到Supabase()，看執行紀錄確認結果
//
// 不會動到 Sheets 原始資料，只讀不寫，執行幾次都安全。
// ════════════════════════════════════════════════════════════

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

// 進場/退場時間欄位可能是Date物件（Sheets自動辨識成時間格式）或純字串，統一轉成 "HH:mm:ss" 字串
function 存文字時間_(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'HH:mm:ss');
  return String(v);
}

// L欄建立時間（Date物件）轉成帶時區的ISO字串
function 轉為ISO時間戳2_(v) {
  if (!(v instanceof Date)) return null;
  return Utilities.formatDate(v, 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function 批次寫入2_(path, rows) {
  var BATCH = 200;
  var inserted = 0;
  for (var i = 0; i < rows.length; i += BATCH) {
    var chunk = rows.slice(i, i + BATCH);
    supabaseRequest2_('POST', path, chunk);
    inserted += chunk.length;
  }
  return inserted;
}

// ============================
// 搬遷「進出資料表」（A~L，12欄）
// ============================
function 遷移開店進出資料_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('進出資料表');
  if (!sheet) throw new Error('找不到分頁：進出資料表');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rows: [], skippedEmpty: 0 };

  var data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  var rows = [];
  var skippedEmpty = 0;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (String(row[1]).trim() === '' && String(row[2]).trim() === '' && String(row[3]).trim() === '') {
      skippedEmpty++;
      continue;
    }
    rows.push({
      legacy_id: (typeof row[0] === 'number' && isFinite(row[0])) ? Math.floor(row[0]) : null,
      shop_code: String(row[1] || ''),
      floor: String(row[2] || ''),
      shop_name: String(row[3] || ''),
      headcount: row[4] === '' || row[4] == null ? null : Number(row[4]),
      supervisor: String(row[5] || ''),
      entry_time: 存文字時間_(row[6]),
      location: String(row[7] || ''),
      work_type: String(row[8] || ''),
      exit_time: 存文字時間_(row[9]),
      inspector: String(row[10] || ''),
      created_at: 轉為ISO時間戳2_(row[11])
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
// 主流程
// ============================
function 遷移開店資料到Supabase() {
  var con = 遷移開店進出資料_();
  var inserted = 批次寫入2_('/rest/v1/opening_gate_logs', con.rows);
  var msg = '進出資料表：讀到' + (con.rows.length + con.skippedEmpty) + '列，'
    + '略過空殼' + con.skippedEmpty + '筆，'
    + '實際寫入' + inserted + '筆';
  Logger.log(msg);
  return msg;
}

// 用 Prefer: count=exact 標頭問總筆數，不用真的把資料全撈下來，
// 才不會撞到 Supabase 單次 GET 預設上限 1000 筆的限制
// （這個限制連帶 limit= 查詢參數都蓋不過，只有 Prefer: count=exact 能問到真實總數）
function supabaseCount2_(path) {
  var cfg = supabaseConfig2_();
  var headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, Prefer: 'count=exact', Range: '0-0' };
  var resp = UrlFetchApp.fetch(cfg.url + path, { method: 'get', headers: headers, muteHttpExceptions: true });
  var code = resp.getResponseCode();
  if (code >= 400) throw new Error('Supabase請求失敗（' + code + '）：' + resp.getContentText() + '｜path=' + path);
  // Content-Range格式："0-0/4266"，斜線後面是總筆數
  var contentRange = resp.getHeaders()['Content-Range'] || resp.getHeaders()['content-range'] || '';
  var total = parseInt(contentRange.split('/')[1], 10);
  return isNaN(total) ? -1 : total;
}

// ============================
// 驗證用：核對Supabase筆數
// ============================
function 核對開店遷移結果() {
  var total = supabaseCount2_('/rest/v1/opening_gate_logs?select=id');
  var msg = 'opening_gate_logs Supabase共 ' + total + ' 筆';
  Logger.log(msg);
  return msg;
}
