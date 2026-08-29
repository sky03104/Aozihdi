# 班表管理 — Sheets 徹底退場規劃

> 接續 2026-08-27 已完成的第一輪遷移（PR #254/255，見 `docs/SQL遷移規劃_班表管理.md`）。
> 那一輪決定「Sheets 永久保留」，原因是 LINE小助手／自動排哨工具／會計月彙整表
> 三個外部系統都直接讀 Sheets，遷移風險判斷大於效益。這次咖哩決定接受工程量，
> 徹底做完，讓 Supabase 成為班表資料唯一權威來源。

## 現況（2026-08-27 遺留）

- `schedule_versions`／`schedule_entries` 已在 Supabase（`narilpgjmjncladkquly`）上線
- `getScheduleByMonth`／`listScheduleMonths`：Supabase 優先、Sheets 備援
- `getSchedule`（首頁日常查詢）：Sheets 優先、Supabase 備援（**因為實測 Supabase 較慢才改回的，不是沒試過**：Sheets 18-25ms vs Supabase 750-800ms）
- 每日 Supabase→Drive 備份已上線，Sheets 側每月備份分頁已停止建立
- **三個外部系統仍直接讀 Sheets，完全繞過這套 GAS**：
  1. LINE小助手（`天鷹保全APP_後端_GAS.gs`，獨立部署，自己的 `SCHEDULE_SHEETS_`／`getScheduleSheet_`／`readEmployeeShiftsFromSheet_`）
  2. 自動排哨工具（`哨表產生_GAS.gs`，獨立部署，自己的 `SCHEDULE_SHEETS_`／`getEmployeeNames`／`getMonthlyRoster`）
  3. 會計月彙整表（試算表 `1zVoI7-zshz2zhhcR0sOT6xVzhwFGdIrhc3KxQ5A0PV4`，純公式 IMPORTRANGE/XLOOKUP/CHOOSECOLS，無程式碼）

## 這次的三個決定（咖哩已拍板）

1. **班別設定／員工工號對照建成正式 Supabase 資料表**（`shift_codes`／`staff_emp_ids`），不是塞進備份 JSON 應付。
2. **寫入路徑這次直接砍掉 Sheets 寫入**（7b，非漸進式的 7a），不留 best-effort 備援。
3. **會計月彙整表鏡像改用簡化新版面**，不沿用原本 A4:AG30 版面 —— 代表咖哩要重寫那份試算表的公式，這是外部人工維護的東西，需要跟咖哩明確溝通新版面欄位長相，讓他能對照重寫。

## 執行順序（重要：因為選了 7b，順序被鎖死）

因為這次要整個砍掉 Sheets 寫入，寫入切斷（原規劃的 Stage 7）**必須排在所有讀取端都遷完之後**，否則 LINE小助手／排哨工具還在讀 Sheets 時，資料會停在切斷那一刻不再更新，變成看不出來的死資料 bug。

| 階段 | 內容 | 檔案 | 風險/備援 |
|---|---|---|---|
| **6** | `getSchedule` 快取吸收重新設計：不是「Supabase優先」，是「Supabase為權威、寫入時主動清快取，讀取只在 cache miss 才付網路成本」 | `班表管理_後端_GAS_v2.13.gs`、`班表管理_SQL讀取層.gs` | 純內部改動，用 `測試讀取效能()` 實測 p50/p95，沒達標就退回 Sheets優先（現有路徑不刪） |
| **6.5** | 建 `docs/班表管理SQL建表.sql`（補文件缺口）＋建立 `shift_codes`／`staff_emp_ids` 兩張表並回填資料 | 新增 `.sql`、Supabase MCP | 純新增，不影響現有讀寫 |
| **8** | LINE小助手改讀 Supabase（`schedule_entries`＋`staff_emp_ids`），雙讀＋Sheets備援，先跑幾天比對再切預設路徑，最後才切每日推播 | `天鷹保全APP_後端_GAS.gs` | 獨立部署，失敗只影響LINE回覆/推播，備援路徑就是現有 Sheets 讀法（先留著不刪） |
| **9** | 自動排哨工具改讀 Supabase，雙讀＋Sheets備援，**跑通既有 ~60 項 node 測試**才算完成 | `哨表產生_GAS.gs` | 獨立部署，排在 LINE小助手之後（先驗證 Supabase 讀取模式可靠） |
| **10** | 會計月彙整表鏡像：新腳本定期（比照每日備份的時間點觸發）把 `schedule_entries` 寫成**簡化新版面**到會計試算表新分頁，跟咖哩對過新版面欄位後才寫程式，且要提醒咖哩公式需要重寫 | 新增小型 GAS（暫名 `班表管理_SQL會計鏡像推播.gs`） | 對外部試算表的改動，先跟咖哩對版面、他確認能重寫公式才上線 |
| **7b** | **上述 8、9、10 都確認穩定後**，才切斷 Sheets 寫入：`handleUpdate`／`handleUpdateSchedule`／`deleteStaff`／`updateShiftSettings`／`upsertStaffEmpId`／`deleteStaffEmpId` 全部只寫 Supabase；`_待生效` 暫存機制改用 `schedule_versions.status`（staged→live→superseded，欄位已存在）取代 Sheets 暫存分頁 | `班表管理_後端_GAS_v2.13.gs`、`tool_upload.html`（確認前端上傳UX不變） | Supabase 寫入失敗直接算失敗（不再有 Sheets 兜底），安全網是每日備份 + `schedule_versions` 版本歷史，可用還原版本狀態修正錯誤寫入。**Drive 上傳的 xlsx 稽核檔仍保留**（`schedule_versions.drive_file_id` 記錄對應關係），不受影響 |

**注意**：階段 8/9/10 進行期間，Sheets 寫入照舊維持（還沒到 7b），確保這三個還在遷移中的讀取端備援路徑資料是對的。

## 這次範圍之外（Phase 2，之後再排）

`tool_ai_chat.html`／`tool_car.html`／`tool_emergency.html`／`tool_feedback.html`／`tool_handover.html`／
`tool_menstrual.html`／`tool_radio.html`／`tool_report.html`／`tool_shift_adjust.html`／`liff_leave.html`／
`tool_upload.html` 的獨立哨表上傳子功能（另一支 GAS `哨表上傳_GAS_v6.gs`）／`tool_work.html` 搜尋歷史查詢（既有 TODO-38）。
`tool_billing.html` 已經在讀 `getScheduleByMonth`，這次不用動。

## 沿用既有踩坑教訓（跨專案已知）

- GAS `UrlFetchApp` 的 HTTP method 字串一律小寫（`'patch'`/`'delete'`），大寫會被靜默忽略
- 一定要同時帶 `apikey` 與 `Authorization: Bearer`，缺一個會被 RLS 靜默篩成空結果（不會報錯）
- Supabase GET 預設回傳上限 1000 筆，可能大量的查詢要用 Range header 分頁
- 多檔案 GAS 專案：改動任一檔案，記得提醒咖哩要把所有互相依賴的檔案一起貼上重新部署，不能只貼改到的那個
- 新舊行為比對出現差異時，先去查原始設計意圖，不要預設「舊的一定對」

## 進度追蹤

- [ ] 階段6：`getSchedule` 快取重設計＋效能實測
- [ ] 階段6.5：`docs/班表管理SQL建表.sql` ＋ `shift_codes`／`staff_emp_ids` 建表回填
- [ ] 階段8：LINE小助手改讀 Supabase
- [ ] 階段9：自動排哨工具改讀 Supabase
- [ ] 階段10：會計月彙整表鏡像推播（待與咖哩確認新版面）
- [ ] 階段7b：切斷 Sheets 寫入
