// ════════════════════════════════════════════════════════════
// 天鷹保全 · 過夜車輛統計 SQL遷移【階段7：Sheets定期清除】
// ────────────────────────────────────────────────────────────
// 用途：Supabase已是「館內機車/館內汽車/新莊停車場」三個登記分頁的
// 權威來源，Sheets角色改成「Supabase查詢失敗時的備援緩衝」，不需要
// 永久保留全部歷史。這支每天清掉Sheets裡超過30天的舊列，只留最近
// 30天，完整歷史仍在Supabase查得到（透過查詢歷史紀錄功能）。
//
// ⚠️⚠️ 前置條件（一定要先確認才能執行這支）：
// 查詢歷史紀錄／每日寄信都已經改讀Supabase且穩定運作一段時間。
// 清除前若Sheets還是唯一還在用的資料來源，執行會造成舊紀錄查不到。
// 見 docs/SQL遷移規劃_過夜車輛統計.md 第三節與進度追蹤。
//
// ⚠️ 這支要跟 車牌辨識_後端_GAS.gs、過夜車輛_SQL遷移腳本.gs 貼在同一個
// Apps Script 專案裡（共用 SPREADSHEET_ID / toDate_ / VEHICLE_TYPE_LABELS_SQL_）。
// 部署後執行一次 設定過夜車輛Sheets清除觸發器() 即可。
// ════════════════════════════════════════════════════════════

var 過夜車輛SHEETS保留天數_ = 30;

// 清單一個分頁裡超過保留天數的舊列。假設appendRow累加使時間大致遞增排列
// （現場登記皆用appendRow，跟checkAndUpdateLongTermParking_已用的假設一致），
// 從最上面（最舊）往下找到第一筆還在保留範圍內的列，前面整批刪除。
// 遇到時間格式看不懂的列一律當「還要保留」處理（寧可少清也不要清錯）。
function 清除過夜車輛過期Sheets列_(sheetName) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { sheet: sheetName, deleted: 0, notFound: true };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { sheet: sheetName, deleted: 0 };

  var 界線 = new Date();
  界線.setDate(界線.getDate() - 過夜車輛SHEETS保留天數_);

  var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues(); // 只需要A欄時間
  var cutoffIdx = -1; // 0-based，指向第一筆要保留的資料列
  for (var i = 0; i < data.length; i++) {
    var d = toDate_(data[i][0]);
    if (!d || d >= 界線) { cutoffIdx = i; break; }
  }
  if (cutoffIdx === -1) cutoffIdx = data.length - 1; // 全部都比保留天數舊，保守起見至少留最後1列
  if (cutoffIdx <= 0) return { sheet: sheetName, deleted: 0 }; // 沒有需要刪的舊列

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet.deleteRows(2, cutoffIdx); // 列2~(2+cutoffIdx-1)，共cutoffIdx列
  } finally {
    lock.releaseLock();
  }
  return { sheet: sheetName, deleted: cutoffIdx };
}

function 每日清除過夜車輛過期Sheets資料() {
  try {
    var results = VEHICLE_TYPE_LABELS_SQL_.map(function (t) {
      return 清除過夜車輛過期Sheets列_(t);
    });
    var msg = results.map(function (r) {
      return r.notFound ? (r.sheet + '：找不到分頁，跳過') : (r.sheet + '：清除' + r.deleted + '列');
    }).join('\n');
    console.log('過夜車輛Sheets定期清除完成：\n' + msg);
    return msg;
  } catch (err) {
    console.error('過夜車輛Sheets定期清除失敗：' + err.toString());
  }
}

function 設定過夜車輛Sheets清除觸發器() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === '每日清除過夜車輛過期Sheets資料') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('每日清除過夜車輛過期Sheets資料')
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .create();
  Logger.log('已建立每日清除觸發器（每日凌晨4:00~5:00執行一次，接在每日備份3點之後）');
}
