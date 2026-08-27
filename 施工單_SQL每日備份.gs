// ════════════════════════════════════════════════════════════
// 天鷹保全 · 施工單管理 SQL遷移【每日備份 Supabase 到雲端硬碟】
// ────────────────────────────────────────────────────────────
// 用途：跟班表管理同一套防護（見 班表管理_SQL每日備份.gs），Supabase是
// 別人公司的免費方案，長期有兩個風險：①免費方案政策說變就變 ②連續7天
// 沒人查詢會自動暫停。這支每天執行一次，把 construction_orders /
// fire_permits 全部資料匯出成一個檔案存進 Drive（保留30天，舊的自動
// 清掉），順便每天都會實際打一次 Supabase，避免被判定閒置。
//
// ⚠️ 這支要跟 施工單時間修正_完整修正版.gs 貼在同一個 Apps Script 專案
// 裡（共用 supabaseRequest2_ 連線函式，定義於 施工單_SQL遷移腳本.gs）。
// 部署後執行一次 設定施工單每日備份觸發器() 即可。
// ════════════════════════════════════════════════════════════

var 施工單備份資料夾名稱_ = '天鷹保全_施工單SQL備份';
var 施工單備份保留天數_ = 30;

function 取得施工單備份資料夾_() {
  var it = DriveApp.getFoldersByName(施工單備份資料夾名稱_);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(施工單備份資料夾名稱_);
}

// Supabase/PostgREST預設一次最多回傳1000筆，資料量早就超過這個數字，
// 不分頁抓的話備份會悄悄漏資料（實測過：施工單4302筆只抓到1000筆）。
// 用limit+offset分頁抓到抓不滿一頁為止。
function supabase分頁抓全部_(path) {
  var all = [];
  var pageSize = 1000;
  var offset = 0;
  while (true) {
    var sep = path.indexOf('?') === -1 ? '?' : '&';
    var page = supabaseRequest2_('GET', path + sep + 'limit=' + pageSize + '&offset=' + offset);
    all = all.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

function 每日備份施工單Supabase到雲端硬碟() {
  try {
    var construction = supabase分頁抓全部_('/rest/v1/construction_orders?select=*');
    var fire = supabase分頁抓全部_('/rest/v1/fire_permits?select=*');
    var payload = {
      匯出時間: new Date().toISOString(),
      construction_orders: construction,
      fire_permits: fire
    };

    var 檔名 = '施工單SQL備份_' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd') + '.json';
    var folder = 取得施工單備份資料夾_();

    var existing = folder.getFilesByName(檔名);
    while (existing.hasNext()) existing.next().setTrashed(true);

    folder.createFile(檔名, JSON.stringify(payload), MimeType.PLAIN_TEXT);

    清除施工單過期備份_(folder);
    console.log('每日備份完成：' + 檔名 + '，施工單 ' + construction.length + ' 筆，動火申請 ' + fire.length + ' 筆');
  } catch (err) {
    console.error('每日備份施工單Supabase失敗：' + err.toString());
  }
}

function 清除施工單過期備份_(folder) {
  var 界線 = new Date();
  界線.setDate(界線.getDate() - 施工單備份保留天數_);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (f.getDateCreated() < 界線) f.setTrashed(true);
  }
}

function 設定施工單每日備份觸發器() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === '每日備份施工單Supabase到雲端硬碟') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('每日備份施工單Supabase到雲端硬碟')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log('已建立每日備份觸發器（每日凌晨3:00~4:00間執行一次）');
}
