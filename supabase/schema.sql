-- 天鷹保全 APP 帳號密碼權限系統 — Postgres schema
-- 對照 Google Sheets：帳號管理／帳號申請／系統設定／LINE綁定／LINE驗證碼
-- 密碼欄位不搬——密碼交給 Supabase Auth（auth.users）管理，這裡只存 app 自己的欄位。
-- 重複執行安全（create table if not exists／create or replace），可重跑不報錯。

-- ════════════════════════════════════════════════════════════
-- profiles（對照「帳號管理」分頁）
-- ════════════════════════════════════════════════════════════
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  emp_id       text unique not null,        -- 工號
  display_name text not null default '',    -- 姓名
  role         text not null default 'fulltime'
               check (role in ('fulltime','parttime','leader','vicecaptain','captain','executive','admin')),
  dept         text not null default '',    -- 部門/案場
  status       text not null default 'active' check (status in ('active','inactive')),
  shift        text not null default '' check (shift in ('','早班','晚班')),
  updated_at   timestamptz not null default now()
);
create index if not exists profiles_emp_id_idx on profiles(emp_id);

-- ════════════════════════════════════════════════════════════
-- applications（對照「帳號申請」分頁）
-- 2026-08 起申請不再收明文密碼：審核通過後由 admin-users Edge Function
-- 配發隨機臨時密碼，登入後強制改密碼。
-- ════════════════════════════════════════════════════════════
create table if not exists applications (
  id           bigint generated always as identity primary key,
  emp_id       text not null,
  name         text not null,
  dept         text not null default '',
  role         text not null default 'fulltime'
               check (role in ('fulltime','parttime','leader','vicecaptain','captain','executive','admin')),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  applied_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
create index if not exists applications_status_idx on applications(status);
create index if not exists applications_emp_id_idx on applications(emp_id);

-- ════════════════════════════════════════════════════════════
-- settings（對照「系統設定」分頁，key/value）
-- 已知 key：leaveCapMorning / leaveCapNight / toolPerms / workAllowedIds / toolsConfig
-- ════════════════════════════════════════════════════════════
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════
-- line_bindings（對照「LINE綁定」分頁）
-- ════════════════════════════════════════════════════════════
create table if not exists line_bindings (
  emp_id       text primary key,
  name         text not null default '',
  line_user_id text not null,
  bound_at     timestamptz not null default now(),
  status       text not null default 'bound' check (status in ('bound','unbound'))
);
create index if not exists line_bindings_line_user_id_idx on line_bindings(line_user_id);

-- ════════════════════════════════════════════════════════════
-- line_verification_codes（對照「LINE驗證碼」分頁）
-- ════════════════════════════════════════════════════════════
create table if not exists line_verification_codes (
  emp_id     text primary key,
  name       text not null default '',
  code       text not null,
  created_at timestamptz not null default now(),
  status     text not null default 'pending' check (status in ('pending','used','expired')),
  expires_at timestamptz not null
);
