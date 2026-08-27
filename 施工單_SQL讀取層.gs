// ════════════════════════════════════════════════════════════
// 天鷹保全 · 施工單管理 SQL遷移【第三階段：getOrders 讀取層】
// ────────────────────────────────────────────────────────────
// 用途：getOrders(mode) 給打烊/開店工具用，只需要「今晚/明早」或
//       「昨晚/今天」這兩天的資料，改讀Supabase用 work_date 索引查詢，
//       不用像現在整表撈4千多筆再篩。
//
// ⚠️ 範圍限定：這支只處理 getOrders，不含 tool_work.html 的搜尋/歷史
//    查詢功能（那個需要能查任意日期、自由文字搜尋全部歷史，範圍不同，
//    另外設計）。
//
// 2026-08-27 咖哩確認設計意圖（走過一輪來回確認）：**只要今天落在
// 「施工日期～退場日期」這個區間內就要顯示**，不管當天的Excel分頁裡
// 有沒有重新上傳那一筆——這才是原本getOrders()區間判斷邏輯真正要做的
// 事。之前比對測試發現「天圓室內裝修」這筆新版有顯示、舊版沒有，
// 查證後確認是**舊版的既有bug**：試算表裡這筆的施工日期/退場日期欄位
// 沒有存成真正的日期格式，導致舊版的instanceof Date判斷失敗、意外退回
// 成只認精確日期，才會漏掉「還在施工期間但當天沒有重新登記」的案例。
// 新版從Supabase的正規date欄位判斷，才是真正符合設計意圖的行為，
// 這個差異在後續驗證時預期會出現，是新版修正了舊版的漏抓，不是新版錯了。
//
// 查詢設計：用 work_date 索引先篩出「開始日期不會太早」的範圍（180天內
// 開始的），避免真的整表撈；exit_date 沒填的用 work_date 當單日工程
// 判斷。180天是保守估計「不會有比這更長的施工期」，之後若真的遇到更長
// 的案例導致查不到，這個數字要跟著調大。
// ════════════════════════════════════════════════════════════

var 查詢回溯天數_ = 180;

function 算日期字串_(d) {
  return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
}

// 對應 getOrders(mode) 但改讀 Supabase
function getOrders_SQL(mode) {
  var now = new Date();
  var dayA = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mode === 'opening') dayA.setDate(dayA.getDate() - 1);
  var dayB = new Date(dayA.getTime() + 86400000);

  var lowerBound = new Date(dayA.getTime());
  lowerBound.setDate(lowerBound.getDate() - 查詢回溯天數_);

  var path = '/rest/v1/construction_orders'
    + '?work_date=gte.' + 算日期字串_(lowerBound)
    + '&work_date=lte.' + 算日期字串_(dayB)
    + '&or=(exit_date.is.null,exit_date.gte.' + 算日期字串_(dayA) + ')';

  var supaRows = supabaseRequest2_('GET', path);

  return 分桶並回傳_(supaRows, dayA, dayB);
}

// 跟原本 getOrders() 完全一樣的去重＋分桶邏輯，只是輸入來源換成Supabase的列
function 分桶並回傳_(supaRows, dayA, dayB) {
  function toT(v) { var n = parseInt(String(v).replace(/\D/g, '')); return isNaN(n) ? -1 : n; }
  function d0(s) { if (!s) return null; var p = s.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
  function normLoose(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ''); }
  function looseTextMatch(a, b) {
    var na = normLoose(a), nb = normLoose(b);
    if (!na || !nb) return na === nb;
    return na === nb || na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0;
  }
  function rangesOverlap(g1, g2) { return g1.s <= g2.e && g2.s <= g1.e; }

  var rows = [];
  for (var i = 0; i < supaRows.length; i++) {
    var row = supaRows[i];
    var jobDate = d0(row.work_date);
    var exitDate = row.exit_date ? d0(row.exit_date) : jobDate; // 沒填退場日期，比照原邏輯fallback成施工日期
    if (jobDate && exitDate < jobDate) exitDate = jobDate;

    rows.push({
      applicant: row.apply_unit || '',
      shop: row.vendor || '',
      entryTime: row.entry_time || '',
      exitTime: row.exit_time || '',
      count: row.headcount || 0,
      supervisor: row.supervisor || '',
      location: row.location || '',
      workType: row.item || '',
      _t: toT(row.entry_time),
      _jobStart: jobDate,
      _jobEnd: exitDate
    });
  }

  // 模糊去重（跟原本getOrders一模一樣：監工+項目分桶，桶內廠商/地點寬鬆比對＋區間重疊）
  var buckets = {};
  rows.forEach(function (r) {
    var bkey = r.supervisor.trim() + '|' + r.workType.trim();
    var bucket = buckets[bkey] || (buckets[bkey] = []);
    var g = r._jobStart ? { s: r._jobStart, e: r._jobEnd } : null;
    var matched = null;
    for (var j = 0; j < bucket.length; j++) {
      var slot = bucket[j];
      if (!looseTextMatch(r.shop, slot.rep.shop)) continue;
      if (!looseTextMatch(r.location, slot.rep.location)) continue;
      if (g && slot.range) { if (!rangesOverlap(g, slot.range)) continue; }
      matched = slot; break;
    }
    if (!matched) {
      bucket.push({ rep: r, range: g });
    } else {
      if (g && matched.range) {
        matched.range = { s: g.s < matched.range.s ? g.s : matched.range.s, e: g.e > matched.range.e ? g.e : matched.range.e };
      } else if (g && !matched.range) {
        matched.range = g;
      }
      if (r._t >= 0 && matched.rep._t < 0) matched.rep = r;
    }
  });
  var deduped = [];
  Object.keys(buckets).forEach(function (k) {
    buckets[k].forEach(function (slot) { deduped.push(slot.rep); });
  });

  // 分桶：今晚(bucketA) / 明早(bucketB)
  var bucketA = [], bucketB = [];
  deduped.forEach(function (obj) {
    var isDayA = obj._jobStart && obj._jobStart <= dayA && dayA <= obj._jobEnd;
    var isDayB = obj._jobStart && obj._jobStart <= dayB && dayB <= obj._jobEnd;
    if (!isDayA && !isDayB) return;

    var t = obj._t;
    delete obj._t; delete obj._jobStart; delete obj._jobEnd;

    if ((isDayA && t >= 2000) || (isDayB && t >= 0 && t < 800)) {
      bucketA.push(obj);
    } else if (isDayB && t >= 800 && t < 2000) {
      bucketB.push(obj);
    } else if (isDayA || isDayB) {
      obj.timeUnclear = true;
      (isDayA ? bucketA : bucketB).push(obj);
    }
  });

  return { status: 'ok', tonight: bucketA, morning: bucketB };
}

// ============================
// 讀取含備援：doPost 的 getOrders action 改呼叫這支
// ============================
function getOrders_含備援(mode) {
  try {
    var result = getOrders_SQL(mode);
    return result;
  } catch (err) {
    console.error('getOrders讀Supabase失敗，改用Sheets：' + err.toString());
    return getOrders(mode);
  }
}

// ============================
// 比對工具：拿今天的實際查詢結果，新舊兩邊比對
// ============================
function 比對getOrders_(mode) {
  var oldResult = getOrders(mode);
  var newResult = getOrders_SQL(mode);

  function keyOf(r) { return [r.applicant, r.shop, r.entryTime, r.exitTime, r.supervisor, r.location, r.workType].join('§'); }
  function toSet(arr) { var s = {}; arr.forEach(function (r) { s[keyOf(r)] = true; }); return s; }

  var diffs = [];
  ['tonight', 'morning'].forEach(function (bucket) {
    var oldSet = toSet(oldResult[bucket] || []);
    var newSet = toSet(newResult[bucket] || []);
    var oldKeys = Object.keys(oldSet), newKeys = Object.keys(newSet);
    var onlyOld = oldKeys.filter(function (k) { return !newSet[k]; });
    var onlyNew = newKeys.filter(function (k) { return !oldSet[k]; });
    if (onlyOld.length > 0) diffs.push(bucket + '：舊有新無 ' + onlyOld.length + ' 筆 → ' + onlyOld.join(' | '));
    if (onlyNew.length > 0) diffs.push(bucket + '：新有舊無 ' + onlyNew.length + ' 筆 → ' + onlyNew.join(' | '));
  });

  if (diffs.length === 0) {
    return mode + '：完全一致 ✅（今晚' + (oldResult.tonight || []).length + '筆／明早' + (oldResult.morning || []).length + '筆）';
  }
  return mode + '：發現差異 ❌\n' + diffs.join('\n');
}

function 比對getOrders全部模式() {
  var msg = 比對getOrders_('closing') + '\n\n' + 比對getOrders_('opening');
  Logger.log(msg);
  return msg;
}

// ============================
// 效能測試：同一次執行分別計時，避免受網路環境影響
// ============================
function 測試getOrders效能() {
  var t1 = new Date().getTime();
  getOrders('closing');
  var t2 = new Date().getTime();
  getOrders_SQL('closing');
  var t3 = new Date().getTime();
  var msg = '讀Sheets耗時 ' + (t2 - t1) + 'ms　讀Supabase耗時 ' + (t3 - t2) + 'ms';
  Logger.log(msg);
  return msg;
}
