---
tags: [tianying, project-state, 狀態快照]
updated: 2026-06-23
status: active
aliases: [專案狀態, 快照]
---

# 天鷹保全管理系統 — 專案狀態快照

> 漢神巨蛋部署 · 服務保全員工與管理層 · 產品負責人：咖哩ღ（非工程師，需求方/決策者）
> **這份檔案是專案唯一權威狀態。開工先讀、收工先更。最後更新：2026-06-22(2)**

---

## 1. 系統架構

| 層 | 技術 | 位置 |
|---|---|---|
| 前端 | 純 HTML（內嵌 tpl-* base64 工具）| GitHub Pages `sky03104.github.io/tianying-security/` |
| 後端 | Google Apps Script（多專案分工）| 各 GAS Web App `/exec` |
| 資料庫 | Google Sheets | 多份試算表 |

- 管理員帳號：`sky03104` / 密碼 `qaz03104`
- index.html 已達 3MB+，長期評估 MPA 分離架構遷移（尚未執行）

---

## 2. 檔案清單

| 檔案 | 用途 | 狀態 |
|---|---|---|
| `index.html` | 主程式（React createElement + 內嵌 tpl-* 工具）| ✅ 維護中，3.38MB |
| `post.html` | 明日哨表完整頁（GitHub Pages，被 index.html iframe 串接）| ✅ |
| `tool_work.html` | 施工單查詢外部頁（TOOLS id:9 externalUrl）| ✅ |
| `tool_report.html` | 事故報告填寫外部頁（externalUrl，root 同層）| ✅ 2026-06-22 改寫 |
| `tool_feedback.html` | 匿名表揚／檢舉外部頁（externalUrl，root 同層）| ✅ 2026-06-22 改寫 |
| 專案檔目錄 | `/mnt/project/` | — |
| 輸出目錄 | `/mnt/user-data/outputs/` | — |
| LOGO base64 快取 | `/tmp/logo_b64.txt` | — |

---

## 3. 工具清單（index.html 內嵌 tpl-* / 主程式 toolId）

| toolId / id | 名稱 | 實作 | 狀態 |
|---|---|---|---|
| `signin` / 6 | 過夜車輛登記 | tpl-signin，LIFF 自動帶入 empId | ✅ |
| `closing` / 2 | 打烊後進出快速登錄 | tpl-closing，含右下角 🔍 施工單查詢 drawer | ✅ |
| `upload` / 3 | 資料上傳工具 | tpl-upload | ✅ |
| `emergency` / 12 | 緊急聯絡清單 | tpl-emergency | ✅ |
| `car` / 7 | 停車場車位數計算 | tpl-car | ✅ |
| `post` / 14 | 明日哨表 | 外部 `src` iframe → post.html | ✅ |
| — / 15 | 績效報表查看 | 主程式（管理報表，原與哨表共用 id:14，已分離）| ✅ |
| `leave` / 99 | 請假申請 | 主程式 React createElement（無 tpl）| ✅ |
| `schedule` | 班表管理工具 | 從資料上傳工具同步開啟；上傳成功後自動清快取讓其他裝置重拉 | ✅ |
| — / 9 | 施工單查詢 | externalUrl → tool_work.html | ✅ |
| 既有「事故報告填寫」鈕 | 事故報告填寫（綁工號不匿名）| externalUrl → tool_report.html | ✅ 前端就緒，待改 index.html externalUrl |
| 既有「異常事件通報」鈕 | 匿名表揚／舉報（**由異常事件通報改名**）| externalUrl → tool_feedback.html（前台匿名/後台記工號姓名）| ✅ 前端就緒，待改名+externalUrl |

現存 tpl script id（index.html）：`tpl-upload` / `tpl-closing` / `tpl-signin` / `tpl-emergency` / `tpl-car`
（明日哨表已從 base64 srcDoc 改為外部 iframe，tpl-post 已移除）

---

## 4. GAS 專案

| 識別 | 名稱 | exec URL 後綴 | 用途 |
|---|---|---|---|
| doc3 | 天鷹保全APP主GAS / 帳號GAS | `…wiDJf2coO3zMcg/exec` | 帳號申請、請假申請、getSettings/setSettings（含 toolPerms）、公告 |
| doc4 | 班表上傳GAS | `AKfycbzs56In…w/exec` | 班表上傳、批次通知 notifyScheduleChangeBatch、月份切換 v2.9/v2.10 |
| — | 打烊後進出快速登錄 GAS | `AKfycbwZ5f7h…ng/exec` | 打烊後進出登錄 |
| CON_GAS | 施工單查詢 GAS | `AKfycbz7orMAA608…/exec`（在 tpl-closing L563）| getOrders 回 {tonight, morning}（**原始碼未持有，另一專案**）|
| FB_GAS | 事故報告 / 匿名表揚舉報 GAS | `AKfycbwHXlwTMmJyA79…/exec` | report+feedback 共用 action 分流。✅ **完整原始碼已交付 `FB_GAS_Code.gs`**：照片存公告資料夾、回 ContentService JSON、寫主試算表「事故報告」/「表揚檢舉」分頁 |

- doc3 完整 URL：`https://script.google.com/macros/s/AKfycbxEVBHseDpLWiWe4d8kLcCHbVFiKAK9wyoLwqNkt59PS4vPCY9QfG0_wiDJf2coO3zMcg/exec`（index.html 內 `ACCOUNT_GAS_URL`）

---

## 5. 關鍵常數

**試算表 ID**
- 主試算表：`1oZsn8WlJ_-qQ6k9tIzm6Ymp3Zp-IfBFCf80Ut7Zw_JU`
- 明日哨表 SS：`1sIcdAhw0mz5iM3F5fulDNPOda2pv-t7xUhT6XXf9X7Q`
- 打烊後/車輛登錄 SS：`1TnN3iJb1w9XTuw0-QuNrtXEOa71KCCy7y8Q3_1b1FmI`
- Drive 公告圖片資料夾：`1K_RRPUjcWrdNAS2ppcx6OFDtlkfSfAl3`

**權限／localStorage**
- `PERMS_VER = 'v6'`
- keys：`tianying_perms` / `tianying_perms_known` / `tianying_perms_ver` / `tianying_sched_v1` / `tianying_sched_m1` / `hsh_session_user`
- 設定 keys：`leaveCapMorning`(預設5) / `leaveCapNight`(預設3) / `tomorrowPostGroupId` / `toolPerms`
- known 機制：`tianying_perms_known` 存「儲存當下系統已存在工具 id」；新增工具 id 不在 known 內 → 自動補 DEFAULT_PERMS 預設權限（雲端載入時亦同，見本次交付 2026-06-21）

**LINE LIFF**（兩者不可混用）
- 請假用：`2010392723-P8uR4CaO`
- 夜間車輛登記用：`2010392723-Pl8dPArQ`
- LINE 綁定：userId 存「LINE綁定」工作表，6 位驗證碼流程，Token 在 Script Properties `LINE_CHANNEL_ACCESS_TOKEN`

**角色階層**（index.html ROLES）
`fulltime`(正職) / `parttime`(兼職) < `leader`(組長) / `vicecaptain`(副隊長) < `captain`(隊長) < `executive`(公司主管) < `admin`(管理員)
- `CAN_MANAGE_ROLES = ['leader','vicecaptain','captain','executive','admin']`（控制管理後台入口、公告編輯）
- 管理後台「🔐權限」「✏️工具」子分頁：**admin only**
- 請假「管理員專屬：請假上限」欄：**隊長以上**（`['captain','executive','admin']`，2026-06-21 變更）
- 事故報告填寫 DEFAULT_PERMS：**組長以上** `leader/vicecaptain/captain/executive/admin`
- 匿名表揚／舉報 DEFAULT_PERMS：**全員**（`fulltime/parttime` 起全部）。兩者掛 TOOLS id 後 admin 可於後台 toolPerms 隨時改

---

## 6. 設計規範

**色彩**（所有工具頁強制）
- 背景 `#0A0C10`；主色金 `#D4A800`/`#FFD700`；副色靛藍 `#818CF8`/`#6366F1`
- 文字 `#F5F5F5`；成功 `#4ADE80`；錯誤 `#F87171`

**字型／圖示**：Microsoft JhengHei；Tabler Icons
**卡片**：Glassmorphism；主按鈕金漸層；副按鈕靛藍漸層
**品牌**：天鷹保全 / TIANYING SECURITY · DATA SYSTEM

**LOGO 鐵律**
- 正確：PNG，276802 字元，`data:image/png;base64,...`
- 來源：`/mnt/user-data/uploads/天鷹保全資料上傳工具.html` 用 `re.findall(r'data:image[^"\'>\s]+', content)[0]` 擷取
- **嚴禁** `/mnt/project/天鷹去背LOGO.png`（JPEG，錯誤）
- 視覺：三層旋轉金色光環 + 中央去背 LOGO + 四角金色角框（CSS 動畫）

**LIFF SDK 鐵律**
- 網址必須 `https://static.line-scdn.net/liff/edge/2/sdk.js`（`line-scdn` 中間有 `s`，勿寫 `line-cdn`）

**交付規則（嚴格）**
1. 完整可貼上檔案，零省略／零 diff／零 placeholder 註解
2. 輸出至 `/mnt/user-data/outputs/`，提供下載
3. 交付前 `node --check`（.gs 需改名 .js）
4. 100% 保留既有功能
5. GAS 修改後必須部署為新版本（exec URL 不變，但不選新版本則無效）

**技術心得**
- 大型 HTML 修改：python regex `count=1` 精準替換 + assert 唯一性，比字串操作可靠
- tpl-* 修改流程：解碼 base64 → patch → node --check → 重新 base64 編碼回，並驗證解碼往返一致
- ⚠️ patch script 若中途 assert 失敗會在 write 前 crash → 前面改動不落檔，需從備份重解
- base64 內嵌 emoji 用 `\uXXXX` 轉義較安全
- Google Sheets 日期 bug：appendRow 日期欄加 `'` 前綴強制文字，避免 UTC 偏移
- GAS installable onEdit 不跨專案觸發 → 改 UrlFetchApp POST 跨專案通知（首次需手動執行觸發 OAuth）
- GAS 私有函式（`_` 結尾）不出現在執行下拉選單
- ⚠️ **React UMD 鐵律：原生 UMD 必用 React 18.x（18.3.1）**。React 19 已移除 umd build，載入 `react/19.0.0/umd/...` → 404 → React undefined → 卡 splash +「Uncaught Error: Script error.」
- 外部工具頁照片統一公告同款：urlencoded base64 POST → GAS 存公告資料夾 `1K_RRPUjcWrdNAS2ppcx6OFDtlkfSfAl3` 回連結 → 前端讀 `{status,msg}` JSON

---

## 7. 交付時間軸（append-only，新的在最上）

- **2026-06-22(2)｜修閃退+照片對齊公告+全新FB_GAS｜影響：tool_report.html, tool_feedback.html, FB_GAS_Code.gs**
  (1)修閃退：React 19 無 umd → 回退 18.3.1
  (2)照片改公告同款 urlencoded base64，GAS 存公告資料夾回連結，讀真實 JSON
  (3)report 綁工號不匿名；feedback 前台匿名、後台分頁記工號+姓名
  (4)前端 getSessionName() 同 origin 讀 hsh_session_user 帶姓名
  (5)交付全新 FB_GAS_Code.gs（action 分流/存圖/兩分頁/純數字流水號/JSON）
  待辦：index.html 結合按鈕+權限（需上傳 index.html）；部署 FB_GAS
- **2026-06-22｜助手版事故報告/匿名表揚檢舉改寫對齊APP｜影響：tool_report.html, tool_feedback.html**
  兩支外部工具頁改寫：(1)返回路徑 `../index.html`→`index.html?empId=`（修錯誤上層 bug）
  (2)React 18→19 (3)套天鷹品牌 splash（三環+去背LOGO+角框）+頂部LOGO+頁尾版權
  (4)empId 預設統一「未登入」(5)字型加 JhengHei fallback
  (6)feedback 移除 no-cors 假成功→改 FormData 讀真實 GAS JSON `{status,msg}` 顯示真成功/失敗
  (7)report 補 `action:'report'` 與 feedback `action:'feedback'` 共用 FB_GAS 分流。
  ⚠️ FB_GAS（`AKfycbwHXlwTMmJyA79…/exec`）原始碼未持有，需確認 doPost 已回傳 ContentService JSON。

- **2026-06-21｜班表上傳成功後清快取｜影響：index.html, tpl-upload**
  班表上傳成功時，主動清除本機 localStorage `tianying_sched_v1`/`tianying_sched_m1` 快取，
  讓其他裝置重開班表工具時強制重拉最新班表，解決「改班表後同事看舊版」的跨裝置不同步問題。
  方案 A（快速版）：1 行程式碼，立刻生效，無需改 GAS；缺點是每次開班表都要重拉（慢一點但保證最新）。
  後續可升級為方案 B（版本號機制）。
- **2026-06-21｜四項修正一次交付｜影響：index.html, tpl-closing**
  1. 工具管理權限：確認「🔐權限/✏️工具」子分頁已 admin only（守門完整，未改碼）
  2. 明日哨表 vs 績效報表解綁：績效報表 id 14→15，DEFAULT_PERMS captain/executive/admin 加 15，雲端載入新增「補新工具預設權限」邏輯（newToolIds 比對 known）
  3. 請假「管理員專屬：請假上限」欄顯示條件 `CAN_MANAGE_ROLES` → `['captain','executive','admin']`（隊長以上，排除組長/副隊長）
  4. 施工單查詢 drawer 加實際日期：tab 顯示「今晚 M/D(週)」「明早 M/D(週)」（凌晨<8點算昨晚的夜班）+ 每張卡片加 📅 日期列（GAS 若回 o.date 優先，否則用分頁對應日期）
- **2026-06｜明日哨表改 iframe 串接｜影響：index.html, post.html**
  base64 srcDoc → 外部 `src` iframe 指向 post.html；index.html 縮約 9KB；tpl-post 移除
- **2026-06｜doc3 設定同步修正｜影響：doc3 GAS**
  getSettings/setSettings 新增 toolPerms JSON 雲端同步；修正 parseInt 靜默失敗
- **2026-06｜公告系統｜影響：index.html, doc3 GAS**
  支援 Drive 圖片上傳；前端改 `application/x-www-form-urlencoded` POST；GAS 新增 getAnnouncements/saveAnnouncements/annUploadImage_
- **較早｜班表上傳｜影響：doc4 GAS**
  批次通知 notifyScheduleChangeBatch + 月份切換 v2.9/v2.10（持續驗證中）

---

## 待辦 / 規劃中

- 📋 薪資計算工具（已規劃，未交付）
- 📋 MPA 分離架構遷移評估（index.html 3MB+ 長期維護）
- 🔧 **待上傳 index.html** 以完成：(a)「事故報告填寫」鈕 externalUrl→tool_report.html、權限組長以上；(b)「異常事件通報」鈕改名「匿名表揚／舉報」+ externalUrl→tool_feedback.html、權限全員；(c)確認兩 id 在 toolPerms，admin 可後台改
- 🔧 **待部署 FB_GAS_Code.gs** 到 AKfycbwHXlwTMmJyA79…/exec（新版本部署），首次手動執行授權 Drive/Sheet
- ⚠️ 施工單查詢若需「資料按日精準過濾」，須取得 CON_GAS 原始碼確認 getOrders 的日期分組邏輯（目前前端僅補日期顯示）
