#!/usr/bin/env node
// 天鷹保全 APP 帳密系統 — Sheets 副本 → Supabase 遷移腳本
// ════════════════════════════════════════════════════════════
// 前置：
// 1. data-export.json：呼叫 匯出帳密資料_GAS.gs 的 exportAccountData
//    action 存下來的 JSON（讀的是「複製出來的副本」，不是正式試算表）
// 2. 環境變數 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（service role
//    key 只能放這裡，絕對不能進前端、不能 commit 進 git）
//
// 全程用 upsert，中途失敗可以重跑，不會重複建立帳號。
// 密碼沒辦法遷移（雜湊方式不同）——每個帳號配一組隨機臨時密碼，
// 存進本機 migration-credentials.txt（已加進 .gitignore，不會進 git），
// 之後要發給對應的人自己登入後改密碼。
// ════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('請先設定環境變數 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const DATA_FILE = process.argv[2] || path.join(__dirname, 'data-export.json');
const CRED_FILE = path.join(__dirname, 'migration-credentials.txt');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function empIdToEmail(empId) {
  return `${empId}@tianying.internal`;
}

function randomTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function main() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  if (data.status !== 'ok') throw new Error('匯出檔案內容異常：' + JSON.stringify(data));

  const credLines = ['# 遷移產生的臨時密碼，發給對應的人後請刪除這個檔案', '# 格式：工號  姓名  臨時密碼'];
  const empIdToUserId = {};

  console.log(`帳號共 ${data.users.length} 筆，開始建立 Auth 帳號 + profiles...`);
  for (const u of data.users) {
    if (u.status !== 'active') {
      console.log(`  跳過（非 active）：${u.empId} ${u.name}`);
      continue;
    }
    const email = empIdToEmail(u.empId);
    const tempPassword = randomTempPassword();
    let userId;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
    });
    if (createErr) {
      if (String(createErr.message || '').includes('already been registered')) {
        // 重跑時帳號已存在：查現有 uid，不重新配密碼（避免每次重跑都
        // 讓臨時密碼失效）
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list.users.find((x) => x.email === email);
        if (!existing) { console.warn(`  ⚠ 找不到既有帳號 ${u.empId}，跳過`); continue; }
        userId = existing.id;
      } else {
        console.warn(`  ⚠ 建立帳號失敗 ${u.empId}：${createErr.message}`);
        continue;
      }
    } else {
      userId = created.user.id;
      credLines.push(`${u.empId}\t${u.name}\t${tempPassword}`);
    }
    empIdToUserId[u.empId] = userId;

    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: userId, emp_id: u.empId, display_name: u.name, role: u.role,
      dept: u.dept, status: u.status, shift: u.shift || '',
    });
    if (profileErr) console.warn(`  ⚠ 寫入 profile 失敗 ${u.empId}：${profileErr.message}`);
  }

  console.log(`帳號申請共 ${data.applications.length} 筆...`);
  for (const a of data.applications) {
    const { error } = await supabase.from('applications').upsert({
      emp_id: a.empId, name: a.name, dept: a.dept, role: a.role,
      status: a.status, applied_at: a.appliedAt, reviewed_at: a.reviewedAt,
    });
    if (error) console.warn(`  ⚠ 寫入申請失敗 ${a.empId}：${error.message}`);
  }

  console.log('系統設定...');
  for (const [key, value] of Object.entries(data.settings || {})) {
    const { error } = await supabase.from('settings').upsert({ key, value });
    if (error) console.warn(`  ⚠ 寫入設定失敗 ${key}：${error.message}`);
  }

  console.log(`LINE 綁定共 ${data.lineBindings.length} 筆...`);
  for (const b of data.lineBindings) {
    if (!empIdToUserId[b.empId]) { console.warn(`  ⚠ 找不到對應帳號，跳過：${b.empId}`); continue; }
    const { error } = await supabase.from('line_bindings').upsert({
      emp_id: b.empId, name: b.name, line_user_id: b.lineUserId,
      bound_at: b.boundAt, status: b.status,
    });
    if (error) console.warn(`  ⚠ 寫入 LINE 綁定失敗 ${b.empId}：${error.message}`);
  }

  console.log(`LINE 驗證碼共 ${data.lineCodes.length} 筆...`);
  for (const c of data.lineCodes) {
    const { error } = await supabase.from('line_verification_codes').upsert({
      emp_id: c.empId, name: c.name, code: c.code,
      created_at: c.createdAt, status: c.status, expires_at: c.expiresAt,
    });
    if (error) console.warn(`  ⚠ 寫入 LINE 驗證碼失敗 ${c.empId}：${error.message}`);
  }

  if (credLines.length > 1) {
    fs.writeFileSync(CRED_FILE, credLines.join('\n') + '\n', 'utf8');
    console.log(`\n新建帳號的臨時密碼已存進 ${CRED_FILE}（不會進 git，記得發完就刪除）`);
  }
  console.log('\n遷移完成，請接著跑 verify-migration.sql 核對筆數。');
}

main().catch((err) => {
  console.error('遷移失敗：', err);
  process.exit(1);
});
