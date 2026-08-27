/* ================================================================
   施工單 GAS — 修正版 v2.0（cec-up 上傳工具 / app 內資料上傳工具 的後端）

   2026-08-27 SQL遷移階段3：doPost的getOrders action改呼叫
   getOrders_含備援()（定義於同專案的 施工單_SQL讀取層.gs），優先讀
   Supabase，失敗自動退回原本這支 getOrders(mode) 讀 Sheets。
   ⚠️ 這個檔案要跟 施工單_SQL讀取層.gs、施工單_SQL遷移腳本.gs 貼在
   同一個 Apps Script 專案裡，缺一支就會 ReferenceError（班表管理那次
   踩過的坑，這次要記得）。

   2026-08-27 SQL遷移階段4（雙寫）：doPost 寫入施工單/動火申請成功後，
   同步寫進Supabase（_syncToSupabase）。⚠️ 刻意維持Sheets也照常寫入
   （雙寫，非取代）——因為 tool_work.html 的搜尋/歷史查詢功能還沒搬，
   仍直接讀Sheets，若停止寫入會讀到過時資料。之後那個功能也搬完，才
   考慮要不要真正停用Sheets寫入。
   試算表真實欄位 A~N：
     A=流水號 B=申請單位 C=廠商 D=月 E=日 F=進場時間 G=退場時間
     H=人數 I=監工 J=施工地點 K=施工項目 L=施工日期 M=退場日期 N=分頁來源/備註
   ================================================================ */

function _numVal(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return isNaN(n) ? '' : n;
}

function parseTimeAndDate(raw, fallbackMonth, fallbackDay) {
  const currentYear = new Date().getFullYear();
  const tz = Session.getScriptTimeZone();
  const s = String(raw || "").trim();
  const fbM = _numVal(fallbackMonth), fbD = _numVal(fallbackDay);

  function fbDate() {
    return (fbM !== '' && fbD !== '')
      ? Utilities.formatDate(new Date(currentYear, fbM - 1, fbD), tz, "yyyy/M/d")
      : "";
  }

  if (!s) {
    return { time: "", date: fbDate(), month: fbM, day: fbD };
  }

  const lines = s.split(/\r?\n/);
  if (lines.length >= 2) {
    const dm = lines[0].replace(/\s+/g, "").match(/(\d{1,2})\/(\d{1,2})$/);
    if (dm) {
      const mo = Number(dm[1]), dy = Number(dm[2]);
      return {
        time: lines[1].replace(/\s+/g, "").replace(/\D/g, "").padStart(4, "0"),
        date: Utilities.formatDate(new Date(currentYear, mo - 1, dy), tz, "yyyy/M/d"),
        month: mo, day: dy
      };
    }
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length > 4) {
    const time = digits.slice(-4);
    const prefix = digits.slice(0, -4);
    let month, day;
    if (prefix.length === 2) { month = Number(prefix[0]); day = Number(prefix[1]); }
    else if (prefix.length === 3) { month = Number(prefix[0]); day = Number(prefix.slice(1)); }
    else if (prefix.length === 4) { month = Number(prefix.slice(0, 2)); day = Number(prefix.slice(2)); }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        time,
        date: Utilities.formatDate(new Date(currentYear, month - 1, day), tz, "yyyy/M/d"),
        month, day
      };
    }
  }

  return { time: digits.padStart(4, "0"), date: fbDate(), month: fbM, day: fbD };
}

function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== "施工單查詢") return;

  const startRow = e.range.getRow();
  const numRows = e.range.getNumRows();
  if (startRow < 2) return;

  const currentYear = new Date().getFullYear();
  const tz = Session.getScriptTimeZone();
  const lastRow = sheet.getLastRow();

  const allData = sheet.getRange(startRow, 1, numRows, 13).getValues();

  const idValues = sheet
    .getRange(2, 1, Math.max(lastRow - 1, 1), 1)
    .getValues().flat();

  let maxId = 0;
  idValues.forEach(v => {
    const num = Number(v);
    if (!isNaN(num) && num > maxId) maxId = num;
  });

  const updates = [];

  allData.forEach((rowData) => {
    const row = [...rowData];

    if (!row[0]) {
      maxId++;
      row[0] = maxId;
    }

    const month = row[3];
    const day = row[4];

    const fResult = parseTimeAndDate(row[5], month, day);
    const gResult = parseTimeAndDate(row[6], month, day);

    row[5] = fResult.time || row[5];
    row[6] = gResult.time || row[6];

    const cm = _numVal(row[3]), cd = _numVal(row[4]);
    row[11] = (cm !== '' && cd !== '')
      ? Utilities.formatDate(new Date(currentYear, cm - 1, cd), tz, "yyyy/M/d")
      : "";

    row[12] = gResult.date || "";

    updates.push(row);
  });

  sheet.getRange(startRow, 1, updates.length, 13).setValues(updates);
}

// 2026-08-27：這支同時被選單手動點選、也被時間驅動排程自動呼叫，但
// getUi() 只有手動點選單那種有UI互動的情境才能用，排程觸發時呼叫會
// 直接拋例外。改成有UI就跳視窗，沒有（排程觸發）就寫進log，不讓排程
// 每次都失敗。
function 安全提示_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (err) {
    console.log('（排程觸發，無法顯示視窗）' + msg);
  }
}

function removeDuplicateBM() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("施工單查詢");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // ★ 修正：改讀 A~O 共 15 欄（含 N 備註、O 報到換證狀態），整列一起搬，
  //   避免去重後 A~M 上移、N/O 留在原位造成備註與報到狀態錯位。
  const COLS = 15;
  const data = sheet.getRange(2, 1, lastRow - 1, COLS).getValues();
  const keepRows = [];
  const seen = new Set();

  for (const row of data) {
    // ★ 跳過空殼列：申請單位(B)、廠商(C) 皆空 → 多半是過去去重 bug 殘留的孤兒列
    //   （施工資料已清空，只剩備註/報到狀態賴著），直接丟棄清乾淨
    if (String(row[1]).trim() === '' && String(row[2]).trim() === '') continue;
    // 去重 Key 維持 B~K（申請單位/廠商/月/日/進場/退場/人數/監工/地點/項目）
    const key = [row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10]]
      .map(v => String(v).trim())
      .join("§");
    if (!seen.has(key)) {
      seen.add(key);
      keepRows.push(row);
    }
  }

  if (keepRows.length === data.length) {
    安全提示_('沒有發現重複或空殼列！');
    return;
  }

  const removed = data.length - keepRows.length;
  sheet.getRange(2, 1, lastRow - 1, COLS).clearContent();
  if (keepRows.length > 0)
    sheet.getRange(2, 1, keepRows.length, COLS).setValues(keepRows);
  安全提示_(`完成！清掉 ${removed} 筆重複/空殼列，保留 ${keepRows.length} 筆。`);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('自訂工具')
    .addItem('清除重複資料', 'removeDuplicateBM')
    .addToUi();
}

// mode='closing'（預設，打烊工具晚上用）：dayA=今天 dayB=明天 → tonight=今晚(含跨夜) morning=明早
// mode='opening'（開店工具早上用）：dayA=昨天 dayB=今天 → tonight=昨晚(含跨夜) morning=今天
//   開店前查的是「早上開門前」，需要的是今天白天(08:00~20:00)要進場的施工單，
//   若沿用 closing 的 dayA=今天/dayB=明天，今天白天的資料會兩邊都比對不到、永遠看不到。
//
// 2026-07-30 健檢補修（跟 tool_work.html 的 dedupeRows/jobRange 邏輯比照，同一套判斷方向）：
//   ① 只用單一天的 D/E 欄比對，長期授權（如 6/1~6/30）中間日完全不顯示 → 改用
//      L(施工日期)/M(退場日期) 區間涵蓋 dayA/dayB 判斷，L/M 缺資料時退回原本的 D/E 精確比對。
//   ② 進場時間空白/爛資料的列，三種時段判斷都不命中 → 整筆靜默消失 → 改成落入符合的分頁，
//      標記 timeUnclear，不再無聲消失。
//   ③ 完全沒套用模糊去重 → 同一施工單文字打法不同會顯示兩張重複卡片 → 補上跟 tool_work.html
//      dedupeRows 同一套規則：監工+施工項目完全相同分桶，桶內廠商/地點寬鬆比對＋施工區間重疊
//      才視為重複；拿不準的邊界案例一律不合併（漏抓比多顯示嚴重）。
function getOrders(mode) {
  // 2026-08-27：getSheetByName('施工單查詢') 手動執行時會拋出詭異的
  // 「Sheet 38985608 not found」（一個數字，疑似分頁名稱含看不見的特殊
  // 字元），改用 依gid取分頁_()（定義於同專案的 施工單_SQL遷移腳本.gs，
  // gid=0 已用診斷函式確認過）繞過名稱比對。
  var sheet = 依gid取分頁_(0);
  if (!sheet) return { status: 'error', msg: '找不到分頁：施工單查詢' };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'ok', tonight: [], morning: [] };

  var now = new Date();
  var dayA = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mode === 'opening') dayA.setDate(dayA.getDate() - 1); // 昨天
  var dayB = new Date(dayA.getTime() + 86400000);           // dayA 隔天
  var aM = dayA.getMonth() + 1, aD = dayA.getDate();
  var bM = dayB.getMonth() + 1, bD = dayB.getDate();

  function toT(v) { var n = parseInt(String(v).replace(/\D/g, '')); return isNaN(n) ? -1 : n; }
  function d0(dt) { var x = new Date(dt); x.setHours(0, 0, 0, 0); return x; }
  function normLoose(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ''); }
  function looseTextMatch(a, b) {
    var na = normLoose(a), nb = normLoose(b);
    if (!na || !nb) return na === nb;
    return na === nb || na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0;
  }
  function rangesOverlap(g1, g2) { return g1.s <= g2.e && g2.s <= g1.e; }

  // 1) 讀原始列，順便算出施工區間（L/M 欄），供分桶與去重共用
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[1] && !row[2]) continue; // 空殼列略過

    var jobDate = (row[11] instanceof Date) ? d0(row[11]) : null;   // L 施工日期
    var exitDate = (row[12] instanceof Date) ? d0(row[12]) : jobDate; // M 退場日期，缺就當單日
    if (jobDate && exitDate < jobDate) exitDate = jobDate;

    rows.push({
      applicant:  String(row[1]  || ''),
      shop:       String(row[2]  || ''),
      month:      row[3],
      day:        row[4],
      entryTime:  String(row[5]  || ''),
      exitTime:   String(row[6]  || ''),
      count:      parseInt(row[7])  || 0,
      supervisor: String(row[8]  || ''),
      location:   String(row[9]  || ''),
      workType:   String(row[10] || ''),
      tabName:    String(row[13] || ''),
      _t:         toT(row[5]),
      _jobStart:  jobDate,
      _jobEnd:    exitDate
    });
  }

  // 2) 模糊去重（比照 tool_work.html dedupeRows）
  var buckets = {};
  rows.forEach(function(r) {
    var bkey = r.supervisor.trim() + '|' + r.workType.trim();
    var bucket = buckets[bkey] || (buckets[bkey] = []);
    var g = r._jobStart ? { s: r._jobStart, e: r._jobEnd } : null;
    var matched = null;
    for (var j = 0; j < bucket.length; j++) {
      var slot = bucket[j];
      if (!looseTextMatch(r.shop, slot.rep.shop)) continue;
      if (!looseTextMatch(r.location, slot.rep.location)) continue;
      // 兩邊都有合法區間才要求重疊；只要有一邊缺日期資料，沿用原設計靠廠商/地點/項目/監工判定重複
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
      // 保留進場時間正常的那筆，都正常/都異常則保留先到的
      if (r._t >= 0 && matched.rep._t < 0) matched.rep = r;
    }
  });
  var deduped = [];
  Object.keys(buckets).forEach(function(k) {
    buckets[k].forEach(function(slot) { deduped.push(slot.rep); });
  });

  // 3) 分桶：有施工區間資料就用區間涵蓋 dayA/dayB 判斷（修正多天施工中間日不顯示），
  //    沒有就退回原本的月/日精確比對。班別（天鷹定義）：早班 08:00~20:00、晚班 20:00~隔天 08:00
  //      bucketA = dayA晚班(進場≥2000) ＋ dayB凌晨(進場<0800，屬跨夜段)
  //      bucketB = dayB早班(進場 08:00~20:00)
  var bucketA = [], bucketB = [];

  deduped.forEach(function(obj) {
    var isDayA, isDayB;
    if (obj._jobStart) {
      isDayA = obj._jobStart <= dayA && dayA <= obj._jobEnd;
      isDayB = obj._jobStart <= dayB && dayB <= obj._jobEnd;
    } else {
      var m = parseInt(obj.month), d = parseInt(obj.day);
      isDayA = (m === aM && d === aD);
      isDayB = (m === bM && d === bD);
    }
    if (!isDayA && !isDayB) return;

    var t = obj._t;
    delete obj._t; delete obj._jobStart; delete obj._jobEnd;

    if ((isDayA && t >= 2000) || (isDayB && t >= 0 && t < 800)) {
      bucketA.push(obj);                  // 今晚/昨晚（含跨夜）
    } else if (isDayB && t >= 800 && t < 2000) {
      bucketB.push(obj);                  // 明早/今天
    } else if (isDayA || isDayB) {
      // 進場時間空白/爛資料：不再靜默消失，落到符合的天並標記待確認
      obj.timeUnclear = true;
      (isDayA ? bucketA : bucketB).push(obj);
    }
  });

  return { status: 'ok', tonight: bucketA, morning: bucketB };
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const currentYear = new Date().getFullYear();
    const tz = Session.getScriptTimeZone();

    if (payload.action === 'getOrders') {
      // v2：優先讀Supabase（work_date索引查詢，不用整表撈），失敗自動退回讀
      // Sheets（getOrders_含備援 定義於 施工單_SQL讀取層.gs）
      const result = getOrders_含備援(payload.mode);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    function _parseTime(raw, fallbackMonth, fallbackDay) {
      const fbM = _numVal(fallbackMonth), fbD = _numVal(fallbackDay);
      const lines = String(raw || "").split(/\r?\n/);
      if (lines.length >= 2) {
        const dm = lines[0].replace(/\s+/g, "").match(/(\d{1,2})\/(\d{1,2})$/);
        if (dm) {
          const mo = Number(dm[1]), dy = Number(dm[2]);
          return {
            time: lines[1].replace(/\D/g, "").padStart(4, "0"),
            date: Utilities.formatDate(new Date(currentYear, mo - 1, dy), tz, "yyyy/M/d"),
            month: mo, day: dy
          };
        }
      }
      const digits = String(raw || "").replace(/\s+/g, "").replace(/\D/g, "");
      if (digits.length > 4) {
        const time = digits.slice(-4);
        const prefix = digits.slice(0, -4);
        let month, day;
        if (prefix.length === 2) { month = Number(prefix[0]); day = Number(prefix[1]); }
        else if (prefix.length === 3) { month = Number(prefix[0]); day = Number(prefix.slice(1)); }
        else if (prefix.length === 4) { month = Number(prefix.slice(0, 2)); day = Number(prefix.slice(2)); }
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return {
            time,
            date: Utilities.formatDate(new Date(currentYear, month - 1, day), tz, "yyyy/M/d"),
            month, day
          };
        }
        return { time, date: _fallbackDate(fbM, fbD), month: fbM, day: fbD };
      }
      return {
        time: digits.length ? digits.padStart(4, "0") : "",
        date: _fallbackDate(fbM, fbD),
        month: fbM, day: fbD
      };
    }

    function _fallbackDate(m, d) {
      if (m === '' || d === '' || m == null || d == null) return "";
      return Utilities.formatDate(new Date(currentYear, Number(m) - 1, Number(d)), tz, "yyyy/M/d");
    }

    // 把 "yyyy/M/d" 格式轉成 Postgres 用的 "yyyy-MM-dd"，空字串回傳null
    function _toIsoDate(s) {
      if (!s) return null;
      var p = String(s).split('/');
      if (p.length !== 3) return null;
      return p[0] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[2]).slice(-2);
    }

    // v2.16：SQL遷移階段4——同步寫入Supabase，Sheets仍照常寫入不受影響。
    // 失敗只記log不擋Sheets這邊的正常流程（Sheets目前仍是雙寫來源之一，
    // tool_work.html的搜尋/歷史查詢功能還沒搬，仍需要Sheets持續更新）。
    function _syncToSupabase(path, rows) {
      try {
        if (rows.length === 0) return;
        supabaseRequest2_('POST', path + '?on_conflict=dedupe_key', rows,
          { Prefer: 'resolution=ignore-duplicates' });
      } catch (err) {
        console.error('同步Supabase失敗（' + path + '，不影響Sheets已成功寫入）：' + err.toString());
      }
    }

    function _buildKeys(sheet, startCol, totalCols, keyColIndexes) {
      const lastRow = sheet.getLastRow();
      const keys = new Set();
      if (lastRow >= 2) {
        sheet.getRange(2, startCol, lastRow - 1, totalCols).getValues().forEach(row => {
          keys.add(keyColIndexes.map(i => String(row[i]).trim()).join("§"));
        });
      }
      return keys;
    }

    let result = {};

    // ===== 施工單 → 施工單查詢（A~N 欄，共 14 欄）=====
    if (payload.rows && payload.rows.length > 0) {
      const sheet = ss.getSheetByName("施工單查詢");

      const existingKeys = _buildKeys(sheet, 1, 11, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      const lastRow = sheet.getLastRow();
      const idValues = lastRow >= 2
        ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat() : [];
      let maxId = 0;
      idValues.forEach(v => { const n = Number(v); if (!isNaN(n) && n > maxId) maxId = n; });

      const writeData = [];
      const supabaseRows = [];
      let skipped = 0;

      payload.rows.forEach(r => {
        const month = r[2], day = r[3];
        const f = _parseTime(r[4], month, day);
        const g = _parseTime(r[5], month, day);

        const finalMonth = _numVal(month);
        const finalDay   = _numVal(day);

        const key = [r[0], r[1], finalMonth, finalDay, f.time, g.time, r[6], r[7], r[8], r[9]]
          .map(v => String(v).trim()).join("§");
        if (existingKeys.has(key)) { skipped++; return; }
        existingKeys.add(key);
        maxId++;

        const entryDate = _fallbackDate(finalMonth, finalDay);
        const exitDate  = g.date || entryDate;
        writeData.push([
          maxId,
          r[0], r[1], finalMonth, finalDay,
          f.time, g.time,
          r[6], r[7], r[8], r[9],
          entryDate, exitDate,
          ''            // ★ N 欄不再寫分頁名（不可靠又是雜訊）；留空給人工備註用
        ]);
        supabaseRows.push({
          apply_unit: String(r[0] || ''), vendor: String(r[1] || ''),
          work_date: _toIsoDate(entryDate), entry_time: f.time, exit_time: g.time,
          headcount: r[6] === '' || r[6] == null ? null : Number(r[6]),
          supervisor: String(r[7] || ''), location: String(r[8] || ''), item: String(r[9] || ''),
          exit_date: _toIsoDate(exitDate), note: '', dedupe_key: key
        });
      });

      if (writeData.length > 0)
        sheet.getRange(sheet.getLastRow() + 1, 1, writeData.length, 14).setValues(writeData);
      _syncToSupabase('/rest/v1/construction_orders', supabaseRows);

      result.construction = { inserted: writeData.length, skipped };
    }

    // ===== 動火申請 → 動火申請查詢（B~N欄，跳過A欄讓ARRAYFORMULA跑）=====
    if (payload.fireRows && payload.fireRows.length > 0) {
      const targetSs = SpreadsheetApp.openById("1QuNkwu9zgPidUfSgWpqyT1M9X683IU-0LhXTc23hw-A");
      const sheet = targetSs.getSheetByName("動火申請查詢");

      const existingKeys = _buildKeys(sheet, 2, 10, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      const writeData = [];
      const supabaseRows = [];
      let skipped = 0;

      payload.fireRows.forEach(r => {
        const month = r[2], day = r[3];
        const f = _parseTime(r[4], month, day);
        const g = _parseTime(r[5], month, day);

        const finalMonth = _numVal(month);
        const finalDay   = _numVal(day);

        const key = [r[0], r[1], finalMonth, finalDay, f.time, g.time, r[6], r[7], r[8], r[9]]
          .map(v => String(v).trim()).join("§");
        if (existingKeys.has(key)) { skipped++; return; }
        existingKeys.add(key);

        const entryDate = _fallbackDate(finalMonth, finalDay);
        const exitDate  = g.date || entryDate;

        writeData.push([
          r[0], r[1], finalMonth, finalDay,
          f.time, g.time,
          r[6], r[7], r[8], r[9],
          r[10],
          entryDate, exitDate,
        ]);
        supabaseRows.push({
          apply_unit: String(r[0] || ''), vendor: String(r[1] || ''),
          work_date: _toIsoDate(entryDate), entry_time: f.time, exit_time: g.time,
          headcount: r[6] === '' || r[6] == null ? null : Number(r[6]),
          supervisor: String(r[7] || ''), location: String(r[8] || ''), item: String(r[9] || ''),
          equipment: String(r[10] || ''), exit_date: _toIsoDate(exitDate), dedupe_key: key
        });
      });

      if (writeData.length > 0)
        sheet.getRange(sheet.getLastRow() + 1, 2, writeData.length, 13).setValues(writeData);
      _syncToSupabase('/rest/v1/fire_permits', supabaseRows);

      result.fire = { inserted: writeData.length, skipped };
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, ...result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
