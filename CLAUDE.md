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

15個節點的角色/地點圖完整對照表、角色圖檔規格、路飛跑步動畫現況、地點圖放大機制 → 已搬到 `docs/角色地點對應表.md`（2026-07-14 精簡搬出，內容一字未改）。改動角色分配/新增地點圖時，**改完那份文件也要同步更新**，並跑一次 `node --check` + id/edge 完整性檢查。

### ⛔ 自動同步規則（強制，使用者已要求每次改動自動同步）

**只要本次工作有「結構性變動」，AI 必須在結束回合前同步更新 `brain_map.html` 的資料區，並在進度摘要回報，不需使用者另外開口。** 結構性變動定義：

- 新增／刪除／改名 任一工具（`tool_*.html`、`index.html` 內嵌 tpl-*、獨立頁）
- 新增／刪除 GAS endpoint（`action` 路由）或 GAS 檔
- 新增／刪除 資料表分頁、localStorage 資料庫、Drive 資料夾用途
- 模組間關聯改變（新呼叫、新資料流、新頁面連結）
- 待辦狀態重大變化（TODO 完成/新增，對應 `todo` 主題節點）

**做法**：依上方「維護指令」更新 `TOPICS/NODES/EDGES`（只動資料標記區）→ 跑完整性檢查（無斷邊／無重複 id／topic 有對應）→ 與該次變更**同一個 commit** 一起提交。純文案／樣式微調、不改結構者可略過。

---

## 📝 進行中待辦（完成一項 → 細節寫進 docs/歸檔_已完成待辦.md，本節刪該行）

- **[TODO-12] 哨表自動化工作流** — ✅ 已上線（2026-07-19）。`tool_guard_gen.html`（哨點設定＋產生哨表兩分頁）＋ `哨表產生_GAS.gs` 已部署，掛進主選單「人事管理」分類、僅管理員可見。月班表代號自動判斷：見=見習、L=巡檢增派、LN=巡檢+停巡增派、N=停巡增派、南=南側門、海=海底撈、H/H2=早晚班漢來飯店同一人；帶班幹部改下拉選單（哨點設定裡標記過資格的人）且會排除在其他哨位隨機池外；哨點設定支援每崗位優先序＋姓名搜尋。上傳沿用既有 `哨表上傳_GAS_v6.gs` 的 `guardUpload` action。核心邏輯累計約60項 node 測試全過。主管操作手冊已補「自動排哨工具」章節、brain_map.html 節點138已同步。

- **[TODO-30] 每月請款資料自動產生** — ✅ 已上線（2026-08-08）。`tool_billing.html`（純前端，無新增 GAS），主選單 id22「人事管理」分類、**僅管理員可見**（請款金額屬財務資料）。產出 20 分頁 xlsx（總表＋主合約＋6項各自的發票/明細/附表），可直接交件。時數優先自動讀月班表代號：`海`→2海底撈(4H)、`N`或`LN`→3地下停車場(8H)、`H`/`H2`→4漢來VIP(11H/11.5H)、`L`或`LN`→5假日勤務(8H)、`南`→6其他南側門(11或12H)；7安全駕駛(VIP泊車)不在班表，手動輸入。費率一般270／國定假日410元/時，**假日由使用者勾選，不自動判斷**。支援自訂臨時項目（如週年慶增派）排在項次8起。**對帳驗證**：以 115年7、8月實檔的日期時數餵入，7項＋總計共16個數字全數相符。獨立驗收（fresh agent）第一輪 FAIL 抓到 2🔴——①「一般增派時數」在 Excel 寫成公式指向總時數欄，該月有國定假日時 Excel 重算會多算（畫面正確、檔案錯誤）；②月份保護 `y &&` 導致空白 ym 被當成通過（fail-open）。皆已修正並補上「含假日月份」的測試（原測試資料全是無假日，繞過該路徑）。brain_map 節點140 已同步。
- **[TODO-35] 生理假紀錄工具** — ✅ 已開發完成（2026-08-10），**待咖哩建試算表＋部署 GAS 才能用**。`tool_menstrual.html` ＋ `生理假紀錄_GAS.gs`（獨立部署／獨立試算表），主選單 id23「資料管理」分類、**僅副隊長以上**（vicecaptain/captain/executive/admin）。⚠️ 存的是女性員工健康資料，屬**個資法第6條特種個資**，三層權限把關：`DEFAULT_PERMS` → 前端 `checkPermission()` → GAS 每個 action 驗 token+角色（前兩層在瀏覽器裡改得掉，後端那層才是真的）。定位是**主管登記模式**（非申請審核流程，避免與既有「請假申請」id99 重複）。欄位：ID/日期/工號/姓名/天數(1或0.5)/班別/備註/登記人/登記時間，同人同日不可重複登記。**自動依《性別平等工作法》第14條計算**：全年 3 日內不併病假、超出部分逐筆標註「併入病假」，同月超過 1 日提醒。另提供「下次約在何時」參考區間，設計上刻意保守——少於 2 筆不推估、只取最近 6 次、間隔 15~60 天以外視為異常剔除（同次經期分兩天登記或中間漏登記會嚴重汙染平均），輸出預估日 ±3 天且畫面標明僅供排班參考。核心計算為純函式並 `module.exports`，已用 node 驗過法規計算與預估的 15 種情境。brain_map 節點141 已同步。
- **[TODO-34] 首頁小卡改顯示明日哨點** — ✅ 已上線（2026-08-09）。首頁四張小卡左下角原本顯示「常用工具數量」，改成讀 `getTomorrowPost` 顯示登入者自己明天的哨點。**不用改後端**：該 API 每筆回傳 `{loc, name, time, empId}`，「查某人明日哨點」的邏輯後端早就有（`天鷹保全APP_後端_GAS.gs:3374`），先前只給 LINE 推播用。四種狀態：`ok` 顯示哨點（金色🛡️，多哨位標「共N處」）／`off` 休假（綠🌴）／`notyet` 尚未更新（灰⏳）／`loading` 讀取中。⚠️ **用「工號 或 姓名」雙重比對**：哨表上是手寫姓名，該員若沒在員工資料建檔則回傳的 empId 為空字串，只比工號會把「有排班」誤判成「休假」——那是會害人漏班的假訊息；同理讀取失敗一律顯示「尚未更新」，絕不顯示成休假。點小卡直接開明日哨表（`post.html` 新增 `?view=tomorrow` 參數，只認小寫、其餘退回 today；從工具選單進入則維持預設今日，兩個選單入口都要重設 `postView`）。
- **[TODO-33] 打烊工具兩個資料面 bug** — ✅ 已修復並經咖哩實機驗證（2026-08-09）。①**進出資料表 A 欄整欄變 `#NUM!`**：`nextRecordId_()` 掃 A 欄取最大值時只用 `!isNaN()` 過濾，但 `isNaN(Infinity)` 是 `false`；舊版 `genId()` 的隨機 8 碼中形如 `948e0715` 者被 Sheets 讀成 948×10^715 而溢位成 `Infinity`，於是 `nextId = Infinity+1 = Infinity`，寫回顯示 `#NUM!` 且 `Infinity++` 恆為 `Infinity` → 整批全壞、下批重新掃描又命中同樣壞格 → 永久復發。改為三道過濾（非 number 型別／非有限數／僅採信 1~1e7 正整數）。歷史 `#NUM!` 資料經咖哩決定不清理（編輯刪除靠列號比對，不受影響）。②**凌晨 00:00 後登錄的資料在「今日」分頁看不到也無法編輯**：`getTodayRows()` 的 `shiftEnd` 寫成 `new Date(y, m, d+1, 0, 0)`，少給一個參數被讀成「隔天 0 時 0 分」而非註解宣告的 08:00，兩個分支都錯。補成 `8, 0, 0`。⚠️ 兩者皆內嵌於 `tool_closing.html` 的 `GAS_CODE`，需手動貼到 Apps Script 重新部署（已完成）。
- **[TODO-31] 月班表跨月自動備份** — ✅ 已上線（2026-08-09），`班表管理_後端_GAS_v2.13.gs`。**背景**：每月1號凌晨排程 `checkAndSwitchMonth_` 會把「待生效」直接蓋掉線上班表且無備份，舊月份班表就此消失；咖哩是**次月初做上個月的請款**，等於每次要用的班表都剛好在前一天不見，出勤爭議時也查無當時排班。**修法**：兩個覆蓋點（排程換月、上傳換月）在覆蓋前先把舊班表複製成隱藏分頁 `_備份_{分頁名}_{yyyy-MM}`；只新增不刪除、同月已存在則跳過保留最早那份、備份失敗只記 log 不中斷換月。新增 `getScheduleByMonth`（先找線上再翻備份，找不到明確失敗不拿別月充數）、`listScheduleMonths`、`手動備份目前班表()`。`tool_billing.html` 改讀 `getScheduleByMonth` 且預設帶「上個月」。⚠️ **備份只對部署之後的月份有效，部署前的月份救不回來**；部署後務必先手動執行一次 `手動備份目前班表()`。2026-08-09 已部署並確認 8 月備份分頁建立成功。
- **[TODO-32] 班表管理 UI 調整＋請款工具預覽** — ✅ 已上線（2026-08-09）。①班表預設從「晚班班表/今日」改為「案場班表（早+晚合併）/月班表」——不能只改預設值，`switchShift('all')` 只讀本機快取不向雲端要資料，初始就設 all 會是空白；改法是抽出 `抓班表_()`（只取資料不碰畫面狀態）、`合併案場班表_()`（早班 id 加 ID_OFFSET 避免撞號）、`讀班表快取_()`，初始 useEffect 平行抓早晚兩班寫入各自快取後合併顯示，單班讀不到就退回該班快取並明講。②今日/明日/本週那排分頁鈕原本 `background:none`+`border:none` 只有一條底線，現場有人看不出可按，改成與班別切換鈕相同的膠囊樣式（底色/金框/圓角/minHeight 40）。③請款工具下載鈕上方加「預覽內容」全螢幕視窗（總表/主合約/各項明細＋計價＋附表文字/臨時項目，附分頁跳轉），附表內容抽成 `附表內容_()` 供產生 xlsx 與預覽共用，確保預覽＝實際檔案。④請款項3 收 `N` 或 `LN`、項5 收 `L` 或 `LN`；**LN 一天在兩項各算 8H 合計 16H 是正確的**（LN 的 1200-2000 算項5、2000-2400 算項3，項3 另外 4H 來自假日 S 班變 A 班多出的 1600-2000），已寫進程式註解勿改回。
- **[附帶修正]** `tool_guard_gen.html` 漢來 `H2` 收哨時間 `1100-2330` → `1100-2230`（咖哩 2026-08-08 確認原值錯誤，請款附表以 11:00-22:30＝11.5 小時計）。該時間原本在 `POST_DEFS` 與 `HANLAI_CODE_TIME` 兩處各寫一份導致改漏，已改為後者引用前者，單一來源。

### 🆕 新待辦（2026-07-10 新增）

> 附註：咖哩要求「待開發項目移到最下面」— 之後每次整理 backlog，已完成項目（✅）留在上方各分類原位，未開發／規劃中項目統一往此區塊或更下方擺放，方便一眼看到還沒做的事。

#### [TODO-22] APP 全站健檢
- 比照 2026-07-05 效能體檢模式，重新跑一輪全站健檢（效能＋功能正確性＋資安），找出目前累積的新問題
- **狀態**：✅ 三大面向（資安／效能／功能正確性）皆已跑過一輪且 🔴 清單全數修復完畢（最後核實 2026-07-30）。7/11 22:45 跑過一輪主動健檢，查出 index.html 內嵌 React19.2.5（根因見 `docs/技術經驗筆記.md` 2026-07-11 段，決定暫不降版）。
  - **資安**（7/26~7/29）：移除前後端硬編員工帳密，登入改走後端驗證＋新增 `login/verifySession/changePassword` API（`b2a7160` `c4bef78` `71d03db`）；事故報告/表揚檢舉、緊急聯絡清單 GAS 補登入驗證，堵住個資外洩缺口（`1eeb1eb` `63f720d`）；移除緊急聯絡清單前端硬編的80組電話含家屬（`6efb9e1`）；緊急聯絡清單 GAS 分頁名稱寫錯＋未登入仍讀得到本機快取兩個外洩缺口修復（`0b2f54a` `0d8ca0d`）
  - **效能**（7/26）：index.html 從 21769 行大幅瘦身到現行 4630 行——React 執行環境、打烊登錄、資料上傳、緊急聯絡清單、停車位計算都抽成外部檔案引用（`862df8f` `0d059ff` `fa9053b`）
  - **功能正確性**（2026-07-29~30）：13 支工具＋index.html 主控台核心全數複查完畢，找出 7 項 🔴 阻擋、多項 🟡，完整清單見 `docs/健檢報告_2026-07-29_功能正確性.md`。**7 項 🔴 全數修復並經獨立 code-reviewer 驗收 PASS**：#1 請假早/晚班配額失真、#3 班表上傳內容防呆遺失、#5 自動排哨同人雙崗無警告、#6 事故/表揚日期跨夜算錯（2026-07-29 修，0🔴 2🟡收斂項不影響交付）；#2 打烊登錄今日分頁編輯/刪除100%失敗、#4 施工單查詢資料遺失/重複（2026-07-30 修，0🔴 0🟡，已合併 PR #203）；#7 過夜車輛登記無防連點/無empId驗證（2026-07-30 修，0🔴 2🟡收斂項）。剩一批 empId 未驗證的中等問題留在報告 🟡 段，未來要修再另開待辦
  - **需咖哩手動部署**：#2 是內嵌在 `tool_closing.html` 裡的 `GAS_CODE` 字串，需複製貼到 Apps Script 重新部署；#7 是獨立部署的 `車牌辨識_後端_GAS.gs`，需重新部署新版本

#### [TODO-25] 無線電管理／庫存工具（新工具）
- 需求待細化：無線電領用/歸還登記、數量庫存、故障報修、借用人員追蹤等
- 需先確認規格再動工（比照其他獨立工具走「獨立檔 + 獨立 GAS + 新試算表」模式）
- **狀態**：🟡 待開發（待補規格）

#### [TODO-28] 吉祥物動畫補完——每隻補到4段接力動畫
- 目標：互動吉祥物系統（`MascotWidget`，`index.html` 內 `MASCOT_CHARACTERS`，見 `brain_map.html` 節點136）12隻角色都補到 4 段接力動畫
- **現況盤點（2026-07-14 更新）**：
  - 已達4段 ✅：咖波、白爛貓、**鯊魚先生**（原本卡在雨滴背景問題的第4段，咖哩這次傳的是不同來源「再睡五分鐘」片段，背景是床/鬧鐘沒有雨滴橋接問題，補上了）、**情侶貓**、**小呆雞**（1→4段）
  - 1段待擴充：愛心小狐、奔騰小馬
  - 0段（純靜態立繪，需先找/截素材才能做動畫）：路飛、索隆、娜美、喬巴、香吉士——這5隻是海賊王角色，沒有 LINE 貼圖動態素材可用，跟 `brain_map.html` 的跑步動畫是完全不同的系統，不要混為一談
- 素材來源、去背/瘦身流程照既有 SOP（`docs/技術經驗筆記.md` 2026-07-11「互動吉祥物系統」整篇），版權判斷標準不變（個人創作者貼圖可做，大型商業IP一律婉拒）
- **狀態**：🟡 待開發，逐隻角色慢慢補，不用一次做完。剩愛心小狐、奔騰小馬 1→4 段，5隻海賊王靜態立繪視情況再議

#### [TODO-29] 咖哩海域跑步動畫補完（brain_map.html RUN_IMG_MAP，跟TODO-28是不同系統）— ✅ 已完成
- 目標：`brain_map.html`（咖哩海域3D知識圖譜）節點角色的跑步循環動畫，`NODE_CHAR` 對應到的角色全數要有跑步循環，不代打路飛
- **2026-07-14 全數補齊**：弗蘭奇/薩波/香克斯（咖哩重新出圖，綠幕底6x2=12格）切格去背後補進 `RUN_IMG_MAP`，加上先前已完成的索隆/娜美/喬巴/山治/烏索普/羅/艾斯/克比/甚平/佩羅娜/布魯克/路飛/羅賓，共17位角色全數有跑步循環
- **同日順便修復**：克比/甚平/布魯克三隻先前補的12幀圖其實是實心白底沒去背（一直沒發現），改用邊界連通白色像素去背法修正
- 詳細處理過程見 `docs/技術經驗筆記.md` 2026-07-14 段

#### [TODO-27] 多案場版開發方向
- 目標：同一套天鷹保全 APP 服務三個案場——漢神巨蛋（現行）、漢神本館（已完工待建資料）、漢神凹子底（興建中）
- 採「三方會議」模式規劃（呼叫 `llm-council` skill 問 ChatGPT+Gemini，Claude 整合），一天一個主題慢慢討論細節，直到完整方案成型，每場記錄都寫進 `docs/技術經驗筆記.md` 2026-07-12 段
- **會議1（架構方向）已定案**：資料獨立、程式碼共用——每案場各開一份獨立試算表，三案場共用同一份 GAS 程式碼，靠 `siteId → 試算表ID` 對照表路由；前端用 `?site=` 參數＋localStorage 記憶；員工跨案場支援靠一份全公司員工總表做身份驗證
- **會議2（優先順序與步驟）已定案**：第一步先建 SiteConfig 對照表＋漢神本館空白試算表範本（不改程式碼）；「一工具一GAS」維持現狀不合併，各自加標準函式 `getSsById(siteId)`；第一個試點選 **`tool_car.html`**（車輛管理，非簽到——簽到牽涉員工出勤影響太大）；驗證靠「舊連結相容/新site寫入/亂打site防呆」三項測試
- **2026-07-26 補充決策**：外部 code review 建議做「統一 API 呼叫函式」（`api.js` 集中管理 fetch），評估後**只有這一項跟多案場真的相關**——因為每支工具的每個 fetch 呼叫都要補 `site` 參數，跟這幾天補 token 驗證時「漏改某個呼叫點」的坑是同一類風險，範圍還更大。決定**排進 `tool_car.html` 試點的第一步**，跟建 SiteConfig 對照表一起做，不單獨提前做（wrapper 設計要先確定 `site` 參數實際傳法）。Review 建議的其餘項目（Core/Components/Store 全套框架化、後端 Services 集中）跟「一工具一GAS」的既定架構方向衝突，不採用
- **狀態**：🟡 規劃中（會議1、2 已完成），下一場主題待定。**等咖哩明確說要開始動工才動手**，不要主動搶著做

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
