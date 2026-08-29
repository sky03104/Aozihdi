-- 天鷹保全 APP — RLS policies + helper functions
-- 架構參考 sky03104/wei repo（feature/supabase-migration 分支）已驗證過的模式：
-- security definer helper function 判斷角色，policy 呼叫 helper，不在每條 policy
-- 裡重複寫 join 邏輯。可重複執行（create or replace / drop policy if exists）。

-- ════════════════════════════════════════════════════════════
-- Helper functions
-- ════════════════════════════════════════════════════════════

-- 目前登入者的角色（帳號被停用時視同沒有角色）
create or replace function current_role_name()
returns text
language sql stable security definer set search_path = public
as $$
  select role from profiles where id = auth.uid() and status = 'active';
$$;

-- 目前登入者的工號
create or replace function current_emp_id()
returns text
language sql stable security definer set search_path = public
as $$
  select emp_id from profiles where id = auth.uid() and status = 'active';
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(current_role_name() = 'admin', false);
$$;

-- 對照前端 CAN_MANAGE_ROLES = ['leader','vicecaptain','captain','executive','admin']
create or replace function can_manage()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(current_role_name() in ('leader','vicecaptain','captain','executive','admin'), false);
$$;

-- 工號 → 登入用合成 email（給前端 signInWithPassword 用）
-- 查不到或帳號已停用一律回 null，前端統一顯示「帳號或密碼錯誤」，
-- 不讓人從回應內容猜出工號存不存在。
create or replace function resolve_empid_email(p_emp_id text)
returns text
language sql security definer set search_path = public, auth
as $$
  select au.email
  from profiles p
  join auth.users au on au.id = p.id
  where p.emp_id = p_emp_id
    and p.status = 'active';
$$;
grant execute on function resolve_empid_email(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════
-- profiles
-- ════════════════════════════════════════════════════════════
alter table profiles enable row level security;

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or can_manage());

-- 新增/修改/刪除帳號一律走 admin-users Edge Function（需要同時操作
-- auth.users），這裡的 write policy 只保留給 Edge Function 用的
-- service role（service role 本來就繞過 RLS，這條主要是防呆文件用途）。
drop policy if exists profiles_write on profiles;
create policy profiles_write on profiles for all
  using (is_admin()) with check (is_admin());

-- ════════════════════════════════════════════════════════════
-- applications
-- 申請帳號是「還沒有帳號的人」在填，所以 insert 要放行 anon。
-- ════════════════════════════════════════════════════════════
alter table applications enable row level security;

drop policy if exists applications_insert on applications;
create policy applications_insert on applications for insert
  to anon, authenticated
  with check (status = 'pending');

drop policy if exists applications_select on applications;
create policy applications_select on applications for select
  using (can_manage());

drop policy if exists applications_update on applications;
create policy applications_update on applications for update
  using (can_manage()) with check (can_manage());

-- ════════════════════════════════════════════════════════════
-- settings（toolPerms 這類要給每個已登入使用者讀，只有 admin 能寫）
-- ════════════════════════════════════════════════════════════
alter table settings enable row level security;

drop policy if exists settings_select on settings;
create policy settings_select on settings for select
  to authenticated
  using (true);

drop policy if exists settings_write on settings;
create policy settings_write on settings for all
  using (is_admin()) with check (is_admin());

-- ════════════════════════════════════════════════════════════
-- line_bindings / line_verification_codes（本人 or 管理員）
-- ════════════════════════════════════════════════════════════
alter table line_bindings enable row level security;

drop policy if exists line_bindings_select on line_bindings;
create policy line_bindings_select on line_bindings for select
  using (emp_id = current_emp_id() or can_manage());

drop policy if exists line_bindings_write on line_bindings;
create policy line_bindings_write on line_bindings for all
  using (emp_id = current_emp_id() or is_admin())
  with check (emp_id = current_emp_id() or is_admin());

alter table line_verification_codes enable row level security;

drop policy if exists line_codes_select on line_verification_codes;
create policy line_codes_select on line_verification_codes for select
  using (emp_id = current_emp_id() or can_manage());

drop policy if exists line_codes_write on line_verification_codes;
create policy line_codes_write on line_verification_codes for all
  using (emp_id = current_emp_id() or is_admin())
  with check (emp_id = current_emp_id() or is_admin());
