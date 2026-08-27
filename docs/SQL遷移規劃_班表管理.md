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

## 四、分階段執行

| 階段 | 內容 | 完成定義 |
|---|---|---|
| 1. 建置 | Supabase 建三張表；GAS 設定連線金鑰 | 測試資料寫入再讀出成功 |
| 2. 歷史資料搬遷 | 兩份試算表現有資料＋所有 `_備份_` 分頁，一次性轉存 Supabase | 月數/人數與原試算表逐項核對相符 |
| 3. 只換讀 | `getSchedule`／`getScheduleByMonth`／`listScheduleMonths_` 改讀 Supabase，回傳格式不變；Sheets 暫時仍是寫入來源 | 新舊 API 回傳結果逐字比對數個月份皆相符 |
| 4. 換寫 | 上傳流程改寫入 Supabase，含換月判斷、差異通知邏輯 | 實際上傳一份月班表，寫入正確、備份/通知邏輯正確觸發 |
| 5. 觀察期 | Sheets 停止當寫入來源，保留備援 | 咖哩實際使用數天無異常 |
| 6. 收尾 | 停用複製分頁備份機制 | 確認所有歷史月份已在 Supabase，分頁數不再增加 |

## 五、風險與備援

- Supabase 連不上：GAS 呼叫失敗要明確報錯，保留切回讀 Sheets 的備用路徑
- 過渡期是否要同步一份唯讀 Sheets 供咖哩肉眼核對：待決定，非必要但有助於驗收

## 六、進度追蹤

- [ ] 階段1：建置
- [ ] 階段2：歷史資料搬遷
- [ ] 階段3：只換讀
- [ ] 階段4：換寫
- [ ] 階段5：觀察期
- [ ] 階段6：收尾
