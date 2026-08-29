// 天鷹保全 APP — 帳號管理 Edge Function
// 唯一持有 service role key 的地方。前端 anon key 沒辦法呼叫
// auth.admin.createUser()／auth.admin.updateUserById()，這兩件事
// （新增帳號、重設密碼）一定要走這裡。
//
// 對照 GAS：reviewApplication()（核准分支）／addUser()／
// changePassword() 的「管理員代改」情境。
//
// 部署後記得測「重設密碼」：wei 專案踩過的坑——Edge Function 沒補
// CORS header 時，後端其實已經執行成功，但瀏覽器讀不到回應（沒有
// Access-Control-Allow-Origin）會誤判成失敗，畫面顯示失敗但密碼
// 其實已經改了，很容易誤導人。這支已經補好 CORS，部署後仍建議
// 實際測一次確認。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function randomTempPassword(): string {
  // 6 碼英數混合，不需要多複雜——只是臨時密碼，登入後強制改掉
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function empIdToEmail(empId: string): string {
  return `${empId}@tianying.internal`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 呼叫者必須是已登入的 admin（用呼叫者帶的 JWT 驗證身分＋角色，
  // 不是只看有沒有帶 apikey）
  const authHeader = req.headers.get('Authorization') || '';
  const callerClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerUser } = await callerClient.auth.getUser();
  if (!callerUser?.user) return json({ status: 'err', msg: '未登入' }, 401);

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', callerUser.user.id)
    .maybeSingle();
  if (!callerProfile || callerProfile.status !== 'active' || callerProfile.role !== 'admin') {
    return json({ status: 'err', msg: '權限不足' }, 403);
  }

  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === 'approveApplication') {
      // 對照 GAS reviewApplication() 的核准分支
      const { data: appRow, error: appErr } = await admin
        .from('applications')
        .select('*')
        .eq('id', body.applicationId)
        .eq('status', 'pending')
        .maybeSingle();
      if (appErr || !appRow) return json({ status: 'err', msg: '找不到該申請單或已審核過' }, 404);

      const tempPassword = randomTempPassword();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: empIdToEmail(appRow.emp_id),
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        return json({ status: 'err', msg: '建立帳號失敗：' + (createErr?.message || '未知錯誤') }, 500);
      }

      const { error: profileErr } = await admin.from('profiles').insert({
        id: created.user.id,
        emp_id: appRow.emp_id,
        display_name: appRow.name,
        role: appRow.role,
        dept: appRow.dept,
        status: 'active',
      });
      if (profileErr) return json({ status: 'err', msg: '寫入 profiles 失敗：' + profileErr.message }, 500);

      await admin
        .from('applications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', body.applicationId);

      return json({ status: 'ok', empId: appRow.emp_id, tempPassword });
    }

    if (action === 'addUser') {
      // 對照 GAS addUser()：管理員直接新增帳號（非經申請流程）
      const { empId, name, role, dept } = body;
      if (!empId || !name) return json({ status: 'err', msg: '資料不完整' }, 400);

      const tempPassword = randomTempPassword();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: empIdToEmail(empId),
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        return json({ status: 'err', msg: '建立帳號失敗：' + (createErr?.message || '未知錯誤') }, 500);
      }

      const { error: profileErr } = await admin.from('profiles').insert({
        id: created.user.id,
        emp_id: empId,
        display_name: name,
        role: role || 'fulltime',
        dept: dept || '',
        status: 'active',
      });
      if (profileErr) return json({ status: 'err', msg: '寫入 profiles 失敗：' + profileErr.message }, 500);

      return json({ status: 'ok', empId, tempPassword });
    }

    if (action === 'resetPassword') {
      // 對照管理員代改密碼的情境（原系統沒有這個 action，改密碼一律
      // 靠員工自己 changePassword；這裡補上，因為管理員有時需要幫
      // 忘記密碼的員工重設）
      const { empId } = body;
      if (!empId) return json({ status: 'err', msg: '缺少工號' }, 400);

      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('emp_id', empId)
        .maybeSingle();
      if (!profile) return json({ status: 'err', msg: '找不到此工號' }, 404);

      const tempPassword = randomTempPassword();
      const { error: updErr } = await admin.auth.admin.updateUserById(profile.id, {
        password: tempPassword,
      });
      if (updErr) return json({ status: 'err', msg: '重設密碼失敗：' + updErr.message }, 500);

      return json({ status: 'ok', empId, tempPassword });
    }

    return json({ status: 'err', msg: '未知的 action' }, 400);
  } catch (err) {
    return json({ status: 'err', msg: String(err) }, 500);
  }
});
