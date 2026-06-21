---
title: 天鷹保全 · 工具轉換自動化系統 v3.0 部署指南
subtitle: 從等級 1 升級到等級 3（完全自動化）
version: 3.0
date: 2026-06-22
---

# 等級 3：完全自動化部署指南

## 概述

升級到等級 3 後，系統會**完全自動化**執行以下流程：

```
你上傳工具
    ↓ 自動轉換 (tianying-tool-converter)
    ↓ 失敗? → 自動記錄到中央日誌
    ↓ 每 6 小時自動掃描
    ↓ 達到阈值? → 自動觸發 skill-updater
    ↓ 自動驗證 + 版本化合併 + 回歸測試
    ↓ 自動更新 SKILL.md + 發送通知
    ↓ 下次轉換時自動啟用新規則
    
結果：零人工干預，無遺漏
```

---

## 第 1 步：安裝監控系統（5 分鐘）

### 1.1 複製檔案到適當位置

```bash
# 創建監控系統目錄
mkdir -p /path/to/project/monitor
cd /path/to/project/monitor

# 複製監控腳本
cp /tmp/workflow-monitor.py ./
cp /tmp/auto-update.sh ./
cp /tmp/monitor-config.yaml ./

# 設定執行權限
chmod +x auto-update.sh workflow-monitor.py

# 驗證
ls -la
# 應看到：
# -rw-r--r-- workflow-monitor.py
# -rwxr-xr-x auto-update.sh
# -rw-r--r-- monitor-config.yaml
```

### 1.2 驗證前置條件

```bash
# 檢查 Python 3（推薦 3.8+）
python3 --version
# 應輸出：Python 3.8.x 或更高

# 檢查必要的 Python 標準庫
python3 -c "import json, re, datetime, pathlib; print('✅ 所有標準庫均可用')"

# 檢查 Node.js（用於 --check 驗證）
node --version
# 應輸出：v14.x 或更高
```

---

## 第 2 步：配置監控規則（可選，有預設值）

編輯 `monitor-config.yaml`，調整阈值和通知：

```yaml
# 最常改的三項：

auto_trigger:
  critical_threshold: 2        # critical 錯誤 ≥2 個時觸發
  important_threshold: 4       # important 錯誤 ≥4 個時觸發
  time_based: "0 */6 * * *"   # 每 6 小時掃一次

notification:
  channels:
    - type: "file"            # 檔案通知（預設）
      enabled: true
    - type: "slack"           # 可選：Slack 通知
      webhook_url: ""         # 填入 Slack webhook URL
      enabled: false
```

---

## 第 3 步：集成到轉換工作流（關鍵）

### 3.1 修改 `tianying-tool-converter` 的執行入口

當執行工具轉換時，自動記錄結果。在你的轉換腳本或 CI/CD 中：

```bash
# 方式 1：直接調用（推薦用於開發）
python3 workflow-monitor.py --mode convert \
  --tool "tool_report.html" \
  --error-msg "" \
  --priority "important"

# 方式 2：包裝在 bash 函式中（推薦用於自動化）
convert_tool() {
    local tool_name="$1"
    local error_msg="$2"
    local priority="${3:-important}"
    
    # 執行 tianying-tool-converter
    # ... (實際轉換邏輯)
    
    # 記錄結果
    if [ -z "$error_msg" ]; then
        echo "✅ $tool_name 轉換成功"
    else
        python3 /path/to/monitor/workflow-monitor.py --mode convert \
            --tool "$tool_name" \
            --error-msg "$error_msg" \
            --priority "$priority"
    fi
}

# 使用
convert_tool "tool_report.html"
convert_tool "tool_feedback.html" "React version mismatch" "critical"
```

### 3.2 與 index.html 掛載流程整合

在你的 index.html 轉換腳本中，捕獲失敗並記錄：

```python
# Python 示例（偽代碼）
import subprocess
import json

def patch_index_html(input_file, output_file):
    try:
        # 執行 patch（既有邏輯）
        result = subprocess.run([...], check=True, capture_output=True)
        
        # 驗證（既有邏輯）
        subprocess.run(['node', '--check', ...], check=True)
        
        print(f"✅ 成功：{output_file}")
        return True
    
    except subprocess.CalledProcessError as e:
        # 自動記錄失敗
        error_msg = str(e.stderr)[:500]
        record_failure(
            tool_name="index.html",
            error_type="patch_failed",
            error_msg=error_msg,
            priority="critical"  # index.html 失敗是 critical
        )
        return False

def record_failure(tool_name, error_type, error_msg, priority):
    """調用監控系統記錄失敗"""
    import subprocess
    subprocess.run([
        'python3', '/path/to/monitor/workflow-monitor.py',
        '--mode', 'convert',
        '--tool', tool_name,
        '--error-type', error_type,
        '--error-msg', error_msg,
        '--priority', priority
    ])
```

### 3.3 與 GAS 部署流程整合

在部署 GAS 時，捕獲授權失敗、執行錯誤等：

```bash
# GAS 部署時，若遇到授權失敗或錯誤
if ! gcloud functions deploy tianying-gas --runtime nodejs18 2>&1 | tee /tmp/gas_deploy.log; then
    python3 /path/to/monitor/workflow-monitor.py --mode convert \
        --tool "GAS" \
        --error-msg "$(cat /tmp/gas_deploy.log | tail -5)" \
        --priority "critical"
fi
```

---

## 第 4 步：設定定時執行（Cron 自動觸發）

### 4.1 設定 Cron 任務

```bash
# 編輯 crontab
crontab -e

# 加入下行（每 6 小時自動掃一次、觸發學習）
0 */6 * * * cd /path/to/project/monitor && ./auto-update.sh

# 或更頻繁（每 2 小時）
0 */2 * * * cd /path/to/project/monitor && ./auto-update.sh

# 或每天固定時間（晚上 6 點）
0 18 * * * cd /path/to/project/monitor && ./auto-update.sh
```

### 4.2 驗證 Cron 已設定

```bash
# 查看已設定的 cron
crontab -l | grep auto-update

# 查看 cron 執行日誌（Linux）
grep CRON /var/log/syslog | tail -10

# 或手動執行一次驗證
cd /path/to/project/monitor && ./auto-update.sh
```

---

## 第 5 步：監控儀表板（查看進度）

### 5.1 查看失敗日誌（實時）

```bash
# 檢視當前失敗日誌
python3 /path/to/monitor/workflow-monitor.py --mode review-log

# 輸出示例：
# ============================================================
# 失敗日誌檢視
# ============================================================
# 
# 📊 統計：失敗 5 次，邊界案例 2 個
# 
# 🔴 CRITICAL (2 起)：
#    2026-06-25 tool_report.html: React version mismatch
#    2026-06-24 tool_feedback.html: GAS action conflict
# 
# 🟡 IMPORTANT (3 起)：
#    2026-06-25 index.html: empId not passed
#    2026-06-23 tool_report.html: image upload failed
#    2026-06-22 tool_feedback.html: permission undefined
# 
# 💡 提示：執行 `python3 workflow-monitor.py --mode auto-learn` 自動觸發學習
```

### 5.2 查看自動更新日誌

```bash
# 查看最後的自動更新摘要
cat /tmp/auto-update-summary.txt

# 查看詳細執行日誌
tail -50 /tmp/auto-update.log

# 查看最後的通知
cat /tmp/skill-update-notification.txt
```

### 5.3 檢視技能版本歷史

```bash
# 查看最新的技能版本
head -50 /mnt/skills/user/tianying-tool-converter/SKILL.md | grep "^## 更新歷史" -A 20

# 應看到最新迭代的記錄：
# ## 更新歷史
# 
# ### v1.5 (2026-06-25，自動迭代第 8 輪)
# **新增規則**：3 個
# - 規則：Vue 3 UMD 支援 (important)
# - 規則：GAS doPost 衝突檢測 (critical)
# - 規則：empId 三層解析 (important)
# **驗證**：✅ 回歸測試通過
```

---

## 第 6 步：緊急控制與回滾

### 6.1 臨時停止自動化

若需要臨時暫停自動學習（如進行大規模改動）：

```bash
# 方式 1：停用 cron
crontab -e
# 註解掉 auto-update.sh 那行
# # 0 */6 * * * cd /path/to/project/monitor && ./auto-update.sh

# 方式 2：移除失敗日誌（暫停積累）
rm /tmp/failure-log.json

# 方式 3：改配置阈值（提高觸發標準）
# 編輯 monitor-config.yaml
# critical_threshold: 10  # 改為 10，幾乎不會觸發
```

### 6.2 手動回滾（若自動更新出錯）

```bash
# 1. 查看版本歷史
grep "^### v" /mnt/skills/user/tianying-tool-converter/SKILL.md

# 2. 備份當前版本
cp /mnt/skills/user/tianying-tool-converter/SKILL.md \
   /mnt/skills/user/tianying-tool-converter/SKILL_backup_$(date +%s).md

# 3. 手動編輯，移除有問題的規則
# 或從備份恢復
# cp /mnt/skills/user/tianying-tool-converter/SKILL_backup_*.md \
#    /mnt/skills/user/tianying-tool-converter/SKILL.md

# 4. 清空或重置失敗日誌
rm /tmp/failure-log.json
echo '{"failures": [], "last_updated": null}' > /tmp/failure-log.json
```

---

## 第 7 步：可選增強 — Slack 通知

若想在技能自動更新時收到 Slack 消息：

### 7.1 建立 Slack Webhook

1. 進入 Slack 工作區設定
2. 建立 Incoming Webhook：https://api.slack.com/messaging/webhooks
3. 複製 Webhook URL

### 7.2 配置通知

編輯 `monitor-config.yaml`：

```yaml
notification:
  channels:
    - type: "slack"
      webhook_url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
      enabled: true
```

之後每次自動更新時，會自動發送 Slack 消息：

```
🚀 技能自動更新完成

版本：v1.5 (2026-06-25，自動迭代第 8 輪)
新增規則：3 個

已啟用的新規則：
  - 規則：Vue 3 UMD 支援 (important)
  - 規則：GAS doPost 衝突檢測 (critical)
  - 規則：empId 三層解析 (important)

下次執行 tianying-tool-converter 時自動啟用此規則。
```

---

## 典型日常流程

### Day 1：上傳新工具

```bash
# 你上傳一個新工具
# Claude 自動調用 tianying-tool-converter

# ✅ 成功 → 輸出可貼上版本
# ❌ 失敗 → 自動記錄到日誌
```

### Day 2：自動掃描（自動化，無需你操作）

```bash
# 6 小時後，auto-update.sh 自動執行
# 掃描失敗日誌：3 個 critical，1 個 important
# 判斷：critical ≥2 → 觸發自動學習
# 執行 skill-updater：萃取規則 → diff 檢查 → 版本化 → 回歸測試
# 結果：✅ v1.5 已部署
# 通知：Slack / 檔案已寄出
```

### Day 3：下次轉換時自動生效

```bash
# 你上傳另一個工具
# Claude 調用 tianying-tool-converter
# 新版本已內含昨天學到的規則
# ✅ 覆蓋更多邊界案例、轉換成功率更高
```

---

## 常見問題

### Q: Cron 沒有執行怎麼辦？

```bash
# 1. 檢查 crontab 是否設定
crontab -l

# 2. 檢查 cron daemon 是否執行
pgrep cron || echo "cron 未執行"

# 3. 手動執行驗證
/path/to/project/monitor/auto-update.sh

# 4. 檢查日誌（MacOS）
log stream --predicate 'process == "cron"' --level debug
```

### Q: 失敗日誌遺漏了某次失敗怎麼辦？

等級 3 設計上不會遺漏 — 所有轉換都會通過 `workflow-monitor.py` 記錄。
若某次失敗未被記錄，可手動補錄：

```bash
python3 /path/to/monitor/workflow-monitor.py --mode convert \
    --tool "tool_feedback.html" \
    --error-type "某種錯誤" \
    --error-msg "詳細訊息" \
    --priority "critical"
```

### Q: 技能更新太頻繁怎麼辦？

降低自動觸發頻率，編輯 `monitor-config.yaml`：

```yaml
auto_trigger:
  critical_threshold: 5        # 改為 5（更難觸發）
  important_threshold: 10
  time_based: "0 0 * * *"     # 改為每天一次（而非每 6 小時）
  
safety:
  max_iterations_per_day: 1    # 每天最多 1 次迭代
```

### Q: 我想手動查看學習過程怎麼辦？

```bash
# 手動觸發一次自動學習
python3 /path/to/monitor/workflow-monitor.py --mode auto-learn

# 輸出會顯示完整過程：
# 🤖 自動學習觸發：5 項待處理
# 分類統計：
#   🔴 Critical: 2 個 → 必須處理
#   🟡 Important: 3 個 → 優先處理
# ⚡ Critical 項達 2 個，自動觸發學習
# 🔧 開始自動更新...
# ... (完整過程)
# ✅ 自動更新完成！v1.5 已部署
```

---

## 與等級 1 & 2 的對比

| 功能 | 等級 1（手動） | 等級 2（半自動） | 等級 3（完全自動） |
|------|---|---|---|
| 失敗捕獲 | 手動報告 | 自動記錄 | ✅ 自動記錄 + 無遺漏 |
| 學習觸發 | 手動說「學習」 | 定期掃描 | ✅ 自動掃描 + 自動觸發 |
| 版本化更新 | 手動確認 | 自動（有檢查點） | ✅ 完全自動 |
| 通知 | 無 | 人工檢視 | ✅ 自動通知（Slack/檔案） |
| 維護負擔 | 高（需記得說） | 中（定期檢視） | ✅ 低（監控 → 通知） |
| 規則覆蓋 | 慢 | 中等 | ✅ 快速成長 |
| 適用場景 | 低頻工具開發 | 中頻改進 | ✅ 持續迭代（推薦） |

---

## 安全承諾

即使完全自動化，系統也有多重保護：

1. **回歸測試必通過** → 無法部署有問題的更新
2. **衝突檢測** → 有衝突時暫停，等人工確認
3. **自動備份** → 更新前自動備份 SKILL.md
4. **日誌完整** → 每次迭代都記錄「什麼時候、誰改了、為什麼改」
5. **版本可溯** → 任何時候都能回滾到前一版本

---

## 下一步

1. **立即部署**：執行第 1~5 步（15 分鐘）
2. **監控 24 小時**：確保 cron 正常執行、通知收到
3. **調整配置**：根據實際情況微調阈值（可選）
4. **增加增強**：啟用 Slack 通知、郵件提醒（可選）

完成後，系統將自動運行 — **你只需要上傳工具，其他都交給我**。

