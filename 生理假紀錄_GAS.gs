// ============================
// 生理假紀錄 — 獨立 GAS（天鷹保全）
// 綁定試算表：生理假紀錄（新建，見下方部署說明）
// 分頁：紀錄（主資料，找不到會自動建立）
// 欄位：A ID | B 日期 | C 工號 | D 姓名 | E 天數(1=全天 0.5=半天) | F 班別
//       | G 備註 | H 登記人工號 | I 登記人姓名 | J 登記時間
// 主鍵：純數字流水號（既有最大ID+1；支援刪除列，故不可用列號產生，否則會重號）
//
// ⚠️ 本表存的是女性員工的健康相關資料，在個資法屬「特種個資」。
//    權限：副隊長以上（vicecaptain/captain/executive/admin），三層把關——
//    index.html DEFAULT_PERMS 決定看不看得到入口、tool_menstrual.html 前端擋、
//    本檔每個 action 再驗一次 token+角色（前兩層都在使用者的瀏覽器裡，
//    改得掉，後端這層才是真的）。
//
// ── 部署 ──────────────────────────────────────────────────────
// 1. Google Drive 新建一份空白試算表，複製它的 ID
//    （網址 https://docs.google.com/spreadsheets/d/【這一段】/edit）
// 2. 把下面 SPREADSHEET_ID 換成剛剛複製的 ID
// 3. 部署 → 新增部署 → 類型「網路應用程式」，執行身分「我」，存取權限「所有人」
// 4. 複製部署網址，填入 tool_menstrual.html 的 LEAVE_GAS_URL 變數
// 5. 之後改動：部署 → 管理部署作業 → 編輯(鉛筆) → 版本「新版本」
//    （不要「新增部署」，網址會變，前端全斷）
// ============================

var SPREADSHEET_ID = '請填入試算表ID'; // ← 部署前務必替換
var SHEET_NAME = '紀錄';
var TZ = 'Asia/Taipei';

// 主 App（天鷹保全APP_後端_GAS.gs）部署網址，用來驗證登入通行證
var MAIN_APP_GAS_URL_ = 'https://script.google.com/macros/s/AKfycbxEVBHseDpLWiWe4d8kLcCHbVFiKAK9wyoLwqNkt59PS4vPCY9QfG0_wiDJf2coO3zMcg/exec';

// 允許使用本工具的角色：副隊長以上
var VICE_PLUS_ROLES_ = ['vicecaptain', 'captain', 'executive', 'admin'];

var HEADERS_ = ['ID', '日期', '工號', '姓名', '天數', '班別', '備註',
                '登記人工號', '登記人姓名', '登記時間'];

/**
 * 驗證通行證，通過回傳 { empId, name, role, ... }，不通過回傳 null。
 * 通行證由主 App 登入時發放，這裡沒有簽章金鑰，直接請主 App 幫忙確認
 * （跟缺班調班紀錄/緊急聯絡清單等 GAS 同做法）。
 */
function verifyAuthToken_(token) {
  if (!token) return null;
  try {
    var res = UrlFetchApp.fetch(MAIN_APP_GAS_URL_, {
      method: 'post',
      payload: { action: 'verifySession', data: JSON.stringify({ token: token }) },
      muteHttpExceptions: true
    });
    var d = JSON.parse(res.getContentText());
    if (d.status !== 'ok' || !d.user || !d.user.empId) return null;
    return d.user;
  } catch (err) {
    return null;
  }
}

// 驗證通行證＋角色需副隊長以上，通過回傳使用者物件，不通過回傳 null
function requireVicePlus_(token) {
  var user = verifyAuthToken_(token);
  if (!user) return null;
  if (VICE_PLUS_ROLES_.indexOf(user.role) === -1) return null;
  return user;
}

function jsonRes_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS_.length).setValues([HEADERS_])
      .setFontWeight('bold').setBackground('#1A2340').setFontColor('#D4A800');
    sh.setFrozenRows(1);
    sh.setColumnWidth(2, 110); // 日期
    sh.setColumnWidth(4, 100); // 姓名
    sh.setColumnWidth(7, 220); // 備註
  }
  return sh;
}

/* 純數字流水號主鍵。
   ⚠️ 一定要用 isFinite 過濾，不能只用 !isNaN——isNaN(Infinity) 是 false，
   Infinity 會被當成合法數字放行，之後 max+1 還是 Infinity，寫回試算表
   會變成 #NUM! 而且永久復發（2026-08-08 打烊工具真的踩過，見技術經驗筆記）。 */
function nextId_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return 1;
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < vals.length; i++) {
    var raw = vals[i][0];
    if (typeof raw !== 'number' || !isFinite(raw)) continue;
    var n = Math.floor(raw);
    if (n > 0 && n <= 10000000 && n > max) max = n;
  }
  return max + 1;
}

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v == null ? '' : v).trim();
}

// ============================
// 讀取
// ============================
function doGet(e) {
  var action = (e && e.parameter) ? e.parameter.action : '';
  var token = (e && e.parameter) ? e.parameter.token : '';

  if (action === 'getRecords') {
    var user = requireVicePlus_(token);
    if (!user) return jsonRes_({ status: 'error', msg: '權限不足或登入已失效' });
    try {
      var sh = getSheet_();
      var last = sh.getLastRow();
      if (last < 2) return jsonRes_({ status: 'ok', records: [] });
      var data = sh.getRange(2, 1, last - 1, HEADERS_.length).getValues();
      var out = [];
      for (var i = 0; i < data.length; i++) {
        var r = data[i];
        if (!r[0] && !r[2]) continue; // 整列空白跳過
        out.push({
          id: r[0], date: fmtDate_(r[1]), empId: String(r[2] || '').trim(),
          name: String(r[3] || '').trim(), days: Number(r[4]) || 0,
          shift: String(r[5] || '').trim(), note: String(r[6] || '').trim(),
          byEmpId: String(r[7] || '').trim(), byName: String(r[8] || '').trim(),
          createdAt: fmtDate_(r[9])
        });
      }
      return jsonRes_({ status: 'ok', records: out });
    } catch (err) {
      return jsonRes_({ status: 'error', msg: err.message });
    }
  }

  return jsonRes_({ status: 'ok', msg: '天鷹保全 生理假紀錄 API 正常 ✓' });
}

// ============================
// 寫入／刪除
// ============================
function doPost(e) {
  try {
    var action = e.parameter.action || '';
    var token = e.parameter.token || '';
    var data = {};
    try { data = JSON.parse(e.parameter.data || '{}'); } catch (err) { data = {}; }

    var user = requireVicePlus_(token);
    if (!user) return jsonRes_({ status: 'error', msg: '權限不足或登入已失效' });

    if (action === 'addRecord')    return addRecord_(data, user);
    if (action === 'updateRecord') return updateRecord_(data, user);
    if (action === 'deleteRecord') return deleteRecord_(data, user);
    return jsonRes_({ status: 'error', msg: '未知動作: ' + action });
  } catch (err) {
    return jsonRes_({ status: 'error', msg: err.message });
  }
}

function addRecord_(d, user) {
  var date = String(d.date || '').trim();
  var empId = String(d.empId || '').trim();
  var name = String(d.name || '').trim();
  var days = Number(d.days);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonRes_({ status: 'error', msg: '日期格式需為 YYYY-MM-DD' });
  if (!empId || !name) return jsonRes_({ status: 'error', msg: '請選擇員工' });
  if (!(days === 1 || days === 0.5)) return jsonRes_({ status: 'error', msg: '天數只能是 1（全天）或 0.5（半天）' });

  var sh = getSheet_();
  // 同一人同一天不重複登記（大量點擊或兩個幹部同時登記都擋得住）
  var last = sh.getLastRow();
  if (last >= 2) {
    var exist = sh.getRange(2, 2, last - 1, 2).getValues(); // B日期 C工號
    for (var i = 0; i < exist.length; i++) {
      if (fmtDate_(exist[i][0]) === date && String(exist[i][1] || '').trim() === empId) {
        return jsonRes_({ status: 'error', msg: name + ' 在 ' + date + ' 已經有一筆紀錄了' });
      }
    }
  }

  var id = nextId_(sh);
  sh.appendRow([id, date, empId, name, days, String(d.shift || '').trim(),
                String(d.note || '').trim(), user.empId, user.name || '',
                Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss')]);
  return jsonRes_({ status: 'ok', id: id });
}

function updateRecord_(d, user) {
  var id = Number(d.id);
  if (!id) return jsonRes_({ status: 'error', msg: '缺少紀錄 ID' });
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last < 2) return jsonRes_({ status: 'error', msg: '找不到該筆紀錄' });
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === id) {
      var row = i + 2;
      if (d.days != null) {
        var days = Number(d.days);
        if (!(days === 1 || days === 0.5)) return jsonRes_({ status: 'error', msg: '天數只能是 1 或 0.5' });
        sh.getRange(row, 5).setValue(days);
      }
      if (d.shift != null) sh.getRange(row, 6).setValue(String(d.shift).trim());
      if (d.note != null)  sh.getRange(row, 7).setValue(String(d.note).trim());
      return jsonRes_({ status: 'ok' });
    }
  }
  return jsonRes_({ status: 'error', msg: '找不到該筆紀錄' });
}

function deleteRecord_(d, user) {
  var id = Number(d.id);
  if (!id) return jsonRes_({ status: 'error', msg: '缺少紀錄 ID' });
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last < 2) return jsonRes_({ status: 'error', msg: '找不到該筆紀錄' });
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === id) {
      sh.deleteRow(i + 2);
      return jsonRes_({ status: 'ok' });
    }
  }
  return jsonRes_({ status: 'error', msg: '找不到該筆紀錄' });
}
