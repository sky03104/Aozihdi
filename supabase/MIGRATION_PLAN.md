# 帳號密碼權限系統搬遷 SQL — 進度追蹤

跟先前 5 支工具（班表/施工單/打烊開店/物流/過夜車輛）的「GAS 中介＋
service_role key」架構不同，這次咖哩指定改用**前端直連 Supabase＋
Row Level Security（RLS）**，登入改用 **Supabase Auth**（內建 bcrypt
密碼雜湊＋JWT session，不再自己刻 HMAC token）。架構參考咖哩另一個
repo `sky03104/wei` 的 `feature/supabase-migration` 分支（已完整跑過
一輪同樣的轉換）。

**只在 Aozihdi 這個沙盒 repo 動工，不碰 `tianying-security` 正式站、
正式 GAS 部署、正式試算表。**

## 範圍

`帳號管理`（核心）／`帳號申請`／`系統設定`（toolPerms 權限矩陣）／
`LINE 綁定`／`LINE 驗證碼`，全部搬。請假系統這次不動，維持打 GAS。

## 資料來源（咖哩明確要求：不動正式資料）

遷移不是直接讀正式 Google Sheets，而是：
1. 先在 Google Drive **複製一份**整份「天鷹保全APP」試算表
2. 用一個**全新、獨立**的 Apps Script 專案（貼 `匯出帳密資料_GAS.gs`），
   `SPREADSHEET_ID` 指向**複製出來的副本**，部署成臨時網頁應用程式
3. `migrate-from-sheets.js` 讀這個臨時部署匯出的 JSON 寫進 Supabase

正式試算表、正式 GAS 部署全程不會被這次遷移碰到。

## 進度

- [x] **Phase 1：Schema 設計**（`schema.sql`）——`profiles`／
      `applications`／`settings`／`line_bindings`／
      `line_verification_codes` 五張表，逐欄對照原 Sheets 欄位。
- [x] **Phase 2：Auth & RLS**（`policies.sql`）——helper function
      （`current_role_name()`／`is_admin()`／`can_manage()`／
      `current_emp_id()`）＋ `resolve_empid_email()`（工號→合成
      email，格式 `{empId}@tianying.internal`）＋ 五張表的 policy。
- [x] **Phase 3：業務邏輯 Postgres function**（`functions.sql`）——
      `get_settings()`／`set_settings()`／`account_bootstrap()`／
      `reject_application()`／`bind_line()`／`unbind_line()`／
      `generate_line_code()`。單純 CRUD（讀自己的 profile／line binding）
      前端直接 `.from().select()`，不特別包 function。
- [x] **Phase 4：資料遷移已完成並驗證**（2026-08-29）——**改用 Supabase
      MCP 直接執行，沒有真的跑 `migrate-from-sheets.js` 這支 Node 腳本**
      （原計畫路徑；連上 MCP 之後改成用 `execute_sql` 直接下 SQL insert，
      更省一手）。來源是咖哩複製出來的副本試算表
      `1bEUyj_9injDIROf3ycagtVwXTspKPhVsCUEZeXs7rWQ`（用 Google Drive
      連接器讀取 `read_file_content`），**沒有讀取或動到正式試算表**。
      密碼一律配隨機臨時密碼（`extensions.crypt()` bcrypt 雜湊，寫進
      `auth.users`／`auth.identities`，`auth.identities.email` 是
      generated column，不能顯式 insert，改用 `select ... from
      auth.users` 帶出），舊明文密碼完全沒有遷移。**筆數核對**：
      profiles 64、applications 18、settings 6、line_bindings 40、
      line_verification_codes 40，`auth.users`／`auth.identities`
      各 64 筆對齊，孤兒資料 0 筆。**已驗證**：`extensions.crypt()`
      密碼雜湊比對正確（測試帳號 011341）；`resolve_empid_email()`
      對 active 帳號回傳 email、對 inactive 帳號（如 011340）與不存在
      工號都正確回傳 null（登入會被擋）。臨時密碼清單存在本機
      `supabase/migration-credentials.txt`（已在 `.gitignore`，不會
      進 git），已交給咖哩，發完給對應員工後應刪除。
- [x] **Phase 6：Edge Function 寫好**（`functions/admin-users/index.ts`）——
      處理「核准申請→建帳號」／「管理員新增帳號」／「管理員重設密碼」，
      這是唯一需要 service role key 的地方。**還沒部署、還沒實測**。
- [x] **套用 schema/policies/functions 到 Supabase 專案**——2026-08-29
      咖哩親自在 Supabase Dashboard 的 SQL Editor 依序貼上執行
      `schema.sql` → `policies.sql` → `functions.sql`，三份都成功
      （Success. No rows returned）。備註：這個 sandbox 環境的網路
      政策只放行 HTTPS 白名單網域，Postgres 直連（5432/6543）跟
      Supabase Management API（`api.supabase.com`）都連不到，沒辦法
      由 Claude 這邊直接執行，所以是咖哩手動貼的。
- [ ] **Phase 5：前端接上**——Aozihdi 的 `index.html` 目前 `ACCOUNT_GAS_URL`
      相關的 35 個呼叫點還沒改，這是接下來最大的一塊，還沒開始。
- [ ] **實測**：登入／改密碼／申請審核／toolPerms 權限矩陣／LINE 綁定，
      跟正式站行為比對。

## 密碼處理

舊密碼沒辦法遷移（雜湊方式不同）。所有帳號（含既有員工、新核准的
申請）一律配一組隨機臨時密碼，`migrate-from-sheets.js` 存進本機
`migration-credentials.txt`（已加進 `.gitignore`，不會進 git），
發給對應的人後這個檔案應該刪除。`帳號申請` 從此不再收明文密碼
（順手修掉原本申請時就明文存密碼的第二個資安缺口）。

## 已知留到後面的事

- 其他獨立 GAS 專案（如 `事故與表揚`）目前靠複製 `SESSION_SECRET`
  做本地 HMAC 驗證來跟主系統對接——這次只換 Aozihdi 沙盒自己的登入
  系統，這些旁系專案怎麼驗證 Supabase JWT 是已知後續工作，不在這次
  範圍內。
- 沒有做「正式切換」規劃（wei 專案的 Phase 6「正式上線」那套），
  這輪只到「Aozihdi 沙盒裡能跑、能測」為止。
