-- 天鷹保全 APP — 業務邏輯 Postgres functions
-- 對照 天鷹保全APP_後端_GAS.gs 的同名 GAS function。
-- 純 CRUD（讀 line_bindings 自己那筆、讀 profiles 自己那筆）前端直接
-- .from().select()，不特別包 function；這裡只放「需要組合/驗證」的邏輯。
-- 「核准申請 → 建立帳號」需要 auth.admin.createUser()（service role），
-- 純 SQL function 做不到，那段邏輯在 admin-users Edge Function 裡，
-- 不在這個檔案。

-- ════════════════════════════════════════════════════════════
-- 系統設定（對照 getSettings / setSettings / bootstrap）
-- ════════════════════════════════════════════════════════════

create or replace function get_settings()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from settings;
$$;
grant execute on function get_settings() to authenticated;

-- 只覆寫有帶進來的 key，跟原本 GAS setSettings() 的「部分更新」行為一致
create or replace function set_settings(p_patch jsonb)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  k text;
begin
  if not is_admin() then
    raise exception '權限不足';
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    insert into settings(key, value, updated_at)
    values (k, p_patch -> k, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end loop;
  return get_settings();
end;
$$;
grant execute on function set_settings(jsonb) to authenticated;

-- 登入 bootstrap：對照 GAS bootstrap()，範圍縮小成「待審申請 + 設定」
-- （請假系統這次沒有搬 SQL，維持打 GAS，不在這支裡）
create or replace function account_bootstrap()
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select jsonb_build_object(
    'applications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'empId', emp_id, 'name', name, 'dept', dept,
        'role', role, 'appliedAt', applied_at
      ) order by applied_at)
      from applications where status = 'pending'
    ), '[]'::jsonb),
    'settings', get_settings()
  );
$$;
grant execute on function account_bootstrap() to authenticated;

-- ════════════════════════════════════════════════════════════
-- 帳號申請（對照 reviewApplication 的「拒絕」分支；
-- 「核准」分支需要建立 Auth 帳號，在 admin-users Edge Function 裡）
-- ════════════════════════════════════════════════════════════

create or replace function reject_application(p_id bigint)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not can_manage() then
    raise exception '權限不足';
  end if;
  update applications
     set status = 'rejected', reviewed_at = now()
   where id = p_id and status = 'pending';
  if not found then
    raise exception '找不到該申請單或已審核過';
  end if;
end;
$$;
grant execute on function reject_application(bigint) to authenticated;

-- ════════════════════════════════════════════════════════════
-- LINE 綁定（對照 bindLine / unbindLine / generateLineCode）
-- ════════════════════════════════════════════════════════════

create or replace function bind_line(p_emp_id text, p_name text, p_line_user_id text)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if p_emp_id <> current_emp_id() and not is_admin() then
    raise exception '權限不足';
  end if;
  if exists (
    select 1 from line_bindings
     where line_user_id = p_line_user_id
       and status = 'bound'
       and emp_id <> p_emp_id
  ) then
    raise exception '此 LINE 帳號已綁定其他工號';
  end if;
  insert into line_bindings(emp_id, name, line_user_id, bound_at, status)
  values (p_emp_id, coalesce(p_name, ''), p_line_user_id, now(), 'bound')
  on conflict (emp_id) do update
    set name = coalesce(nullif(excluded.name, ''), line_bindings.name),
        line_user_id = excluded.line_user_id,
        bound_at = now(),
        status = 'bound';
end;
$$;
grant execute on function bind_line(text, text, text) to authenticated;

create or replace function unbind_line(p_emp_id text)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if p_emp_id <> current_emp_id() and not is_admin() then
    raise exception '權限不足';
  end if;
  update line_bindings set status = 'unbound' where emp_id = p_emp_id;
  if not found then
    raise exception '找不到此工號的綁定紀錄';
  end if;
end;
$$;
grant execute on function unbind_line(text) to authenticated;

create or replace function generate_line_code(p_emp_id text, p_name text)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_code text;
  v_expire timestamptz;
begin
  if p_emp_id <> current_emp_id() and not is_admin() then
    raise exception '權限不足';
  end if;
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');
  v_expire := now() + interval '5 minutes';
  insert into line_verification_codes(emp_id, name, code, created_at, status, expires_at)
  values (p_emp_id, coalesce(p_name, ''), v_code, now(), 'pending', v_expire)
  on conflict (emp_id) do update
    set name = coalesce(nullif(excluded.name, ''), line_verification_codes.name),
        code = excluded.code, created_at = now(), status = 'pending', expires_at = excluded.expires_at;
  return jsonb_build_object('code', v_code, 'expireAt', v_expire);
end;
$$;
grant execute on function generate_line_code(text, text) to authenticated;
