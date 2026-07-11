@AGENTS.md

---

# CLAUDE.md — 天鷹保全 專案規則

> 2026-07-10 制度化瘦身（Fable 5）：本檔只放「會改變行為的規則」與進行中事項。
> 原 1635 行的內容**一字未刪**，全部搬進 `docs/`（見文末路由表）。
> 改本檔前先讀 `~/.claude/rules/40-maintenance.md`；歸檔性內容（完成紀錄、日期流水帳）不准寫回本檔，寫進 `docs/歸檔_已完成待辦.md` 或 `docs/技術經驗筆記.md`。

## 專案速覽
- 天鷹保全 APP：HTML 工具集（`index.html` 主控台＋`tool_*.html`）＋ GAS 後端 ＋ Google Sheets 資料庫，前端部署 GitHub Pages。
- 專案概觀、班別定義（早班 08:00~20:00／晚班 20:00~隔日08:00）、工作流程、收工觸發語、Never 清單 → 見 `AGENTS.md`（開機已自動載入，不在此重複）。
- `tianying-monitor/` 自動化監控系統目前待命；要動它時讀 `tianying-monitor/README.md`。
- 動工前先查 `docs/技術經驗筆記.md` 有沒有同主題的坑（GAS、Drive、LINE、brain_map、部署都踩過）。

---

## 🛠️ Development & Output Standards

### 編碼規範
1. **完整可直接貼上程式碼**：絕不省略、截斷或使用「其餘保持不變」
2. **修改前說明**：修改內容、影響範圍、關鍵決策理由
3. **中文註解與變數**：所有註解、變數說明、UI文字均為繁體中文
4. **成功/失敗反饋**：成功用綠色#4ADE80、失敗用紅色#F87171，必須有Toast/Modal提示
5. **程式碼交付格式**：檔名、存放位置、貼上說明，包含完整路徑

### 天鷹保全設計規範

**色彩系統**:
```
背景        #0A0C10 / #0D0F14
主色（金）  #D4A800 / #FFD700 / #F0C040
副色（靛）  #818CF8 / #6366F1
成功綠      #4ADE80 | #22C55E
錯誤紅      #F87171 | #E53E3E
警告橙      #FB923C
文字        #F5F5F5 / #F0EDE6
```

**元件與風格**:
- **字型**: Microsoft JhengHei, Noto Sans TC, sans-serif
- **圖示**: Tabler Icons (npm: @tabler/icons)
- **主按鈕**: 金色漸層 (linear-gradient(135deg, #D4A800 0%, #FFD700 100%))
- **副按鈕**: 靛藍漸層 (linear-gradient(135deg, #818CF8 0%, #6366F1 100%))
- **卡片**: Glassmorphism 低透明白色邊框 (rgba(255,255,255,0.1))
- **品牌**: 天鷹保全 / TIANYING SECURITY · DATA SYSTEM

**RWD要求**:
- LOGO與外框: `max-width:100%, height:auto, object-fit:contain`
- 行動端: 絕不破版溢出
- Splash動畫: 同心圓旋轉金色光環 (ring1順時2.4s, ring2逆時1.8s, ring3順時3s)

### 通訊模式

**穴居人高密度對話**：極度精簡、無客套話、高資訊密度
- 直接切入重點，不寒暄不重述
- 極致優化Token消耗
- 使用繁體中文

---


---

## 🧰 工具格式標準（所有 HTML 工具必守）

### 5. Tool Format Standards

所有HTML工具必須遵守以下結構與檢查清單：

**基礎框架**：
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>天鷹保全 · [工具名稱]</title>
  
  <!-- React 18.3.1 (絕對禁止 19.x) -->
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  
  <!-- Tabler Icons -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/tabler-icons.css">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #0A0C10; 
      color: #F5F5F5; 
      font-family: 'Microsoft JhengHei', 'Noto Sans TC', sans-serif;
    }
  </style>
</head>
<body id="root">
  <!-- App content -->
</body>
</html>
```

**QA檢查清單**：
- ✅ HTML標籤完整閉合（不能有 `<div>` 未配 `</div>`）
- ✅ Tabler Icons 正確引入
- ✅ URLSearchParams 解析 `?empId=` 工號狀態傳遞
- ✅ 返回主選單按鈕（保留工號狀態，不遺失）
- ✅ 大量複製貼上防重去重機制 (Deduplication)
- ✅ `node --check` 語法驗證通過
- ✅ React 版本必須 18.3.1（非19.x）
- ✅ 行動端RWD無破版溢出
- ✅ Glassmorphism卡片實作完整
- ✅ 成功/失敗用色精確（綠#4ADE80/紅#F87171）

**驗證命令**：
```bash
# React版本驗證
grep -c "react/18.3.1" tool_*.html  # 應 ≥1
grep -c "19.0.0\|19.1" tool_*.html  # 應 0（任何19版本都是bug）

# 語法驗證
node --check tool_report.html

# 標籤閉合檢查
grep -o '<[^/>]*>' tool_report.html | grep -v '/>' | sort | uniq -c
```

---


## 🔧 Google Apps Script (GAS) 標準

所有GAS後端均需遵守以下規範：

### doPost 函數簽名
```javascript
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, empId, data } = payload;
    
    // 驗證empId（工號必傳）
    if (!empId) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', msg: '工號遺失' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 動作路由
    switch(action) {
      case 'submit':
        return handleSubmit(empId, data);
      case 'update':
        return handleUpdate(empId, data);
      default:
        throw new Error(`未知動作: ${action}`);
    }
  } catch(err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', msg: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 試算表主鍵規範
- **主鍵型態**：純數字流水號 (1, 2, 3, ...)
- **禁止**：UUID (e.g. "a1b2c3d4-e5f6..."), 隨機英數字串
- **生成方式**：`lastRow() + 1` 或自增欄位

### 前後端通訊格式
```javascript
// 前端送出
const payload = {
  action: 'submit',
  empId: '12345',  // 必傳
  data: {
    title: '事故報告',
    description: '...',
    timestamp: new Date().toISOString()
  }
};

// GAS回應（統一JSON格式）
{
  status: 'ok' | 'error',
  msg: '訊息文字',
  data: {...}  // 可選，返回新資料
}
```

### 工號狀態傳遞檢查
- ✅ 前端URLSearchParams解析 `?empId=12345`
- ✅ GAS接收empId並驗證（非空、非null）
- ✅ 後續操作均記錄empId
- ✅ 返回前端時保留empId在返回URL中
- ✅ 返回按鈕不遺失工號狀態

### 照片/檔案上傳規範
- **統一資料夾**：Google Drive 公告資料夾 (1K_RR…)
- **存放命名**：`[日期]_[工號]_[功能名稱].png`
- **驗證**：上傳前檢查檔案大小、格式
- **錯誤回應**：上傳失敗時返回明確錯誤訊息

---


---

## ✅ QA檢查清單 (Pre-Push Validation)

**程式碼品質**：
- [ ] 程式碼遵循現有模式（無創意破格）
- [ ] Python語法有效：`python3 -m py_compile file.py`
- [ ] YAML有效：`python3 -c "import yaml; yaml.safe_load(open('file.yaml'))"`
- [ ] Markdown正確frontmatter
- [ ] 回歸測試通過：`python3 regression-tester.py`
- [ ] 失敗日誌仍可讀：`python3 workflow-monitor.py --mode review-log`

**HTML/前端工具**：
- [ ] HTML標籤完整閉合，無遺漏
- [ ] React版本確認為18.3.1（非19.x）
- [ ] Tabler Icons正確引入
- [ ] URLSearchParams正確解析 `?empId=`
- [ ] 返回按鈕保留工號狀態
- [ ] 色彩精確（#4ADE80成功/紅#F87171失敗）
- [ ] Toast/Modal提示完整
- [ ] 行動端RWD無破版
- [ ] 去重機制(Deduplication)實作

**GAS後端**：
- [ ] doPost/doGet函數簽名正確
- [ ] JSON解析/序列化無誤
- [ ] 試算表主鍵為純數字（非UUID）
- [ ] 工號狀態正確傳遞回前端
- [ ] 錯誤處理完整（不返回null）

**文件與通訊**：
- [ ] 提交訊息遵循約定（feat/fix/chore/docs）
- [ ] 變更說明清晰（修改內容+影響範圍）
- [ ] 所有註解均為繁體中文
- [ ] 完整可直接貼上程式碼（無省略）
- [ ] 功能不破壞既有運作
- [ ] **有結構性變動 → 已同步 `brain_map.html`（節點/關聯）並通過完整性檢查**（見「知識星空大腦」自動同步規則）

---


---

## 🧠 知識星空大腦 / brain_map.html

專案含一個互動式 3D 知識圖譜 `brain_map.html`（Three.js r128，單一 HTML，瀏覽器直接開、免伺服器），把模組/功能/關聯視覺化。節點＝功能，連線＝關聯，點節點看說明。

### 維護指令（對 AI）

當使用者說「**請更新知識圖譜**」時：
1. **掃描專案**：讀主要程式檔（.html/.gs/.py/.js…），識別功能模組、頁面、GAS endpoint、資料表。
2. **決定主題 TOPICS**：3～6 個，繁中名＋色碼，更新 `TOPICS`。目前用 6 主題：`core` 主控台核心(金 #D4A800)、`tools` 前端工具(綠 #4ADE80)、`backend` 後端 GAS(靛 #818CF8)、`data` 資料儲存(橙 #FB923C)、`infra` 部署/監控(藍 #38BDF8)、`todo` 待辦/規劃(紅 #F87171)。
3. **節點 NODES**：每個功能一個節點。`id` 純整數接續最大值；`title` 繁中 ≤15 字；`topic` 對應 key；`pos` [x,y,z] 範圍 ±1.4；`note` 一句話（可放規則/TODO/注意）。
4. **關聯 EDGES**：函式呼叫、資料讀寫、頁面連結、功能依賴、流程相鄰 → 各建一條 `[idA, idB]`。
5. **只改** `=== BRAIN_MAP_DATA_START ===` 與 `=== BRAIN_MAP_DATA_END ===` 之間（`BRAIN_CONFIG`/`TOPICS`/`NODES`/`EDGES`），**不得動標記外的 Three.js 程式**。改完跑資料完整性檢查（edges 不指向缺失節點、id 不重複、topic 有對應）。
6. **回報摘要**：新增/修改節點（列標題）、新增關聯數、主題清單。

座標分區參考：core 中央(z 正)、tools 右(x 0.5~1.4)、backend 左(x -1.4~-0.5)、data 下(y -1.4~-0.7)、infra 後(z -1.4~-0.7)、todo 頂(y 0.8~1.4)。同主題節點間距 ±0.25~0.45 避免重疊。

**增量指令**也支援：「新增節點：X，屬於 Y 主題」「把節點 X 的說明改成…」「在 X 和 Y 之間新增關聯」「刪除節點 X」「把主題 X 顏色改成 #…」。

> 詳細規則原稿見 `CLAUDE_CODE_BRAIN_MAP.md`。

### 📋 角色地點對應表（咖哩說「角色地點對應表」就是指這個）

海賊王人物進駐工具節點的固定對應，資料來源是 `brain_map.html` 的 `NODE_CHAR`（節點→角色）與 `NODE_IMG_MAP`（節點→地點場景圖）。改動角色分配/新增地點圖時，**這裡也要同步更新**，並跑一次 `node --check` + id/edge 完整性檢查。

| 節點id | 工具 | 角色 | 地點圖 |
|---|---|---|---|
| 0 | 主控台 index.html | 路飛 | 黃金梅利號 ✅（1.4倍放大） |
| 1 | 登入與角色系統 | 艾斯 | 待補（白鬍子海賊團莫比迪克號） |
| 2 | 首頁待審卡片 | 薩波 | 待補（革命軍本部） |
| 3 | 事故報告工具 | 羅賓 | 圖書室 ✅ |
| 4 | 匿名表揚/反應 | 喬巴 | 醫務室 ✅ |
| 5 | 開店前進出登錄 | 香克斯 | 日出羊頭甲板 ✅ |
| 6 | 打烊後快速登錄 | 羅 | 夜晚羊頭甲板 ✅ |
| 7 | 今/明日哨表 | 甚平 | 舵輪室 ✅ |
| 8 | 班表查詢 | 娜美 | 柑橘園 ✅ |
| 9 | 緊急聯絡清單 | 烏索普 | 瞭望台 ✅ |
| 10 | 資料上傳工具 | 弗蘭奇 | Franky House 工房 ✅ |
| 11 | 簽到/車輛/工作 | 索隆 | 待補（道場） |
| 12 | 請假申請 | 山治 | 待補（廚房） |
| 29 | 天鷹 AI 小助手 | 布魯克 | 待補（鋼琴） |
| 37 | 物流車輛統計 | 佩羅娜 | 待補（恐怖三詭帆船） |
| 135 | 帶班交接事項 | 克比 | 待補（海軍本部） |

**角色圖檔**：香克斯/羅/佩羅娜/克比/艾斯/薩波已上傳並壓縮（`shanks.png`/`law.png`/`perona.png`/`coby.png`/`ace.png`/`sabo.png`），皆為透明底、380~480px高，跟其他角色圖同規格。

**路飛跑步動畫**：`RUN_IMG_MAP['路飛']` 目前只有單張去背裁切的靜態跑步姿勢（`run_luffy_f1.png`），不像羅賓有 F1~F6 六張連續動畫幀，之後有更多姿勢素材可直接擴充陣列。

**地點圖放大機制**：`NODE_IMG_SCALE`（node0=1.4倍）可覆寫個別節點地點圖顯示尺寸；放大某節點時記得同步檢查 `drawLiveUsers()` 的使用者圍站半徑是否也要套用同倍率（已處理 node0 這個案例，邏輯是自動比對最近的放大節點）。

### ⛔ 自動同步規則（強制，使用者已要求每次改動自動同步）

**只要本次工作有「結構性變動」，AI 必須在結束回合前同步更新 `brain_map.html` 的資料區，並在進度摘要回報，不需使用者另外開口。** 結構性變動定義：

- 新增／刪除／改名 任一工具（`tool_*.html`、`index.html` 內嵌 tpl-*、獨立頁）
- 新增／刪除 GAS endpoint（`action` 路由）或 GAS 檔
- 新增／刪除 資料表分頁、localStorage 資料庫、Drive 資料夾用途
- 模組間關聯改變（新呼叫、新資料流、新頁面連結）
- 待辦狀態重大變化（TODO 完成/新增，對應 `todo` 主題節點）

**做法**：依上方「維護指令」更新 `TOPICS/NODES/EDGES`（只動資料標記區）→ 跑完整性檢查（無斷邊／無重複 id／topic 有對應）→ 與該次變更**同一個 commit** 一起提交。純文案／樣式微調、不改結構者可略過。

---


---

## 📝 進行中待辦（完成一項 → 細節寫進 docs/歸檔_已完成待辦.md，本節刪該行）

- **[TODO-12] 哨表自動化工作流** — 🟡 規劃中（待規格）
- **[TODO-10 尾巴] 班表「停休加班」代號** — 黃底停休加班與休假同字無法區分，等咖哩提供獨立代號。

### 🆕 新待辦（2026-07-10 新增）

> 附註：咖哩要求「待開發項目移到最下面」— 之後每次整理 backlog，已完成項目（✅）留在上方各分類原位，未開發／規劃中項目統一往此區塊或更下方擺放，方便一眼看到還沒做的事。

#### [TODO-22] APP 全站健檢
- 比照 2026-07-05 效能體檢模式，重新跑一輪全站健檢（效能＋功能正確性＋資安），找出目前累積的新問題
- **狀態**：🟡 待開發

#### [TODO-25] 無線電管理／庫存工具（新工具）
- 需求待細化：無線電領用/歸還登記、數量庫存、故障報修、借用人員追蹤等
- 需先確認規格再動工（比照其他獨立工具走「獨立檔 + 獨立 GAS + 新試算表」模式）
- **狀態**：🟡 待開發（待補規格）

#### ⏳ 待咖哩手動操作
- 宣導事項（TODO-20 已完成，2026-07-10）：GAS「管理部署→編輯→新版本」重新部署後，首頁宣導事項按鈕才能讀寫雲端。細節見 `docs/歸檔_已完成待辦.md` 2026-07-10 段。
- TODO-23/24/26 亦已完成（2026-07-10），細節同上歸檔檔。

---

## 📂 路由表（要查什麼、去哪裡）

| 要查什麼 | 去哪裡 |
|---|---|
| 已完成待辦的實作細節（欄位、GAS 端點、部署狀態、試算表 ID） | `docs/歸檔_已完成待辦.md` |
| 踩坑教訓（GAS 授權/Drive/LINE 推播/brain_map/部署/Gemini） | `docs/技術經驗筆記.md` |
| 瘦身前完整 CLAUDE.md（監控系統詳解、Troubleshooting、Git 教學、文件版本史） | `docs/CLAUDE歸檔_2026-07-10_原始完整版.md` |
| brain_map 維護規則原稿 | `CLAUDE_CODE_BRAIN_MAP.md` |
| 各工具 GAS 部署步驟 | repo 根目錄各 `*_GAS_部署說明.md` |
| 派工／模型選擇／驗收制度（全域） | `~/.claude/rules/`（入口：`~/.claude/CLAUDE.md`） |

**維護鐵則**：本檔超過 400 行就要精簡（規則見 `~/.claude/rules/40-maintenance.md` 第四節）。
