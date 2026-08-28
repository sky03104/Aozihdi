// ════════════════════════════════════════════════════════════
// 天鷹保全 · 過夜車輛統計 SQL遷移【每日備份 Supabase 到雲端硬碟】
// ────────────────────────────────────────────────────────────
// 用途：跟其他工具同一套防護（見 施工單_SQL每日備份.gs），Supabase是別人
// 公司的免費方案，長期有兩個風險：①免費方案政策說變就變 ②連續7天沒人
// 查詢會自動暫停。這支每天執行一次，把 vehicle_overnight_logs 全部資料
// 匯出成一個檔案存進 Drive（保留30天，舊的自動清掉），順便每天都會實際
// 打一次 Supabase，避免被判定閒置。
//
// ⚠️ 這支要跟 車牌辨識_後端_GAS.gs、過夜車輛_SQL遷移腳本.gs 貼在同一個
// Apps Script 專案裡（共用 supabaseRequest_ 連線函式）。
// 部署後執行一次 設定過夜車輛每日備份觸發器() 即可。
// ════════════════════════════════════════════════════════════

var 過夜車輛備份資料夾名稱_ = '天鷹保全_過夜車輛SQL備份';
var 過夜車輛備份保留天數_ = 30;

function 取得過夜車輛備份資料夾_() {
  var it = DriveApp.getFoldersByName(過夜車輛備份資料夾名稱_);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(過夜車輛備份資料夾名稱_);
}

// Supabase/PostgREST預設一次最多回傳1000筆，資料量早晚會超過這個數字，
// 不分頁抓的話備份會悄悄漏資料。用limit+offset分頁抓到抓不滿一頁為止。
function supabase分頁抓全部_過夜車輛_(path) {
  var all = [];
  var pageSize = 1000;
  var offset = 0;
  while (true) {
    var sep = path.indexOf('?') === -1 ? '?' : '&';
    var page = supabaseRequest_('get', path + sep + 'limit=' + pageSize + '&offset=' + offset);
    all = all.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

function 每日備份過夜車輛Supabase到雲端硬碟() {
  try {
    var logs = supabase分頁抓全部_過夜車輛_('/rest/v1/vehicle_overnight_logs?select=*');
    var payload = {
      匯出時間: new Date().toISOString(),
      vehicle_overnight_logs: logs
    };

    var 檔名 = '過夜車輛SQL備份_' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd') + '.json';
    var folder = 取得過夜車輛備份資料夾_();

    var existing = folder.getFilesByName(檔名);
    while (existing.hasNext()) existing.next().setTrashed(true);

    folder.createFile(檔名, JSON.stringify(payload), MimeType.PLAIN_TEXT);

    清除過夜車輛過期備份_(folder);
    console.log('每日備份完成：' + 檔名 + '，過夜車輛登記 ' + logs.length + ' 筆');
  } catch (err) {
    console.error('每日備份過夜車輛Supabase失敗：' + err.toString());
  }
}

function 清除過夜車輛過期備份_(folder) {
  var 界線 = new Date();
  界線.setDate(界線.getDate() - 過夜車輛備份保留天數_);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated() < 界線) f.setTrashed(true);
  }
}

function 設定過夜車輛每日備份觸發器() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === '每日備份過夜車輛Supabase到雲端硬碟') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('每日備份過夜車輛Supabase到雲端硬碟')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log('已建立每日備份觸發器（每日凌晨3:00~4:00間執行一次）');
}
