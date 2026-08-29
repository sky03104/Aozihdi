-- 遷移完成後在 Supabase SQL Editor 跑，核對筆數與有無孤兒資料。
-- 每張表的筆數應該跟 migrate-from-sheets.js 執行時印出的數字一致。

select 'profiles' as table_name, count(*) from profiles
union all
select 'applications', count(*) from applications
union all
select 'settings', count(*) from settings
union all
select 'line_bindings', count(*) from line_bindings
union all
select 'line_verification_codes', count(*) from line_verification_codes;

-- 孤兒資料：line_bindings / line_verification_codes 裡的 emp_id
-- 對不到任何 profiles（理論上遷移腳本已經跳過這種情況，這裡是雙重確認）
select 'orphan_line_bindings' as check_name, count(*)
from line_bindings lb
where not exists (select 1 from profiles p where p.emp_id = lb.emp_id)
union all
select 'orphan_line_codes', count(*)
from line_verification_codes lc
where not exists (select 1 from profiles p where p.emp_id = lc.emp_id);

-- 抽查幾筆對一下工號/姓名/角色是否跟 Sheets 副本一致
select emp_id, display_name, role, dept, status, shift from profiles order by emp_id limit 20;
