---
tags: [tianying, project-state, 狀態快照]
updated: 2026-06-24b
status: active
aliases: [專案狀態, 快照]
---

# 🦅 天鷹保全管理系統 · 專案狀態快照
> 最後更新：2026-06-24｜由 Claude 掃描 tianying-security repo 生成

---

## 1. 系統架構

| 層 | 技術 | 說明 |
|---|---|---|
| 前端 | 純 HTML + Vanilla JS | 嚴禁 React JSX |
| 工具嵌入 | Base64 tpl 內嵌 OR 獨立 HTML | index.html 含 5 個 tpl |
| 後端 | Google Apps Script (GAS) | 2支已知 + 1支待部署 |
| 部署 | GitHub Pages | https://sky03104.github.io/tianying-security/ |
| 狀態傳遞 | URLSearchParams `?empId=` | 所有工具頁面必須實作 |
| Vault | Obsidian + Git | tianying-security repo 二合一 |

---

## 2. 關鍵常數（不可改動）

| 項目 | 值 |
|---|---|
| 主試算表 ID | `1oZsn8WlJ_-qQ6k9tIzm6Ymp3Zp-IfBFCf80Ut7Zw_JU` |
| ACCOUNT_GAS_URL | `https://script.google.com/macros/s/AKfycbxEVBHseDpLWiWe4d8kLcCHbVFiKAK9wyoLwqNkt59PS4vPCY9QfG0_wiDJf2coO3zMcg/exec` |
| 第二 GAS URL | `https://script.google.com/macros/s/AKfycbzs56InZLeaHiRJhy1alNfQwDyH0mXEV9t_WJxzfjTjIhf68DHgMiWVQvVG6vKrRZ2x1w/exec` |
| PERMS_VER | `v6` |
| LIFF 請假申請 | `2010392723-P8uR4CaO` |
| LIFF 過夜車輛 | `2010392723-Pl8dPArQ` |
| Drive 公告圖片 | `1K_RRPUjcWrdNAS2ppcx6OFDtlkfSfAl3` |
| 管理員帳號 | `sky03104` / `qaz03104` |
| GitHub Pages | `https://sky03104.github.io/tianying-security/` |

**localStorage Keys：**
`hsh_favs_` / `hsh_personal_favs` / `hsh_remember_user` / `hsh_session_user`
`tianying_announcements` / `tianying_perms` / `tianying_perms_known` / `tianying_perms_ver` / `tianying_sched_v1` / `tianying_userdb`

**靜態變數（不可覆蓋）：** `USER_DB`, `DEFAULT_PERMS`, `TOOLS`, `ROLES`

---

## 3. 工具清單

| ID | 名稱 | toolId | 實作位置 | 行數 | 狀態 |
|---|---|---|---|---|---|
| 1 | 班表查詢 | `schedule` | ❌ 無 | — | 📋 待開發 |
| 2 | 打烊後進出快速登錄 | `closing` | `tpl-closing`（index內嵌）| — | ✅ |
| 3 | 資料上傳工具 | `upload` | `tpl-upload`（index內嵌）| — | ✅ |
| 4 | 事故報告填寫 | externalUrl | `事故回報工具/tool_report.html` + `事故回報工具/Code.gs` | 232行+74行GAS | ✅（GAS v2.0 支援照片上傳）|
| 5 | 訪客登記系統 | — | ❌ 無 | — | 📋 待開發 |
| 6 | 過夜車輛登記 | `signin` | `tpl-signin`（index內嵌）+ `tool_signin.html` | 561行 | ✅ |
| 7 | 停車場車位計算 | `car` | `tpl-car`（index內嵌）+ `tool_car.html` | 758行 | ✅ |
| 9 | 施工單查詢 | externalUrl | `tool_work.html` | 766行 | ✅ |
| 10 | 影像調閱申請 | — | ❌ 無 | — | 📋 待開發 |
| 11 | 設備檢查表 | — | ❌ 無 | — | 📋 待開發 |
| 12 | 緊急聯絡清單 | `emergency` | `tpl-emergency`（index內嵌）| — | ✅ |
| 13 | 匿名表揚／舉報 | externalUrl | `匿名舉報工具/tool_feedback.html` | 970行 | ✅（後端 GAS 待部署）|
| 14 | 明日哨表 | `post` | `post.html`（獨立）| 160行 | ⚠️ 疑不完整 |
| 15 | 績效報表查看 | — | ❌ 無 | — | 📋 待開發 |
| 99 | 請假申請 | `leave` | `liff_leave.html`（LIFF）| 543行 | ✅ |

---

## 4. GAS 專案

| 名稱 | exec URL 後綴識別 | 用途 | 狀態 |
|---|---|---|---|
| ACCOUNT_GAS | `…wiDJf2coO3zMcg/exec` | 登入驗證、公告、班表查詢 | ✅ 運作中 |
| 第二 GAS | `…VG6vKrRZ2x1w/exec` | 用途待確認 | ⚠️ |
| FB_GAS_Code.gs | — | 匿名表揚後端（新） | 🔧 待部署授權 |
| 事故回報工具/Code.gs | — | 事故報告後端 v2.0，支援 Base64 照片→Drive | 🔧 待部署授權 |
| 哨表上傳_GAS_Code.gs | — | 哨表上傳處理 | ✅ |

---

## 5. index.html tpl 清單

| tpl ID | 對應工具 | 狀態 |
|---|---|---|
| `tpl-car` | 停車場車位計算 | ✅ |
| `tpl-closing` | 打烊後進出快速登錄 | ✅ |
| `tpl-emergency` | 緊急聯絡清單 | ✅ |
| `tpl-signin` | 過夜車輛登記 | ✅ |
| `tpl-upload` | 資料上傳工具 | ✅ |

> ⚠️ `tpl-post`、`tpl-leave`、`tpl-schedule` 不存在於 index.html，相關工具為獨立頁或 LIFF

---

## 6. 設計規範

- 框架：純 HTML（非 React JSX）
- 背景：#0A0C10 / #0D0F14 | 主色（金）：#D4A800 / #FFD700
- 副色（靛藍）：#818CF8 / #6366F1
- 成功綠：#4ADE80 | 錯誤紅：#F87171 | 警告橙：#FB923C
- 文字：#F5F5F5 | 字型：Microsoft JhengHei | 圖示：Tabler Icons
- 卡片：Glassmorphism（rgba(255,255,255,0.03), border rgba(255,255,255,0.08), backdrop-filter:blur(12px)）
- 主按鈕：金色漸層 | 副按鈕：靛藍漸層

---

## 7. 當前待辦

> [!WARNING] 待辦（截至 2026-06-24）
> - 🔧 **FB_GAS_Code.gs** 部署新版本 + 首次授權（匿名表揚後端）
> - 🔧 **事故回報工具/Code.gs** v2.0 部署 + 首次授權（事故報告後端）
> - 🔧 **index.html** 確認 externalUrl 是否已指向正確子資料夾路徑
> - ⚠️ **post.html** 只有 160 行，確認是否完整
> - ⚠️ **事故回報工具/tool_report.html** 只有 232 行，前端功能待確認
> - 📋 **班表查詢**（toolId: schedule）尚無任何實作
> - 📋 **訪客登記系統**、**影像調閱申請**、**設備檢查表**、**績效報表**待開發
> - 📋 **MPA 分離架構評估**（index.html 已達 3MB+/20634行）

---

## 8. 交付時間軸

```
2026-06-24｜掃描新增資料夾，補全事故報告GAS v2.0、匿名舉報工具、技能自動進化監控系統｜影響：project-state.md（工具清單+GAS）
2026-06-24｜Claude 掃描雙 repo 重建完整快照，補全 LIFF ID、試算表 ID、GAS URL｜影響：project-state.md（重寫）
2026-06-23｜自動同步測試成功（obsidian-auto-sync.py）｜影響：project-state.md（測試版）
```

---

## 工具狀態標記
✅ 完成　🔧 進行中／待部署　📋 規劃待開發　⚠️ 有已知問題
