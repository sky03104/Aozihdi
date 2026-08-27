-- 打烊/開店管理 SQL 遷移 · 階段1 建表
-- 沿用班表管理／施工單管理已建立的同一個 Supabase 專案（narilpgjmjncladkquly）

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
