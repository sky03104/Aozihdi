# 天鷹保全監控系統 (Tianying Security Monitor)

> 天鷹保全 漢神巨蛋 · 內部營運自動化監控平台  
> 版本：v3.1 · 最後更新：2026-06

---

## 系統概述

`tianying-monitor` 是天鷹保全 APP 的本地端監控系統，負責：

- **自動學習**：累積失敗案例 → 達閾值自動更新技能（SKILL.md）
- **技能管理**：版本備份、回歸測試、成長趨勢分析
- **告警通知**：閾值達標自動記錄告警，可選 LINE push
- **報告生成**：週報、月報、Obsidian 狀態匯出

---

## 目錄結構

```
tianying-monitor\
│
├── 📋 設定
│   ├── monitor-config.yaml      錯誤模式與閾值設定（所有腳本共用）
│   └── version-manifest.json   技能版本記錄（自動生成）
│
├── 💾 資料
│   ├── failure-log.json         失敗記錄（自動生成）
│   ├── regression-history.json  回歸測試歷史（自動生成）
│   └── archive-log.json         已歸檔項目（log-cleaner 生成）
│
├── 📁 skills\                   本地 SKILL.md 副本（手動維護）
│   ├── tianying-tool-converter.md
│   └── skill-updater.md
│
├── 📁 skill-backups\            版本備份（skill-version-manager 生成）
├── 📁 reports\                  各類報告輸出（自動生成）
├── 📁 alerts\                   告警記錄（alert-dispatcher 生成）
│
├── 🔧 核心整合
│   └── workflow-monitor.py      主控制器（v3.1，所有模式的入口）
│
├── 📊 Track A：進度追蹤
│   ├── delivery-detector.py     交付物偵測
│   ├── snapshot-generator.py    快照生成
│   └── auto-snapshot-runner.py  自動快照執行器
│
├── 🔬 Track B：skill-updater 增強
│   ├── failure-classifier.py    失敗分類增強（繼承 monitor-config 模式）
│   ├── regression-tester.py     SKILL.md 回歸測試
│   └── skill-version-manager.py 版本備份與 rollback
│
├── 🤖 Track C：auto-team 自動觸發
│   ├── task-detector.py         任務角色偵測
│   ├── priority-sorter.py       失敗優先排序
│   └── proactive-suggestion.py  主動建議引擎
│
├── 🛠️ 維護工具
│   ├── log-cleaner.py           日誌去重、歸檔、截斷
│   ├── e2e-test.py              端對端測試套件（T1-T8）
│   └── config-validator.py      monitor-config.yaml 驗證
│
├── 📈 分析工具
│   ├── status-dashboard.py      全系統狀態儀表板
│   ├── trend-analyzer.py        技能成長趨勢圖（ASCII）
│   └── alert-dispatcher.py      閾值告警分發
│
├── 📝 報告工具
│   ├── monthly-summary.py       月度彙整報告生成器
│   └── obsidian-export.py       Obsidian vault 狀態匯出
│
└── ⚙️ 設定工具
    └── setup-scheduler.ps1      Task Scheduler 一鍵設定（已廢棄，改用 cmd）
```

---

## 快速開始

### 1. 環境需求

- Windows 10/11
- Python 3.8+（建議 3.11+）
- 標準庫即可，無需安裝第三方套件

### 2. 首次設定

```cmd
cd C:\Users\USER\OneDrive\文件\GitHub\tianying-security\tianying-monitor

:: 驗證設定檔
python config-validator.py

:: 建立 skills\ 目錄並放入 SKILL.md 副本
mkdir skills
:: 將 SKILL.md 從 Claude 下載後放入 skills\，改名如：
:: skills\tianying-tool-converter.md
:: skills\skill-updater.md

:: 執行首次回歸測試
python regression-tester.py --compare

:: 備份技能
python skill-version-manager.py --backup-all

:: 查看系統狀態
python status-dashboard.py
```

### 3. Task Scheduler 排程（一次性設定）

在 `tianying-monitor\` 目錄下執行（每台電腦各做一次）：

```cmd
:: 每 6 小時自動學習
schtasks /create /tn "tianying-auto-learn" /tr "python %CD%\workflow-monitor.py --mode auto-learn" /sc HOURLY /mo 6 /st 06:00 /f

:: 每天 02:00 回歸測試
schtasks /create /tn "tianying-regression" /tr "python %CD%\regression-tester.py --compare --output" /sc DAILY /st 02:00 /f

:: 每月 1 日 03:00 清理
schtasks /create /tn "tianying-log-clean" /tr "python %CD%\log-cleaner.py --all" /sc MONTHLY /d 1 /st 03:00 /f

:: 每天 08:00 儀表板快照
schtasks /create /tn "tianying-dashboard" /tr "python %CD%\status-dashboard.py --save" /sc DAILY /st 08:00 /f

:: 每小時 :30 告警檢查
schtasks /create /tn "tianying-alert" /tr "python %CD%\alert-dispatcher.py" /sc HOURLY /st 00:30 /f

:: 每月 1 日 04:00 月度彙整
schtasks /create /tn "tianying-monthly" /tr "python %CD%\monthly-summary.py" /sc MONTHLY /d 1 /st 04:00 /f
```

---

## 核心工作流

```
Task Scheduler（每 6 小時）
  └─ workflow-monitor.py --mode auto-learn
       │  讀取 failure-log.json
       │  pending critical >= 2 → 自動更新 SKILL.md
       └─ Post-learn hooks（完成後自動觸發）：
            ├─ failure-classifier.py --enrich
            ├─ priority-sorter.py --output
            └─ regression-tester.py --compare --output

Task Scheduler（每天 02:00）
  └─ regression-tester.py --compare --output

Task Scheduler（每天 08:00）
  └─ status-dashboard.py --save

Task Scheduler（每小時 :30）
  └─ alert-dispatcher.py

Task Scheduler（每月 1 日）
  ├─ log-cleaner.py --all（03:00）
  └─ monthly-summary.py（04:00）
```

---

## 腳本說明

### workflow-monitor.py（主控制器）

```cmd
python workflow-monitor.py --mode auto-learn     自動學習（含 post-learn hooks）
python workflow-monitor.py --mode review-log     查看日誌（自動觸發建議）
python workflow-monitor.py --mode scan           系統狀態掃描 + 角色建議
python workflow-monitor.py --mode suggest        完整主動建議報告
python workflow-monitor.py --mode dry-run        預覽 auto-learn 結果（不執行）
python workflow-monitor.py --mode report         生成 Markdown 週報
python workflow-monitor.py --mode convert --tool <name> --error-msg <msg>  記錄失敗
```

### 狀態查看

```cmd
python status-dashboard.py                 全系統狀態儀表板
python status-dashboard.py --save          儀表板另存到 reports\
python trend-analyzer.py                   技能成長趨勢圖
python trend-analyzer.py --metric chars    字元數趨勢
python trend-analyzer.py --last 20         最近 20 次
```

### 技能管理

```cmd
python regression-tester.py                驗證所有技能
python regression-tester.py --compare      與上次比對成長
python skill-version-manager.py --list     列出版本清單
python skill-version-manager.py --backup-all    備份全部
python skill-version-manager.py --rollback <name>   回滾
python skill-version-manager.py --diff <name>        顯示差異
python skill-version-manager.py --next-version <name> 預覽下一版
```

### 失敗管理

```cmd
python failure-classifier.py               分類並輸出報告
python failure-classifier.py --enrich      豐富化 failure-log.json
python priority-sorter.py                  優先行動佇列
python priority-sorter.py --section        依節點分組
python alert-dispatcher.py --status        查看告警狀態
python alert-dispatcher.py --test          測試告警
```

### 報告生成

```cmd
python monthly-summary.py                  生成本月月報
python monthly-summary.py --month 2026-05  生成指定月份
python monthly-summary.py --preview        預覽
python obsidian-export.py                  匯出到 Obsidian vault
python obsidian-export.py --dry-run        預覽不寫入
```

### 維護工具

```cmd
python log-cleaner.py --status             查看日誌狀態
python log-cleaner.py --all                全部清理
python log-cleaner.py --all --dry-run      預覽清理
python config-validator.py                 驗證設定檔
python config-validator.py --fix           顯示修復範本
python e2e-test.py                         全系統端對端測試（T1-T8）
python e2e-test.py --quick                 快速測試（T1-T5）
```

---

## 設定檔（monitor-config.yaml）

```yaml
## 監控規則
monitoring:
  failure_patterns:
    - pattern: "node --check failed"
      priority: "critical"
      section: "SOP 驗證"
    # ... 更多模式

## 自動觸發閾值
auto_trigger:
  critical_threshold: 2      # critical >= 2 才觸發學習
  important_threshold: 4     # important >= 4 才觸發學習

## Obsidian 整合（可選）
obsidian_vault_path: "C:\Users\USER\OneDrive\文件\GitHub\tianying-security"

## LINE 告警 webhook（可選）
# alert_webhook_url: "https://script.google.com/.../exec"
```

---

## 雙電腦同步

| 設定項目 | 公司電腦 | 家用電腦 |
|----------|---------|---------|
| 腳本路徑 | `C:\Users\天鷹\Documents\GitHub\tianying-security\tianying-monitor\` | `C:\Users\USER\OneDrive\文件\GitHub\tianying-security\tianying-monitor\` |
| GitHub 同步 | GitHub Desktop | GitHub Desktop |
| Task Scheduler | 各自設定 | 各自設定 |
| skills\ 目錄 | 手動維護 | 手動維護 |

**同步流程：**
1. 一台電腦 push → 另一台 pull（GitHub Desktop）
2. `skills\` 目錄的 SKILL.md 也放入 Git 追蹤
3. `failure-log.json`、`regression-history.json` 不放入 Git（各機獨立）

---

## 故障排除

### `failure-log.json 不存在`
正常。尚無失敗記錄，系統健康。

### `skills\ 目錄為空`
需手動放入 SKILL.md 副本。從 Claude 對話下載後改名放入 `skills\<name>.md`。

### `regression-history.json 無記錄`
執行 `python regression-tester.py --compare` 至少兩次後才有趨勢可比對。

### Task Scheduler 不執行
1. 確認 Python 在 PATH：`python --version`
2. 確認路徑無空格問題：`schtasks /query /tn "tianying-auto-learn"`
3. 手動執行腳本確認無錯誤

### obsidian-export.py 找不到 vault
在 `monitor-config.yaml` 加入：
```yaml
obsidian_vault_path: "C:\Users\...\tianying-security"
```

---

## 版本歷史

| 版本 | 內容 |
|------|------|
| v1.0 | Track A/B/C 基礎腳本（9 個） |
| v2.0 | workflow-monitor 整合（W2） |
| v3.0 | e2e-test + log-cleaner + dry-run（W3） |
| v3.1 | status-dashboard + config-validator + report（W4） |
| v3.2 | trend-analyzer + alert-dispatcher（W5） |
| v3.3 | monthly-summary + obsidian-export（W6） |
