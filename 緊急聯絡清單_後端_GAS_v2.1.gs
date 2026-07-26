// ============================================================
// 天鷹保全 · 漢神巨蛋 · 緊急聯絡清單 Google Apps Script Web App
// 版本：2.1  更新：getContacts / setContacts 加上身分驗證
//   （2026-07-26 前是任何人拿到這支網址就能讀寫全體同仁與家屬電話，
//    這版改成必須帶主 App 登入後發的通行證(token)才能呼叫）
// Spreadsheet ID: 1TnN3iJb1w9XTuw0-QuNrtXEOa71KCCy7y8Q3_1b1FmI
//
// ⚠ 部署新版本後，就算重新部署也不會生效！getContacts/setContacts 改用
//   UrlFetchApp 呼叫主 App 驗證通行證，這是「連上外部服務」的權限，跟
//   Sheet 讀寫是不同的授權範圍，第一次用到時 Google 不會自動彈出同意視窗、
//   也不會在部署當下觸發，只會在腳本編輯器裡「手動執行一次函式」時觸發。
//   部署完後，請在 Apps Script 編輯器選擇 forceAuth 函式並執行一次、
//   跳出授權視窗後同意，之後 getContacts/setContacts 才會真的能用；
//   沒跑這步的話，任何通行證（包含真的）都會被誤判成「登入已失效」。
// ============================================================

/**
 * 部署新版本後手動執行一次，觸發「連上外部服務」的授權同意視窗。
 * 不用重新部署，跑一次、同意權限即可。
 */
function forceAuth() {
  var authTestResult = verifyAuthToken_('auth-test-dummy-token');
  console.log('UrlFetchApp 測試呼叫完成（回傳 ' + (authTestResult ? '有效使用者' : 'null，正常，假token本來就驗不過') + '）');
  console.log('授權測試成功！外部連線權限已授權，getContacts/setContacts 現在可以正常驗證通行證了');
}

// ============================
// 身分驗證：呼叫主 App 的 GAS 驗證通行證
// ============================
var MAIN_APP_GAS_URL_ = 'https://script.google.com/macros/s/AKfycbxEVBHseDpLWiWe4d8kLcCHbVFiKAK9wyoLwqNkt59PS4vPCY9QfG0_wiDJf2coO3zMcg/exec';

// 允許編輯（setContacts）的角色，跟前端 tool_emergency.html 的 CAN_EDIT 一致
var CAN_EDIT_ROLES_ = ['leader','vicecaptain','captain','executive','admin'];

/**
 * 驗證通行證，通過回傳 { empId, name, role, dept, status, shift }，不通過回傳 null。
 * 通行證由主 App 登入時發放，這裡不重簽也不解密，直接請主 App 幫忙確認。
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

// ============================
// POST 入口
// ============================
function doPost(e) {
  try {
    var action = e.parameter.action || '';

    // 共用資料庫：寫入
    if (action === 'setDB') {
      return setDB(e.parameter.db);
    }

    // 【新】緊急聯絡清單：寫入（需登入 + 組長以上權限）
    if (action === 'setContacts') {
      return setContacts(e.parameter.contacts, e.parameter.token);
    }

    // 補填退場時間
    if (action === 'updateExit') {
      return updateExitTime(e);
    }

    // 刪除紀錄
    if (action === 'deleteRow') {
      return deleteRow(e);
    }

    // 一般進出資料寫入
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetNm = e.parameter.sheetName || '進出資料表';
    var sheet = ss.getSheetByName(sheetNm);
    if (!sheet) return jsonRes({status:'error', msg:'找不到分頁: '+sheetNm});

    var rows = JSON.parse(e.parameter.rows);
    var now = new Date();
    var added = 0;

    rows.forEach(function(r) {
      var shopCode = getOrCreateShopCode(ss, r.shop, r.floor);
      var nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, 12).setValues([[
        genId(),
        shopCode,
        r.floor || '',
        r.shop || '',
        parseInt(r.count) || 1,
        r.supervisor || '',
        r.entryTime || '',
        r.location || '',
        r.workType || '',
        r.exitTime || '',
        r.inspector || '',
        now
      ]]);
      // L欄格式 yyyy/M/d HH:mm:ss，底層仍是數值，可供 FILTER 公式比較
      sheet.getRange(nextRow, 12).setNumberFormat('yyyy/M/d HH:mm:ss');
      added++;
    });

    return jsonRes({status:'ok', added:added});

  } catch(err) {
    return jsonRes({status:'error', msg:err.toString()});
  }
}

// ============================
// GET 入口
// ============================
function doGet(e) {
  var action = (e && e.parameter) ? e.parameter.action : '';

  // 今日紀錄
  if (action === 'getTodayRows') {
    return getTodayRows(e);
  }

  // 共用資料庫：讀取
  if (action === 'getDB') {
    return getDB();
  }

  // 【新】緊急聯絡清單：讀取（需登入）
  if (action === 'getContacts') {
    return getContacts(e.parameter.token);
  }

  return jsonRes({status:'ok', msg:'天鷹保全 API 正常 ✓'});
}

// ============================
// 今日紀錄：依當班時段撈資料
// 當班時段定義：
//   20:00 以後 → 今天 20:00 ~ 明天 08:00
//   08:00 以前 → 昨天 20:00 ~ 今天 08:00
// ============================
function getTodayRows(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetNm = (e && e.parameter && e.parameter.sheet) ? e.parameter.sheet : '進出資料表';
    var sheet = ss.getSheetByName(sheetNm);
    if (!sheet) return jsonRes({status:'error', msg:'找不到分頁: '+sheetNm});

    var now = new Date();
    var hour = now.getHours();
    var shiftStart, shiftEnd;

    if (hour >= 20) {
      // 今晚 20:00 ~ 明天 08:00
      shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
      shiftEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 8, 0, 0);
    } else if (hour < 8) {
      // 昨天 20:00 ~ 今天 08:00
      shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()-1, 20, 0, 0);
      shiftEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
    } else {
      // 白天（非當班）：回傳空
      return jsonRes({status:'ok', rows:[]});
    }

    var data = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var createdAt = row[11];
      if (!createdAt) continue;
      var d = new Date(createdAt);
      if (d >= shiftStart && d <= shiftEnd) {
        result.push({
          rowIndex: i + 1,
          id:        row[0],
          shopCode:  row[1],
          floor:     row[2],
          shop:      row[3],
          count:     row[4],
          supervisor:row[5],
          entryTime: row[6],
          location:  row[7],
          workType:  row[8],
          exitTime:  row[9],
          inspector: row[10],
          createdAt: Utilities.formatDate(d, 'Asia/Taipei', 'yyyy/M/d HH:mm:ss')
        });
      }
    }
    return jsonRes({status:'ok', rows:result});
  } catch(err) {
    return jsonRes({status:'error', msg:err.toString()});
  }
}

// ============================
// 補填退場時間
// ============================
function updateExitTime(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetNm = e.parameter.sheetName || '進出資料表';
    var sheet = ss.getSheetByName(sheetNm);
    if (!sheet) return jsonRes({status:'error', msg:'找不到分頁: '+sheetNm});

    var rowIndex   = parseInt(e.parameter.rowIndex);
    var exitTime   = e.parameter.exitTime || '';
    var inspector  = e.parameter.inspector || '';

    if (isNaN(rowIndex) || rowIndex < 2) return jsonRes({status:'error', msg:'rowIndex 無效'});

    sheet.getRange(rowIndex, 10).setValue(exitTime);
    if (inspector) sheet.getRange(rowIndex, 11).setValue(inspector);

    return jsonRes({status:'ok'});
  } catch(err) {
    return jsonRes({status:'error', msg:err.toString()});
  }
}

// ============================
// 刪除資料列
// ============================
function deleteRow(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetNm = e.parameter.sheetName || '進出資料表';
    var sheet = ss.getSheetByName(sheetNm);
    if (!sheet) return jsonRes({status:'error', msg:'找不到分頁'});

    var rowIndex = parseInt(e.parameter.rowIndex);
    if (isNaN(rowIndex) || rowIndex < 2) return jsonRes({status:'error', msg:'rowIndex 無效'});

    sheet.deleteRow(rowIndex);
    return jsonRes({status:'ok'});
  } catch(err) {
    return jsonRes({status:'error', msg:err.toString()});
  }
}

// ============================
// 共用資料庫：讀取（_SharedDB 分頁）
// ============================
function getDB() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dbSheet = ss.getSheetByName('_SharedDB');
    if (!dbSheet) return jsonRes({status:'ok', db:null});
    var val = dbSheet.getRange(1, 1).getValue();
    if (!val) return jsonRes({status:'ok', db:null});
    return jsonRes({status:'ok', db:JSON.parse(val)});
  } catch(err) {
    return jsonRes({status:'error', msg:err.toString()});
  }
}

// ============================
// 共用資料庫：寫入（_SharedDB 分頁）
// ============================
function setDB(dbJson) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dbSheet = ss.getSheetByName('_SharedDB');
    if (!dbSheet) dbSheet = ss.insertSheet('_SharedDB');
    dbSheet.getRange(1, 1).setValue(dbJson);
    return jsonRes({status:'ok'});
  } catch(err) {
    return jsonRes({status:'error', msg:err.toString()});
  }
}

// ============================
// 【新】緊急聯絡清單：讀取（_Contacts 分頁）
// 需帶有效通行證（token），證明是已登入的同仁才能看電話。
// ============================
function getContacts(token) {
  try {
    var user = verifyAuthToken_(token);
    if (!user) return jsonRes({status:'error', msg:'登入已失效，請重新登入天鷹保全 App'});

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('_Contacts');
    if (!sheet) return jsonRes({status:'ok', contacts:[]});

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return jsonRes({status:'ok', contacts:[]});

    var contacts = [];
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[2]) continue; // 姓名為空就跳過
      contacts.push({
        id:      r[0],
        shift:   r[1],
        name:    r[2],
        role:    r[3],
        phone:   r[4],
        ecName:  r[5],
        ecRel:   r[6],
        ecPhone: r[7]
      });
    }
    return jsonRes({status:'ok', contacts:contacts});
  } catch(err) {
    return jsonRes({status:'error', msg:err.toString()});
  }
}

// ============================
// 【新】緊急聯絡清單：寫入（_Contacts 分頁）
// 整批覆蓋（先清空再寫入）
// 需帶有效通行證，且身分要是組長以上（跟前端 CAN_EDIT 一致），
// 一般同仁的通行證能讀不能寫。
// ============================
function setContacts(contactsJson, token) {
  try {
    var user = verifyAuthToken_(token);
    if (!user) return jsonRes({status:'error', msg:'登入已失效，請重新登入天鷹保全 App'});
    if (CAN_EDIT_ROLES_.indexOf(user.role) === -1) {
      return jsonRes({status:'error', msg:'權限不足，僅組長以上可編輯緊急聯絡清單'});
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('_Contacts');

    // 若分頁不存在就新建
    if (!sheet) {
      sheet = ss.insertSheet('_Contacts');
    }

    // 清空舊資料（保留第一行標題）
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
    }

    // 寫入標題（第一次）
    var headers = ['ID','班別','姓名','職務','電話','緊急聯絡人','關係','緊急連絡人電話'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1a1a2e');
    sheet.getRange(1, 1, 1, headers.length).setFontColor('#D4A800');

    var contacts = JSON.parse(contactsJson);
    if (!contacts || contacts.length === 0) return jsonRes({status:'ok'});

    var rows = contacts.map(function(c) {
      return [
        c.id      || '',
        c.shift   || '',
        c.name    || '',
        c.role    || '',
        c.phone   || '',
        c.ecName  || '',
        c.ecRel   || '',
        c.ecPhone || ''
      ];
    });

    sheet.getRange(2, 1, rows.length, 8).setValues(rows);

    // 凍結第一列
    sheet.setFrozenRows(1);

    return jsonRes({status:'ok', written:rows.length});
  } catch(err) {
    return jsonRes({status:'error', msg:err.toString()});
  }
}

// ============================
// 查詢或新增專櫃代號
// ============================
function getOrCreateShopCode(ss, name, floor) {
  try {
    var st = ss.getSheetByName('專櫃表');
    if (!st) return name;
    var data = st.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(name).trim() &&
          String(data[i][2]).trim() === String(floor).trim()) {
        return data[i][0];
      }
    }
    var prefix = floor + '-';
    var maxNum = 0;
    for (var j = 1; j < data.length; j++) {
      var code = String(data[j][0]);
      if (code.indexOf(prefix) === 0) {
        var num = parseInt(code.replace(prefix, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    var newNum = maxNum + 1;
    var newCode = prefix + (newNum < 10 ? '0' + newNum : String(newNum));
    st.appendRow([newCode, name, floor]);
    return newCode;
  } catch(err) {
    return name;
  }
}

// ============================
// 工具函式
// ============================
function genId() {
  return 'TY' + new Date().getTime().toString(36).toUpperCase() +
         Math.random().toString(36).substr(2, 3).toUpperCase();
}

function jsonRes(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
