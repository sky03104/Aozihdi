// ════════════════════════════════════════════════════════════
// 天鷹保全 · 班表管理 SQL遷移【階段6：會計月彙整表鏡像推播】
// ────────────────────────────────────────────────────────────
// 背景：會計月彙整表是咖哩手動維護的外部試算表，用 IMPORTRANGE/XLOOKUP/
//       CHOOSECOLS 之類公式直接讀班表試算表的儲存格。公式沒辦法讀
//       Supabase，階段7 切斷 Sheets 寫入後，公式會讀到「不再更新的死
//       資料」。這支腳本定期把凹子底沙盒 Supabase 的資料寫回這份會計
//       試算表的專屬分頁，讓公式繼續有新鮮資料可讀——但版面改成簡化版
//       （人×日矩陣，拿掉職務欄/星期列/月份表頭/工時統計欄/代號說明/
//       檢核列），咖哩需要對照新版面重寫公式。
//
// 版面（早/晚班各一個分頁）：
//   A1 = 年月字串（例：'2026/08'）
//   B1:AF1 = 日期 1~31（超過該月實際天數的欄位留空）
//   A2 起：A欄=姓名，B欄起=當天班別代號（跟 schedule_entries.shift_code
//          一模一樣，包含空字串代表當天沒有排班資料）
//
// 部署方式：
//   1. 這支跟 班表管理_後端_GAS_v2.13_凹子底版.gs 等其他班表管理檔案貼在「同一個」
//      Apps Script 專案裡，共用 SHIFT_CONFIG / supabaseRequest_ 等函式。
//   2. ⚠️ ACCOUNTING_SS_ID 目前是研究階段找到的猜測值，正式使用前咖哩
//      務必自己核對這是不是正確的會計月彙整表 ID，錯了會寫壞不相干的
//      試算表。
//   3. 在 Apps Script 編輯器手動執行一次 推播會計鏡像() 確認正常，
//      再用 設定會計鏡像每日觸發器() 排程（預設跟每日 Supabase 備份
//      同一個離峰時段，避免同時多個 trigger 搶資源）。
//   4. 咖哩對照新版面重寫會計試算表裡的公式，確認抓得到資料後，這份
//      鏡像推播才算真正上線。
// ════════════════════════════════════════════════════════════

// ⚠️ 待咖哩確認：這是研究階段找到的會計月彙整表 ID，正式使用前務必核對
var ACCOUNTING_SS_ID = '1zVoI7-zshz2zhhcR0sOT6xVzhwFGdIrhc3KxQ5A0PV4';

var ACCOUNTING_MIRROR_SHEET_NAMES_ = {
  night: '晚班班表鏡像',
  morning: '早班班表鏡像'
};

// 該月實際天數（跟 班表管理_SQL遷移腳本_凹子底版.gs 的 該月實際天數_ 邏輯一致，
// 這裡重寫一份是因為這支腳本要能獨立閱讀，不強制依賴檔案載入順序）
function 會計鏡像_該月實際天數(ym) {
  var parts = ym.split('/');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  return new Date(y, m, 0).getDate();
}

function 取得或建立鏡像分頁_(sheetName) {
  var ss = SpreadsheetApp.openById(ACCOUNTING_SS_ID);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);
  return sh;
}

// 把某個班別目前 live 版本的資料整批寫進鏡像分頁（每次執行整個範圍重寫，
// 冪等：重跑不會疊加或殘留舊資料）
function 推播單一班別鏡像_(shiftKey) {
  var shiftTypeForDb = SHIFT_TYPE_MAP_[shiftKey];
  var sheetName = ACCOUNTING_MIRROR_SHEET_NAMES_[shiftKey];
  if (!shiftTypeForDb || !sheetName) throw new Error('未知的班別代號：' + shiftKey);

  var versions = supabaseRequest_('GET',
    '/rest/v1/schedule_versions?shift_type=eq.' + shiftTypeForDb + '&status=eq.live');
  if (!versions || versions.length === 0) {
    return sheetName + '：Supabase 找不到目前線上版本，略過';
  }
  var v = versions[0];
  var ymSlash = v.year_month.replace('-', '/');
  var 天數 = 會計鏡像_該月實際天數(ymSlash);

  var entries = supabaseRequest_('GET',
    '/rest/v1/schedule_entries?version_id=eq.' + v.id + '&order=row_index.asc,day_of_month.asc');

  // 依 row_index 分組還原成「一人一列」
  var byRow = {};
  var order = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (!(e.row_index in byRow)) {
      byRow[e.row_index] = { name: e.emp_name || '', days: {} };
      order.push(e.row_index);
    }
    byRow[e.row_index].days[e.day_of_month] = e.shift_code || '';
  }
  order.sort(function (a, b) { return a - b; });

  // 組成輸出矩陣：第一列是表頭（A1=年月, B1起=日期），之後每列一人
  var header = [ymSlash];
  for (var d = 1; d <= 31; d++) header.push(d <= 天數 ? d : '');

  var rows = [header];
  for (var r = 0; r < order.length; r++) {
    var g = byRow[order[r]];
    var line = [g.name];
    for (var day = 1; day <= 31; day++) {
      line.push(day <= 天數 ? (g.days[day] !== undefined ? g.days[day] : '') : '');
    }
    rows.push(line);
  }

  var sh = 取得或建立鏡像分頁_(sheetName);
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 32).setValues(rows);
  sh.getRange(1, 1, 1, 32).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);

  return sheetName + '：已推播 ' + ymSlash + '（' + order.length + ' 人 x ' + 天數 + ' 天）';
}

// ============================
// 主流程：兩個班別各推一次
// ============================
function 推播會計鏡像() {
  var 結果 = [];
  for (var key in SHIFT_CONFIG) {
    try {
      結果.push(推播單一班別鏡像_(key));
    } catch (err) {
      結果.push((ACCOUNTING_MIRROR_SHEET_NAMES_[key] || key) + '：失敗 ' + err.toString());
    }
  }
  var msg = 結果.join('\n');
  Logger.log(msg);
  return msg;
}

// ============================
// 每日定時觸發（比照每日備份離峰時段，避免多個 trigger 搶資源；
// 會計試算表只有人月結查閱，不需要即時，每日更新一次即可）
// ============================
function 設定會計鏡像每日觸發器() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === '推播會計鏡像') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('推播會計鏡像')
    .timeBased().everyDays(1).atHour(4).inTimezone('Asia/Taipei').create();
  Logger.log('已建立會計鏡像每日 04:00 推播觸發器');
}
