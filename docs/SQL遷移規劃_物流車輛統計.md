# 物流車輛統計 SQL 遷移規劃

> 2026-08-27 建立。目標：把「物流車輛紀錄」從 Google Sheets 搬到 Supabase（沿用班表管理/施工單管理/打烊開店管理已建立的同一個 Supabase 專案 `narilpgjmjncladkquly`，新增一張表）。
> 跟打烊/開店/施工單同一種效能債模式（每天持續累積、從不清理），但**沒有「即時監控報表」的依賴**（`exportMonth` 只是把彙總結果寫進試算表新分頁，不是呼叫 Sheets 原生 xlsx 匯出 API，也沒有公式即時抓資料的畫面），比打烊/開店單純很多，不需要「按需刷新」那一層。

## 一、現況架構（搬遷前基準）

- 獨立試算表＋獨立 GAS（`tool_logistics.html` 內嵌 `GAS_CODE`，同內容另存一份 `物流車輛統計_GAS.gs` 供參考，兩者需同步改）
- 分頁「物流車輛紀錄」（主資料，8欄：A紀錄ID|B日期|C時間|D分類|E數量|F登記人工號|G登記人姓名|H建立時間）——每天持續累積，不清理
- 分頁「快捷設定」（管理員設的分類+數量快捷組合）——量小固定，**不搬**
- **讀取**：`getDay`/`getMonth`/`aggregateMonth_` 都是 `getRange(2,1,lastRow-1,8).getValues()` 全表掃描再篩選——O(n)，資料累積越多越慢
- **寫入**：`nextId_`/`commitNextId_` 用 Script Properties 快取下一個可用ID（O(1)，沒快取時才全表掃描重建），`updateRecord`/`deleteRecord` 用 `findRowById_` 掃描A欄比對ID找列號——O(n)
- **日期判斷**：優先用 H欄「建立時間」（絕對時間戳）判斷登記日期/時間，沒有才退回 B/C 欄字串（`isDate_`/`rowDateKey_`/`rowTime_`），這是為了兼容早期沒有正確存成Date物件的舊資料
- **消費者只有工具自己**：只有 `tool_logistics.html` 讀寫這份試算表

## 二、範圍決策：只搬「物流車輛紀錄」，「快捷設定」不搬

同打烊/開店/施工單的判斷標準：「快捷設定」筆數是管理員手動設定的固定組合數，不會隨時間增長，搬到 Supabase 沒有效能意義，維持在 Sheets。

## 三、目標資料表設計

```sql
create table logistics_records (
  id bigserial primary key,
  category text not null,
  count integer not null,
  emp_id text,
  emp_name text,
  legacy_id integer,
  created_at timestamptz not null default now()
);
create index logistics_records_created_at on logistics_records (created_at);
alter table logistics_records enable row level security;
```

- `id`：Supabase bigserial，直接取代原本 `nextId_`/`commitNextId_` 的 Script Properties 快取機制，也是 `updateRecord`/`deleteRecord` 的定位鍵（取代 `findRowById_` 全表掃描）
- `legacy_id`：原 Sheets A欄流水號，僅供搬遷稽核用，不參與業務邏輯（比照打烊/開店踩過的坑，不設唯一約束——舊資料若有A欄重複情況，唯一約束會誤殺真實資料）
- 不轉存 B/C 欄字串日期時間，統一用 `created_at`（timestamptz）當唯一時間來源，新資料本來就一律用伺服器時間寫入，不會有舊資料那種「沒存成Date物件」的相容性問題

## 四、連線方式

沿用既有 Supabase 連線方式（`UrlFetchApp` 打 REST API，金鑰存指令碼屬性，`apikey`+`Authorization: Bearer`，HTTP 方法字串一律小寫）。獨立 GAS 專案要設定一次連線金鑰。

## 五、分階段執行

| 階段 | 內容 | 完成定義 |
|---|---|---|
| 1. 建置 | Supabase 新增 `logistics_records`；GAS 設定連線金鑰並測試 | 能寫入再讀出測試資料成功 |
| 2. 歷史資料搬遷 | 讀「物流車輛紀錄」全部資料，轉存 Supabase（`legacy_id`保留原始A欄流水號供稽核；執行前檢查Supabase是否已有資料，防止重複執行重複灌資料——比照打烊/開店踩過的坑） | 咖哩確認搬遷筆數與原分頁筆數相符 |
| 3. 只換讀＋失敗備援 | `getDay`/`getMonth` 改讀 Supabase（`created_at`區間查詢），失敗自動退回讀 Sheets；實測效能 | 新舊結果比對相符；效能有改善 |
| 4. 換寫 | `addRecord`/`updateRecord`/`deleteRecord` 全部改走 Supabase（`id`定位）；`exportMonth` 改讀 Supabase 彙總後寫入試算表分頁（邏輯不變，只換資料來源） | 實際新增/編輯/刪除一筆皆正確反映在 Supabase；產生月統計分頁內容正確 |
| 5. 每日備份防護 | 比照其他工具，新增每日自動備份 Supabase 到 Drive | 咖哩確認 Drive 出現備份檔 |

## 六、進度追蹤

- [ ] 階段1：建置
- [ ] 階段2：歷史資料搬遷
- [ ] 階段3：只換讀＋失敗備援
- [ ] 階段4：換寫
- [ ] 階段5：每日備份防護
