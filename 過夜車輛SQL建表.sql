-- 天鷹保全 · 過夜車輛統計 SQL遷移建表
-- 在同一個 Supabase 專案 narilpgjmjncladkquly（沿用班表管理/施工單管理/打烊開店管理/物流車輛統計）
-- 的 SQL Editor 執行這份即可。

create table vehicle_overnight_logs (
  id bigserial primary key,
  type_label text not null,
  plate text not null,
  operator text not null,
  created_at timestamptz not null default now()
);

create index vehicle_overnight_logs_created_at on vehicle_overnight_logs (created_at);
create index vehicle_overnight_logs_plate on vehicle_overnight_logs (plate);

alter table vehicle_overnight_logs enable row level security;
-- 不建立任何 policy：只有 service_role 金鑰（略過 RLS）能存取，
-- anon/publishable 金鑰預設全擋，這是沿用前幾次遷移的安全模式。
