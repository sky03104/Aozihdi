# 班表管理 SQL 遷移規劃

> 2026-08-27 建立。分支：`claude/schedule-sql-migration`。目標：把「月班表」（早班表／晚班表）從 Google Sheets 搬到 Supabase（Postgres），解決讀取效能與備份分頁無限增長兩個問題。
> 不含「哨表」系統（每日哨位/巡邏表，資料源完全不同，不在本次範圍）。

## 一、現況架構（搬遷前基準）

- 兩份獨立試算表（早/晚班分開）：
  - 晚班 `targetSsId=1hIbgESfLitqC3W9DuSFGMWEuFZKJFKzK8srorQMuia8`，分頁「晚班班表」
  - 早班 `targetSsId=1l8SoOVDQ4nO6qBkXcNEaBzct6AN82-H_0njbKNQauUQ`，分頁「早班班表」
- 資料主體固定範圍 `A4:AG30`（A欄職稱、B欄姓名、C~AG欄對應每天），`Z1` 存月份
- 儲存格內容＝單一班別代號字串；紅字色＝額外語意覆蓋為「休」（`parseShiftCode_`）
- 上傳流程：`tool_upload.html`（SheetJS 解析 xlsx）→ GAS `action:upload`（存 Drive）→ `action:update`（轉暫存 Sheet 後整段覆蓋目標分頁）
- 換月判斷：比對上傳月份/線上月份/今天月份，決定「直接覆蓋+備份」「寫入_待生效分頁」或「同月修訂+差異通知」
- 換月備份：複製整分頁成隱藏分頁 `_備份_{分頁名}_{yyyy-MM}`，**只增不刪，2026-08-09 才開始有**
- 讀取消費者：`index.html`（ScheduleApp，`getSchedule`）、`tool_billing.html`（`getScheduleByMonth`）、`tool_guard_gen.html`（透過父視窗 index.html 拿資料，不直接呼叫 API）

詳細出處見本次規劃的探索記錄（GAS 檔案：`班表管理_後端_GAS_v2.13.gs`）。

### ⚠️ 2026-08-27 全專案消費者複查（範圍決策的依據）

執行到階段3後，咖哩陸續提出「請假申請」「LINE小助手」「自動排哨工具」「給會計的彙整表」，派 Explore agent 徹底掃過全專案，發現比原始探索更多消費者：

**已涵蓋、走 v2.13 這支 GAS（受本次搬遷影響，安全）**：
- `index.html` 班表管理工具、`tool_billing.html` 請款、`tool_upload.html` 上傳——皆直接呼叫 v2.13 部署網址

**完全獨立、直接讀 Sheets，不受本次搬遷影響（也不需要受影響）**：
- **LINE 小助手**（`天鷹保全APP_後端_GAS.gs`，獨立部署）：自己一份 `SCHEDULE_SHEETS_` 常數，`getScheduleSheet_()`/`readEmployeeShiftsFromSheet_()` 供 LINE 查「今日/明日/本週/本月班表」直接讀 Sheets
- **自動排哨工具**（`哨表產生_GAS.gs`，獨立部署）：`getMonthlyRoster()` 讀當日班別代號算出在職名單，直接讀 Sheets
- **給會計的月彙整表**（`1zVoI7-zshz2zhhcR0sOT6xVzhwFGdIrhc3KxQ5A0PV4`，咖哩另外維護）：純 `IMPORTRANGE`／`XLOOKUP`／`CHOOSECOLS` 公式直接抓兩份試算表儲存格，**沒有任何程式碼**，只要 Sheets 內容正確就永遠正常
- 舊的 `onScheduleEdit_` onEdit 觸發器：程式碼看起來已被新的差異推播機制取代（`班表管理_後端_GAS_v2.13.gs` 寫入成功後直接呼叫 LINE小助手推播，不再依賴 Sheets 被編輯這件事本身觸發），但無法百分之百確定 Apps Script 專案的「觸發器」頁面是否真的清空——不影響目前決策，若之後真要動 Sheets 寫入行為才需要查證

**範圍決策（2026-08-27，咖哩與AI討論後決定）**：**不追求完全停用 Sheets**。理由：要做到那一步，還要另外改 2 支獨立 GAS 專案（LINE小助手、排哨工具），風險（LINE通知、排哨邏輯）大於效益。改為：**Sheets 永久保留當唯一權威來源，Supabase 只當「讀取效能加速層」**，LINE小助手、排哨工具、會計彙整表全部維持現狀不動。原本想解決的兩個目標改用這個方式達成：讀取效能→已用 Supabase 讀取層解決；備份分頁無限增長→不需要停用 Sheets，只要不再讓 Sheets 端複製整分頁備份即可（完整歷史已經在 Supabase 的 schedule_versions 裡）。

## 二、目標資料表設計（Supabase / Postgres）

### schedule_entries（取代寬表格 A4:AG30）
| 欄位 | 說明 |
|---|---|
| id | bigserial 主鍵 |
| shift_type | 'day' / 'night' |
| year_month | 'yyyy-MM' |
| work_date | date，由 year_month + 天數算出 |
| day_of_month | 天數 |
| row_index | 原表格列序（保留職稱分組順序） |
| role | 職稱/身分（A欄） |
| emp_name | 姓名（B欄） |
| shift_code | 班別代號（休假直接存明確代號，不再靠字體顏色判斷） |
| version_id | 外鍵 → schedule_versions.id |
| created_at | timestamptz |

### schedule_versions（取代「複製整分頁當備份」）
| 欄位 | 說明 |
|---|---|
| id | bigserial 主鍵 |
| shift_type | 'day' / 'night' |
| year_month | 'yyyy-MM' |
| status | 'staged' / 'live' / 'superseded' |
| source_file_name | 原始上傳 xlsx 檔名 |
| uploaded_at | timestamptz |
| effective_at | date，預計生效日 |
| superseded_at | timestamptz，nullable |
| note | 換月說明/差異摘要 |

### shift_codes（取代「班別設定」分頁）
| 欄位 | 說明 |
|---|---|
| code | 主鍵 |
| label | 顯示名稱 |
| start_time / end_time | 時段 |
| category | '跟人走' / '跟崗位走' |

## 三、連線方式

GAS 用 `UrlFetchApp` 呼叫 Supabase 自動產生的 REST API。金鑰（service_role key）存在 GAS 指令碼屬性（`PropertiesService`），不寫進程式碼、不流向前端瀏覽器。前端網址與回傳 JSON 格式維持不變，index.html / tool_billing.html / tool_guard_gen.html **不需要改動**。

## 四、分階段執行（2026-08-27 依範圍決策修訂）

| 階段 | 內容 | 完成定義 |
|---|---|---|
| 1. 建置 | Supabase 建三張表；GAS 設定連線金鑰 | 測試資料寫入再讀出成功 |
| 2. 歷史資料搬遷 | 兩份試算表現有資料＋所有 `_備份_` 分頁，一次性轉存 Supabase | 月數/人數與原試算表逐項核對相符 |
| 3. 只換讀＋寫入同步 | `getSchedule`／`getScheduleByMonth`／`listScheduleMonths_` 改讀 Supabase（失敗自動退回讀Sheets）；`handleUpdate`/`checkAndSwitchMonth_` 寫入Sheets成功後同步一份到Supabase | 新舊 API 回傳結果逐字比對相符；已正式接進 doGet 路由 |
| 4. 收尾：停止Sheets端備份分頁 | 換月時不再複製整分頁備份（`備份歷史班表_`呼叫移除），完整歷史改由 Supabase `schedule_versions` 保存 | 之後每次換月，Sheets 分頁數不再增加；`手動備份目前班表()` 保留供緊急手動使用 |
| 5. 每日備份防護 | 新增 `班表管理_SQL每日備份.gs`，每日凌晨3點把Supabase全部資料匯出成JSON存進Drive資料夾「天鷹保全_班表SQL備份」，保留30天自動清舊檔；順便每天實際查詢Supabase一次，避免免費方案7天無查詢自動暫停 | 咖哩實機執行`每日備份Supabase到雲端硬碟`確認Drive出現當天備份檔；`設定每日備份觸發器`已執行 |

~~原本規劃的「4.換寫（上傳直接寫Supabase）」「5.觀察期（Sheets停止當寫入來源）」「6.收尾（完全停用Sheets）」~~ **已依範圍決策取消，不執行**——Sheets 永久保留當唯一權威寫入來源，理由見上方「全專案消費者複查」。

## 五、風險與備援

- Supabase 連不上：GAS 呼叫失敗要明確報錯，保留切回讀 Sheets 的備用路徑（僅對舊有已存在備份分頁的月份有效，新月份無Sheets端備份，詳見階段4）
- Supabase 免費方案的政策/長期穩定性風險（非用量問題，是廠商政策說變就變的風險，如PlanetScale 2024砍免費方案前例）：已用每日自動備份到Drive緩解，就算Supabase帳號/方案出狀況，手上仍有近30天內的完整資料可還原
- 過渡期是否要同步一份唯讀 Sheets 供咖哩肉眼核對：待決定，非必要但有助於驗收

## 六、進度追蹤

- [x] 階段1：建置（2026-08-27，Supabase 專案 `narilpgjmjncladkquly`，三張表建立完成，讀寫刪皆驗證成功，RLS 阻擋無金鑰請求已確認生效）
- [x] 階段2：歷史資料搬遷（2026-08-27，共6個版本：晚班/早班各線上+備份+待生效；經核對遷移結果與直接查詢Supabase雙重驗證，人數/內容抽查皆正確，紅字排休語意正確轉換）
  - ⚠️ 踩坑記錄：Supabase 新版 `sb_secret_` 金鑰有瀏覽器偵測機制，GAS 的 `UrlFetchApp` 無法自訂 User-Agent（Google平台長年限制）會被誤判擋下，改用 legacy `service_role` JWT 金鑰解決，且**REST請求必須同時帶 `apikey` 與 `Authorization: Bearer` 兩個標頭**，只帶 apikey 會被當成匿名身份、被RLS規則擋成回傳空陣列（非報錯，容易誤判為資料遺失）。Phase 3 讀取程式碼務必兩個標頭都帶。
  - ⚠️ 踩坑記錄：原本略過空白格節省空間，會導致「整月都沒排班的人」在資料庫消失，讀取重組時漏人；已修正為全部存（含空白格），換取讀取完整性。原始試算表固定31欄對應每月最多31天，月份不足31天時（如9月30天）多出欄位是不存在的日期，直接存會被資料庫拒絕，已加該月實際天數判斷跳過。修正後6個版本明細筆數皆為「人數×該月天數」整除，確認資料矩形完整無缺漏。
- [x] 階段3：只換讀＋寫入同步（2026-08-27）。`getSchedule`/`listScheduleMonths`/`getScheduleByMonth` 三支讀取API皆與Sheets原版逐字比對完全一致，早晚班皆驗證通過。**已正式接進doGet路由**：優先讀Supabase，任何失敗自動退回讀Sheets並記log（`讀取含備援_`）。`handleUpdate`/`checkAndSwitchMonth_`寫入Sheets成功後同步一份到Supabase。
  - ⚠️ 殘留驗證缺口：`getScheduleByMonth` 的「歷史備份」分支（status=superseded）目前無法用真實資料測到——現有備份月份跟線上月份剛好都是2026-08，查詢一律命中live分支。等下次真的換月（約9月1日）之後，兩邊月份不同了，要再跑一次`比對讀取結果`把backup分支也驗過。
- [x] 階段4：收尾（2026-08-27）。移除`handleUpdate`/`checkAndSwitchMonth_`裡`備份歷史班表_`的呼叫，換月不再複製整分頁；完整歷史由Supabase保存。舊有`_備份_`分頁維持不動不主動清除。
- [x] 階段5：每日備份防護（2026-08-27）。`班表管理_SQL每日備份.gs`已部署，`設定每日備份觸發器`已執行，咖哩實機執行過`每日備份Supabase到雲端硬碟`並確認Drive出現備份檔。
- ~~階段6（原規劃）：觀察期（Sheets停止當寫入來源）~~ 已依範圍決策取消
- ~~階段7（原規劃）：收尾（完全停用Sheets）~~ 已依範圍決策取消

**本次搬遷到此告一段落。** 剩餘待辦：等下次真實換月後補驗`getScheduleByMonth`的backup分支（見階段3殘留缺口）；確認驗證無誤後開PR合併回main。
