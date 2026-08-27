# 施工單管理 SQL 遷移規劃

> 2026-08-27 建立。分支：`claude/construction-sql-migration`。目標：把「施工單查詢」「動火申請查詢」從 Google Sheets 搬到 Supabase（沿用班表管理已建立的同一個 Supabase 專案 `narilpgjmjncladkquly`，新增兩張表）。
> 跟班表管理不同：這裡是**真實存在且會持續惡化的效能問題**（每天新增幾十筆、歷史從不清理），不是誤判；且現場**只透過工具寫入，沒有人直接編輯 Sheets**，所以 Supabase 可以直接當真正的權威來源，比班表管理的設計更進一步。

## 一、現況架構（搬遷前基準）

- 唯一試算表 `1QuNkwu9zgPidUfSgWpqyT1M9X683IU-0LhXTc23hw-A`，兩個分頁：
  - 施工單查詢（A流水號|B申請單位|C廠商|D月|E日|F進場|G退場|H人數|I監工|J地點|K項目|L施工日期|M退場日期|N備註|O報到時間戳）
  - 動火申請查詢（欄位對應偏移+2，A欄留給ARRAYFORMULA）
- **兩支獨立部署的 GAS**（不同專案、不同部署網址，改動其一不影響另一，不用擔心像班表管理那次多檔案互相呼叫的部署風險）：
  - `施工單時間修正_完整修正版.gs`（`CON_GAS_URL`）：`getOrders(mode)` 查詢、`doPost` 上傳/新增
  - `施工單_報到換證_GAS.gs`（`GAS_URL`）：報到換證
- 5 個消費者：`tool_work.html`（**直接用 gviz 無驗證讀取整表**、手動新增、報到換證）、`tool_closing.html`（getOrders）、`tool_opening.html`（getOrders）、`tool_upload.html`（Excel批次上傳）
- ⚠️ 2026-08-27 咖哩確認：`tool_work.html` 的 gviz 無驗證讀取**是刻意設計，不是漏洞**——這是給某台指定電腦單獨使用的工具，該電腦故意設計成不用登入即可操作（跟咖哩另外兩個獨立repo `test-tools`／`cec-up` 的「指定電腦免登入」設計原則一致）。搬遷時**不能把這個讀取改成需要登入**，但可以放心換成「打GAS→GAS讀Supabase」的路徑，因為`tool_work.html`其他動作（報到換證、上傳）本來就是打「任何人都能存取」的GAS網址不用登入，換路徑不影響免登入這個需求。
- **現場只透過工具寫入，沒有人直接編輯 Sheets**（2026-08-27 咖哩確認）——代表不用處理「Sheets被手動改要同步回SQL」的情境，Supabase可以直接當權威來源
- **真實效能債**：
  - ID產生每次掃A欄找`maxId`（O(n)寫入）
  - 去重用B~K十欄組key掃全表（O(n)寫入）
  - `getOrders`每次`getDataRange().getValues()`撈整表再篩今晚明早兩天（O(n)讀取，`tool_closing`/`tool_opening`每次開工具都觸發）
  - 報到換證：後端全表逐列比對＋前端gviz全表重讀驗證，雙重O(n)，且是**高頻動作**（每張施工單報到觸發一次）
- **歷史已出過至少3次去重bug**（`0d2ab42`誤刪常態巡檢紀錄、`295689d`分桶邏輯誤判、`66e8831`資料遺失重複）——根因是「寫入去重」（B~K精確比對）跟「顯示去重」（監工+項目模糊分桶）兩套邏輯對不上。SQL化時只設計**一套**唯一鍵，不重蹈覆轍。

## 二、目標資料表設計（Supabase / Postgres，沿用同一專案新增兩張表）

### construction_orders（施工單查詢）
| 欄位 | 說明 |
|---|---|
| id | bigserial 主鍵（取代掃A欄找maxId） |
| apply_unit | 申請單位 |
| vendor | 廠商 |
| work_date | date，合併原本月/日/L施工日期三欄打結的設計，存真正的日期 |
| entry_time | 進場時間（實際格式需在階段2核對原始資料後確認） |
| exit_time | 退場時間 |
| headcount | 人數 |
| supervisor | 監工 |
| location | 地點 |
| item | 項目 |
| exit_date | 退場日期（M欄，跨夜工程退場可能是隔天） |
| note | 備註 |
| checked_in_at | timestamptz，nullable，報到時間戳（O欄），報到換證時寫入 |
| dedupe_key | **唯一鍵**，由 vendor+work_date+entry_time+exit_time+location+item 組成，取代舊有兩套對不上的去重邏輯 |
| created_at | timestamptz |

`dedupe_key` 設 UNIQUE 限制，寫入時 `ON CONFLICT (dedupe_key) DO NOTHING`（或視需求 DO UPDATE），一次解決過去3次去重bug的根因——資料庫的唯一鍵不會像手寫的Set比對邏輯一樣，在「寫入時」跟「顯示時」出現兩套不一致的規則。

### fire_permits（動火申請查詢）
結構同上，欄位對應動火申請查詢分頁的B~N，**額外多一欄 `equipment`（動火器具）**——讀了`施工單時間修正_完整修正版.gs`的doPost才發現，施工單查詢跟動火申請查詢的欄位不完全對稱，動火多存這一項業務欄位，但不參與去重比對（dedupe_key只看B~K十個欄位，兩張表一致）。

## 三、連線方式

沿用班表管理已經建好的 Supabase 連線方式（GAS用`UrlFetchApp`打REST API，金鑰存指令碼屬性，legacy service_role key，`apikey`+`Authorization: Bearer`兩個標頭都要帶——這些都是上次踩過的坑，直接套用）。**兩支獨立GAS專案都要各自設定一次連線金鑰**（不是共用同一個部署，是兩個獨立專案）。

## 四、分階段執行

| 階段 | 內容 | 完成定義 |
|---|---|---|
| 1. 建置 | Supabase新增`construction_orders`/`fire_permits`兩張表；兩支GAS各自設定連線金鑰並測試 | 兩支GAS都能各自寫入再讀出測試資料成功 |
| 2. 歷史資料搬遷＋清理 | 讀現有兩個分頁全部資料，用新的`dedupe_key`規則跑一次去重後轉存Supabase | 咖哩確認搬遷筆數與原分頁筆數的差異（重複/孤兒列被清掉的數量）可以接受；**清理紀錄要落檔保留，不靜默丟棄**，方便事後稽核 |
| 3. 只換讀＋失敗備援 | `getOrders`、`tool_work.html`的gviz讀取、報到換證的查詢比對，都改讀Supabase（含索引查詢，例如`getOrders`直接WHERE work_date篩選，不用整表撈），失敗自動退回讀Sheets | 新舊結果比對相符；**這次要實測效能**（比照班表管理教訓），確認真的比全表掃描快，不是憑感覺 |
| 4. 換寫 | 上傳工具、手動新增、報到換證全部改寫入Supabase；Supabase成為真正權威來源 | 實際上傳一批施工單、手動新增一筆、報到一筆，皆正確寫入且無重複 |
| 5. 每日備份防護 | 比照班表管理，新增每日自動備份Supabase到Drive | 咖哩確認Drive出現備份檔 |
| 6.（可選）Sheets唯讀鏡像 | 視咖哩需求，定期把Supabase資料同步回一份唯讀Sheets方便肉眼查看 | 非必要，看咖哩要不要 |

**跟班表管理的關鍵差異**：這裡沒有「Sheets永久當權威來源」的退讓——階段4完成後，Sheets會停止被寫入，Supabase變成真正的權威資料庫。因為現場確認只透過工具寫入，沒有直接編輯Sheets的情境，才能這樣設計。

## 五、風險與備援

- `tool_work.html`目前用gviz無驗證直接讀取整份試算表——**這是刻意設計（指定電腦免登入），不是要修的漏洞**。搬遷時改走GAS+Supabase的路徑要維持「不用登入」這個特性，GAS部署設定沿用現有「任何人都能存取」即可，不要加登入驗證。
- 歷史重複/孤兒資料的清理決策：不做靜默清除，遷移報告要列出「哪些資料被判定重複、依什麼規則、合併或捨棄了什麼」，供咖哩事後稽核，不確定的保留不清。
- Supabase連不上：沿用班表管理的備援設計（讀取自動退回Sheets），但因為階段4之後Sheets不再是寫入來源，**新資料的備援讀取會跟班表管理歷史月份查詢一樣「沒有退路」**——這也是為什麼階段5的每日備份特別重要。
- 效能實測：階段3務必實際測試前後差異（比照班表管理教訓，不能假設SQL一定比較快），但這裡的資料特性（持續累積、無上限成長）跟班表管理（範圍固定小）本質不同，預期會有真實改善。

## 六、進度追蹤

- [x] 階段1：建置（2026-08-27，`construction_orders`/`fire_permits`兩張表建立完成，讀寫刪皆驗證成功，唯一鍵`dedupe_key`確認能擋掉重複資料（409衝突），RLS安全設定沿用班表管理同一套）
- [ ] 階段2：歷史資料搬遷＋清理
- [ ] 階段3：只換讀＋失敗備援
- [ ] 階段4：換寫
- [ ] 階段5：每日備份防護
- [ ] 階段6（可選）：Sheets唯讀鏡像
