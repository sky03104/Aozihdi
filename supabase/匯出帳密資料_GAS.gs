// 帳密系統 SQL 遷移 — 匯出用臨時 GAS 專案
// ════════════════════════════════════════════════════════════
// 用法：
// 1. 先在 Google Drive 把「天鷹保全APP」整份試算表複製一份（右鍵→
//    建立副本），拿到副本的 spreadsheet ID。
// 2. 開一個全新、獨立的 Apps Script 專案（不要動正式站台那個），
//    貼上這支檔案，Script Properties 設 SPREADSHEET_ID = 副本 ID。
// 3. 部署成網頁應用程式，只給這次遷移用，只有你自己知道網址。
// 4. 瀏覽器開 exec網址?action=exportAccountData，把回傳的 JSON
//    存成 data-export.json，供 migrate-from-sheets.js 讀取。
// 5. 遷移驗證完成後，這個臨時專案跟部署可以直接刪除/停用，
//    不影響正式站台（正式 GAS 專案完全沒被動過）。
// ════════════════════════════════════════════════════════════

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('請先在 Script Properties 設定 SPREADSHEET_ID（複製出來的副本 ID）');
  return SpreadsheetApp.openById(id);
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'exportAccountData') {
    return jsonRes_(exportAccountData());
  }
  return jsonRes_({ status: 'err', msg: '未知的 action' });
}

function jsonRes_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetRows_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  data.shift(); // 去表頭
  return data;
}

function exportAccountData() {
  var users = sheetRows_('帳號管理').filter(function (r) { return r[0]; }).map(function (r) {
    return {
      empId: String(r[0]),
      name: String(r[1]),
      // 密碼刻意不匯出：雜湊方式不同，Auth 帳號一律配新的隨機臨時密碼
      role: String(r[3]),
      dept: String(r[4]),
      status: String(r[5] || 'active'),
      shift: String(r[6] || '')
    };
  });

  var applications = sheetRows_('帳號申請').filter(function (r) { return r[0]; }).map(function (r) {
    return {
      id: r[0],
      empId: String(r[1]),
      name: String(r[2]),
      dept: String(r[3]),
      role: String(r[4]),
      // 密碼同樣不匯出
      appliedAt: r[6] ? new Date(r[6]).toISOString() : null,
      status: String(r[7] || 'pending'),
      reviewedAt: r[8] ? new Date(r[8]).toISOString() : null
    };
  });

  var settingsSheet = ss_().getSheetByName('系統設定');
  var settings = {};
  if (settingsSheet) {
    settingsSheet.getDataRange().getValues().slice(1).forEach(function (r) {
      if (!r[0]) return;
      var v = r[1];
      try { v = JSON.parse(v); } catch (e) {} // toolPerms/workAllowedIds/toolsConfig 是 JSON 字串
      settings[String(r[0])] = v;
    });
  }

  var lineBindings = sheetRows_('LINE綁定').filter(function (r) { return r[0]; }).map(function (r) {
    return {
      empId: String(r[0]), name: String(r[1]), lineUserId: String(r[2]),
      boundAt: r[3] ? new Date(r[3]).toISOString() : null, status: String(r[4] || 'unbound')
    };
  });

  var lineCodes = sheetRows_('LINE驗證碼').filter(function (r) { return r[0]; }).map(function (r) {
    return {
      empId: String(r[0]), name: String(r[1]), code: String(r[2]),
      createdAt: r[3] ? new Date(r[3]).toISOString() : null,
      status: String(r[4] || 'expired'),
      expiresAt: r[5] ? new Date(r[5]).toISOString() : null
    };
  });

  return {
    status: 'ok',
    exportedAt: new Date().toISOString(),
    users: users,
    applications: applications,
    settings: settings,
    lineBindings: lineBindings,
    lineCodes: lineCodes
  };
}
