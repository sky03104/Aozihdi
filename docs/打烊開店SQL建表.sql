-- 打烊/開店管理 SQL 遷移 · 階段1 建表
-- 沿用班表管理／施工單管理已建立的同一個 Supabase 專案（narilpgjmjncladkquly）
--
-- ⚠️ 2026-08-27 踩坑記錄：legacy_id（A欄流水號）曾一度想加 unique 約束
-- 當防重複執行的依據，但A欄流水號歷史上可能出過打烊管理TODO-33那種
-- 溢位bug，舊資料裡可能殘留「不同筆真實紀錄卻共用同一個壞掉的A欄值」，
-- 拿它當唯一鍵會把這些不同紀錄誤判成重複而silently丟棄（實測真的少了7
-- 筆真實資料）。最終決定不加這個約束，改由遷移腳本自己在執行前檢查
-- Supabase是否已有資料來防止重複執行，不靠資料庫層級的唯一鍵。
-- 若曾經套用過舊版SQL（legacy_id unique）且已灌過重複資料，要復原：
--   truncate table closing_gate_logs restart identity;
--   truncate table opening_gate_logs restart identity;
--   alter table closing_gate_logs drop constraint if exists closing_gate_logs_legacy_id_key;
--   alter table opening_gate_logs drop constraint if exists opening_gate_logs_legacy_id_key;
-- 全新建表直接用下面完整版本即可，不用管這段。

create table closing_gate_logs (
  id bigserial primary key,
  shop_code text,
  floor text,
  shop_name text,
  headcount integer,
  supervisor text,
  entry_time text,
  location text,
  work_type text,
  exit_time text,
  inspector text,
  legacy_id integer,
  created_at timestamptz not null default now()
);

create index closing_gate_logs_created_at on closing_gate_logs (created_at);

create table opening_gate_logs (
  id bigserial primary key,
  shop_code text,
  floor text,
  shop_name text,
  headcount integer,
  supervisor text,
  entry_time text,
  location text,
  work_type text,
  exit_time text,
  inspector text,
  legacy_id integer,
  created_at timestamptz not null default now()
);

create index opening_gate_logs_created_at on opening_gate_logs (created_at);

-- 安全設定：跟班表管理/施工單管理一樣，關閉一般網頁金鑰的存取，只有伺服器端 secret key 能讀寫
alter table closing_gate_logs enable row level security;
alter table opening_gate_logs enable row level security;
