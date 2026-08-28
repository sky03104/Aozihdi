// ════════════════════════════════════════════════════════════
// 天鷹保全 · 過夜車輛統計 SQL遷移【一次性歷史資料搬遷腳本】
// ────────────────────────────────────────────────────────────
// 用途：把「館內機車」「館內汽車」「新莊停車場」三個登記分頁的現有
// 資料，轉存進 Supabase 的 vehicle_overnight_logs。
//
// ⚠️ 這支要貼在 車牌辨識_後端_GAS.gs 所在的 Apps Script 專案裡
// （容器繫結腳本，getActiveSpreadsheet() 直接拿到過夜車輛登記試算表；
// 也共用該檔案已定義的 toDate_ 函式，不要重複貼一次）。
//
// 使用前置：
//   1. 先在 Supabase SQL Editor 執行 過夜車輛SQL建表.sql
//   2. 專案設定 → Script Properties 設定 SUPABASE_URL / SUPABASE_SECRET_KEY
//      （這是獨立的Apps Script專案，要重新設定一次，不會沿用其他工具那邊的）
//   3. 執行 遷移過夜車輛資料到Supabase()，看執行紀錄確認結果
//
// 不會動到 Sheets 原始資料，只讀不寫。
//
// ⚠️ 建議搬遷時機：這支跑完之後，緊接著要部署 過夜車輛_SQL讀取層.gs＋
// 更新版的 車牌辨識_後端_GAS.gs（含雙寫）。中間這段時間新登記的資料只會
// 進 Sheets、不會進 Supabase，若間隔太久會有一小段落差；建議選在登記
// 淡季（例如白天）一口氣做完「跑遷移 → 貼新版主檔 → 部署新版本」三步。
// ════════════════════════════════════════════════════════════

var VEHICLE_TYPE_LABELS_SQL_ = ['館內機車', '館內汽車', '新莊停車場'];

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

// 用 Prefer: count=exact 標頭問總筆數，不用真的把資料全撈下來
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

// 把時間欄轉成ISO timestamptz字串（欄位可能是Date物件或'yyyy-MM-dd HH:mm:ss'字串；
// toDate_ 沿用 車牌辨識_後端_GAS.gs 已定義的版本，兩種都能處理）
function 轉為ISO時間戳_過夜車輛_(v) {
  var d = toDate_(v);
  if (!d) return null;
  return Utilities.formatDate(d, 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// ============================
// 搬遷單一分頁
// ============================
function 遷移過夜車輛分頁_(typeLabel) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(typeLabel);
  if (!sheet) return { rows: [], skippedEmpty: 0, notFound: true };
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rows: [], skippedEmpty: 0 };

  var data = sheet.getRange(2, 1, lastRow - 1, 4).getValues(); // 時間/類型/車牌/登記人
  var rows = [];
  var skippedEmpty = 0;
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var plate = String(row[2] || '').trim();
    if (!plate) { skippedEmpty++; continue; }
    var createdAt = 轉為ISO時間戳_過夜車輛_(row[0]);
    if (!createdAt) { skippedEmpty++; continue; } // 時間格式看不懂，寧可跳過也不要亂猜
    rows.push({
      type_label: String(row[1] || typeLabel),
      plate: plate,
      operator: String(row[3] || ''),
      created_at: createdAt
    });
  }
  return { rows: rows, skippedEmpty: skippedEmpty };
}

// ============================
// 診斷用：這個專案實際綁定的是哪份試算表、有哪些分頁
// ============================
function 診斷目前試算表_過夜車輛() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return '這個專案沒有綁定任何試算表（getActiveSpreadsheet()回傳null）';
  var names = ss.getSheets().map(function (s) { return s.getName() + '（gid=' + s.getSheetId() + '）'; });
  var msg = '試算表名稱：' + ss.getName() + '\n試算表ID：' + ss.getId() + '\n分頁清單：\n' + names.join('\n');
  Logger.log(msg);
  return msg;
}

// ============================
// 主流程
// ⚠️ 執行前會檢查Supabase是否已有資料，避免重複執行造成重複灌資料。
//    真的要重跑，先到Supabase SQL Editor執行
//    truncate table vehicle_overnight_logs restart identity; 再跑這支。
// ============================
function 遷移過夜車輛資料到Supabase() {
  var existing = supabaseCount_('/rest/v1/vehicle_overnight_logs?select=id');
  if (existing > 0) {
    throw new Error('vehicle_overnight_logs 已有 ' + existing + ' 筆資料，為避免重複灌資料已中止。'
      + '若確定要重跑，請先在Supabase SQL Editor執行 truncate table vehicle_overnight_logs restart identity; 再重新執行這支。');
  }
  var 結果 = [];
  var allRows = [];
  for (var t = 0; t < VEHICLE_TYPE_LABELS_SQL_.length; t++) {
    var typeLabel = VEHICLE_TYPE_LABELS_SQL_[t];
    var r = 遷移過夜車輛分頁_(typeLabel);
    if (r.notFound) { 結果.push(typeLabel + '：找不到這個分頁，跳過'); continue; }
    allRows = allRows.concat(r.rows);
    結果.push(typeLabel + '：讀到' + (r.rows.length + r.skippedEmpty) + '列，略過' + r.skippedEmpty + '筆，待寫入' + r.rows.length + '筆');
  }
  var inserted = 批次寫入_('/rest/v1/vehicle_overnight_logs', allRows);
  結果.push('實際寫入Supabase共 ' + inserted + ' 筆');
  var msg = 結果.join('\n');
  Logger.log(msg);
  return msg;
}

// ============================
// 驗證用：核對Supabase筆數
// ============================
function 核對過夜車輛遷移結果() {
  var total = supabaseCount_('/rest/v1/vehicle_overnight_logs?select=id');
  var msg = 'vehicle_overnight_logs Supabase共 ' + total + ' 筆';
  Logger.log(msg);
  return msg;
}
