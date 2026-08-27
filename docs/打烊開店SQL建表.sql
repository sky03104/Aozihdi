-- 打烊/開店管理 SQL 遷移 · 階段1 建表
-- 沿用班表管理／施工單管理已建立的同一個 Supabase 專案（narilpgjmjncladkquly）
--
-- 2026-08-27 補：legacy_id 加 unique 約束是事後補的（原本沒加，遷移腳本
-- 又沒做ON CONFLICT保護，實測重複執行3次真的插入了3倍資料）。若表已經
-- 用舊版SQL建好且已跑過遷移，先清空重灌再補約束：
--   truncate table closing_gate_logs restart identity;
--   truncate table opening_gate_logs restart identity;
--   alter table closing_gate_logs add constraint closing_gate_logs_legacy_id_key unique (legacy_id);
--   alter table opening_gate_logs add constraint opening_gate_logs_legacy_id_key unique (legacy_id);
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
  legacy_id integer unique,
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
  legacy_id integer unique,
  created_at timestamptz not null default now()
);

create index opening_gate_logs_created_at on opening_gate_logs (created_at);

-- 安全設定：跟班表管理/施工單管理一樣，關閉一般網頁金鑰的存取，只有伺服器端 secret key 能讀寫
alter table closing_gate_logs enable row level security;
alter table opening_gate_logs enable row level security;
