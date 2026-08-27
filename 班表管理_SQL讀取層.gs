// ════════════════════════════════════════════════════════════
// 天鷹保全 · 班表管理 SQL遷移【第三階段：讀取層】
// ────────────────────────────────────────────────────────────
// 用途：提供跟 getScheduleData / getScheduleByMonth_ / listScheduleMonths_
//       回傳格式「完全相同」的 Supabase 版本，供比對驗證用。
//
// ⚠️ 目前階段：這幾支 _SQL 結尾的函式尚未接進 doGet 路由，正式流量
//       還是走原本讀 Sheets 的版本，不影響現在正在使用的人。
//       等比對驗證通過，才會把 doGet 裡的路由換成呼叫這幾支。
//
// 這個檔案要跟 班表管理_後端_GAS_v2.13.gs、班表管理_SQL遷移腳本.gs
// 貼在「同一個」Apps Script 專案裡（共用 SHIFT_CONFIG / supabaseRequest_ 等）。
// ════════════════════════════════════════════════════════════

// ============================
// 把 Supabase 明細（entries）重組回跟 讀班表分頁_() 一模一樣的 rows 格式
// ============================
function 重組Rows_(entries) {
  // 用 row_index 分組，一組就是一個人
  var byRow = {};
  var order = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (!(e.row_index in byRow)) {
      byRow[e.row_index] = { roleStr: e.role || '', name: e.emp_name || '', days: {} };
      order.push(e.row_index);
    }
    byRow[e.row_index].days[e.day_of_month] = e.shift_code || '';
  }
  order.sort(function (a, b) { return a - b; });

  var rows = [];
  for (var r = 0; r < order.length; r++) {
    var g = byRow[order[r]];
    var 天數 = 0;
    for (var d in g.days) { if (Number(d) > 天數) 天數 = Number(d); }
    var shifts = [];
    for (var day = 1; day <= 天數; day++) {
      shifts.push(g.days[day] !== undefined ? g.days[day] : '');
    }
    rows.push({ roleStr: g.roleStr, name: g.name, shifts: shifts });
  }
  return rows;
}

// 抓某個版本的全部明細（Supabase 預設一次最多回1000筆，一個月頂多 30人*31天=930筆，
// 單次夠用；未來人數/月份範圍變大再考慮分頁）
function 抓版本明細_(versionId) {
  return supabaseRequest_('GET',
    '/rest/v1/schedule_entries?version_id=eq.' + versionId +
    '&order=row_index.asc,day_of_month.asc');
}

// ============================
// 對應 getScheduleData（action=getSchedule）
// ============================
function getScheduleData_SQL(e) {
  try {
    var shiftKey = (e && e.parameter) ? e.parameter.shift : '';
    var cfg = SHIFT_CONFIG[shiftKey] || SHIFT_CONFIG.night;
    var shiftTypeForDb = SHIFT_TYPE_MAP_[shiftKey] || SHIFT_TYPE_MAP_.night;

    var versions = supabaseRequest_('GET',
      '/rest/v1/schedule_versions?shift_type=eq.' + shiftTypeForDb + '&status=eq.live');
    if (!versions || versions.length === 0) {
      return respond({ success: false, error: 'Supabase 找不到' + cfg.label + '的線上版本' });
    }
    var v = versions[0];
    var entries = 抓版本明細_(v.id);
    return respond({ success: true, ym: v.year_month.replace('-', '/'), rows: 重組Rows_(entries) });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ============================
// 對應 getScheduleByMonth_（action=getScheduleByMonth）
// ============================
function getScheduleByMonth_SQL(e) {
  try {
    var shiftKey = (e && e.parameter) ? e.parameter.shift : '';
    var ymSlash = String((e && e.parameter) ? e.parameter.ym : '').trim();
    if (!/^\d{4}\/\d{2}$/.test(ymSlash)) {
      return respond({ success: false, error: '月份格式需為 yyyy/MM，收到：' + ymSlash });
    }
    var cfg = SHIFT_CONFIG[shiftKey] || SHIFT_CONFIG.night;
    var shiftTypeForDb = SHIFT_TYPE_MAP_[shiftKey] || SHIFT_TYPE_MAP_.night;
    var ym = ymSlash.replace('/', '-');

    // 先找線上版本
    var live = supabaseRequest_('GET',
      '/rest/v1/schedule_versions?shift_type=eq.' + shiftTypeForDb +
      '&status=eq.live&year_month=eq.' + ym);
    if (live && live.length > 0) {
      var entriesLive = 抓版本明細_(live[0].id);
      return respond({ success: true, ym: ymSlash, source: 'live', rows: 重組Rows_(entriesLive) });
    }

    // 找不到再翻歷史（superseded）版本
    var backup = supabaseRequest_('GET',
      '/rest/v1/schedule_versions?shift_type=eq.' + shiftTypeForDb +
      '&status=eq.superseded&year_month=eq.' + ym);
    if (backup && backup.length > 0) {
      var entriesBackup = 抓版本明細_(backup[0].id);
      return respond({ success: true, ym: ymSlash, source: 'backup', rows: 重組Rows_(entriesBackup) });
    }

    var curLive = supabaseRequest_('GET',
      '/rest/v1/schedule_versions?shift_type=eq.' + shiftTypeForDb + '&status=eq.live');
    var liveYm = (curLive && curLive.length > 0) ? curLive[0].year_month.replace('-', '/') : '';
    return respond({
      success: false,
      error: '找不到 ' + ymSlash + ' 的' + cfg.label + '班表（線上目前是 ' + (liveYm || '未知') + '，也沒有該月備份）',
      liveYm: liveYm
    });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ============================
// 對應 listScheduleMonths_（action=listScheduleMonths）
// ============================
function listScheduleMonths_SQL(e) {
  try {
    var shiftKey = (e && e.parameter) ? e.parameter.shift : '';
    var cfg = SHIFT_CONFIG[shiftKey] || SHIFT_CONFIG.night;
    var shiftTypeForDb = SHIFT_TYPE_MAP_[shiftKey] || SHIFT_TYPE_MAP_.night;

    var all = supabaseRequest_('GET',
      '/rest/v1/schedule_versions?shift_type=eq.' + shiftTypeForDb + '&select=year_month,status');

    var 備份月份 = [];
    var liveYm = '';
    for (var i = 0; i < all.length; i++) {
      var ymSlash = all[i].year_month.replace('-', '/');
      if (all[i].status === 'superseded' && 備份月份.indexOf(ymSlash) < 0) 備份月份.push(ymSlash);
      if (all[i].status === 'live') liveYm = ymSlash;
    }
    備份月份.sort();
    var 全部 = 備份月份.slice();
    if (liveYm && 全部.indexOf(liveYm) < 0) 全部.push(liveYm);
    全部.sort();

    return respond({
      success: true,
      months: 全部,
      backups: 備份月份,
      backupCount: 備份月份.length,
      liveYm: liveYm
    });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ============================
// v2.14：把「目前線上這份」同步進 Supabase
// ────────────────────────────
// 呼叫時機：Sheets 寫入成功之後（handleUpdate、checkAndSwitchMonth_）。
// Sheets 目前仍是唯一權威來源，這裡只是「順便同步一份」，失敗不能擋住
// Sheets 那邊已經成功的操作，呼叫端務必包 try/catch。
//
// 兩種情況：
//   1. 同月修訂（月份沒變）：既有 live 版本原地清掉明細重灌，version本身不變
//   2. 換月／第一次同步：舊 live 版本標記成 superseded，另外開一個新的 live 版本
// ============================
function 同步目前線上班表到Supabase_(shiftKey) {
  var cfg = SHIFT_CONFIG[shiftKey];
  var shiftTypeForDb = SHIFT_TYPE_MAP_[shiftKey];
  if (!cfg || !shiftTypeForDb) throw new Error('未知的班別代號：' + shiftKey);

  var sh = resolveTargetSheet(cfg);
  var slashYm = String(sh.getRange('Z1').getValue() || '').trim();
  if (!slashYm) return; // 月份是空的，沒東西好同步

  var ym = 轉為橫線年月_(slashYm);
  var rows = 讀班表分頁_(sh);

  var existingLive = supabaseRequest_('GET',
    '/rest/v1/schedule_versions?shift_type=eq.' + shiftTypeForDb + '&status=eq.live');

  var versionId;
  if (existingLive && existingLive.length > 0 && existingLive[0].year_month === ym) {
    // 同月修訂：原地清掉重灌
    versionId = existingLive[0].id;
    supabaseRequest_('DELETE', '/rest/v1/schedule_entries?version_id=eq.' + versionId);
  } else {
    // 換月或第一次：舊的line標記成歷史，開一個新版本
    if (existingLive && existingLive.length > 0) {
      supabaseRequest_('PATCH', '/rest/v1/schedule_versions?id=eq.' + existingLive[0].id, {
        status: 'superseded',
        superseded_at: new Date().toISOString()
      });
    }
    versionId = 建立或取得版本_(shiftTypeForDb, ym, 'live', cfg.label + '-同步-' + ym);
  }

  批次寫入Entries_(轉為Entries_(rows, shiftTypeForDb, ym, versionId));
}

// ============================
// 比對工具：把「讀Sheets」跟「讀Supabase」的結果拿來對，逐欄比對差異
// 在 Apps Script 編輯器直接執行 比對讀取結果() 看執行紀錄
// ============================
function 比對單一班別_(shiftKey) {
  var eFake = { parameter: { shift: shiftKey } };
  var oldResult = getScheduleData(eFake);
  var newResult = getScheduleData_SQL(eFake);
  var oldData = JSON.parse(oldResult.getContent());
  var newData = JSON.parse(newResult.getContent());

  if (!oldData.success || !newData.success) {
    return shiftKey + '：其中一邊讀取失敗 — 舊:' + JSON.stringify(oldData.success) + ' 新:' + JSON.stringify(newData.success)
      + (oldData.error ? ' 舊錯誤:' + oldData.error : '') + (newData.error ? ' 新錯誤:' + newData.error : '');
  }
  if (oldData.ym !== newData.ym) {
    return shiftKey + '：月份不一致！舊=' + oldData.ym + ' 新=' + newData.ym;
  }
  if (oldData.rows.length !== newData.rows.length) {
    return shiftKey + '：人數不一致！舊=' + oldData.rows.length + ' 新=' + newData.rows.length;
  }

  var 差異 = [];
  for (var r = 0; r < oldData.rows.length; r++) {
    var o = oldData.rows[r], n = newData.rows[r];
    if (o.name !== n.name || o.roleStr !== n.roleStr) {
      差異.push('第' + r + '列 姓名/職稱不一致：舊[' + o.roleStr + ',' + o.name + '] 新[' + n.roleStr + ',' + n.name + ']');
      continue;
    }
    if (o.shifts.length !== n.shifts.length) {
      差異.push(o.name + '：天數不一致 舊=' + o.shifts.length + ' 新=' + n.shifts.length);
      continue;
    }
    for (var d = 0; d < o.shifts.length; d++) {
      if (o.shifts[d] !== n.shifts[d]) {
        差異.push(o.name + ' 第' + (d + 1) + '天：舊[' + o.shifts[d] + '] 新[' + n.shifts[d] + ']');
      }
    }
  }

  if (差異.length === 0) {
    return shiftKey + '：完全一致 ✅（' + oldData.rows.length + '人 x ' + oldData.rows[0].shifts.length + '天）';
  }
  return shiftKey + '：發現 ' + 差異.length + ' 處差異 ❌\n' + 差異.join('\n');
}

function 比對讀取結果() {
  var 結果 = [];
  for (var key in SHIFT_CONFIG) {
    結果.push(比對單一班別_(key));
  }
  var msg = 結果.join('\n\n');
  Logger.log(msg);
  return msg;
}
