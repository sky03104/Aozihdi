# 天鷹保全 · 工具轉換監控系統

**自動化等級 3：完全無人工干預，零遺漏**

> 上傳工具 → 自動轉換 → 失敗自動記錄 → 6 小時後自動學習 → 技能進化 → 下次更聰明

---

## 📋 目錄結構

```
tianying-monitor/
├─ setup.bat              ← Windows 一鍵部署
├─ setup.sh               ← Mac/Linux 一鍵部署
├─ workflow-monitor.py    ← 監控核心引擎
├─ auto-update.sh         ← 自動執行腳本
├─ monitor-config.yaml    ← 配置檔（可調整）
├─ README.md              ← 英文文檔
├─ README_TW.md           ← 本文檔
├─ .gitignore            ← Git 忽略檔
└─ logs/                  ← 自動生成（執行日誌）
```

---

## 🚀 快速開始（3 步，3 分鐘）

### 步驟 1：下載整個資料夾

```bash
# 方式 A: 用 Git（推薦）
git clone https://github.com/sky03104/sky03104.github.io
cd sky03104.github.io/tianying-monitor

# 方式 B: 手動下載
# 到 GitHub 頁面下載整個 tianying-monitor 資料夾
```

### 步驟 2：執行一鍵部署

#### Windows：
雙擊 `setup.bat`，等待完成（自動檢查 Python、設定 Task Scheduler）

#### Mac/Linux：
```bash
bash setup.sh
# 或
chmod +x setup.sh && ./setup.sh
```

### 步驟 3：驗證成功

執行：
```bash
python3 workflow-monitor.py --mode review-log
```

應該看到：
```
============================================================
失敗日誌檢視
============================================================

✅ 無失敗記錄（系統運行良好）
```

✅ 完成！系統已自動運行。

---

## 📖 詳細說明

### 系統會做什麼？

```
【自動循環】（無需人工干預）

1️⃣  你上傳工具給 Claude
    ↓
2️⃣  Claude 自動轉換（天鷹 APP 規範）
    ↓
3️⃣  失敗？ → 自動記錄到中央日誌
    ↓
4️⃣  背景監控：每 6 小時掃描一次
    ↓
5️⃣  達到阈值？ → 自動觸發學習
    - critical ≥2 個
    - 或 important ≥4 個
    ↓
6️⃣  自動執行：
    - 萃取新規則
    - 驗證無衝突
    - 版本化合併
    - 回歸測試
    - 更新技能
    ↓
7️⃣  下次轉換時自動啟用新規則
    ↓
✅ 循環重複，技能越來越聰明
```

### 配置文件說明

編輯 `monitor-config.yaml` 調整：

```yaml
auto_trigger:
  critical_threshold: 2        # critical 錯誤 ≥2 個時觸發學習
  important_threshold: 4       # important 錯誤 ≥4 個時觸發學習
  time_based: "0 */6 * * *"   # 每 6 小時掃一次

notification:
  enabled: true
  channels:
    - type: "file"
      enabled: true            # 檔案通知（預設）
    - type: "slack"
      webhook_url: ""          # 可選：Slack 通知
      enabled: false
```

---

## 🛠️ 常用命令

### 查看失敗日誌
```bash
python3 workflow-monitor.py --mode review-log
```

### 手動觸發一次學習
```bash
python3 workflow-monitor.py --mode auto-learn
```

### 查看執行日誌

#### Windows：
```cmd
type %temp%\auto-update-summary.txt
```

#### Mac/Linux：
```bash
cat /tmp/auto-update-summary.txt
tail -50 /tmp/tianying-auto-update.log
```

### 驗證排程

#### Windows：
```cmd
schtasks /query /tn "tianying-auto-update" /v
```

#### Mac/Linux：
```bash
crontab -l
```

---

## 🔧 多台電腦同步

### 新電腦快速部署：

```bash
# 1. 克隆或下載
git clone https://github.com/sky03104/sky03104.github.io
cd sky03104.github.io/tianying-monitor

# 2. 一鍵部署
# Windows: 雙擊 setup.bat
# Mac/Linux: bash setup.sh

# 完成！技能會自動同步
```

### 所有電腦無需重新學習
- 技能（SKILL.md）存在 Claude 環境
- 只要登入 Claude，新規則自動生效
- 不用在每台電腦重新安裝技能

---

## ⚠️ 故障排查

### 排程沒有執行？

#### Windows：
```cmd
REM 檢查 Task Scheduler
schtasks /query /tn "tianying-auto-update"

REM 重新建立排程
setup.bat
```

#### Mac/Linux：
```bash
# 檢查 Cron
crontab -l | grep workflow-monitor

# 手動執行測試
python3 workflow-monitor.py --mode auto-learn
```

### Python 找不到？

```bash
# 檢查 Python 位置
which python3
which python

# 確認版本
python3 --version
# 應為 3.8+ 版本
```

### 排程執行了但沒有更新？

檢查失敗日誌是否達到阈值：
```bash
python3 workflow-monitor.py --mode review-log
```

阈值設定：
- critical ≥2 個才觸發
- 或 important ≥4 個才觸發

如要提前觸發，手動執行：
```bash
python3 workflow-monitor.py --mode auto-learn
```

---

## 📊 系統架構

```
Cloud（雲端/Claude 環境）
├─ SKILL_tianying-tool-converter.md （工具轉換技能）
├─ SKILL_skill-updater.md           （自動學習器）
└─ failure-log.json                 （失敗日誌）
   ↑
   │ 自動同步
   │
Local（你的電腦）
└─ tianying-monitor/
   ├─ workflow-monitor.py
   ├─ auto-update.sh
   ├─ monitor-config.yaml
   └─ logs/                          （本地執行日誌）
```

---

## 🔐 安全性

系統有多重保護：

1. **回歸測試必通過** → 無法部署有問題的更新
2. **Diff 檢查** → 偵測衝突，衝突時暫停等待人工確認
3. **自動備份** → 更新前自動備份 SKILL.md
4. **完整日誌** → 可追溯每次迭代的時間、原因、改動

---

## 📝 日常使用

### 你要做的事：
```
✅ 上傳工具給 Claude
✅ 定期檢視日誌（可選）
✅ 相信系統自動學習
```

### 你不用做的事：
```
❌ 手動觸發學習
❌ 手動更新技能
❌ 手動驗證回歸測試
❌ 手動建立版本

→ 全部自動化
```

---

## 🎯 長期收益

```
Week 1：手工轉換失敗
  → 自動記錄

Week 2：失敗積累到阈值
  → 自動觸發學習 → v1.1 誕生

Week 3：新規則生效
  → 新工具成功率提升 20%

Week 4-12：持續迭代
  → v1.2, v1.3, v1.4, ...
  → 覆蓋更多邊界案例
  → 技能完整度達 95%+

Month 3+：穩定運行
  → 新工具自動適配
  → 月迭代 1-2 次（維護級別）
```

---

## 📞 支援

遇到問題？

1. 檢查 **故障排查** 部分
2. 查看執行日誌
3. 手動執行一次測試：`python3 workflow-monitor.py --mode review-log`
4. 告訴我具體錯誤訊息

---

## 📜 版本歷史

- **v3.0** (2026-06-22)：完全自動化版本
  - Windows/Mac/Linux 一鍵部署
  - Task Scheduler / Cron 自動執行
  - GitHub 版本控制
  - 多台電腦同步

---

## 📄 授權

MIT License - 自由使用、修改、分享

---

**準備好了嗎？執行 `setup.bat` (Windows) 或 `bash setup.sh` (Mac/Linux)，開始自動化之旅！** 🚀
