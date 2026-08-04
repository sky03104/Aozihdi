// ════════════════════════════════════════════════════════════
// 天鷹保全 · 班表上傳 Google Apps Script【完整貼上版】
// 部署網址：https://script.google.com/macros/s/AKfycbzs56InZLeaHiRJhy1alNfQwDyH0mXEV9t_WJxzfjTjIhf68DHgMiWVQvVG6vKrRZ2x1w/exec
// （早班晚班共用同一支，透過 SHIFT_CONFIG / payload.shift 分流，非天鷹保全APP帳號系統那支）
//
// 版本：2.12 新增：
//   - handleUpdateSchedule：找不到姓名時自動塞入空白列（新增員工同步）、同步寫入職稱欄
//   - handleDeleteStaff：deleteStaff 動作，清空整列（不刪實體列，避免破壞固定範圍/格式）
// 版本：2.11 新增：
//   - getShiftSettings_：讀取「班別設定」分頁，供 APP 跨裝置同步自訂班別代號
//   - updateShiftSettings_：寫入「班別設定」分頁（分頁不存在時自動建立）
// 版本：2.10 新增：
//   - copyRangeWithFormat 不再複製欄寬/列高，避免每次上傳後live分頁欄位變窄
// ════════════════════════════════════════════════════════════

// ⚠️ 「天鷹保全APP」GAS的部署網址（doPost那支，結尾為 /exec）
var NOTIFY_GAS_URL = "https://script.google.com/macros/s/AKfycbxEVBHseDpLWiWe4d8kLcCHbVFiKAK9wyoLwqNkt59PS4vPCY9QfG0_wiDJf2coO3zMcg/exec";

// ── 雙班別設定 ──
var SHIFT_CONFIG = {
  // 晚班：維持原本目標（不變）
  night: {
    label: '晚班',
    targetSsId: '1hIbgESfLitqC3W9DuSFGMWEuFZKJFKzK8srorQMuia8',
    targetSheetName: '晚班班表',
    targetGid: 1144284018,
    sourceSheetName: '晚班班表'
  },
  // 早班：新增目標（早班線上班表）
  morning: {
    label: '早班',
    targetSsId: '1l8SoOVDQ4nO6qBkXcNEaBzct6AN82-H_0njbKNQauUQ',
    targetSheetName: '早班班表',
    targetGid: 38985608,
    sourceSheetName: '早班班表'
  }
};

// 上傳的 Excel 暫存資料夾
var SOURCE_FOLDER_ID = '1JaWrMWQQBGGt1BGGaUKqnwTVKQ9De8Na';

// ============================
// POST 入口
// ============================
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    if (action === 'upload') {
      return handleUpload(payload);
    } else if (action === 'update') {
      return handleUpdate(payload);
    } else if (action === 'updateSchedule') {
      return handleUpdateSchedule(payload);
    } else if (action === 'updateShiftSettings') {
      return updateShiftSettings_(payload);
    } else if (action === 'deleteStaff') {
      return handleDeleteStaff(payload);
    }

    throw new Error('未知的 action');
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ============================
// GET 入口（連線測試用）
// ============================
function doGet(e) {
  var action = (e && e.parameter) ? e.parameter.action : '';

  if (action === 'getSchedule') {
    return getScheduleData(e);
  } else if (action === 'getShiftSettings') {
    return getShiftSettings_();
  }

  return respond({ success: true, status: 'online' });
}

// ============================
// 上傳 Excel 到雲端硬碟
// ============================
function handleUpload(payload) {
  var base64 = payload.fileData;
  var fileName = payload.fileName || '班表上傳.xlsx';

  var folder = DriveApp.getFolderById(SOURCE_FOLDER_ID);

  // 刪除同名舊檔
  var existing = folder.getFilesByName(fileName);
  while (existing.hasNext()) existing.next().setTrashed(true);

  // 建立新檔
  var blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName
  );
  var file = folder.createFile(blob);

  return respond({ success: true, fileId: file.getId(), fileName: file.getName() });
}

// ============================
// 輔助函式：解析班別代號（含排休字色判斷）
// val = 儲存格值，color = 字體顏色字串
// ============================
function parseShiftCode_(val, color) {
  var v = String(val == null ? '' : val).trim();
  var c = String(color || '').toLowerCase();
  // 試算表中「排休」以紅字「休」儲存
  if (v === '休' && (c === '#ff0000' || c === 'red')) return '排休';
  return v || '-';
}

// ============================
// 輔助函式：取得台北時間「yyyy/MM」格式年月字串
// ============================
function getTaipeiYm_() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM');
}

// ============================
// 輔助函式：年/月數字 → 「yyyy/MM」字串（與 getTaipeiYm_ 格式一致）
// ============================
function buildYm_(year, monthNum) {
  return year + '/' + (monthNum < 10 ? '0' + monthNum : String(monthNum));
}

// ============================
// 依設定取得「待生效」分頁；不存在則複製live分頁建立同結構分頁
// ============================
function getStagingSheet_(cfg) {
  var ss = SpreadsheetApp.openById(cfg.targetSsId);
  var stagingName = cfg.targetSheetName + '_待生效';
  var sh = ss.getSheetByName(stagingName);
  if (!sh) {
    var liveSheet = resolveTargetSheet(cfg);
    sh = liveSheet.copyTo(ss);
    sh.setName(stagingName);
  }
  return sh;
}

// ============================
// 從雲端硬碟讀取 Excel 並更新線上班表
// ============================
function handleUpdate(payload) {
  var fileId = payload.fileId;

  var cfg = SHIFT_CONFIG[payload.shift] || SHIFT_CONFIG.night;
  var srcName = payload.srcSheet || cfg.sourceSheetName;

  var tempSs = Drive.Files.copy(
    { title: '_temp_班表_' + Date.now(), mimeType: MimeType.GOOGLE_SHEETS },
    fileId
  );
  var tempSsId = tempSs.id;

  try {
    var srcSs = SpreadsheetApp.openById(tempSsId);
    var srcSheet = srcSs.getSheetByName(srcName);
    if (!srcSheet) throw new Error('找不到來源分頁「' + srcName + '」');

    var tgtSheet = resolveTargetSheet(cfg);

    var notifyShiftType = (payload.shift === 'morning') ? 'early' : 'late';

    var monthVal = srcSheet.getRange('Z1').getValue();
    var monthNum = Number(monthVal);
    var year = Number(payload.year) || (new Date()).getFullYear();
    var newYm = (monthNum >= 1 && monthNum <= 12) ? buildYm_(year, monthNum) : '';

    var liveYm = String(tgtSheet.getRange('Z1').getValue() || '').trim();
    var todayYm = getTaipeiYm_();

    var isStagingUpload = !!(newYm && liveYm && newYm !== liveYm && newYm !== todayYm);
    var isMonthSwitch   = !!(newYm && newYm !== liveYm && newYm === todayYm);

    if (isStagingUpload) {
      var stagingSheet = getStagingSheet_(cfg);
      copyRangeWithFormat(srcSheet, stagingSheet, 'A4:AG30');
      copyRangeWithFormat(srcSheet, stagingSheet, 'C2:AG3');
      stagingSheet.getRange('Z1').setValue(newYm);
      SpreadsheetApp.flush();
      return respond({
        success: true,
        message: cfg.label + newYm + ' 班表已上傳至待生效區，將於 ' + newYm + ' 1日自動切換生效（目前線上班表不受影響）'
      });
    }

    var oldVals, oldColors;
    if (!isMonthSwitch) {
      oldVals   = tgtSheet.getRange('A4:AG30').getValues();
      oldColors = tgtSheet.getRange('A4:AG30').getFontColors();
    }

    copyRangeWithFormat(srcSheet, tgtSheet, 'A4:AG30');

    if (isMonthSwitch) {
      notifyMonthScheduleReleased_(notifyShiftType, newYm);
    } else {
      var newVals   = tgtSheet.getRange('A4:AG30').getValues();
      var newColors = tgtSheet.getRange('A4:AG30').getFontColors();

      var allDiffs = [];

      for (var r = 0; r < newVals.length; r++) {
        var name = String(newVals[r][1] || '').trim();
        if (!name) continue;

        var diffDays = [];
        for (var c = 2; c <= 31; c++) {
          var oldCode = parseShiftCode_(oldVals[r][c], oldColors[r][c]);
          var newCode = parseShiftCode_(newVals[r][c], newColors[r][c]);
          if (oldCode !== newCode) {
            diffDays.push({ day: c - 1, code: newCode });
          }
        }

        if (diffDays.length > 0) {
          allDiffs.push({ name: name, shiftType: notifyShiftType, days: diffDays });
        }
      }

      // 2026-08-02：一次異動達門檻（換月、整批調整）改群組發一則，個位數的一般小異動
      // 仍走個人化推播（讓當事人清楚知道自己哪幾天改了），兩種情境門檻分開處理。
      var BULK_DIFF_THRESHOLD = 10;
      if (allDiffs.length >= BULK_DIFF_THRESHOLD) {
        notifyScheduleChangeBulkToLine_(notifyShiftType, allDiffs.length);
      } else if (allDiffs.length > 0) {
        notifyScheduleChangeBatchToLine_(allDiffs);
      }
    }

    copyRangeWithFormat(srcSheet, tgtSheet, 'C2:AG3');

    if (newYm) {
      tgtSheet.getRange('Z1').setValue(newYm);
    }

    SpreadsheetApp.flush();
    return respond({
      success: true,
      message: cfg.label + '線上班表已更新完成' + (isMonthSwitch ? '（已切換為' + newYm + '）' : '')
    });

  } finally {
    try { DriveApp.getFileById(tempSsId).setTrashed(true); } catch (e) {}
  }
}

// ============================
// 依設定取得目標分頁：gid 優先、名稱備援
// ============================
function resolveTargetSheet(cfg) {
  var ss = SpreadsheetApp.openById(cfg.targetSsId);
  if (cfg.targetGid != null) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === cfg.targetGid) return sheets[i];
    }
  }
  if (cfg.targetSheetName) {
    var sh = ss.getSheetByName(cfg.targetSheetName);
    if (sh) return sh;
  }
  throw new Error('找不到' + cfg.label + '目標分頁（gid:' + cfg.targetGid + ' / 名稱:' + cfg.targetSheetName + '）');
}

// ============================
// 複製範圍：內容＋格式＋合併儲存格（v2.10：不複製欄寬/列高）
// ============================
function copyRangeWithFormat(srcSheet, tgtSheet, rangeA1) {
  var src = srcSheet.getRange(rangeA1);
  var tgt = tgtSheet.getRange(rangeA1);

  tgt.setValues(src.getValues());
  tgt.setBackgrounds(src.getBackgrounds());
  tgt.setFontColors(src.getFontColors());
  tgt.setFontWeights(src.getFontWeights());
  tgt.setFontStyles(src.getFontStyles());
  tgt.setFontSizes(src.getFontSizes());
  tgt.setFontFamilies(src.getFontFamilies());
  tgt.setHorizontalAlignments(src.getHorizontalAlignments());
  tgt.setVerticalAlignments(src.getVerticalAlignments());
  tgt.setNumberFormats(src.getNumberFormats());

  tgt.breakApart();
  var merges = src.getMergedRanges();
  for (var i = 0; i < merges.length; i++) {
    var m = merges[i];
    tgtSheet.getRange(m.getRow(), m.getColumn(), m.getNumRows(), m.getNumColumns()).merge();
  }
}

// ============================
// 班表管理工具：讀取線上班表
// ============================
function getScheduleData(e) {
  try {
    var shiftKey = (e && e.parameter) ? e.parameter.shift : '';
    var cfg = SHIFT_CONFIG[shiftKey] || SHIFT_CONFIG.night;
    var sh = resolveTargetSheet(cfg);
    var ym = String(sh.getRange('Z1').getValue() || '').trim();
    var rng = sh.getRange('A4:AG30');
    var data = rng.getValues();
    var colors = rng.getFontColors();
    var rows = [];
    for (var r = 0; r < data.length; r++) {
      var name = String(data[r][1] || '').trim();
      if (!name) continue;
      var shifts = [];
      for (var c = 2; c < 33; c++) {
        var v = String(data[r][c] == null ? '' : data[r][c]).trim();
        if (v === '休') {
          var col = String(colors[r][c] || '').toLowerCase();
          if (col === '#ff0000' || col === 'red') v = '排休';
        }
        shifts.push(v);
      }
      rows.push({ roleStr: String(data[r][0] || '').trim(), name: name, shifts: shifts });
    }
    return respond({ success: true, ym: ym, rows: rows });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ============================
// 通知「天鷹保全APP」GAS：班表異動（單一員工）
// ============================
function notifyScheduleChangeToLine_(name, shiftType, days) {
  try {
    if (!days || !days.length) return;
    if (!NOTIFY_GAS_URL || NOTIFY_GAS_URL.indexOf('請填入') === 0) return;
    UrlFetchApp.fetch(NOTIFY_GAS_URL, {
      method: 'post',
      payload: {
        action: 'notifyScheduleChange',
        data: JSON.stringify({ name: name, shiftType: shiftType, days: days })
      },
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('notifyScheduleChangeToLine_ 失敗：' + err.toString());
  }
}

// ============================
// v2.8：通知「天鷹保全APP」GAS：班表異動（整批多員工）
// ============================
function notifyScheduleChangeBatchToLine_(items) {
  try {
    if (!items || !items.length) return;
    if (!NOTIFY_GAS_URL || NOTIFY_GAS_URL.indexOf('請填入') === 0) return;
    UrlFetchApp.fetch(NOTIFY_GAS_URL, {
      method: 'post',
      payload: {
        action: 'notifyScheduleChangeBatch',
        data: JSON.stringify(items)
      },
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('notifyScheduleChangeBatchToLine_ 失敗：' + err.toString());
  }
}

// 2026-08-02 新增：一次異動人數太多（例如換月整批班表一起改）改群組發一則，不逐人各發一則，
// 避免像 8/1 換月那次一天燒掉149則個人推播、把當月免費額度吃光。
function notifyScheduleChangeBulkToLine_(shiftType, count) {
  try {
    if (!NOTIFY_GAS_URL || NOTIFY_GAS_URL.indexOf('請填入') === 0) return;
    UrlFetchApp.fetch(NOTIFY_GAS_URL, {
      method: 'post',
      payload: {
        action: 'notifyScheduleChangeBulk',
        data: JSON.stringify({ shiftType: shiftType, count: count })
      },
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('notifyScheduleChangeBulkToLine_ 失敗：' + err.toString());
  }
}

// ============================
// v2.9：通知「天鷹保全APP」GAS：換月公告
// ============================
function notifyMonthScheduleReleased_(shiftType, ym) {
  try {
    if (!NOTIFY_GAS_URL || NOTIFY_GAS_URL.indexOf('請填入') === 0) return;
    UrlFetchApp.fetch(NOTIFY_GAS_URL, {
      method: 'post',
      payload: {
        action: 'monthScheduleReleased',
        data: JSON.stringify({ shiftType: shiftType, ym: ym })
      },
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('notifyMonthScheduleReleased_ 失敗：' + err.toString());
  }
}

// ============================
// v2.9：每日時間觸發器執行函式（月初自動切換待生效分頁）
// ============================
function checkAndSwitchMonth_() {
  var todayYm = getTaipeiYm_();

  for (var key in SHIFT_CONFIG) {
    var cfg = SHIFT_CONFIG[key];
    try {
      var ss = SpreadsheetApp.openById(cfg.targetSsId);
      var stagingSheet = ss.getSheetByName(cfg.targetSheetName + '_待生效');
      if (!stagingSheet) continue;

      var stagingYm = String(stagingSheet.getRange('Z1').getValue() || '').trim();
      if (!stagingYm || stagingYm !== todayYm) continue;

      var tgtSheet = resolveTargetSheet(cfg);
      var liveYm = String(tgtSheet.getRange('Z1').getValue() || '').trim();
      if (liveYm === todayYm) continue;

      copyRangeWithFormat(stagingSheet, tgtSheet, 'A4:AG30');
      copyRangeWithFormat(stagingSheet, tgtSheet, 'C2:AG3');
      tgtSheet.getRange('Z1').setValue(stagingYm);
      SpreadsheetApp.flush();

      var notifyShiftType = (key === 'morning') ? 'early' : 'late';
      notifyMonthScheduleReleased_(notifyShiftType, stagingYm);
    } catch (err) {
      console.error('checkAndSwitchMonth_ 失敗（' + key + '）：' + err.toString());
    }
  }
}

// ============================
// v2.9：一次性設定每日換月檢查觸發器
// ============================
function setupMonthSwitchTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkAndSwitchMonth_') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('checkAndSwitchMonth_')
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();
  Logger.log('已建立每日換月檢查觸發器（每日00:00~01:00間執行一次）');
}

function runSetupMonthSwitchTrigger() {
  setupMonthSwitchTrigger_();
}

// ============================
// 班表管理工具：手動排班寫回線上班表
// v2.12：找不到姓名時自動塞入空白列（新增員工同步）、同步寫入職稱欄
// ============================
function handleUpdateSchedule(payload) {
  try {
    var cfg = SHIFT_CONFIG[payload.shift] || SHIFT_CONFIG.night;
    var sh = resolveTargetSheet(cfg);

    var ym = String(sh.getRange('Z1').getValue() || '').trim();
    var m = Number(payload.month), y = Number(payload.year);
    if (ym && m >= 1 && m <= 12 && y > 2000) {
      var expect = y + '/' + (m < 10 ? '0' + m : String(m));
      if (ym !== expect) {
        return respond({ success: false, error: '線上班表月份(' + ym + ')與資料月份(' + expect + ')不符，未寫入' });
      }
    }

    var notifyShiftType = (payload.shift === 'morning') ? 'early' : 'late';

    var grid = sh.getRange('A4:AG30').getValues();
    var list = payload.data || [];
    var updated = 0, added = 0, skipped = 0;
    for (var i = 0; i < list.length; i++) {
      var nm = String(list[i].name || '').trim();
      if (!nm) continue;

      var foundRow = -1, emptyRow = -1;
      for (var r = 0; r < grid.length; r++) {
        var rowName = String(grid[r][1] || '').trim();
        if (rowName === nm) { foundRow = r; break; }
        if (emptyRow === -1 && !rowName) emptyRow = r;
      }

      var targetRow = foundRow;
      var isNew = false;
      if (targetRow === -1) {
        if (emptyRow === -1) { skipped++; continue; } // 沒有空白列可用，需人工到試算表擴充範圍
        targetRow = emptyRow;
        isNew = true;
      }

      var roleStr = String(list[i].roleStr || '').trim();
      if (isNew || roleStr) {
        sh.getRange(4 + targetRow, 1).setValue(roleStr || '保全');
        sh.getRange(4 + targetRow, 2).setValue(nm);
        grid[targetRow][0] = roleStr || '保全';
        grid[targetRow][1] = nm;
      }

      var shifts = list[i].shifts || [];
      var n = Math.min(shifts.length, 31);
      if (n > 0) {
        var oldVals = sh.getRange(4 + targetRow, 3, 1, n).getValues()[0];

        var vals = [], cols = [], notifyCodes = [];
        for (var c = 0; c < n; c++) {
          var v = String(shifts[c] == null ? '' : shifts[c]).trim();
          if (v === '排休') {
            vals.push('休');
            cols.push('#ff0000');
            notifyCodes.push('排休');
          } else {
            vals.push(v === '-' ? '' : v);
            cols.push('#000000');
            notifyCodes.push(v === '-' ? '-' : v);
          }
        }
        var wRng = sh.getRange(4 + targetRow, 3, 1, n);
        wRng.setValues([vals]);
        wRng.setFontColors([cols]);

        if (isNew) {
          added++;
        } else {
          updated++;
          var diffDays = [];
          for (var k = 0; k < n && k < 30; k++) {
            var oldVal = String(oldVals[k] == null ? '' : oldVals[k]).trim();
            if (oldVal !== vals[k]) {
              diffDays.push({ day: k + 1, code: notifyCodes[k] });
            }
          }
          if (diffDays.length > 0) {
            notifyScheduleChangeToLine_(nm, notifyShiftType, diffDays);
          }
        }
      }
    }
    SpreadsheetApp.flush();
    return respond({ success: true, updated: updated, added: added, skipped: skipped });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ============================
// v2.12：刪除員工 — 清空該列（不刪實體列，避免破壞 A4:AG30 固定範圍/格式/合併儲存格）
// ============================
function handleDeleteStaff(payload) {
  try {
    var cfg = SHIFT_CONFIG[payload.shift] || SHIFT_CONFIG.night;
    var sh = resolveTargetSheet(cfg);
    var nm = String(payload.name || '').trim();
    if (!nm) return respond({ success: false, error: '缺少姓名' });

    var grid = sh.getRange('A4:AG30').getValues();
    var targetRow = -1;
    for (var r = 0; r < grid.length; r++) {
      if (String(grid[r][1] || '').trim() === nm) { targetRow = r; break; }
    }
    if (targetRow === -1) return respond({ success: true, deleted: false });

    var rng = sh.getRange(4 + targetRow, 1, 1, 33); // A~AG 整列清空
    rng.setValue('');
    rng.setFontColor('#000000');
    SpreadsheetApp.flush();
    return respond({ success: true, deleted: true });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ============================
// 回傳 JSON
// ============================
function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
// ============================
// v2.11：班別設定 — 讀取（跨裝置同步）
// ============================
function getShiftSettings_() {
  var ss = SpreadsheetApp.openById(SHIFT_CONFIG.night.targetSsId);  // ← 改這行
  var sh = ss.getSheetByName('班別設定');
  if (!sh || sh.getLastRow() < 2) {
    return respond({ success: true, types: [] });
  }
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  var types = data
    .filter(function(r) { return r[0]; })
    .map(function(r) {
      return { code: String(r[0]), label: String(r[1]), time: String(r[2]), hours: Number(r[3]), color: String(r[4]) };
    });
  return respond({ success: true, types: types });
}

// ============================
// v2.11：班別設定 — 儲存（跨裝置同步）
// ============================
function updateShiftSettings_(payload) {
  var ss = SpreadsheetApp.openById(SHIFT_CONFIG.night.targetSsId);  // ← 改這行
  var sh = ss.getSheetByName('班別設定');
  if (!sh) sh = ss.insertSheet('班別設定');
  sh.clearContents();
  sh.appendRow(['代號', '名稱', '時間', '工時', '顏色']);
  var types = payload.types || [];
  for (var i = 0; i < types.length; i++) {
    var t = types[i];
    sh.appendRow([t.code, t.label, t.time || '—', Number(t.hours) || 0, t.color]);
  }
  return respond({ success: true });
}
