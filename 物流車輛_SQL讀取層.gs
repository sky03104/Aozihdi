// ════════════════════════════════════════════════════════════
// 天鷹保全 · 物流車輛統計 SQL遷移【第三階段：getDay/getMonth 讀取層】
// ────────────────────────────────────────────────────────────
// 用途：getDay/getMonth 改讀Supabase用created_at索引查詢，不用像
//       現在整表撈再篩。
//
// ⚠️ 這支只處理讀取比對，還沒接進正式 doGet 路由——先跑
//    比對getDay('YYYY-MM-DD')、比對getMonth('YYYY-MM')、
//    測試getDay效能('YYYY-MM-DD') 確認新舊結果一致、效能有改善，
//    咖哩確認後才把 doGet 的 getDay/getMonth action 改呼叫這支
//    （階段4跟寫入一起接上）。
//
// 需要跟遷移腳本（物流車輛_SQL遷移腳本.gs）貼在同一個專案，共用
// supabaseRequest_ 等函式，不要重複貼一次。
// ════════════════════════════════════════════════════════════

function 算日範圍_(dateStr) {
  var p = String(dateStr || '').split('-');
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, d = parseInt(p[2], 10);
  return {
    start: new Date(y, m, d, 0, 0, 0),
    end: new Date(y, m, d + 1, 0, 0, 0)
  };
}

function 算月範圍_(monthStr) {
  var p = String(monthStr || '').split('-');
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1;
  return {
    start: new Date(y, m, 1, 0, 0, 0),
    end: new Date(y, m + 1, 1, 0, 0, 0)
  };
}

function fmtISO_(d) {
  return Utilities.formatDate(d, 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// 對應原本 getDay(e)，但改讀 Supabase
function getDay_SQL(dateStr) {
  var range = 算日範圍_(dateStr);
  var path = '/rest/v1/logistics_records'
    + '?created_at=gte.' + encodeURIComponent(fmtISO_(range.start))
    + '&created_at=lt.' + encodeURIComponent(fmtISO_(range.end))
    + '&order=created_at.desc';
  var supaRows = supabaseRequest_('get', path);

  var rows = [];
  var totals = { '1.9噸': 0, '3.5噸': 0, '8噸以上': 0 };
  supaRows.forEach(function (r) {
    rows.push({
      id: r.id,
      time: Utilities.formatDate(new Date(r.created_at), 'Asia/Taipei', 'HH:mm'),
      category: r.category,
      count: r.count,
      empId: r.emp_id || '',
      name: r.emp_name || ''
    });
    if (totals.hasOwnProperty(r.category)) totals[r.category] += r.count;
  });
  return { status: 'ok', date: dateStr, rows: rows, totals: totals };
}

// 對應原本 aggregateMonth_，但改讀 Supabase（一次查整月範圍，本地端彙總）
function aggregateMonth_SQL(monthStr) {
  var p = String(monthStr).split('-');
  var year = parseInt(p[0], 10), month = parseInt(p[1], 10);
  var daysInMonth = new Date(year, month, 0).getDate();
  var range = 算月範圍_(monthStr);

  var path = '/rest/v1/logistics_records'
    + '?created_at=gte.' + encodeURIComponent(fmtISO_(range.start))
    + '&created_at=lt.' + encodeURIComponent(fmtISO_(range.end));
  var supaRows = supabaseRequest_('get', path);

  var map = {};
  supaRows.forEach(function (r) {
    var day = new Date(r.created_at);
    var localDay = Number(Utilities.formatDate(day, 'Asia/Taipei', 'd'));
    if (!map[localDay]) map[localDay] = { t19: 0, t35: 0, t80: 0 };
    if (r.category === '1.9噸') map[localDay].t19 += r.count;
    else if (r.category === '3.5噸') map[localDay].t35 += r.count;
    else if (r.category === '8噸以上') map[localDay].t80 += r.count;
  });

  var days = [];
  var totals = { t19: 0, t35: 0, t80: 0, sum: 0 };
  for (var d = 1; d <= daysInMonth; d++) {
    var v = map[d] || { t19: 0, t35: 0, t80: 0 };
    var sum = v.t19 + v.t35 + v.t80;
    days.push({ day: d, t19: v.t19, t35: v.t35, t80: v.t80, sum: sum });
    totals.t19 += v.t19; totals.t35 += v.t35; totals.t80 += v.t80; totals.sum += sum;
  }
  return { days: days, totals: totals };
}

function getMonth_SQL(monthStr) {
  var agg = aggregateMonth_SQL(monthStr);
  return { status: 'ok', month: monthStr, days: agg.days, totals: agg.totals };
}

// 沒帶參數時預設今天/這個月，方便直接用Apps Script的「執行」按鈕測試
// （執行按鈕沒辦法傳參數進去，一律是undefined，用這個預設值繞過去）
function 今天字串_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function 這個月字串_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM'); }

// ============================
// 比對工具：拿目前的實際查詢結果，新舊兩邊比對
// ============================
function 比對getDay(dateStr) {
  dateStr = dateStr || 今天字串_();
  var oldResult = JSON.parse(getDay({ parameter: { date: dateStr } }).getContent());
  var newResult = getDay_SQL(dateStr);

  function keyOf(r) { return [r.time, r.category, r.count, r.empId, r.name].join('§'); }
  function toSet(arr) { var s = {}; arr.forEach(function (r) { s[keyOf(r)] = true; }); return s; }

  var oldSet = toSet(oldResult.rows || []);
  var newSet = toSet(newResult.rows || []);
  var oldKeys = Object.keys(oldSet), newKeys = Object.keys(newSet);
  var onlyOld = oldKeys.filter(function (k) { return !newSet[k]; });
  var onlyNew = newKeys.filter(function (k) { return !oldSet[k]; });

  var msg;
  if (onlyOld.length === 0 && onlyNew.length === 0) {
    msg = dateStr + '：完全一致 ✅（共 ' + (oldResult.rows || []).length + ' 筆）';
  } else {
    var diffs = [];
    if (onlyOld.length > 0) diffs.push('舊有新無 ' + onlyOld.length + ' 筆 → ' + onlyOld.join(' | '));
    if (onlyNew.length > 0) diffs.push('新有舊無 ' + onlyNew.length + ' 筆 → ' + onlyNew.join(' | '));
    msg = dateStr + '：發現差異 ❌\n' + diffs.join('\n');
  }
  Logger.log(msg);
  return msg;
}

function 比對getMonth(monthStr) {
  monthStr = monthStr || 這個月字串_();
  var oldResult = JSON.parse(getMonth({ parameter: { month: monthStr } }).getContent());
  var newResult = getMonth_SQL(monthStr);

  var diffs = [];
  for (var i = 0; i < oldResult.days.length; i++) {
    var o = oldResult.days[i], n = newResult.days[i];
    if (o.t19 !== n.t19 || o.t35 !== n.t35 || o.t80 !== n.t80) {
      diffs.push('第' + o.day + '天：舊(' + o.t19 + ',' + o.t35 + ',' + o.t80 + ') 新(' + n.t19 + ',' + n.t35 + ',' + n.t80 + ')');
    }
  }
  var msg;
  if (diffs.length === 0) {
    msg = monthStr + '：完全一致 ✅（合計' + oldResult.totals.sum + '）';
  } else {
    msg = monthStr + '：發現差異 ❌\n' + diffs.join('\n');
  }
  Logger.log(msg);
  return msg;
}

// ============================
// 效能測試：同一次執行分別計時，避免受網路環境影響
// ============================
function 測試getDay效能(dateStr) {
  dateStr = dateStr || 今天字串_();
  var t1 = new Date().getTime();
  getDay({ parameter: { date: dateStr } });
  var t2 = new Date().getTime();
  getDay_SQL(dateStr);
  var t3 = new Date().getTime();
  var msg = dateStr + '：讀Sheets耗時 ' + (t2 - t1) + 'ms　讀Supabase耗時 ' + (t3 - t2) + 'ms';
  Logger.log(msg);
  return msg;
}
