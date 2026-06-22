---
name: tianying-tool-converter
description: 將外部工具或助手寫的網頁工具轉換成符合天鷹保全 APP 規範的版本。觸發於：用戶上傳新工具 HTML/助手寫的工具、要求改成「符合 APP 的版本」、需要掛進 index.html、外部工具頁需搭配 GAS 後端。自動執行：規範檢查→React UMD 版本驗證→品牌 splash 套用→工號狀態傳遞修正→照片上傳合規→GAS 合併/建立→權限規劃→快照更新。輸出：完整可貼上版本、node --check 驗證通過、掛載指引、GAS 合併方案。
---

# 天鷹保全 APP 工具轉換技能

協助將任何外部工具或助手寫的工具改寫成符合天鷹保全（天鷹APP·漢神巨蛋）的規範。此技能編碼了一次完整轉換流程（2026-06-22 事故報告+匿名表揚舉報），提供可複用的檢查清單、修改模式、驗證步驟。

## 核心工作流

```
1. 需求理解 → 2. 品牌套用 → 3. 狀態傳遞 → 4. 照片方案 → 5. GAS 設計
↓ 驗證 → 6. 權限規劃 → 7. 快照更新 → 輸出完整可貼上版本 + node --check
```

---

## 1. 需求理解（先問五個問題）

### 工具類型
- **外部頁面**？(externalUrl 掛在 index.html，需帶 `?empId=`)
- **內嵌工具**？(tpl-* 內嵌 index.html，需改 base64 編碼)
- **純前端**？(只改 HTML+CSS+JS) 還是**前後端**？(需配 GAS 後端)

### 功能定位
- 涉及**工號綁定**嗎？(report 不匿名 vs feedback 前台匿名後台記)
- 涉及**照片/檔案上傳**嗎？(需統一到公告資料夾 `1K_RR…`)
- 需要**後台試算表記錄**嗎？(分頁名+欄位定義)
- **使用者權限**如何分級？(fulltime/parttime/leader/vicecaptain/captain/executive/admin)

### 輸入輸出格式
- 前端→GAS：`?action=… & payload=JSON` 還是 `?data=JSON` (舊版)?
- GAS→前端：`{status:'ok',msg:…}` JSON (必須統一)
- **按鈕名稱+圖標** (emoji/icon)

---

## 2. 品牌規範檢查清單（強制）

### React UMD 版本（**鐵律**）
```
❌ React 19：無 UMD 版本 → 404 → React undefined → 卡 splash + Script error
✅ React 18.3.1：穩定 UMD 存在
```
檢驗：
```bash
grep -c "react/18.3.1" tool_*.html  # 應 ≥1
grep -c "19.0.0/umd" tool_*.html   # 應 0（任何 19 版本都是 bug）
```

### Splash 啟動遮罩（**品牌象徵**）
三層金色光環 + 中央去背 LOGO + 四角金框 + 天鷹保全+TIANY ING SECURITY·DATA SYSTEM
```
ring1 (外)：#FFD700，順時 2.4s
ring2 (中)：#D4A800，逆時 1.8s  
ring3 (內)：#F0C040，順時 3s
corners  ：#D4A800，邊框
```

### 色彩系統（固定）
```
背景    #0A0C10 / #0D0F14
主色金  #D4A800 / #FFD700 / #F0C040
副色靛  #818CF8 / #6366F1
文字    #F5F5F5 / #F0EDE6
成功    #4ADE80 / #22C55E
錯誤    #F87171 / #E53E3E
```

### 字型（Fallback 順序）
```css
'Noto Sans TC', 'Microsoft JhengHei', sans-serif
```

### LOGO base64（必須正確）
- **正確**：PNG，276802 字元，`data:image/png;base64,iVBORw0KGgo…`
- **取法**：`/mnt/user-data/uploads/天鷹保全資料上傳工具.html`
  ```python
  import re
  c = open('天鷹保全資料上傳工具.html').read()
  logo = re.findall(r'data:image[^\"\'\>\s]+', c)[0]  # 有且唯一
  ```
- **嚴禁**：`/mnt/project/天鷹去背LOGO.png`（JPEG 錯誤）

### 返回路徑（同層）
```
❌ ../index.html              → 跳到錯誤上層
✅ index.html?empId=…         → 同層 root，帶工號
✅ (外部工具內) ../../index.html （若部署在 tools/ 子目錄）
```

### 所有文字（繁體中文）
- 按鈕文案、提示、欄位名、變數名註解、錯誤訊息、報表表頭

---

## 3. 工號狀態傳遞修正

### 原始 Bug（index.html 外部工具開啟）
```javascript
// ❌ 舊版：不帶工號
window.open(tool.externalUrl, '_blank');

// ✅ 修後：帶上 ?empId=（2處 externalUrl 開啟點）
window.open(tool.externalUrl + (tool.externalUrl.indexOf('?') > -1 ? '&' : '?') + 'empId=' + encodeURIComponent((currentUser && currentUser.empId) || ''), '_blank');
```

### 工具頁 empId 雙保險
```javascript
// 優先級：?empId= → session localStorage → 未登入
let empId = new URLSearchParams(window.location.search).get('empId') || '';
if (!empId) {
  try { empId = JSON.parse(localStorage.getItem('hsh_session_user') || '{}').empId || ''; } catch (e) {}
}
if (!empId) empId = '未登入';
```

### Session 姓名 fallback
```javascript
// 同 origin 可讀 hsh_session_user，包含 {empId,name,role,dept}
function getSessionName() {
  try {
    const u = JSON.parse(localStorage.getItem('hsh_session_user') || '{}');
    return u.name || u.empName || u.userName || '';
  } catch (e) { return ''; }
}
// 前端 best-effort 帶到後端 payload
```

---

## 4. 照片上傳統一方案

### 前端規範（urlencoded，無 multipart preflight）
```javascript
const body = new URLSearchParams();
body.append('action', 'report');  // 或 'feedback'
body.append('payload', JSON.stringify({
  empId,
  name: getSessionName(),
  photos,    // base64 陣列 ['data:image/jpeg;base64,...', ...]
  // ... 其他欄位
}));

const res = await fetch(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
  body: body.toString()
});
const result = await res.json();  // {status:'ok'|'error', msg}
```

### GAS 後端規範
```javascript
// 1. 單一 doPost，action 分流
function doPost(e) {
  var p = (e && e.parameter) || {};
  var d = {}; if (p.payload) d = JSON.parse(p.payload);
  if (p.action === 'report') return handleReport_(d);
  if (p.action === 'feedback') return handleFeedback_(d);
}

// 2. 統一存公告資料夾 1K_RRPUjcWrdNAS2ppcx6OFDtlkfSfAl3
var PHOTO_FOLDER_ID = '1K_RRPUjcWrdNAS2ppcx6OFDtlkfSfAl3';

// 3. 照片處理函式
function saveImages_(arr, namePrefix) {
  var urls = [];
  for (var i = 0; i < arr.length; i++) {
    var raw = arr[i];
    if (!raw) continue;
    var mime = raw.indexOf('data:') === 0 ? raw.match(/data:([^;]+);/)[1] : 'image/jpeg';
    var b64 = raw.split(',')[1] || raw;
    var ext = mime.includes('png') ? 'png' : (mime.includes('gif') ? 'gif' : 'jpg');
    var file = DriveApp.getFolderById(PHOTO_FOLDER_ID)
      .createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, namePrefix + '_' + (i+1) + '.' + ext));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    urls.push(file.getUrl());
  }
  return urls;
}

// 4. 回傳統一格式
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
// 成功：{status:'ok', msg:'...', photos: N}
// 失敗：{status:'error', msg:'...'}
```

### 試算表分頁設計
**事故報告**：不匿名，記工號+姓名
```
提交時間, 工號, 姓名, 日期, 時間, 地點, 類別, 描述, 照片連結, ...
```

**匿名表揚／舉報**：前台匿名，後台記工號+姓名（兩列隱藏或標記）
```
時間, 類型, 對象, 分類, 描述, 日期, 附件連結, 【後台】工號, 【後台】姓名
```

---

## 5. GAS 設計方案

### 情景 1：全新工具+新 GAS
- 新建 GAS 專案，貼上合併版 template（見下 6. 快照）
- doPost 實作 `handleReport_` / `handleFeedback_` 或你的邏輯
- 確保 `return json_({status:..., msg:...})`
- 部署為 Web App，exec URL 對齊前端
- 手動執行 `forceAuth()` 授權 Drive/Sheet

### 情景 2：現有 GAS，多支工具共用一個 GAS
- **勿**讓多個 `.gs` 檔各自有 doPost（同專案只能一個）
- 合併到單一檔案，用 action 分流
- 前置驗證：`const d = JSON.parse(e.parameter.payload || '{}')`（縮小野外變異）

### 情景 3：GAS 需要查員工名冊
- 若 session `hsh_session_user.name` 為空，GAS 可用 empId 反查
- 需要員工名冊試算表 ID + 工號/姓名欄位位置
- 改 `getSessionName()` 或 GAS 側加 lookup 函式

---

## 6. 權限規劃（DEFAULT_PERMS）

### 典型分級
```javascript
const DEFAULT_PERMS = {
  fulltime: [1, 2, 3, 7, 5, 6, 9, 12, 13, 99],      // 移除 4
  parttime: [1, 2, 3, 7, 5, 6, 9, 12, 13, 99],      // 本就無 4
  leader: [..., 4, ...],                              // 加 4
  vicecaptain: [..., 4, ...],                         // 加 4
  captain: [..., 4, ...],                             // 加 4
  executive: [..., 4, ...],                           // 加 4
  admin: [..., 4, ...],                               // 全有
};
```

### 新工具權限規則
1. **id:4 事故報告填寫** → 組長以上（leader/vicecaptain/captain/executive/admin）
2. **id:13 匿名表揚／舉報** → 全員（fulltime/parttime 起全部）

### 既有使用者權限（雲端 toolPerms）
- DEFAULT_PERMS 只管新帳號/重置
- 既有帳號若要改，admin 必須手動到後台「✏️工具/🔐權限」改
- 修改後存 GAS Script Properties，同步到 `localStorage.tianying_perms`

---

## 7. TOOLS 掛載（index.html 修改）

### 新工具加進 TOOLS 陣列
```javascript
const TOOLS = [
  // ...既有
  { id: 4, name: "事故報告填寫", icon: "📋", category: "現場管理", externalUrl: "https://sky03104.github.io/tianying-security/tool_report.html" },
  { id: 13, name: "匿名表揚／舉報", icon: "🚨", category: "緊急應變", externalUrl: "https://sky03104.github.io/tianying-security/tool_feedback.html" },
  // ...其他
];
```

### DEFAULT_PERMS 更新
- 新工具 id 加入適當角色的陣列

### window.open 修正（2處外部工具開啟）
- 工具卡片 onClick → 帶 ?empId=
- 管理頁開啟工具 → 帶 ?empId=

---

## 8. 快照更新（project-state.md）

### 工具清單行新增
```
| <id> | <名稱> | externalUrl → <檔名>.html | ✅ 狀態 |
```

### GAS 專案行新增（若新增 GAS）
```
| <識別名> | <功能> | `…/exec` 後綴 | <簡述> |
```

### 時間軸最上方新增
```
- **YYYY-MM-DD(N)｜<工具名>改寫+掛載｜影響：index.html, tool_*.html, <GAS>**
  (1)修項目；(2)修項目；...
```

---

## 完整檢驗清單

### 前端兩支 HTML
```bash
✅ React 18.3.1 UMD（2處）
✅ node --check 語法無誤
✅ Splash 三環+LOGO+角框
✅ 返回路徑 index.html?empId=
✅ empId 雙保險（?empId= + session fallback）
✅ getSessionName() 帶姓名
✅ urlencoded payload POST
✅ 讀 res.json() {status,msg}
✅ 防重複提交鎖
✅ Toast 成功綠/錯誤紅
✅ 頁尾版權 © TIANYING SECURITY · INTERNAL SYSTEM
✅ 所有文字繁體中文
✅ 觸發授權（首次手動執行或自動調用需授權的 API）
```

### GAS 後端
```bash
✅ node --check 語法無誤（.gs 改名 .js）
✅ 單一 doPost，action 分流
✅ openById(SS_ID) 而非 getActiveSpreadsheet()
✅ saveImages_() 存公告資料夾
✅ 分頁自動建+表頭+凍結
✅ 回傳統一 {status:'ok'|'error', msg}
✅ LockService.waitLock(30000)
✅ 首次執行 forceAuth()
✅ 測試函式 testReport() / testFeedback()
```

### index.html
```bash
✅ id:4 externalUrl → tool_report.html
✅ id:13 名稱改「匿名表揚／舉報」+ externalUrl → tool_feedback.html
✅ DEFAULT_PERMS 權限更新
✅ window.open(... ?empId=...) 2 處
✅ node --check 主 script 語法
```

### project-state.md
```bash
✅ 工具清單行新增
✅ GAS 專案行新增（若新增）
✅ 時間軸最上方新增
✅ 待辦清掉已完成
```

---

## SOP：逐步執行

### 第 1 輪：前端改寫
1. 複製上傳的 HTML 到工作區
2. Python regex patch：React UMD → 18.3.1、Splash、LOGO、返回路徑、empId fallback、字型、版權
3. 抽 script 到 .js，`node --check`
4. 驗證 grep：React 版本、Splash 標記、返回路徑
5. 驗證 HTML 標籤閉合（<div> 數 = </div> 數）
6. LOGO 注入後輸出到 `/mnt/user-data/outputs/`

### 第 2 輪：GAS 設計
1. 與用戶確認：新建 GAS 還是合併現有
2. 新建：提供 template，用戶填邏輯；合併：用 Python 精準替換
3. 抽 script，node --check
4. 驗證關鍵函式：doPost action 分流、saveImages_、json_、getSheet_
5. 輸出到 outputs

### 第 3 輪：index.html 修改
1. 複製上傳的 index.html 到工作區
2. Python regex patch（count=1 驗證唯一）：TOOLS 新增行、DEFAULT_PERMS 更新、window.open 2 處帶 ?empId=
3. 抽主 script，node --check
4. grep 驗證四項改動 + 殘留檢查
5. 輸出到 outputs

### 第 4 輪：快照更新
1. 複製 project-state.md 到工作區
2. 更新：工具清單、GAS 清單、時間軸、待辦清掉
3. 輸出到 outputs

### 第 5 輪：使用者指引
1. 總結交付物（5~6 個檔案）
2. 部署步驟（刪舊 GAS → 貼新 → 新版本 → 手動執行授權）
3. Push GitHub
4. 既有帳號權限改動（若影響 DEFAULT_PERMS）

---

## 常見錯誤與修復

| 問題 | 原因 | 修復 |
|---|---|---|
| 卡 splash + `Uncaught Error: Script error` | React 19 無 UMD | 降到 18.3.1 |
| 工號傳不進去 | window.open 未帶 ?empId= | 改開啟點帶上 encodeURIComponent(currentUser.empId) |
| 後台姓名空 | session 無 name 欄位 | getSessionName() 試多個欄位名，或 GAS 側查員工名冊 |
| 照片提交失敗 | 用 FormData multipart | 改 URLSearchParams urlencoded（簡單請求無 preflight） |
| GAS 寫不進試算表 | getActiveSpreadsheet() 在 standalone 回 null | 改 openById(SS_ID) |
| 多個 doPost 衝突 | 同專案多支 .gs 各自 doPost | 合併為單一檔案，action 分流 |
| 前端讀 res.json() 拋錯 | GAS 回 HTML 或文本而非 JSON | GAS 改 ContentService.MimeType.JSON |
| 既有帳號權限沒改 | DEFAULT_PERMS 只管新帳號 | admin 後台「✏️工具/🔐權限」手動改 |

---

## 參考資源

- **正確 LOGO base64**：`/mnt/user-data/uploads/天鷹保全資料上傳工具.html` → regex 提取
- **合併 GAS 範本**：`事故報告_匿名舉報_合併版.gs`（可複用的 doPost + saveImages_ 結構）
- **前端範本**：tool_report.html（完整 Splash+empId fallback+urlencoded 實例）
- **project-state.md**：最新快照，含所有 TOOLS id、GAS URL、localStorage key、設計規範

---

## 使用此技能的簽名指令

使用者上傳新工具時，自動觸發本技能：
```
「這兩個是我的助手寫的工具，把它改成符合我APP的版本」
「寫個新工具，需要改成天鷹APP規範」
「幫我把這個工具改寫並掛進 index.html」
```

技能內部檢查：
1. 上傳檔案類型（HTML / GAS / 圖片？）
2. 工具功能（單純前端 / 含照片 / 要綁工號？）
3. 是否涉及 GAS 後端
4. 是否要掛 index.html

根據回答，逐層走過上述 SOP，最後輸出完整可貼上版本。
