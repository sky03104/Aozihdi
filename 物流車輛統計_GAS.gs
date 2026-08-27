// ============================
// 物流車輛統計 — 獨立 GAS（天鷹保全）
// 綁定試算表：物流車輛統計
// 分頁：物流車輛紀錄（已搬遷至Supabase logistics_records，Sheets不再是權威來源，
//       僅exportMonth寫入月統計分頁時使用）、快捷設定（管理員設定的快捷組合，
//       量小固定未搬遷，仍在Sheets）
// 快捷欄位：A快捷ID | B分類 | C數量
// ============================

var SHORTCUT_SHEET = '快捷設定';
var CATEGORIES = ['1.9噸', '3.5噸', '8噸以上'];
var TZ = 'Asia/Taipei';

// ============================
// Supabase 連線（logistics_records 權威來源）
// ============================
function supabaseConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_URL');
  var key = props.getProperty('SUPABASE_SECRET_KEY');
  if (!url || !key) throw new Error('請先在「專案設定 → Script Properties」設定 SUPABASE_URL 與 SUPABASE_SECRET_KEY');
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

// Supabase單次GET預設上限1000筆，一整個月的資料量可能超過，用Range分頁抓到全部
function supabaseRequestAll_(path) {
  var cfg = supabaseConfig_();
  var headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  var all = [];
  var offset = 0;
  var PAGE = 1000;
  while (true) {
    var pageHeaders = {};
    for (var k in headers) pageHeaders[k] = headers[k];
    pageHeaders.Range = offset + '-' + (offset + PAGE - 1);
    var resp = UrlFetchApp.fetch(cfg.url + path, { method: 'get', headers: pageHeaders, muteHttpExceptions: true });
    var code = resp.getResponseCode();
    if (code >= 400) throw new Error('Supabase請求失敗（' + code + '）：' + resp.getContentText() + '｜path=' + path);
    var chunk = JSON.parse(resp.getContentText() || '[]');
    all = all.concat(chunk);
    if (chunk.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

function doPost(e) {
  try {
    var action = e.parameter.action || '';
    if (action === 'add')            return addRecord(e);
    if (action === 'update')         return updateRecord(e);
    if (action === 'delete')         return deleteRecord(e);
    if (action === 'exportMonth')    return exportMonth(e);
    if (action === 'addShortcut')    return addShortcut(e);
    if (action === 'updateShortcut') return updateShortcut(e);
    if (action === 'deleteShortcut') return deleteShortcut(e);
    return jsonRes({ status: 'error', msg: '未知動作: ' + action });
  } catch (err) {
    return jsonRes({ status: 'error', msg: err.toString() });
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter) ? (e.parameter.action || '') : '';
    if (action === 'getDay')       return getDay(e);
    if (action === 'getMonth')     return getMonth(e);
    if (action === 'getShortcuts') return getShortcuts();
    return jsonRes({ status: 'ok', msg: '天鷹保全 物流車輛統計 API 正常 ✓' });
  } catch (err) {
    return jsonRes({ status: 'error', msg: err.toString() });
  }
}

// 新增登記：登記時間一律伺服器端「送出當下」，寫入Supabase（bigserial主鍵，
// 不需要再自己管理流水號快取跟鎖，Postgres自己保證唯一不重複）
function addRecord(e) {
  var category = String(e.parameter.category || '').trim();
  if (CATEGORIES.indexOf(category) === -1) {
    return jsonRes({ status: 'error', msg: '分類無效: ' + category });
  }
  var count = parseInt(e.parameter.count, 10);
  if (isNaN(count) || count < 1 || count > 999) {
    return jsonRes({ status: 'error', msg: '數量無效（需 1~999）' });
  }
  var empId = String(e.parameter.empId || '').trim();
  var name  = String(e.parameter.name || '').trim();
  var now = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");

  var inserted = supabaseRequest_('post', '/rest/v1/logistics_records', [{
    category: category, count: count, emp_id: empId, emp_name: name, created_at: now
  }], { Prefer: 'return=representation' });

  return jsonRes({ status: 'ok', id: inserted[0].id });
}

// 修改數量（Supabase id定位）
function updateRecord(e) {
  var id = parseInt(e.parameter.id, 10);
  if (isNaN(id)) return jsonRes({ status: 'error', msg: '找不到該筆紀錄' });
  var count = parseInt(e.parameter.count, 10);
  if (isNaN(count) || count < 1 || count > 999) {
    return jsonRes({ status: 'error', msg: '數量無效（需 1~999）' });
  }
  supabaseRequest_('patch', '/rest/v1/logistics_records?id=eq.' + id, { count: count });
  return jsonRes({ status: 'ok' });
}

// 刪除紀錄（Supabase id定位）
function deleteRecord(e) {
  var id = parseInt(e.parameter.id, 10);
  if (isNaN(id)) return jsonRes({ status: 'error', msg: '找不到該筆紀錄' });
  supabaseRequest_('delete', '/rest/v1/logistics_records?id=eq.' + id);
  return jsonRes({ status: 'ok' });
}

function 算日範圍_(dateStr) {
  var p = String(dateStr || '').split('-');
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, d = parseInt(p[2], 10);
  return {
    start: new Date(y, m, d, 0, 0, 0),
    end: new Date(y, m, d + 1, 0, 0, 0)
  };
}

function 算月範圍_(year, month) {
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0),
    end: new Date(year, month, 1, 0, 0, 0)
  };
}

function fmtISO_(d) {
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// 讀單日：?action=getDay&date=YYYY-MM-DD → 逐筆 + 各分類合計，改讀Supabase
function getDay(e) {
  var key = dateKey_(e.parameter.date);
  if (!key) return jsonRes({ status: 'error', msg: '日期格式無效（需 YYYY-MM-DD）' });

  var range = 算日範圍_(e.parameter.date);
  var path = '/rest/v1/logistics_records'
    + '?created_at=gte.' + encodeURIComponent(fmtISO_(range.start))
    + '&created_at=lt.' + encodeURIComponent(fmtISO_(range.end))
    + '&order=created_at.desc';
  var supaRows = supabaseRequestAll_(path);

  var rows = [];
  var totals = { '1.9噸': 0, '3.5噸': 0, '8噸以上': 0 };
  supaRows.forEach(function (r) {
    rows.push({
      id: r.id,
      time: Utilities.formatDate(new Date(r.created_at), TZ, 'HH:mm'),
      category: r.category,
      count: r.count,
      empId: r.emp_id || '',
      name: r.emp_name || ''
    });
    if (totals.hasOwnProperty(r.category)) totals[r.category] += r.count;
  });
  return jsonRes({ status: 'ok', date: key, rows: rows, totals: totals });
}

// 讀整月：?action=getMonth&month=YYYY-MM → 每日 × 三分類彙總，改讀Supabase
function getMonth(e) {
  var m = monthParts_(e.parameter.month);
  if (!m) return jsonRes({ status: 'error', msg: '月份格式無效（需 YYYY-MM）' });
  var agg = aggregateMonth_(m.year, m.month);
  return jsonRes({ status: 'ok', month: e.parameter.month, days: agg.days, totals: agg.totals });
}

// 產生試算表月統計分頁：action=exportMonth&month=YYYY-MM（資料來源Supabase，寫入邏輯不變）
function exportMonth(e) {
  var m = monthParts_(e.parameter.month);
  if (!m) return jsonRes({ status: 'error', msg: '月份格式無效（需 YYYY-MM）' });
  var agg = aggregateMonth_(m.year, m.month);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = e.parameter.month + ' 月統計';
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) sheet.clear(); else sheet = ss.insertSheet(sheetName);

  var out = [['日期', '1.9噸', '3.5噸', '8噸以上', '合計']];
  for (var i = 0; i < agg.days.length; i++) {
    var d = agg.days[i];
    out.push([m.month + '/' + d.day, d.t19, d.t35, d.t80, d.sum]);
  }
  out.push(['合計', agg.totals.t19, agg.totals.t35, agg.totals.t80, agg.totals.sum]);
  sheet.getRange(1, 1, out.length, 5).setValues(out);
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  sheet.getRange(out.length, 1, 1, 5).setFontWeight('bold');
  return jsonRes({ status: 'ok', sheetName: sheetName });
}

// 整月彙總（含沒資料的日子，補 0 方便交報表），改讀Supabase一次查整月範圍本地端彙總
function aggregateMonth_(year, month) {
  var daysInMonth = new Date(year, month, 0).getDate();
  var range = 算月範圍_(year, month);

  var path = '/rest/v1/logistics_records'
    + '?created_at=gte.' + encodeURIComponent(fmtISO_(range.start))
    + '&created_at=lt.' + encodeURIComponent(fmtISO_(range.end))
    + '&order=created_at.asc';
  var supaRows = supabaseRequestAll_(path);

  var map = {};
  supaRows.forEach(function (r) {
    var localDay = Number(Utilities.formatDate(new Date(r.created_at), TZ, 'd'));
    if (!map[localDay]) map[localDay] = { t19: 0, t35: 0, t80: 0 };
    if (r.category === '1.9噸') map[localDay].t19 += r.count;
    else if (r.category === '3.5噸') map[localDay].t35 += r.count;
    else if (r.category === '8噸以上') map[localDay].t80 += r.count;
  });

  var days = [];
  var totals = { t19: 0, t35: 0, t80: 0, sum: 0 };
  for (var d = 1; d <= daysInMonth; d++) {
    var v = map[d] || { t19: 0, t35: 0, t80: 0 };
    var sum = v.t19 + v.t35 + v.t80;
    days.push({ day: d, t19: v.t19, t35: v.t35, t80: v.t80, sum: sum });
    totals.t19 += v.t19; totals.t35 += v.t35; totals.t80 += v.t80; totals.sum += sum;
  }
  return { days: days, totals: totals };
}

// ══════════════════════════════
// 快捷組合（管理員在工具「設定」頁管理，全員登記頁顯示一鍵送出）
// 存「快捷設定」分頁，與主資料分開
// ══════════════════════════════

// 取得（或自動建立）快捷設定分頁
function getShortcutSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHORTCUT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SHORTCUT_SHEET);
    sheet.getRange(1, 1, 1, 3).setValues([['快捷ID', '分類', '數量']]);
  }
  return sheet;
}

// 快捷清單（全員可讀）
function getShortcuts() {
  var sheet = getShortcutSheet_();
  var lastRow = sheet.getLastRow();
  var list = [];
  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === '' && data[i][1] === '') continue; // 略過空列
      list.push({
        id: data[i][0],
        category: String(data[i][1]),
        count: parseInt(data[i][2], 10) || 0
      });
    }
  }
  return jsonRes({ status: 'ok', shortcuts: list });
}

// 驗證快捷參數（分類白名單、數量 1~999），錯誤回訊息字串、正確回 null
function validateShortcut_(e) {
  var category = String(e.parameter.category || '').trim();
  if (CATEGORIES.indexOf(category) === -1) return '分類無效: ' + category;
  var count = parseInt(e.parameter.count, 10);
  if (isNaN(count) || count < 1 || count > 999) return '數量無效（需 1~999）';
  return null;
}

// 新增快捷
function addShortcut(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var err = validateShortcut_(e);
    if (err) return jsonRes({ status: 'error', msg: err });
    var sheet = getShortcutSheet_();
    var id = nextId_(sheet);
    sheet.appendRow([id, String(e.parameter.category).trim(), parseInt(e.parameter.count, 10)]);
    commitNextId_(sheet, id);
    return jsonRes({ status: 'ok', id: id });
  } finally {
    lock.releaseLock();
  }
}

// 修改快捷（分類＋數量）
function updateShortcut(e) {
  var err = validateShortcut_(e);
  if (err) return jsonRes({ status: 'error', msg: err });
  var sheet = getShortcutSheet_();
  var row = findRowById_(sheet, e.parameter.id);
  if (row < 0) return jsonRes({ status: 'error', msg: '找不到該快捷' });
  sheet.getRange(row, 2, 1, 2).setValues([[String(e.parameter.category).trim(), parseInt(e.parameter.count, 10)]]);
  return jsonRes({ status: 'ok' });
}

// 刪除快捷
function deleteShortcut(e) {
  var sheet = getShortcutSheet_();
  var row = findRowById_(sheet, e.parameter.id);
  if (row < 0) return jsonRes({ status: 'error', msg: '找不到該快捷' });
  sheet.deleteRow(row);
  return jsonRes({ status: 'ok' });
}

// 主鍵：Script Properties 快取下一個可用ID（O(1)），沒快取時才全表掃描重建一次。
// 快捷設定量小固定未搬遷Supabase，維持原本的Sheets流水號機制。
function nextId_(sheet) {
  var props = PropertiesService.getScriptProperties();
  var key = 'NEXT_ID_' + sheet.getSheetId();
  var cached = parseInt(props.getProperty(key), 10);
  if (!isNaN(cached) && cached > 0) return cached;

  var lastRow = sheet.getLastRow();
  var max = 0;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var n = parseInt(ids[i][0], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

// 寫入成功後才呼叫：把快取推到下一格。刪除紀錄不會讓快取倒退，故 ID 永不重複使用
function commitNextId_(sheet, id) {
  PropertiesService.getScriptProperties().setProperty('NEXT_ID_' + sheet.getSheetId(), String(id + 1));
}

// 以紀錄ID找列號（找不到回 -1）
function findRowById_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

// ── 工具函數 ──

// 'YYYY-MM-DD' → 'yyyy/M/d'（與試算表儲存格式一致）
function dateKey_(iso) {
  var p = String(iso || '').split('-');
  if (p.length !== 3) return '';
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  return y + '/' + m + '/' + d;
}

// 'YYYY-MM' → {year, month}
function monthParts_(s) {
  var p = String(s || '').split('-');
  if (p.length !== 2) return null;
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

function jsonRes(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
