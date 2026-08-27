-- 物流車輛統計 SQL 遷移 · 階段1 建表
-- 沿用班表管理/施工單管理/打烊開店管理已建立的同一個 Supabase 專案（narilpgjmjncladkquly）
--
-- legacy_id 不加 unique 約束——比照打烊/開店踩過的坑，舊資料A欄流水號若曾出過
-- 溢位/重複bug，唯一約束會把不同筆真實紀錄誤判成重複而silently丟棄。防止遷移
-- 腳本重複執行改用「執行前檢查Supabase是否已有資料」，不靠資料庫層級唯一鍵。

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

-- 安全設定：跟其他工具一樣，關閉一般網頁金鑰的存取，只有伺服器端 secret key 能讀寫
alter table logistics_records enable row level security;
