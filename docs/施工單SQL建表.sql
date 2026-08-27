-- 施工單管理 SQL 遷移 · 階段1 建表
-- 沿用班表管理已建立的同一個 Supabase 專案（narilpgjmjncladkquly）

create table construction_orders (
  id bigserial primary key,
  apply_unit text,
  vendor text,
  work_date date,
  entry_time text,
  exit_time text,
  headcount integer,
  supervisor text,
  location text,
  item text,
  exit_date date,
  note text,
  checked_in_at timestamptz,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index construction_orders_work_date on construction_orders (work_date);

create table fire_permits (
  id bigserial primary key,
  apply_unit text,
  vendor text,
  work_date date,
  entry_time text,
  exit_time text,
  headcount integer,
  supervisor text,
  location text,
  item text,
  exit_date date,
  note text,
  checked_in_at timestamptz,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

create index fire_permits_work_date on fire_permits (work_date);

-- 安全設定：跟班表管理一樣，關閉一般網頁金鑰的存取，只有伺服器端 secret key 能讀寫
alter table construction_orders enable row level security;
alter table fire_permits enable row level security;
