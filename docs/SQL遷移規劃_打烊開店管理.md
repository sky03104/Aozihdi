# 打烊/開店管理 SQL 遷移規劃

> 2026-08-27 建立。分支：`claude/update-confirmation-60fvqz`。目標：把「進出資料表」（打烊後／開店前的每日進出登錄）從 Google Sheets 搬到 Supabase（沿用班表管理／施工單管理已建立的同一個 Supabase 專案 `narilpgjmjncladkquly`，新增兩張表）。
> 跟施工單管理同一種效能債模式（每天新增幾十筆、歷史從不清理），且咖哩確認**現場只透過 App 編輯，沒有人直接改 Sheets**——可以讓 Supabase 直接當權威來源，不用留 Sheets 當退路。

## 一、現況架構（搬遷前基準）

- 打烊後、開店前**各自獨立一份試算表**，各自獨立部署一支 GAS：
  - 打烊：分頁「進出資料表」（12欄：A紀錄ID|B專櫃ID|C樓層|D專櫃名稱|E人數|F監工|G進場時間|H施工地點|I施工項目|J退場時間|K檢查者|L建立時間）、分頁「打烊後」（`exportDailyExcel` 匯出來源＋G1寫日期）、分頁「專櫃表」、分頁「_SharedDB」（監工/廠商/檢查者名單，開店工具透過 `DB_GAS_URL` 打這支 GAS 共用讀寫）
  - 開店：同樣12欄的「進出資料表」、分頁「開店前」（`exportDailyExcel` 匯出來源）、自己一份「專櫃表」
- **每日排程**：`exportDailyExcel()` 呼叫 Sheets 原生 `.../export?format=xlsx`，整份試算表匯出成 xlsx 存進共用 Drive 資料夾 `1JaWrMWQQBGGt1BGGaUKqnwTVKQ9De8Na`，檔名「[月][日]日漢神巨蛋[非營業時間 打烊後/營業前 開店前] 進出管制表.xlsx」
- **讀取**：`getTodayRows` 每次 `getDataRange().getValues()` 撈整表，用 L欄（建立時間）篩「當班時段」（晚班：今20:00~明08:00／早班：昨20:00~今08:00）——O(n) 全表掃描，資料只增不減
- **寫入**：一般登錄用 `sheet.getLastRow()+1` 找空列，打烊版額外 `nextRecordId_()` 掃 A 欄找 max（2026-08-08 已修過 `#NUM!` 溢位 bug，見 CLAUDE.md TODO-33）；`updateExitTime`/`updateRow`/`deleteRow` 三個編輯動作都是**用試算表列號 `rowNum` 直接定位**，不是用 ID——刪除後列號位移是潛在風險（尚未爆過但設計上不穩健）
- **消費者只有工具自己**：`tool_closing.html`/`tool_opening.html` 各自讀寫自己的試算表，沒有其他工具依賴這份「進出資料表」（已用 grep 掃過全專案確認）

## 二、範圍決策：只搬「進出資料表」，「專櫃表」「_SharedDB」不搬

**2026-08-27 咖哩與AI討論後決定**（跟班表管理的「效能問題要先實測瓶頸在哪」是同一個教訓）：

- 「進出資料表」是**持續累積、無上限成長**的紀錄，這才是真正的效能債，適合搬
- 「專櫃表」筆數＝早晚班共用的實體專櫃＋樓層組合數，這個數字有物理上限（漢神巨蛋的樓層店家數），**不會隨時間增長**——早晚班本來就是同一批地點/專櫃，搬到 Supabase 只會多一段跨網路來回（比照班表管理 `getSchedule` 的教訓：範圍固定小的資料，Sheets 本身已經夠快，改 Supabase 反而更慢）
- 「_SharedDB」（監工/廠商/檢查者名單）同理，量小固定，不搬

**這代表 Sheets 不會完全停用，是刻意設計不是妥協**：Sheets 繼續當「專櫃表」「_SharedDB」的權威來源；Supabase 當「進出資料表」的權威來源。寫入流程會變成：GAS 收到登錄請求 → 查 Sheets 的專櫃表拿 `shop_code`（跟現在一樣不變）→ 把 log 寫進 Supabase（原本寫 Sheets 的部分改寫這裡）。一個請求裡混合讀 Sheets＋寫 Supabase，跟班表管理「同一支API裡部分欄位權威在Sheets、部分在Supabase」是同一種務實做法。

## 三、這兩支工具獨有的難點：每日 xlsx 匯出

`exportDailyExcel()` 依賴 **Google Sheets 原生匯出 API**（`.../export?format=xlsx`），資料要實際存在 Sheets 才能直接匯出。Supabase 變成權威來源後，改用「暫存分頁」做法（咖哩已確認 OK）：

1. 讀 Supabase 前一天的資料（`created_at` 落在該班別的當班時段）
2. 在試算表裡建一個暫存分頁，貼表頭＋資料（比照原本「進出資料表」的欄位格式）
3. 對暫存分頁執行原本的匯出流程（`export?format=xlsx`，但只匯出這個分頁需要另外處理——Sheets的匯出API是整份試算表層級，可用 `gid` 參數只匯出單一分頁：`export?format=xlsx&gid=<暫存分頁gid>`）
4. 匯出完成後刪除暫存分頁

行為對使用者完全不變：檔名、資料夾、觸發時機都跟現在一樣，只是資料來源換了。

## 四、目標資料表設計（Supabase / Postgres，沿用同一專案新增兩張表）

### closing_gate_logs（打烊後）／opening_gate_logs（開店前）

兩表欄位一致：

| 欄位 | 說明 |
|---|---|
| id | bigserial 主鍵（取代掃A欄找maxId／`lastRow-1`，也取代編輯/刪除用的列號定位） |
| shop_code | 專櫃代號（B欄，查詢/建立自 Sheets 專櫃表，Sheets 仍是權威來源） |
| floor | 樓層（C欄） |
| shop_name | 專櫃名稱（D欄） |
| headcount | 人數（E欄） |
| supervisor | 監工（F欄） |
| entry_time | 進場時間（G欄，沿用原本字串格式 "HH:MM:SS"，不轉型） |
| location | 施工地點（H欄） |
| work_type | 施工項目（I欄） |
| exit_time | 退場時間（J欄，同進場時間，可為空字串） |
| inspector | 檢查者（K欄） |
| legacy_id | 原 Sheets A欄流水號，僅供搬遷稽核用，不參與業務邏輯 |
| created_at | timestamptz，登錄時間（原L欄），`getTodayRows` 用這欄篩當班時段 |

不設唯一鍵限制——這裡不像施工單管理是「批次上傳＋容易產生重複」的情境，是操作員手動逐筆登錄，目前也沒有既有的去重邏輯，本次遷移不額外新增（避免超出範圍）。

## 五、連線方式

沿用既有 Supabase 連線方式（GAS 用 `UrlFetchApp` 打 REST API，金鑰存指令碼屬性，legacy `service_role` key，`apikey`+`Authorization: Bearer` 兩個標頭都要帶，HTTP 方法字串一律小寫——這些都是前兩次遷移踩過的坑，直接套用）。**打烊、開店是兩支獨立 GAS 專案，要各自設定一次連線金鑰**。

## 六、分階段執行

| 階段 | 內容 | 完成定義 |
|---|---|---|
| 1. 建置 | Supabase 新增 `closing_gate_logs`/`opening_gate_logs` 兩張表；兩支 GAS 各自設定連線金鑰並測試 | 兩支 GAS 都能各自寫入再讀出測試資料成功 |
| 2. 歷史資料搬遷 | 讀現有兩份試算表「進出資料表」全部資料，轉存 Supabase（`legacy_id` 保留原始A欄流水號供稽核） | 咖哩確認搬遷筆數與原分頁筆數相符 |
| 3. 只換讀＋失敗備援 | `getTodayRows` 改讀 Supabase（`WHERE created_at BETWEEN 當班起訖`，不用整表撈），失敗自動退回讀 Sheets；**務必實測效能**（比照施工單管理教訓，不能憑感覺） | 新舊結果比對相符；效能確認有改善或至少不變差 |
| 4. 換寫＋改匯出 | 一般登錄、`updateExitTime`/`updateRow`/`deleteRow`（改用 `id` 定位）全部改寫 Supabase；`exportDailyExcel` 改用暫存分頁方案 | 實際登錄一筆、編輯一筆、刪除一筆皆正確反映在 Supabase；隔天確認 Drive 出現的 xlsx 內容跟改版前一致 |
| 5. 每日備份防護 | 比照施工單管理，新增每日自動備份 Supabase（兩張表）到 Drive | 咖哩確認 Drive 出現備份檔 |

## 七、風險與備援

- Supabase 連不上：階段3失敗自動退回讀 Sheets；階段4之後 Sheets 不再是進出資料表的寫入來源，新資料的備援讀取跟施工單管理一樣「沒有退路」——這也是階段5每日備份特別重要的原因
- 專櫃表／_SharedDB 維持在 Sheets：代表這兩支 GAS 專案仍需要 Sheets 存取權限，不能整支砍掉，屬預期內設計
- xlsx 暫存分頁方案：需先用真實資料測試「單一分頁匯出 gid 參數」與「原始 export 全表格式」是否完全一致（欄寬/表頭/日期格式），比照 `tool_upload.html` 列印版面那次「不能用螢幕量測驗收，要用真實檔案比對」的教訓

## 八、進度追蹤

- [ ] 階段1：建置
- [ ] 階段2：歷史資料搬遷
- [ ] 階段3：只換讀＋失敗備援
- [ ] 階段4：換寫＋改匯出
- [ ] 階段5：每日備份防護
