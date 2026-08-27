// ════════════════════════════════════════════════════════════
// 天鷹保全 · 打烊後管理 SQL遷移【第三階段：getTodayRows 讀取層】
// ────────────────────────────────────────────────────────────
// 用途：getTodayRows 給「今日」分頁用，只需要「當班時段」（今20:00~
//       明08:00，或昨20:00~今08:00）的資料，改讀Supabase用created_at
//       索引查詢，不用像現在整表撈再篩。
//
// ⚠️ 這支只處理讀取比對，還沒接進正式 doGet 路由——先跑
//    比對getTodayRows_() 和 測試getTodayRows效能() 確認新舊結果一致、
//    效能有改善，咖哩確認後才把 doGet 的 getTodayRows action 改呼叫
//    getTodayRows_含備援()（階段4跟寫入/匯出一起接上）。
//
// 需要跟遷移腳本（打烊_SQL遷移腳本.gs）貼在同一個專案，共用
// supabaseRequest2_ 等函式，不要重複貼一次。
// ════════════════════════════════════════════════════════════

function fmtTimeVal2_(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.substring(0, 5);
  return String(val).substring(0, 5);
}

// 對應原本 getTodayRows()，但改讀 Supabase
function getTodayRows_SQL() {
  var now = new Date();
  var nowHour = now.getHours();
  var shiftStart, shiftEnd;

  if (nowHour >= 20) {
    shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
    shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0);
  } else {
    shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0);
    shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
  }

  var fmt = function (d) { return Utilities.formatDate(d, 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ssXXX"); };
  var path = '/rest/v1/closing_gate_logs'
    + '?created_at=gte.' + encodeURIComponent(fmt(shiftStart))
    + '&created_at=lte.' + encodeURIComponent(fmt(shiftEnd))
    + '&order=created_at.desc';

  var rows = supabaseRequest2_('GET', path);

  return rows.map(function (r) {
    return {
      rowNum: r.id, // 階段4起，這個id會取代試算表列號成為編輯/刪除的定位鍵
      id: r.legacy_id,
      floor: r.floor,
      shop: r.shop_name,
      count: r.headcount,
      sup: r.supervisor,
      entry: fmtTimeVal2_(r.entry_time),
      loc: r.location,
      wtype: r.work_type,
      exit: fmtTimeVal2_(r.exit_time),
      ins: r.inspector,
      created: Utilities.formatDate(new Date(r.created_at), 'Asia/Taipei', 'HH:mm:ss')
    };
  });
}

// ============================
// 讀取含備援：doGet 的 getTodayRows action 改呼叫這支（階段4接上）
// ============================
function getTodayRows_含備援(e) {
  try {
    var rows = getTodayRows_SQL();
    return jsonRes({ status: 'ok', rows: rows });
  } catch (err) {
    console.error('getTodayRows讀Supabase失敗，改用Sheets：' + err.toString());
    return getTodayRows(e);
  }
}

// ============================
// 比對工具：拿目前的實際查詢結果，新舊兩邊比對
// ============================
function 比對getTodayRows_() {
  var oldResult = JSON.parse(getTodayRows({ parameter: {} }).getContent());
  var newRows = getTodayRows_SQL();

  function keyOf(r) { return [r.floor, r.shop, r.count, r.sup, r.entry, r.loc, r.wtype, r.exit, r.ins].join('§'); }
  function toSet(arr) { var s = {}; arr.forEach(function (r) { s[keyOf(r)] = true; }); return s; }

  var oldSet = toSet(oldResult.rows || []);
  var newSet = toSet(newRows);
  var oldKeys = Object.keys(oldSet), newKeys = Object.keys(newSet);
  var onlyOld = oldKeys.filter(function (k) { return !newSet[k]; });
  var onlyNew = newKeys.filter(function (k) { return !oldSet[k]; });

  if (onlyOld.length === 0 && onlyNew.length === 0) {
    return '完全一致 ✅（共 ' + (oldResult.rows || []).length + ' 筆）';
  }
  var diffs = [];
  if (onlyOld.length > 0) diffs.push('舊有新無 ' + onlyOld.length + ' 筆 → ' + onlyOld.join(' | '));
  if (onlyNew.length > 0) diffs.push('新有舊無 ' + onlyNew.length + ' 筆 → ' + onlyNew.join(' | '));
  var msg = '發現差異 ❌\n' + diffs.join('\n');
  Logger.log(msg);
  return msg;
}

// ============================
// 效能測試：同一次執行分別計時，避免受網路環境影響
// ============================
function 測試getTodayRows效能() {
  var t1 = new Date().getTime();
  getTodayRows({ parameter: {} });
  var t2 = new Date().getTime();
  getTodayRows_SQL();
  var t3 = new Date().getTime();
  var msg = '讀Sheets耗時 ' + (t2 - t1) + 'ms　讀Supabase耗時 ' + (t3 - t2) + 'ms';
  Logger.log(msg);
  return msg;
}
