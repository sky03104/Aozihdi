// ============================================================================
// 航海日誌 GAS - 工作流程追蹤系統
// ============================================================================
// 用途：記錄 APP 各工具使用情況，供 brain_map 可視化
// 試算表名稱：「航海日誌」
// 分頁：「工作日誌」（自動建立）
// ============================================================================

// ── 工具 ↔ 節點 ↔ 角色映射 ──────────────────────────────────────────
const WORKFLOW_MAP = {
  'schedule':   { nodeId: 8,  role: '娜美' },      // 班表查詢
  'work':       { nodeId: 11, role: '索隆' },      // 施工單
  'signin':     { nodeId: 11, role: '索隆' },      // 簽到
  'car':        { nodeId: 11, role: '索隆' },      // 車輛
  'closing':    { nodeId: 0,  role: '路飛' },      // 打烊
  'opening':    { nodeId: 0,  role: '路飛' },      // 開店
  'report':     { nodeId: 3,  role: '羅賓' },      // 事故報告
  'feedback':   { nodeId: 4,  role: '喬巴' },      // 表揚/反應
  'leave':      { nodeId: 12, role: '山治' },      // 請假
  'upload':     { nodeId: 10, role: '弗蘭奇' },    // 資料上傳
  'aichat':     { nodeId: 29, role: '布魯克' },    // AI 小助手
  'emergency':  { nodeId: 1,  role: '烏索普' },    // 緊急聯絡
  'hailing':    { nodeId: 7,  role: '甚平' },      // 明日哨表
};

// ── 試算表初始化 ─────────────────────────────────────────────────────
function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('工作日誌');

  if (!sheet) {
    sheet = ss.insertSheet('工作日誌', 0);
    // 建立標題列
    sheet.appendRow([
      '時間戳記',      // A
      '工號',          // B
      '使用者名',      // C
      '工具名稱',      // D
      '地盤節點ID',    // E
      '執行者角色',    // F
      '動作類型',      // G
      '狀態',          // H
      '備註'           // I
    ]);
    // 設定標題行格式
    const headerRange = sheet.getRange(1, 1, 1, 9);
    headerRange.setBackground('#D4A800').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

// ── 記錄工作活動 (doPost) ──────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, tool, empId, userName, actionType, status } = payload;

    if (action !== 'logTask') {
      return respond('error', '未知 action', null);
    }

    // 驗證必填欄
    if (!tool || !empId || !userName || !actionType) {
      return respond('error', '缺少必填欄位', null);
    }

    // 取得地盤資訊
    const workflow = WORKFLOW_MAP[tool];
    if (!workflow) {
      return respond('error', `未知工具: ${tool}`, null);
    }

    // 初始化試算表
    const sheet = initializeSheet();

    // 組合資料列
    const timestamp = new Date().toISOString();
    const taskId = `${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss')}_${empId}_${tool}`;

    sheet.appendRow([
      timestamp,              // A - 時間戳記
      empId,                  // B - 工號
      userName,               // C - 使用者名
      tool,                   // D - 工具名稱
      workflow.nodeId,        // E - 地盤節點ID
      workflow.role,          // F - 執行者角色
      actionType,             // G - 動作類型 (view/submit/update/delete)
      status || '已完成',     // H - 狀態
      ''                      // I - 備註（留空）
    ]);

    return respond('ok', '活動記錄已儲存', { taskId });

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return respond('error', err.toString(), null);
  }
}

// ── 讀取最近活動 (doGet) ───────────────────────────────────────────────
function doGet(e) {
  try {
    const mode = e.parameter.mode || 'recent';
    const sheet = initializeSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      // 只有標題列，沒有資料
      return respond('ok', '暫無記錄', []);
    }

    const headers = data[0];
    let records = [];

    // 跳過標題列，從第 2 列開始
    for (let i = 1; i < data.length; i++) {
      records.push({
        timestamp: data[i][0],
        empId: data[i][1],
        userName: data[i][2],
        tool: data[i][3],
        nodeId: data[i][4],
        role: data[i][5],
        actionType: data[i][6],
        status: data[i][7],
        note: data[i][8]
      });
    }

    // 依 mode 篩選
    if (mode === 'recent') {
      const hours = parseInt(e.parameter.hours) || 24;
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      records = records.filter(r => new Date(r.timestamp) > cutoffTime);
    } else if (mode === 'nodeId') {
      const nodeId = parseInt(e.parameter.id);
      records = records.filter(r => r.nodeId === nodeId);
    } else if (mode === 'role') {
      const role = e.parameter.role;
      records = records.filter(r => r.role === role);
    }

    // 反向排序（最新在前）
    records.reverse();

    return respond('ok', `找到 ${records.length} 筆記錄`, records);

  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return respond('error', err.toString(), null);
  }
}

// ── 清理舊紀錄（防止試算表爆炸）──────────────────────────────────────
function cleanupOldRecords() {
  try {
    const sheet = initializeSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return;

    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);  // 30 天前
    let rowsToDelete = [];

    for (let i = 1; i < data.length; i++) {
      const timestamp = new Date(data[i][0]);
      if (timestamp < cutoffDate) {
        rowsToDelete.push(i + 1);  // +1 因為陣列從 0 開始但試算表從 1 開始
      }
    }

    // 反向刪除（避免列號混亂）
    for (let i = rowsToDelete.length - 1; i >= 0; i--) {
      sheet.deleteRow(rowsToDelete[i]);
    }

    Logger.log(`已刪除 ${rowsToDelete.length} 筆舊記錄`);

  } catch (err) {
    Logger.log('cleanupOldRecords error: ' + err.toString());
  }
}

// ── 統一回應格式 ──────────────────────────────────────────────────────
function respond(status, msg, data) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: status,
      msg: msg,
      data: data || null,
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

// ── 定時清理任務（每天凌晨執行）───────────────────────────────────────
function scheduleCleanup() {
  // 在 Google Apps Script 中建立觸發器：
  // 1. 編輯 → 當前專案的觸發器
  // 2. 建立新觸發器 → cleanupOldRecords
  // 3. 選擇時間：每天、凌晨 1:00 AM
  cleanupOldRecords();
}

// ── 測試函數 ──────────────────────────────────────────────────────────
function testLogTask() {
  // 手動測試：在 GAS 編輯器執行此函數
  const testPayload = {
    action: 'logTask',
    tool: 'schedule',
    empId: '12345',
    userName: '王小明',
    actionType: 'view',
    status: '已完成'
  };

  // 模擬 e.postData.contents
  const e = {
    postData: {
      contents: JSON.stringify(testPayload)
    }
  };

  const result = doPost(e);
  Logger.log(result.getContent());
}

function testGetRecent() {
  // 手動測試：讀取最近 24 小時的記錄
  const e = {
    parameter: {
      mode: 'recent',
      hours: 24
    }
  };

  const result = doGet(e);
  Logger.log(result.getContent());
}
