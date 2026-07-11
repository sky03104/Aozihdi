// ================================================================
// 天鷹保全 哨表上傳工具 - Google Apps Script v6
// 目標試算表 ID：1sIcdAhw0mz5iM3F5fulDNPOda2pv-t7xUhT6XXf9X7Q
// 部署：執行身分=我、存取=所有人（不需要 Drive API）
// ================================================================

var GUARD_SS_ID = '1sIcdAhw0mz5iM3F5fulDNPOda2pv-t7xUhT6XXf9X7Q';
var HOLIDAY_API = 'https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/';
var HISTORY_SHEET_NAME = '歷史哨表';

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.action === 'guardUpload') return handleGuardUpload(payload);
    throw new Error('未知 action');
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function doGet(e) {
  return respond({ success: true, status: 'online' });
}

// ================================================================
// 主流程
// ================================================================
function handleGuardUpload(payload) {
  var targetSheet = payload.targetSheet;
  var year        = parseInt(payload.year);
  var month       = parseInt(payload.month);
  var day         = parseInt(payload.day);
  var weekday     = payload.weekday;
  var rows        = payload.rows;
  var styles      = payload.styles;
  var merges      = payload.merges;
  var colWidths   = payload.colWidths;

  if (!rows || !rows.length) throw new Error('未收到資料，請重試');

  var isHoliday = checkIsHoliday(year, month, day);
  var tgtSs = SpreadsheetApp.openById(GUARD_SS_ID);

  writeGuardSheet(tgtSs, targetSheet, rows, styles, merges, colWidths);
  updateHistorySheet(tgtSs, year, month, day, weekday, isHoliday, rows);

  SpreadsheetApp.flush();

  return respond({
    success: true,
    targetSheet: targetSheet,
    isHoliday: isHoliday,
    date: year + '/' + p2(month) + '/' + p2(day) + ' 星期' + weekday
  });
}

// ================================================================
// 寫入今日/明日哨表（只寫值，完全不動格式）
// ================================================================
function writeGuardSheet(tgtSs, sheetName, rows, styles, merges, colWidths) {
  var tgt = tgtSs.getSheetByName(sheetName);
  if (!tgt) {
    // 分頁不存在才新建（請在試算表手動設定好格式後再使用）
    tgt = tgtSs.insertSheet(sheetName);
  }

  var numRows = rows.length;
  var numCols = rows[0] ? rows[0].length : 1;

  // 僅寫入值，框線/顏色/合併格/欄寬全部不動
  tgt.getRange(1, 1, numRows, numCols).setValues(rows);
}

// ================================================================
// 歷史哨表（單一分頁，所有日期集中存放，純文字便於 App 查詢）
// 格式：日期 | 星期 | 假日 | 班別 | 哨位 | 姓名 | 時間
// ================================================================
function updateHistorySheet(tgtSs, year, month, day, weekday, isHoliday, rows) {
  var dateStr = year + '/' + p2(month) + '/' + p2(day);
  var hist = tgtSs.getSheetByName(HISTORY_SHEET_NAME);

  // 建立分頁（若不存在）
  if (!hist) {
    hist = tgtSs.insertSheet(HISTORY_SHEET_NAME);
    hist.getRange(1, 1, 1, 7).setValues([['日期', '星期', '假日', '班別', '哨位', '姓名', '時間']])
      .setFontWeight('bold').setBackground('#1A2340').setFontColor('#D4A800');
    hist.setFrozenRows(1);
    hist.setColumnWidth(1, 100); hist.setColumnWidth(2, 60);
    hist.setColumnWidth(3, 60);  hist.setColumnWidth(4, 90);
    hist.setColumnWidth(5, 130); hist.setColumnWidth(6, 90);
    hist.setColumnWidth(7, 110);
    // 強制整欄格式為純文字（避免日期自動轉換）
    hist.getRange('A:A').setNumberFormat('@');
  }

  // 刪除該日期的舊記錄（避免重複）
  var lastRow = hist.getLastRow();
  if (lastRow > 1) {
    // 一次讀取所有 A 欄，避免多次讀取
    var dateCol = hist.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    var toDelete = [];
    for (var i = dateCol.length - 1; i >= 0; i--) {
      // 用 displayValues 確保讀取到文字格式
      if (String(dateCol[i][0]).trim() === dateStr) {
        toDelete.push(i + 2); // 1-indexed，從第2列開始
      }
    }
    // 從大到小刪（避免行號偏移）
    toDelete.sort(function(a, b){ return b - a; });
    for (var d = 0; d < toDelete.length; d++) {
      hist.deleteRow(toDelete[d]);
    }
  }

  // 解析人員
  var records = [];
  var maxRow = rows.length;
  var holidayText = isHoliday ? '假日' : '平日';

  // 帶隊幹部（C3, L3 或 I3）
  if (rows[2]) {
    var el = pName(rows[2][2]);
    var nl = pName(rows[2][11]) || pName(rows[2][8]);
    if (el) records.push([dateStr, weekday, holidayText, '早班', '帶隊幹部', el.name, el.time]);
    if (nl) records.push([dateStr, weekday, holidayText, '晚班', '帶隊幹部', nl.name, nl.time]);
  }

  // 各哨位（列4起）
  for (var r = 3; r < maxRow; r++) {
    var row = rows[r];
    if (!row) continue;
    var ep = cText(row[1]); var ep2 = pName(row[2]);
    var eep = cText(row[4]); var eep2 = pName(row[5]);
    var np = cText(row[8]); var np2 = pName(row[9]);
    var nep = cText(row[12]); var nep2 = pName(row[13]);
    if (ep && ep2)   records.push([dateStr, weekday, holidayText, '早班', ep, ep2.name, ep2.time]);
    if (eep && eep2) records.push([dateStr, weekday, holidayText, '早班(增派)', eep, eep2.name, eep2.time]);
    if (np && np2)   records.push([dateStr, weekday, holidayText, '晚班', np, np2.name, np2.time]);
    if (nep && nep2) records.push([dateStr, weekday, holidayText, '晚班(增派)', nep, nep2.name, nep2.time]);
  }

  // 去重
  var seen = {}, filtered = [];
  for (var i = 0; i < records.length; i++) {
    if (!records[i][5]) continue;
    var key = records[i].join('|');
    if (!seen[key]) { seen[key] = true; filtered.push(records[i]); }
  }

  if (!filtered.length) return dateStr;

  // 追加到末尾
  var insertRow = hist.getLastRow() + 1;
  var dataRange = hist.getRange(insertRow, 1, filtered.length, 7);
  dataRange.setValues(filtered);
  // 強制 A 欄為純文字，避免日期被 Sheets 轉換
  hist.getRange(insertRow, 1, filtered.length, 1).setNumberFormat('@');

  // 上色
  for (var j = 0; j < filtered.length; j++) {
    var band = filtered[j][3];
    var rng  = hist.getRange(insertRow + j, 1, 1, 7);
    if      (band === '早班')       rng.setBackground('#E8F4FF').setFontColor('#1a1a2e');
    else if (band === '早班(增派)') rng.setBackground('#D0EAFF').setFontColor('#003366');
    else if (band === '晚班')       rng.setBackground('#1A1F2E').setFontColor('#D1D5DB');
    else if (band === '晚班(增派)') rng.setBackground('#0F1520').setFontColor('#A5B4FC');
  }

  return dateStr;
}

// ================================================================
// 假日判定
// ================================================================
function checkIsHoliday(year, month, day) {
  try {
    var res = UrlFetchApp.fetch(HOLIDAY_API + year + '.json', { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return false;
    var data    = JSON.parse(res.getContentText());
    var dateStr = '' + year + p2(month) + p2(day);
    for (var i = 0; i < data.length; i++) {
      if (data[i].date === dateStr)
        return data[i].isHoliday === true || data[i].isHoliday === 'true';
    }
    return false;
  } catch(e) { return false; }
}

// ================================================================
// 工具函式
// ================================================================
function buildMatrix(rows, cols, val) {
  var arr = [];
  for (var r = 0; r < rows; r++) {
    var row = [];
    for (var c = 0; c < cols; c++) row.push(val);
    arr.push(row);
  }
  return arr;
}

function p2(n)    { return n < 10 ? '0'+n : String(n); }
function cText(v) { return v ? String(v).replace(/\n/g,' ').replace(/\s+/g,' ').trim() : ''; }
function pName(v) {
  if (!v || !String(v).trim()) return null;
  var s = String(v).trim();
  if (s.indexOf('人員:')>-1 || s.indexOf('帶隊幹部 :')>-1 ||
      s==='早班' || s==='晚班' || s==='姓名' || s==='哨位') return null;
  var lines = s.split('\n');
  var name  = lines[0].replace(/^\s*帶隊幹部\s*[:：]\s*/,'').trim();
  var time  = lines.length > 1 ? lines[1].trim() : '';
  if (!name || name.length < 2) return null;
  return { name: name, time: time };
}
function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
