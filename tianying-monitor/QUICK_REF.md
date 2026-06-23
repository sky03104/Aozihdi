# 天鷹保全監控系統 · 快速參考卡

> 所有指令在 `tianying-monitor\` 目錄下執行

---

## 日常查看

```cmd
python status-dashboard.py          全系統一覽（健康度 / 失敗 / 技能）
python workflow-monitor.py --mode scan      系統狀態 + 角色建議
python alert-dispatcher.py --status         目前告警狀態
```

---

## 手動觸發學習

```cmd
:: 預覽（不執行）
python workflow-monitor.py --mode dry-run

:: 正式執行
python workflow-monitor.py --mode auto-learn
```

---

## 技能管理

```cmd
python regression-tester.py --compare       測試 + 比對成長
python skill-version-manager.py --backup-all  備份全部
python skill-version-manager.py --list        列出版本
python skill-version-manager.py --rollback <name>  回滾
python trend-analyzer.py                     成長趨勢圖
```

---

## 報告生成

```cmd
python workflow-monitor.py --mode report   Markdown 週報 → reports\weekly-YYYYMMDD.md
python monthly-summary.py                  月報 → reports\monthly-YYYYMM.md
python obsidian-export.py                  → Obsidian vault 更新
```

---

## 維護

```cmd
python log-cleaner.py --status             日誌大小
python log-cleaner.py --all                全部清理（每月跑）
python config-validator.py                 驗證設定檔
python e2e-test.py --quick                 快速功能驗證（T1-T5）
python e2e-test.py                         完整驗證（T1-T8）
```

---

## Task Scheduler 現有排程

| 名稱 | 頻率 | 腳本 |
|------|------|------|
| tianying-auto-learn | 每 6 小時 | workflow-monitor --mode auto-learn |
| tianying-regression | 每天 02:00 | regression-tester --compare --output |
| tianying-log-clean | 每月 1 日 03:00 | log-cleaner --all |
| tianying-dashboard | 每天 08:00 | status-dashboard --save |
| tianying-alert | 每小時 :30 | alert-dispatcher |
| tianying-monthly | 每月 1 日 04:00 | monthly-summary |

---

## 閾值設定（monitor-config.yaml）

| 條件 | 預設值 | 效果 |
|------|--------|------|
| critical_threshold | 2 | critical >= 2 → 自動學習 |
| important_threshold | 4 | important >= 4 → 自動學習 |

---

## skills\ 目錄說明

放入 SKILL.md 副本（從 Claude 下載），改名為 `<skill-name>.md`：

```
skills\
├── tianying-tool-converter.md
└── skill-updater.md
```

---

## 雙電腦路徑

| 電腦 | 路徑 |
|------|------|
| 公司 | `C:\Users\天鷹\Documents\GitHub\tianying-security\tianying-monitor\` |
| 家用 | `C:\Users\USER\OneDrive\文件\GitHub\tianying-security\tianying-monitor\` |
