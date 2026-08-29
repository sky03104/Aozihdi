# 班表管理 — Sheets 徹底退場規劃（凹子底沙盒版）

> **這份規劃在 `Aozihdi` repo 進行，目標 Supabase 專案是 `tjrlpthprtrlmugrofpj`（凹子底專案）。**
> **絕對不碰 `narilpgjmjncladkquly`（tianying-security 正式站已經在用的專案）** ——
> 那邊已經有一輪（2026-08-27，PR #254/255）跑得好好的遷移在服務正式站，這次的沙盒
> 工程完全獨立、不讀不寫、不共用資料。
>
> 也因此，這次**不是接續正式站的既有 Supabase 資料**（那些資料在 narilpgjmjncladkquly，
> 碰不到），而是把整個班表 SQL 化在凹子底專案裡**從零重新做一次**，資料來源直接是
> Google Sheets（跟正式站當初遷移時的來源一樣），不是從 narilpgjmjncladkquly 搬過來。

## 為什麼會需要這份文件

天鷹保全 APP 目前分兩個 repo：
- `tianying-security`（正式站）——已有 5 個工具（班表/施工單/打烈開店/物流/過夜車輛）
  直接對接 Supabase 專案 `narilpgjmjncladkquly`，正式服務中。
- `Aozihdi`（凹子底沙盒）——目前只有帳號權限系統對接 `tjrlpthprtrlmugrofpj`（凹子底專案）。
  咖哩明確表示：**這個 repo 存在的目的就是要把整個 APP 都改走 SQL**，之後每個工具都要
  先在這裡用凹子底專案試通，穩定後才考慮回饋/合併到正式站（合併方式待日後另外討論，
  這次不處理）。

所以「班表管理 + 資料上傳工具的班表上傳」這輪，是在凹子底專案上**從零建置**，
不是延續正式站已完成的遷移進度。

## ⚠️ 部署鐵則（2026-08-29 咖哩明確要求）

**凹子底是新案場，巨蛋是現在正在上線服務現場同事的案場，兩者絕不能互相影響：**

- 這次改的 `天鷹保全APP_後端_GAS.gs`（LINE小助手）、`哨表產生_GAS.gs`（自動排哨）
  雖然放在 Aozihdi repo，**程式碼裡的常數（`SCHEDULE_SHEETS_`／`POST_SHEET_ID` 等）
  其實還是指向巨蛋真正的試算表**——因為凹子底目前還沒有自己的資料來源，這次是
  **拿巨蛋的真實資料當試驗品**，驗證「SQL 化這條路走不走得通」，不是真的在幫
  凹子底建立獨立運作的系統。
- **絕對不能把這次改的程式碼貼進巨蛋現有正式上線的三個 GAS 部署去覆蓋**（LINE小助手／
  自動排哨／班表管理的巨蛋正式部署，正在服務現場真的在上班的同事）。
- 正確做法：**開全新、獨立的 Apps Script 部署**（新專案、新網址、Script Properties
  指向凹子底 Supabase `tjrlpthprtrlmugrofpj`），巨蛋正式站三個部署完全不去動。
  這樣不管沙盒怎麼測，都不會影響巨蛋現場同事在用的東西。
- 同理，`tianying-security` 這個 repo 全程不動（不 clone 寫入、不 commit），
  這次所有變更只在 `Aozihdi` repo。

## 現況基礎（來自 Google Sheets，非 Supabase）

- 兩份試算表：`SHIFT_CONFIG.night`／`SHIFT_CONFIG.morning`
- 主要資料範圍 `A4:AG30`（27列人員 × 31欄日期班別代號），`Z1`＝`yyyy/MM`，
  `C2:AG3`＝日期表頭，紅字「休」＝「排休」語意覆蓋
- `{分頁名}_待生效`＝暫存待生效班表分頁
- `班別設定` 分頁＝班別代號定義
- `員工工號對照` 分頁（只在早班試算表，早晚共用）＝姓名↔工號對照
- 資料上傳工具的「班表上傳」（`tool_upload.html`）與班表管理（`index.html` 內嵌）
  **共用同一個 GAS 部署**（`SCH_WEBAPP_URL`），前端拖曳 Excel 上傳的 UX **不需要改**，
  只改後端這支 GAS 存資料的方式
- 三個外部系統目前直接讀這兩份 Sheets，完全繞過 GAS：
  1. LINE小助手（`天鷹保全APP_後端_GAS.gs`，獨立部署）
  2. 自動排哨工具（`哨表產生_GAS.gs`，獨立部署，`tool_guard_gen.html` 呼叫）
  3. 會計月彙整表（外部人工維護試算表，純公式 IMPORTRANGE/XLOOKUP/CHOOSECOLS 讀班表）

## 這次的決定（咖哩已拍板）

1. **目標 Supabase 專案＝`tjrlpthprtrlmugrofpj`（凹子底專案）**，絕不碰 narilpgjmjncladkquly。
2. 班別設定／員工工號對照建成正式資料表（`shift_codes`／`staff_emp_ids`），
   讓 LINE小助手／排哨工具徹底不用碰 SpreadsheetApp。
3. 寫入路徑最終要整個砍掉 Sheets 寫入（不留 best-effort 備援）。
4. 會計月彙整表鏡像改用簡化新版面，需要咖哩之後重寫那份試算表的公式
   （這是外部人工維護的東西，動工前要先跟咖哩對過新版面欄位長相）。

## 目標資料表設計（全部建在 tjrlpthprtrlmugrofpj）

```sql
-- 版本狀態機：一個月份/一個班別一筆，staged→live→superseded
create table schedule_versions (
  id            bigint generated always as identity primary key,
  shift_type    text not null check (shift_type in ('night','morning')),
  year_month    text not null,              -- 'yyyy/MM'
  status        text not null check (status in ('staged','live','superseded')),
  source_file_name text,
  drive_file_id text,                       -- 對應 Drive 稽核用 xlsx
  uploaded_at   timestamptz not null default now(),
  effective_at  timestamptz,
  superseded_at timestamptz,
  note          text
);

-- 逐日逐人班別代號
create table schedule_entries (
  id          bigint generated always as identity primary key,
  version_id  bigint not null references schedule_versions(id) on delete cascade,
  shift_type  text not null check (shift_type in ('night','morning')),
  year_month  text not null,
  work_date   date not null,
  day_of_month smallint not null,
  row_index   smallint not null,
  role        text,
  emp_name    text not null,
  shift_code  text
);
create index on schedule_entries(shift_type, work_date);
create index on schedule_entries(emp_name, work_date);

-- 班別代號定義（取代「班別設定」分頁）
create table shift_codes (
  code        text primary key,
  label       text not null,
  start_time  text,
  end_time    text,
  category    text,        -- '跟人走' / '跟崗位走'
  updated_at  timestamptz not null default now()
);

-- 姓名↔工號對照（取代「員工工號對照」分頁）
create table staff_emp_ids (
  emp_name    text primary key,
  emp_id      text not null,
  updated_at  timestamptz not null default now()
);
```

## 執行順序

因為最終要砍掉 Sheets 寫入，寫入切斷必須排在所有讀取端（LINE小助手／排哨工具／
會計鏡像）都遷完之後，否則切斷當下這些系統會停在「不再更新的死資料」上不自知。

| 階段 | 內容 | 備註 |
|---|---|---|
| **1** | 凹子底專案建表：`schedule_versions`／`schedule_entries`／`shift_codes`／`staff_emp_ids`，寫 `docs/班表管理SQL建表.sql` | 全新建置，這次沒有既有 Supabase 資料可延用 |
| **2** | 歷史資料遷移：直接從 Google Sheets（兩份試算表）讀出寫入凹子底專案，比照正式站當初的遷移手法（冪等、筆數核對） | 來源是 Sheets，不是 narilpgjmjncladkquly |
| **3** | `getSchedule`／`getScheduleByMonth`／`listScheduleMonths` 改接凹子底專案；`getSchedule` 用「Supabase為權威、寫入時清快取、讀取只在cache miss才付網路成本」設計，避免重蹈正式站「Supabase優先太慢」的覆轍，需要用 `測試讀取效能()` 實測 | 這支 GAS 若要在沙盒獨立測試，需要**另開一個測試用 Apps Script 部署**，Script Properties 指向凹子底專案（`SUPABASE_URL`/`SUPABASE_SECRET_KEY`），不能沿用正式站部署 |
| **4** | LINE小助手改讀凹子底專案，雙讀＋Sheets備援 | 獨立部署，需要自己的 Script Properties |
| **5** | 自動排哨工具改讀凹子底專案，雙讀＋Sheets備援，跑通既有 ~60 項 node 測試 | 獨立部署 |
| **6** | 會計月彙整表鏡像：簡化新版面，需先跟咖哩對版面 | 對外部試算表的改動，先確認咖哩能重寫公式才上線 |
| **7** | 上述都確認穩定後，切斷 Sheets 寫入，`_待生效` 暫存改用 `schedule_versions.status` 取代 | Drive 上傳 xlsx 稽核檔仍保留 |

## 這次範圍之外

`tool_ai_chat.html`／`tool_car.html`／`tool_emergency.html`／`tool_feedback.html`／`tool_handover.html`／
`tool_menstrual.html`／`tool_radio.html`／`tool_report.html`／`tool_shift_adjust.html`／`liff_leave.html`／
`tool_upload.html` 的獨立哨表上傳子功能／`tool_work.html` 搜尋歷史查詢。這些之後再排（Phase 2，
凹子底沙盒逐工具擴大）。

## 沿用既有踩坑教訓

- GAS `UrlFetchApp` 的 HTTP method 字串一律小寫（`'patch'`/`'delete'`）
- 一定要同時帶 `apikey` 與 `Authorization: Bearer`
- Supabase GET 預設回傳上限 1000 筆，大量查詢要用 Range header 分頁
- 多檔案 GAS 專案：改動任一檔案要提醒咖哩把所有互相依賴的檔案一起貼上重新部署
- **這次額外的規則：任何 SQL/Script Properties 設定都只能指向 `tjrlpthprtrlmugrofpj`，
  絕不寫入或讀取 `narilpgjmjncladkquly`**

## 進度追蹤

- [x] 階段1：凹子底專案建表 ＋ `docs/班表管理SQL建表.sql`（2026-08-29 完成——`schedule_versions`／`schedule_entries`／`shift_codes`／`staff_emp_ids` 四表已建，RLS 已開、不建 policy，只留 service_role 存取，比照現有工具的存取模式）
- [x] 階段2：歷史資料從 Sheets 遷移進凹子底專案（2026-08-29 完成——直接從兩份 Google Sheets 讀取六份分頁：晚班班表/待生效/備份、早班班表/待生效/備份，寫入 `schedule_versions`(6筆)+`schedule_entries`(3730筆，逐版本核對筆數與 Sheets 來源完全一致：558/527/527/744/630/744)；`班別設定`分頁寫入`shift_codes`(4筆)；`員工工號對照`分頁寫入`staff_emp_ids`(42筆)）
- [x] 階段3：`getSchedule`／`getScheduleByMonth` 改接凹子底專案＋快取重設計（2026-08-29 發現：這支程式碼因為 Aozihdi 是 tianying-security 的完整 clone，正式站早在 2026-08-27 v2.16 就已經做好一模一樣的設計——`doGet` 的 `getSchedule` 走 `getScheduleData_含快取`（1小時 CacheService，寫入時主動清快取）、`getScheduleByMonth`/`listScheduleMonths` 走 `讀取含備援_`（Supabase優先、Sheets備援），程式邏輯不用重寫。**唯一真的要修的 bug**：`班表管理_SQL遷移腳本.gs` 的 `SHIFT_TYPE_MAP_` 沿用正式站把 `morning` 對應成資料庫 `'day'`，但凹子底沙盒的 `schedule_entries.shift_type` check 限制是 `'night'/'morning'`（跟正式站不同的庫，不能照搬對應表），已改成 identity mapping 並修正註解。**待咖哩手動操作**：這幾支 `.gs` 檔要貼進一個獨立的 Apps Script 部署（不能跟正式站共用），Script Properties 設 `SUPABASE_URL=https://tjrlpthprtrlmugrofpj.supabase.co`＋對應的 legacy service_role key，部署後執行 `測試讀取效能()`/`比對讀取結果()` 驗證）
- [x] 階段4：LINE小助手改讀凹子底專案（2026-08-29 完成——原本以為範圍很大，實際查code發現
      LINE小助手真正碰班表資料的只有 `readEmployeeShiftsFromSheet_`／`getEmployeeShifts_`／
      `findEmployeeShiftsAuto_` 三支，只給互動查詢（今日/明日/本週/本月班表問答）用，都只讀
      **當月 live 版本**。之前研究誤以為每日「明日哨點」推播（`pushTomorrowPostScheduled_`）
      也用到這份資料，查過才發現那支走的是完全不同的 `POST_SHEET_ID`（哨表/崗位系統，屬於
      TODO-38 範圍，不是這次的月班表）。已新增 `readEmployeeShiftsFromSupabase_()`
      （凹子底沙盒獨立連線，跟班表管理 GAS 用不同的 Script Properties）＋改
      `getEmployeeShifts_`／`findEmployeeShiftsAuto_` 為 Supabase 優先、失敗自動退回讀
      Sheets。**跟咖哩確認過**：之後班表全部走程式上傳/編輯，不會再有人直接手改 Sheets——
      所以原本監聽 Sheets 手動編輯並推播異動的一整組機制（`onScheduleEdit_` 等 8 支函式＋
      onEdit 觸發器）**判定為之後可刪除的死碼**，但要等階段7真的切斷 Sheets 寫入那天再刪，
      現在保留不動並在程式碼加註記。`node --check` 語法驗證通過。**待咖哩手動操作**：這支
      獨立 GAS 部署要另外設 Script Properties（`SUPABASE_URL`=凹子底專案、
      `SUPABASE_SECRET_KEY`），部署後先跑幾天觀察互動查詢有沒有問題）
- [x] 階段5：自動排哨工具改讀凹子底專案（2026-08-29 完成——`哨表產生_GAS.gs` 的
      `getEmployeeNames()`／`getMonthlyRoster()` 改成 Supabase 優先（獨立的
      `guardSupabaseRequest_` 連線，跟 LINE小助手/班表管理各自獨立 Script Properties），
      任一步驟失敗自動退回原本讀 Sheets 的邏輯（`getEmployeeNamesFromSheets_`／
      `getMonthlyRosterFromSheets_`，程式碼原封不動搬過去，行為完全不變）。
      刻意**不驗證**請求的 year/month 是否跟目前 live 版本相符（沿用原本 Sheets 版就沒做
      這個檢查的既有行為，不在這次修改範圍內）。`node --check` 通過。**這個 repo 裡沒找到
      CLAUDE.md 提到的 ~60 項 node 測試檔**（大概率在自動分配演算法那層，屬於
      `tool_guard_gen.html` 前端邏輯或另一個沒同步進來的檔案），**待咖哩部署後手動確認
      這些測試還過、且實際排一次哨表結果跟改版前一致**。**待咖哩手動操作**：獨立部署，
      Script Properties 設 `SUPABASE_URL`（凹子底專案）＋`SUPABASE_SECRET_KEY`）
- [x] 階段6：會計月彙整表鏡像推播（2026-08-29 咖哩已確認版面：沿用原本 A4:AG30
      「人×日矩陣」概念的簡化版，拿掉職務欄/星期列/月份表頭合併格/工時統計欄/代號
      說明/檢核列。新增 `班表管理_SQL會計鏡像推播.gs`：`推播會計鏡像()` 從凹子底沙盒
      抓兩班的 live 版本資料，整批重寫進會計試算表的「早班班表鏡像」/「晚班班表鏡像」
      分頁（A1=年月、B1:AF1=日期1~31、A欄起=姓名、之後每欄=當天代號），每日定時觸發
      （04:00，跟每日備份錯開時段）。`node --check` 通過。**⚠️ 待咖哩確認的事**：
      ①`ACCOUNTING_SS_ID` 目前是研究階段找到的猜測值（`1zVoI7-zshz2zhhcR0sOT6xVzhwFGdIrhc3KxQ5A0PV4`），
      正式使用前務必核對這確實是會計月彙整表，錯了會寫壞不相干的試算表；②新版面出來後，
      咖哩要對照重寫會計試算表裡原本讀舊版面的公式；③這支要跟班表管理其他 GAS 檔案
      貼進同一個獨立部署（共用 `SHIFT_CONFIG`/`supabaseRequest_`），部署後先手動執行
      `推播會計鏡像()` 確認正常再排 `設定會計鏡像每日觸發器()`）
- [ ] 階段7：切斷 Sheets 寫入
