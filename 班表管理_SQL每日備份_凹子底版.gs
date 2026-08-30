// ════════════════════════════════════════════════════════════
// 天鷹保全 · 班表管理 SQL遷移【每日備份 Supabase 到雲端硬碟】
// ────────────────────────────────────────────────────────────
// 用途：Supabase 是別人公司的免費方案，長期而言有兩個風險：
//   1. 免費方案政策說變就變（PlanetScale 2024年直接砍掉免費方案的前例）
//   2. 連續7天沒人查詢會自動暫停，要手動上線才能再用
// 這支每天執行一次，把 Supabase 目前所有資料整個匯出成一個檔案存進
// Google Drive（保留最近30天，舊的自動清掉，不會無限累積），
// 順便每天都會實際打一次 Supabase，天天有查詢就不會被判定閒置暫停。
//
// ⚠️ 使用前置：跟其他 SQL 相關檔案一樣，要貼在同一個 Apps Script 專案裡
//    （共用 supabaseRequest_ 連線函式）。
// 部署後執行一次 設定每日備份觸發器()，之後就會每天自動跑。
// ════════════════════════════════════════════════════════════

var 備份資料夾名稱_ = '天鷹保全_班表SQL備份';
var 備份保留天數_ = 30;

function 取得備份資料夾_() {
  var it = DriveApp.getFoldersByName(備份資料夾名稱_);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(備份資料夾名稱_);
}

// ============================
// 主流程：把 Supabase 全部資料匯出成一個 JSON 檔存進 Drive
// ============================
function 每日備份Supabase到雲端硬碟() {
  try {
    var versions = supabaseRequest_('GET', '/rest/v1/schedule_versions?select=*');
    var payload = { 匯出時間: new Date().toISOString(), versions: [] };

    for (var i = 0; i < versions.length; i++) {
      var v = versions[i];
      var entries = supabaseRequest_('GET',
        '/rest/v1/schedule_entries?version_id=eq.' + v.id + '&order=row_index.asc,day_of_month.asc');
      payload.versions.push({ version: v, entries: entries });
    }

    var 檔名 = '班表SQL備份_' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd') + '.json';
    var folder = 取得備份資料夾_();

    // 同一天重複執行（例如手動又跑一次）就覆蓋掉，不留重複檔案
    var existing = folder.getFilesByName(檔名);
    while (existing.hasNext()) existing.next().setTrashed(true);

    folder.createFile(檔名, JSON.stringify(payload), MimeType.PLAIN_TEXT);

    清除過期備份_(folder);
    console.log('每日備份完成：' + 檔名 + '，共 ' + versions.length + ' 個版本');
  } catch (err) {
    // 備份失敗不能是靜默的，一定要留紀錄，之後才查得到到底是哪天開始壞的
    console.error('每日備份Supabase失敗：' + err.toString());
  }
}

// 清掉超過保留天數的舊備份檔（只清這個資料夾內的，不動其他Drive檔案）
function 清除過期備份_(folder) {
  var 界線 = new Date();
  界線.setDate(界線.getDate() - 備份保留天數_);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated() < 界線) f.setTrashed(true);
  }
}

// ============================
// 一次性設定：建立每日執行的時間觸發器
// 在 Apps Script 編輯器直接執行這個函式一次即可
// ============================
function 設定每日備份觸發器() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === '每日備份Supabase到雲端硬碟') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('每日備份Supabase到雲端硬碟')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log('已建立每日備份觸發器（每日凌晨3:00~4:00間執行一次）');
}
