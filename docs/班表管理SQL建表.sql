-- 班表管理 SQL 建表（凹子底沙盒版，Supabase 專案 tjrlpthprtrlmugrofpj）
-- 對應規劃文件：docs/SQL遷移規劃_班表管理_徹底退場.md 階段1
-- 這份是「已在凹子底專案執行過」的 DDL 存檔，重跑前請先確認表格是否已存在

-- 版本狀態機：一個月份/一個班別一筆，staged→live→superseded
create table schedule_versions (
  id            bigint generated always as identity primary key,
  shift_type    text not null check (shift_type in ('night','morning')),
  year_month    text not null,              -- 'yyyy/MM'
  status        text not null check (status in ('staged','live','superseded')),
  source_file_name text,
  drive_file_id text,                       -- 對應 Drive 稽核用 xlsx（tool_upload.html 上傳的原始檔）
  uploaded_at   timestamptz not null default now(),
  effective_at  timestamptz,
  superseded_at timestamptz,
  note          text
);
create index on schedule_versions(shift_type, year_month, status);

-- 逐日逐人班別代號，對應原本 Sheets A4:AG30 範圍
create table schedule_entries (
  id          bigint generated always as identity primary key,
  version_id  bigint not null references schedule_versions(id) on delete cascade,
  shift_type  text not null check (shift_type in ('night','morning')),
  year_month  text not null,
  work_date   date not null,
  day_of_month smallint not null,
  row_index   smallint not null,            -- 對應原 Sheets 列號，方便回溯比對
  role        text,
  emp_name    text not null,
  shift_code  text
);
create index on schedule_entries(shift_type, work_date);
create index on schedule_entries(emp_name, work_date);
create index on schedule_entries(version_id);

-- 班別代號定義，取代「班別設定」分頁
create table shift_codes (
  code        text primary key,
  label       text not null,
  start_time  text,
  end_time    text,
  category    text,                         -- '跟人走' / '跟崗位走'
  updated_at  timestamptz not null default now()
);

-- 姓名↔工號對照，取代「員工工號對照」分頁（原本只在早班試算表，早晚共用）
create table staff_emp_ids (
  emp_name    text primary key,
  emp_id      text not null,
  updated_at  timestamptz not null default now()
);

-- 這幾張表只給 GAS 用 service_role key 存取（比照施工單/打烊等既有工具的作法），
-- 不走前端 RLS 直連。開 RLS 但不建 policy：service_role 天生繞過 RLS，
-- anon/authenticated 會被完全擋下，等於「只有拿得到 service_role key 的 GAS 能碰」。
alter table schedule_versions enable row level security;
alter table schedule_entries enable row level security;
alter table shift_codes enable row level security;
alter table staff_emp_ids enable row level security;
