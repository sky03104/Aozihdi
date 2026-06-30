# 航海日誌 GAS 部署指南

> **專案**：天鷹保全 APP 工作流程追蹤系統  
> **試算表名稱**：航海日誌  
> **用途**：自動記錄 APP 各工具使用情況，供 brain_map 可視化

---

## 📋 部署步驟

### 第 1 步：建立試算表「航海日誌」

1. 開啟 [Google Sheets](https://sheets.google.com)
2. 點擊「新增」→ 「試算表」
3. 將試算表名稱改為：**航海日誌**
4. 儲存並記下試算表 ID（URL 中 `/d/` 後面那串）

✅ **試算表 ID 範例**：`1mxCRUxbuPBuReP1gWK3unFbjtOkAuSkBakQeaH9Rdyc`

---

### 第 2 步：開啟 Google Apps Script 編輯器

1. 在「航海日誌」試算表中
2. 點擊菜單 → **擴充功能** → **Apps Script**
3. 會開啟 GAS 編輯器（新分頁）

---

### 第 3 步：貼上 GAS 代碼

1. 在 GAS 編輯器中，刪除預設的 `function myFunction() {...}`
2. **複製整個** `航海日誌_GAS.gs` 代碼
3. 貼入編輯器
4. 按 **Ctrl+S**（Mac: Cmd+S）儲存

---

### 第 4 步：部署成 Web App

1. 點擊編輯器上方的 **部署** → **新部署**
2. 選擇類型：**Web App**
3. 執行身分：**身為我（你的帳號）**
4. 存取權限：**任何人**
5. 點擊 **部署**
6. 授權對話出現時，點擊「審查權限」→ 選擇你的帳號 → 允許

✅ **部署完成後，複製 Web App URL**  
格式類似：`https://script.google.com/macros/d/{SCRIPT_ID}/userweb/exec`

---

### 第 5 步：取得部署 URL

1. 部署完成後，會顯示「部署 ID」和「Web App URL」
2. **複製整個 URL**（這就是 `WORKFLOW_GAS_URL`）
3. 儲存到一個安全的地方（備用）

**示例 URL**：
```
https://script.google.com/macros/d/AKfycbwZ5f7h_Lv_MOCxPrqPpBPKA917-JKmEz5DDekYixLDsGf1QAKCTOuVxwo18OYKX7a4ng/userweb/exec
```

---

## 🔐 授權與權限

### OAuth 同意畫面設置

如果部署時卡在「未驗證」或「403 access_denied」：

1. 編輯器右上角 → **專案設定**
2. 確認「專案編號」
3. 造訪：`https://console.cloud.google.com/apis/consent?project={PROJECT_ID}`
4. 點擊「建立 OAuth 同意畫面」
   - 選擇「內部」
   - 應用程式名稱：「天鷹航海日誌」
   - 新增測試使用者：加入你的 Gmail 帳號
5. 儲存並返回編輯器

---

## 📊 試算表結構

GAS 會自動建立「工作日誌」分頁，含以下欄位：

| 欄位 | 名稱 | 說明 |
|------|------|------|
| A | 時間戳記 | ISO 格式時間 |
| B | 工號 | 員工工號 |
| C | 使用者名 | 員工名字 |
| D | 工具名稱 | schedule/work/signin 等 |
| E | 地盤節點ID | brain_map 對應節點 |
| F | 執行者角色 | 娜美/索隆/烏索普等 |
| G | 動作類型 | view/submit/update/delete |
| H | 狀態 | 進行中/已完成/失敗 |
| I | 備註 | 可選額外信息 |

---

## 🧪 測試部署

### 測試方式 1：在 GAS 編輯器執行函數

1. 在 GAS 編輯器中，點擊 **testLogTask**
2. 點擊執行按鈕（▶）
3. 檢查「執行日誌」（下方）是否顯示成功

### 測試方式 2：用瀏覽器 GET 請求

打開新分頁，貼入：
```
{WORKFLOW_GAS_URL}?mode=recent&hours=24
```

應該返回 JSON：
```json
{
  "status": "ok",
  "msg": "找到 X 筆記錄",
  "data": [...]
}
```

### 測試方式 3：用 curl 命令

```bash
curl -X POST {WORKFLOW_GAS_URL} \
  -H "Content-Type: application/json" \
  -d '{
    "action": "logTask",
    "tool": "schedule",
    "empId": "12345",
    "userName": "王小明",
    "actionType": "view",
    "status": "已完成"
  }'
```

應該返回：
```json
{
  "status": "ok",
  "msg": "活動記錄已儲存",
  "data": {"taskId": "..."}
}
```

---

## ⏰ 設定自動清理任務

航海日誌每天會新增數十筆記錄。為防止試算表爆炸，需設定 **每天凌晨 1:00 自動刪除 30 天前的舊記錄**。

### 步驟

1. 在 GAS 編輯器中
2. 左側菜單 → **觸發器**（時鐘圖示）
3. 點擊「建立新觸發器」
4. 設定：
   - 要執行的函數：**cleanupOldRecords**
   - 事件來源：**時間驅動**
   - 事件類型：**每天**
   - 時間：**凌晨 1:00 - 2:00**
5. 點擊「建立」

✅ 現在 GAS 會每天自動清理舊紀錄。

---

## 🔗 工具埋點設定

### 前端埋點函數

在各工具的 `<script>` 中加入：

```javascript
const WORKFLOW_GAS_URL = '{WORKFLOW_GAS_URL}';  // 替換成實際 URL

async function logWorkflow(tool, actionType, status = '已完成') {
  const u = JSON.parse(localStorage.getItem('hsh_session_user') || '{}');
  if (!u.empId) return;  // 無登入則不記錄
  
  try {
    const res = await fetch(WORKFLOW_GAS_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'logTask',
        tool,
        empId: u.empId,
        userName: u.name || '未知',
        actionType,
        status
      })
    });
    const data = await res.json();
    console.log('[workflow]', data.msg);
  } catch(e) {
    console.error('[workflow error]', e);
  }
}
```

### 在各工具中調用

**班表工具**（tool_work.html）：
```javascript
// 頁面載入時
document.addEventListener('DOMContentLoaded', () => {
  logWorkflow('schedule', 'view');
});

// 提交時
submitBtn.addEventListener('click', async () => {
  // ... 提交邏輯 ...
  logWorkflow('schedule', 'submit', res.status === 'ok' ? '已完成' : '失敗');
});
```

**打烊工具**（index.html 內嵌）：
```javascript
// 打烊登錄按鈕
closingSubmit.onclick = async () => {
  logWorkflow('closing', 'submit', status === 'ok' ? '已完成' : '失敗');
};
```

**其他工具類似**。

---

## 📋 工具列表與埋點位置

| 工具 | 檔案位置 | 埋點位置 |
|------|---------|--------|
| 班表查詢 | `tool_work.html` | 頁面載入 + 提交按鈕 |
| 施工單 | `index.html`(tpl-work) | 頁面載入 + 查詢/更新按鈕 |
| 簽到 | `tool_signin.html` | 簽到按鈕點擊 |
| 車輛 | `tool_car.html` | 頁面載入 + 操作 |
| 打烊 | `index.html`(tpl-closing) | 登錄按鈕 |
| 開店 | `tool_opening.html` | 登錄按鈕 |
| 事故報告 | `tool_report.html` | 提交按鈕 |
| 表揚 | `tool_feedback.html` | 提交按鈕 |
| 請假 | `liff_leave.html` | 申請按鈕 |
| 資料上傳 | `index.html`(tpl-upload) | 上傳完成 |
| AI 小助手 | `tool_ai_chat.html` | 發送訊息 |
| 緊急聯絡 | `index.html`(tpl-emergency) | 頁面載入 |
| 明日哨表 | `post.html` | 頁面載入 |

---

## 🐛 常見問題

### 1. 部署後返回 403 Forbidden

**原因**：OAuth 同意畫面未完成授權

**解決**：
- 按照「授權與權限」一節設置 OAuth 同意畫面
- 刪除舊部署，重新部署

### 2. 試算表「工作日誌」分頁不自動建立

**原因**：首次呼叫 `initializeSheet()` 時會建立

**解決**：
- 執行 `testLogTask()` 函數
- 刷新試算表，應該出現「工作日誌」分頁

### 3. 工具埋點後沒有記錄

**原因**：
- WORKFLOW_GAS_URL 填錯
- localStorage 沒有 hsh_session_user（未登入）
- CORS 問題

**解決**：
- 開啟瀏覽器開發工具 → Console，查看是否有錯誤
- 確認登入後再測試
- 檢查 URL 是否正確

### 4. 試算表越來越大

**原因**：清理任務未執行

**解決**：
- 檢查觸發器是否正確設定（編輯器 → 觸發器）
- 手動執行 `cleanupOldRecords()`

---

## 📝 完整部署檢查清單

- [ ] 建立試算表「航海日誌」
- [ ] 開啟 GAS 編輯器
- [ ] 貼上 GAS 代碼並儲存
- [ ] 授權 OAuth 同意畫面
- [ ] 部署成 Web App
- [ ] 複製並儲存部署 URL
- [ ] 執行 `testLogTask()` 驗證成功
- [ ] 執行 `testGetRecent()` 讀取記錄
- [ ] 設定自動清理觸發器
- [ ] 在 APP 工具中加入埋點函數
- [ ] 各工具調用 `logWorkflow()`
- [ ] 測試整體流程

---

## 🎯 下一步

1. **完成部署** → 取得 `WORKFLOW_GAS_URL`
2. **埋點各工具** → 在 5 個主要工具加埋點
3. **整合 brain_map** → 讀取航海日誌 + Canvas 人物繪製
4. **測試端對端** → 使用工具 → 檢查試算表 → 查看 brain_map

---

**Support**: 部署失敗時，檢查編輯器「執行日誌」或開啟瀏覽器開發工具查看錯誤
