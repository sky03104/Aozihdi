# CLAUDE.md: Tianying Security Codebase Guide

**Project**: Tianying Security Tool Conversion & Monitoring System (天鷹保全)
**Version**: 3.0 - Fully Automated
**Last Updated**: 2026-06-22
**Language**: English + Traditional Chinese (繁體中文)

---

## 👥 Team Structure & Roles

AI assistants operate as a **5-role development team** for code quality and compliance:

| 角色 | 責任 | 準則 |
|------|------|------|
| 💻 **資深全端工程師** | 系統架構設計、HTML前端、GAS、GitHub Pages部署 | 純HTML框架（非React JSX）、SheetJS Excel解析、Google試算表主鍵為純數字 |
| 🎨 **UI/UX視覺設計師** | 品牌識別、暗色系色彩、Mobile-First極致體感 | Glassmorphism玻璃擬態、完美RWD等比例縮放、行動端絕不破版 |
| 🧪 **QA測試工程師** | 沙盒模擬、100%零錯誤交付 | HTML標籤閉合、Tabler Icons、URLSearchParams解析、去重機制、node --check驗證 |
| 📋 **專案經理** | 進度追蹤、待辦事項管理 | 每次回報附進度摘要、主動提醒尚未完成功能 |
| 💡 **創意總監** | 延伸功能建議、業務相關創意 | 簡短列點呈現、聚焦實際業務且技術可行 |

---

## 📋 Quick Overview

This repository implements a **Level 3 Fully Automated Tool Conversion System** for Tianying Security (天鷹保全) APP. The system:

- **Automatically converts** external web tools to comply with Tianying APP standards
- **Monitors failures** and logs them to a central database
- **Auto-learns** from failures every 6 hours
- **Updates skills** without human intervention
- **Tracks versions** and maintains regression test history

**Key Principle**: "Upload Tool → Auto Convert → Failure Auto-Logged → Learn Every 6 Hours → Skills Evolve → Next Time Smarter"

---

## 🗂️ Repository Structure

```
tianying-security/
├── CLAUDE.md                          ← You are here
├── README.md                          ← Brief intro
├── icon.png                           ← Brand logo
├── manifest.json                      ← PWA manifest
├── index.html                         ← Main dashboard
├── post.html                          ← Post/report tool
├── liff_leave.html                    ← LINE LIFF leave tool
├── tool_car.html                      ← Vehicle/car tool
├── tool_signin.html                   ← Sign-in tool
├── tool_work.html                     ← Work tracking tool
├── tool_report.html                   ← Report tool (example)
├── tool_feedback.html                 ← Feedback tool
│
└── tianying-monitor/                  ← Main automation system
    ├── README.md                      ← System documentation (English)
    ├── README_TW.md                   ← Documentation (繁體中文)
    ├── project-state.md               ← Auto-generated snapshot
    ├── project-snapshots/             ← Version snapshots
    │   └── 2026-06-22_v1.md
    │
    ├── 📜 Configuration & Setup
    ├── setup.bat                      ← Windows one-click setup
    ├── setup.sh                       ← Mac/Linux one-click setup
    ├── monitor-config.yaml            ← Monitoring configuration
    ├── .gitignore                     ← Git ignore rules
    │
    ├── 🔄 Core Automation Scripts
    ├── workflow-monitor.py            ← Main monitoring engine
    ├── auto-update.sh                 ← Scheduled update runner
    ├── skill-version-manager.py       ← Version management
    ├── failure-classifier.py          ← Failure categorization
    ├── regression-tester.py           ← Regression testing
    │
    ├── 📊 Reporting & Analysis
    ├── snapshot-generator-simple.py   ← Project state snapshot
    ├── auto-snapshot-runner-simple.py ← Snapshot scheduler
    ├── delivery-detector-simple.py    ← Delivery detection
    ├── regression-history.json        ← Historical test results
    │
    ├── 📚 Skills (AI Assistant Definitions)
    ├── skills/
    │   ├── tianying-tool-converter.md     ← Tool conversion skill
    │   └── skill-updater.md               ← Auto-learning skill
    ├── SKILL_tianying-tool-converter.md   ← Copy for reference
    ├── SKILL_skill-updater.md             ← Copy for reference
    │
    ├── 📖 Documentation
    ├── LEVEL3_CHECKLIST_ARCHITECTURE.md   ← Deployment checklist + architecture
    ├── DEPLOYMENT_GUIDE_LEVEL3.md         ← Full deployment guide
    ├── GOOGLE_DRIVE_SETUP_GUIDE.md        ← Google Drive integration
    ├── GitHub_Upload_Guide_TW.md          ← GitHub upload guide (Chinese)
    │
    └── 📁 Logs & Data (auto-generated)
        └── logs/                      ← Execution logs
        
```

---

## 🎯 Core Components Explained

### 1. **workflow-monitor.py** - The Monitoring Engine

**Purpose**: Monitors tool conversions and captures failures.

**Key Functions**:
- `_load_failure_log()` - Load failure history from JSON
- `_save_failure_log()` - Persist failures to disk
- `review_failure_log()` - Display summary of failures
- `auto_learn()` - Trigger skill updates when thresholds met
- `convert_tool()` - Monitor a single tool conversion

**Usage**:
```bash
# View failure log
python3 workflow-monitor.py --mode review-log

# Auto-learn and update skills
python3 workflow-monitor.py --mode auto-learn

# Convert a specific tool (with monitoring)
python3 workflow-monitor.py --mode convert --tool tool_report.html
```

**Key Thresholds** (in `monitor-config.yaml`):
- `critical_threshold: 2` - 2 critical errors trigger auto-learn
- `important_threshold: 4` - 4 important errors trigger auto-learn

### 2. **skill-version-manager.py** - Version Control

**Purpose**: Manages skill versions and merges new rules without conflicts.

**Key Features**:
- Semantic versioning (v1.0, v1.1, v1.2, etc.)
- Changelog generation with timestamps
- Conflict detection before updates
- Auto-backup of previous versions
- Regression testing before deployment

**Version Format**: `v{major}.{minor} ({date}，自動迭代第 {iteration} 輪)`
- Example: `v1.2 (2026-06-25，自動迭代第 5 輪)`

### 3. **regression-tester.py** - Quality Assurance

**Purpose**: Validates skill updates don't break existing functionality.

**Required Checks**:
- `frontmatter_exists` - YAML frontmatter present
- `section_structure_valid` - Markdown structure intact
- `file_size_ok` - File not corrupted
- `no_duplicate_rules` - No duplicate conversion rules
- `all_dates_valid` - All timestamps valid ISO format
- `all_priorities_valid` - All priorities are "critical" or "important"

**Behavior**: Fails on error = True (updates blocked if tests fail)

### 4. **failure-classifier.py** - Categorization

**Purpose**: Categorizes failures into sections for targeted learning.

**Priority Levels**:
- **critical** - Blocks tool conversion (≥2 triggers learning)
- **important** - Degrades functionality (≥4 triggers learning)

**Predefined Sections**:
- SOP 驗證 (Process verification)
- 規範檢查清單 (Standards checklist)
- 品牌規範 (Brand standards)
- GAS 設計方案 (Google Apps Script design)
- 工號狀態傳遞修正 (Employee ID status transfer)
- 照片上傳統一方案 (Photo upload standard)
- 權限規劃 (Permission planning)

### 5. **monitor-config.yaml** - Configuration Hub

**Key Sections**:

```yaml
monitoring:
  failure_patterns:
    - pattern: "node --check failed"
      priority: "critical"
      section: "SOP 驗證"
    # ... more patterns

auto_trigger:
  critical_threshold: 2
  important_threshold: 4
  time_based: "0 */6 * * *"  # Cron format
  batch_size: 5

versioning:
  format: "v{major}.{minor} ({date}，自動迭代第 {iteration} 輪)"
  max_iterations_per_day: 3

regression_test:
  enabled: true
  fail_on_error: true
```

---

## 🔄 Development Workflow

### Typical AI Assistant Tasks

#### Task 1: Update Failure Patterns
**When**: New failure type discovered
**How**:
1. Add new pattern to `monitoring.failure_patterns` in `monitor-config.yaml`
2. Update the corresponding skill in `skills/*.md`
3. Add regression test case in `regression-tester.py`
4. Verify with: `python3 workflow-monitor.py --mode review-log`

#### Task 2: Enhance Tool Conversion Skill
**When**: Conversion fails on specific tool
**How**:
1. Review failure in `failure-log.json`
2. Update `skills/tianying-tool-converter.md`
3. Add new rule to checklist or workflow
4. Run regression tests: `python3 regression-tester.py`
5. Manually test on sample tool

#### Task 3: Improve Auto-Learning Algorithm
**When**: Skill not learning from failures effectively
**How**:
1. Analyze recent failures with `failure-classifier.py`
2. Update extraction logic in `skill-version-manager.py`
3. Adjust thresholds in `monitor-config.yaml`
4. Test with: `python3 workflow-monitor.py --mode auto-learn`

#### Task 4: Add New Failure Detection
**When**: System missing detection for new error type
**How**:
1. Identify failure pattern
2. Add to `failure_patterns` in `monitor-config.yaml`
3. Update failure classifier to categorize it
4. Create test case
5. Verify detection with sample input

---

## 🛠️ Development & Output Standards

### 編碼規範
1. **完整可直接貼上程式碼**：絕不省略、截斷或使用「其餘保持不變」
2. **修改前說明**：修改內容、影響範圍、關鍵決策理由
3. **中文註解與變數**：所有註解、變數說明、UI文字均為繁體中文
4. **成功/失敗反饋**：成功用綠色#4ADE80、失敗用紅色#F87171，必須有Toast/Modal提示
5. **程式碼交付格式**：檔名、存放位置、貼上說明，包含完整路徑

### 天鷹保全設計規範

**色彩系統**:
```
背景        #0A0C10 / #0D0F14
主色（金）  #D4A800 / #FFD700 / #F0C040
副色（靛）  #818CF8 / #6366F1
成功綠      #4ADE80 | #22C55E
錯誤紅      #F87171 | #E53E3E
警告橙      #FB923C
文字        #F5F5F5 / #F0EDE6
```

**元件與風格**:
- **字型**: Microsoft JhengHei, Noto Sans TC, sans-serif
- **圖示**: Tabler Icons (npm: @tabler/icons)
- **主按鈕**: 金色漸層 (linear-gradient(135deg, #D4A800 0%, #FFD700 100%))
- **副按鈕**: 靛藍漸層 (linear-gradient(135deg, #818CF8 0%, #6366F1 100%))
- **卡片**: Glassmorphism 低透明白色邊框 (rgba(255,255,255,0.1))
- **品牌**: 天鷹保全 / TIANYING SECURITY · DATA SYSTEM

**RWD要求**:
- LOGO與外框: `max-width:100%, height:auto, object-fit:contain`
- 行動端: 絕不破版溢出
- Splash動畫: 同心圓旋轉金色光環 (ring1順時2.4s, ring2逆時1.8s, ring3順時3s)

### 通訊模式

**穴居人高密度對話**：極度精簡、無客套話、高資訊密度
- 直接切入重點，不寒暄不重述
- 極致優化Token消耗
- 使用繁體中文

---

## 📚 Key Concepts & Conventions

### 1. Skill Format

All skills follow YAML frontmatter + Markdown:

```markdown
---
name: skill-name
description: What this skill does
---

# Skill Title

[Content in Markdown format]
```

**Location**: `skills/*.md` (local) & `/mnt/skills/user/*/SKILL.md` (deployed)

### 2. Failure Log Format

```json
{
  "failures": [
    {
      "id": "unique-id",
      "timestamp": "2026-06-22T10:30:45.123Z",
      "tool": "tool_report.html",
      "type": "critical",
      "section": "品牌規範",
      "pattern": "React version mismatch",
      "error_message": "...",
      "context": {...},
      "learned": false,
      "version": "v1.0"
    }
  ],
  "last_updated": "2026-06-22T10:30:45.123Z"
}
```

**Location**: `/tmp/failure-log.json` (local) & `/mnt/user-data/outputs/failure-log.json` (cloud)

### 3. Version History Format

```yaml
# In SKILL.md under "## 更新歷史"

## 更新歷史

### v1.2 (2026-06-25，自動迭代第 5 輪)
- Fixed React 19 UMD detection (critical)
- Improved GAS action conflict handling (critical)
- Added empId pass-through validation (important)

### v1.1 (2026-06-23，自動迭代第 2 輪)
- Initial learning from first failures

### v1.0 (2026-06-22)
- Initial release with core conversion workflow
```

### 4. Configuration Naming Conventions

```yaml
paths:
  monitor_dir: "/mnt/user-data/outputs"      # Tool outputs to monitor
  failure_log: "/tmp/failure-log.json"       # Failure database
  skill_path: "/mnt/skills/user/*/SKILL.md"  # Skill location
  notify_file: "/tmp/skill-update-notification.txt"  # Notifications

# Note: /tmp on Linux = temporary (cleared on reboot)
# /mnt/user-data = persistent cloud storage
```

### 5. Tool Format Standards

所有HTML工具必須遵守以下結構與檢查清單：

**基礎框架**：
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>天鷹保全 · [工具名稱]</title>
  
  <!-- React 18.3.1 (絕對禁止 19.x) -->
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  
  <!-- Tabler Icons -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/tabler-icons.css">
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #0A0C10; 
      color: #F5F5F5; 
      font-family: 'Microsoft JhengHei', 'Noto Sans TC', sans-serif;
    }
  </style>
</head>
<body id="root">
  <!-- App content -->
</body>
</html>
```

**QA檢查清單**：
- ✅ HTML標籤完整閉合（不能有 `<div>` 未配 `</div>`）
- ✅ Tabler Icons 正確引入
- ✅ URLSearchParams 解析 `?empId=` 工號狀態傳遞
- ✅ 返回主選單按鈕（保留工號狀態，不遺失）
- ✅ 大量複製貼上防重去重機制 (Deduplication)
- ✅ `node --check` 語法驗證通過
- ✅ React 版本必須 18.3.1（非19.x）
- ✅ 行動端RWD無破版溢出
- ✅ Glassmorphism卡片實作完整
- ✅ 成功/失敗用色精確（綠#4ADE80/紅#F87171）

**驗證命令**：
```bash
# React版本驗證
grep -c "react/18.3.1" tool_*.html  # 應 ≥1
grep -c "19.0.0\|19.1" tool_*.html  # 應 0（任何19版本都是bug）

# 語法驗證
node --check tool_report.html

# 標籤閉合檢查
grep -o '<[^/>]*>' tool_report.html | grep -v '/>' | sort | uniq -c
```

---

## 🔧 Google Apps Script (GAS) 標準

所有GAS後端均需遵守以下規範：

### doPost 函數簽名
```javascript
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, empId, data } = payload;
    
    // 驗證empId（工號必傳）
    if (!empId) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', msg: '工號遺失' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 動作路由
    switch(action) {
      case 'submit':
        return handleSubmit(empId, data);
      case 'update':
        return handleUpdate(empId, data);
      default:
        throw new Error(`未知動作: ${action}`);
    }
  } catch(err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', msg: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### 試算表主鍵規範
- **主鍵型態**：純數字流水號 (1, 2, 3, ...)
- **禁止**：UUID (e.g. "a1b2c3d4-e5f6..."), 隨機英數字串
- **生成方式**：`lastRow() + 1` 或自增欄位

### 前後端通訊格式
```javascript
// 前端送出
const payload = {
  action: 'submit',
  empId: '12345',  // 必傳
  data: {
    title: '事故報告',
    description: '...',
    timestamp: new Date().toISOString()
  }
};

// GAS回應（統一JSON格式）
{
  status: 'ok' | 'error',
  msg: '訊息文字',
  data: {...}  // 可選，返回新資料
}
```

### 工號狀態傳遞檢查
- ✅ 前端URLSearchParams解析 `?empId=12345`
- ✅ GAS接收empId並驗證（非空、非null）
- ✅ 後續操作均記錄empId
- ✅ 返回前端時保留empId在返回URL中
- ✅ 返回按鈕不遺失工號狀態

### 照片/檔案上傳規範
- **統一資料夾**：Google Drive 公告資料夾 (1K_RR…)
- **存放命名**：`[日期]_[工號]_[功能名稱].png`
- **驗證**：上傳前檢查檔案大小、格式
- **錯誤回應**：上傳失敗時返回明確錯誤訊息

---

## 🚀 Deployment & Scheduling

### One-Click Setup (Recommended)

**Windows**:
```bash
# Double-click setup.bat
# Creates Task Scheduler job
# Runs every 6 hours automatically
```

**Mac/Linux**:
```bash
chmod +x setup.sh
./setup.sh
# Sets up crontab entry: 0 */6 * * * /path/to/auto-update.sh
```

### Manual Cron Setup

```bash
crontab -e

# Add this line:
# 0 */6 * * * cd /path/to/tianying-monitor && python3 workflow-monitor.py --mode auto-learn

# Verify:
crontab -l | grep workflow-monitor
```

### Verify Deployment

```bash
# Test monitoring
python3 workflow-monitor.py --mode review-log

# Should show:
# ✅ No failure records (System running well)
# OR
# Found X failures (Y critical, Z important)

# Test learning
python3 workflow-monitor.py --mode auto-learn

# Check cron/Task Scheduler
crontab -l          # Linux/Mac
schtasks /query     # Windows
```

---

## 🎯 Team Operational Workflows

### 📋 專案經理職責流程

**每次工作完成後**：
1. 附上進度摘要 (已完成 / 進行中 / 待辦)
2. 列舉已完成項目
3. 主動提醒尚未完成功能
4. 標註下一步行動

**範例回報格式**：
```
## 進度摘要
✅ 已完成：
- HTML框架建立 + React18.3.1整合
- Tabler Icons引入與測試
- 工號解析實作

🔄 進行中：
- GAS後端編寫（50%）
- 照片上傳流程

⏳ 待辦：
- 完整QA測試
- 部署到GitHub Pages
```

### 💡 創意總監延伸建議

**何時提出建議**：
- 完成功能後，延伸相關可行功能
- 聚焦對天鷹保全業務有幫助方向
- 技術上可實現（HTML+GAS範圍內）

**建議呈現格式**：簡短列點，不超過3項
```
💡 建議延伸功能：
• [功能1]：[簡述用途] → 預計工時X小時
• [功能2]：[簡述用途] → 預計工時X小時
• [功能3]：[簡述用途] → 預計工時X小時
```

---

## 📖 Common AI Assistant Tasks & Workflows

### When a User Says...

#### "A tool conversion is failing"

**Steps**:
1. Run: `python3 workflow-monitor.py --mode review-log`
2. Look for recent failures with `"learned": false`
3. Examine the failure's `error_message` and `context`
4. Check if error matches known pattern in `monitor-config.yaml`
5. If new pattern: Add to `failure_patterns` and update skill
6. If known pattern: Check skill version, may need to manually trigger update

#### "Update the tool conversion skill with new rules"

**Steps**:
1. Review existing rules in `skills/tianying-tool-converter.md`
2. Add new section or enhance existing workflow
3. Test changes locally if possible
4. Update version in frontmatter
5. Add changelog entry under "## 更新歷史"
6. Run regression tests: `python3 regression-tester.py`
7. Push to branch (not main yet)

#### "Create a new failure pattern"

**Steps**:
1. Define pattern name (e.g., "React version mismatch")
2. Add to `monitor-config.yaml` under `failure_patterns`
3. Update `failure-classifier.py` if categorization is complex
4. Add detection logic to relevant skill
5. Create test case in regression test suite
6. Verify with: `python3 failure-classifier.py --pattern "new pattern" --input test.html`

#### "Deploy system to new computer"

**Steps**:
1. Clone repository: `git clone https://github.com/sky03104/tianying-security.git`
2. Navigate: `cd tianying-security/tianying-monitor`
3. Run setup: `bash setup.sh` (Mac/Linux) or `setup.bat` (Windows)
4. Verify: `python3 workflow-monitor.py --mode review-log`
5. Check schedule: `crontab -l` (Mac/Linux) or Task Scheduler (Windows)

#### "Fix a merge conflict in SKILL.md"

**Steps**:
1. Open conflicted file
2. Review both versions using version manager: `python3 skill-version-manager.py --analyze-conflict`
3. Manually merge preserving both:
   - Frontmatter (metadata)
   - All sections and rules
   - Changelog (newer version wins)
4. Run regression tests: `python3 regression-tester.py`
5. Commit with message: "fix: resolve SKILL.md version conflict (manual merge)"

---

## 🔍 Troubleshooting Guide

### Python Not Found

```bash
# Check installation
python3 --version  # Should be 3.8+

# If not found, install:
# Ubuntu/Debian: sudo apt-get install python3
# Mac: brew install python3
# Windows: Download from python.org
```

### Schedule Not Running

**Linux/Mac**:
```bash
# Check crontab
crontab -l | grep workflow-monitor

# Check logs
cat /tmp/auto-update-summary.txt
tail -50 /tmp/tianying-auto-update.log

# Re-run setup
bash setup.sh
```

**Windows**:
```cmd
# Check Task Scheduler
schtasks /query /tn "tianying-auto-update" /v

# Check summary
type %temp%\auto-update-summary.txt

# Re-run setup
setup.bat
```

### Failures Not Being Captured

```bash
# Check failure log
python3 workflow-monitor.py --mode review-log

# Check thresholds in config
grep -A2 "auto_trigger:" monitor-config.yaml

# Manually test capture
python3 workflow-monitor.py --mode convert --tool test.html

# Check monitoring directory
ls -la /mnt/user-data/outputs/
```

### Regression Tests Failing

```bash
# Run tests with verbose output
python3 regression-tester.py --verbose

# Check specific test
python3 regression-tester.py --test frontmatter_exists --file skills/skill.md

# View test results
cat regression-history.json
```

---

## 📊 Key Directories & Their Purpose

| Directory | Purpose | Notes |
|-----------|---------|-------|
| `/mnt/user-data/outputs` | Tool conversion outputs | Cloud storage, monitored |
| `/tmp/failure-log.json` | Failure database (temporary) | Cleared on reboot |
| `/mnt/skills/user/*/SKILL.md` | Deployed skills | Live in production |
| `skills/` | Local skill copies | For version control |
| `logs/` | Execution logs | Auto-generated |
| `project-snapshots/` | State snapshots | Auto-generated, versioned |

---

## 🔐 Security & Best Practices

### When Modifying Configuration

- **Never hardcode secrets** in YAML or Python files
- **Use environment variables** for API keys, webhooks
- **Validate all file paths** before reading/writing
- **Check permissions** before deploying to `/mnt/` paths

### When Updating Skills

- **Always run regression tests** before committing
- **Maintain backward compatibility** in failure detection
- **Document breaking changes** in changelog
- **Test on sample tools** before wide deployment

### When Handling Failures

- **Never delete failure records** automatically
- **Archive old failures** quarterly
- **Preserve error messages** for analysis
- **Keep timestamps** for audit trail

---

## 🎓 Learning Resources

### Documentation Files (In Order of Importance)

1. **README.md** - Quick start guide
2. **LEVEL3_CHECKLIST_ARCHITECTURE.md** - System architecture & deployment checklist
3. **DEPLOYMENT_GUIDE_LEVEL3.md** - Detailed deployment instructions
4. **SKILL_tianying-tool-converter.md** - Tool conversion reference
5. **SKILL_skill-updater.md** - Auto-learning process reference

### Key Skills to Understand

```
SKILL_tianying-tool-converter.md
  ├─ Brand Standards (React 18.3.1, Splash, Colors)
  ├─ Conversion Workflow (7 steps)
  └─ Checklist & Validation

SKILL_skill-updater.md
  ├─ Learning Algorithm
  ├─ Version Management
  └─ Regression Testing
```

---

## 📝 Common Git Workflows

### Before Starting Work

```bash
# Check current branch
git branch

# Update from remote
git fetch origin claude/claude-md-docs-4bz58p
git pull origin claude/claude-md-docs-4bz58p

# Verify you're on the right branch
git status
```

### Making Changes

```bash
# Make your changes to files
# Then stage them
git add tianying-monitor/workflow-monitor.py

# Commit with clear message
git commit -m "fix: improve failure detection for React version mismatch"

# Push to your branch
git push -u origin claude/claude-md-docs-4bz58p
```

### Commit Message Conventions

```
feat:  New feature (e.g., "feat: add Slack notification support")
fix:   Bug fix (e.g., "fix: resolve SKILL.md merge conflict")
chore: Maintenance (e.g., "chore: update regression test cases")
docs:  Documentation (e.g., "docs: update deployment guide")
refactor: Code cleanup (e.g., "refactor: simplify failure classifier")
test:  Test updates (e.g., "test: add case for React 19 detection")
```

---

## ✅ QA檢查清單 (Pre-Push Validation)

**程式碼品質**：
- [ ] 程式碼遵循現有模式（無創意破格）
- [ ] Python語法有效：`python3 -m py_compile file.py`
- [ ] YAML有效：`python3 -c "import yaml; yaml.safe_load(open('file.yaml'))"`
- [ ] Markdown正確frontmatter
- [ ] 回歸測試通過：`python3 regression-tester.py`
- [ ] 失敗日誌仍可讀：`python3 workflow-monitor.py --mode review-log`

**HTML/前端工具**：
- [ ] HTML標籤完整閉合，無遺漏
- [ ] React版本確認為18.3.1（非19.x）
- [ ] Tabler Icons正確引入
- [ ] URLSearchParams正確解析 `?empId=`
- [ ] 返回按鈕保留工號狀態
- [ ] 色彩精確（#4ADE80成功/紅#F87171失敗）
- [ ] Toast/Modal提示完整
- [ ] 行動端RWD無破版
- [ ] 去重機制(Deduplication)實作

**GAS後端**：
- [ ] doPost/doGet函數簽名正確
- [ ] JSON解析/序列化無誤
- [ ] 試算表主鍵為純數字（非UUID）
- [ ] 工號狀態正確傳遞回前端
- [ ] 錯誤處理完整（不返回null）

**文件與通訊**：
- [ ] 提交訊息遵循約定（feat/fix/chore/docs）
- [ ] 變更說明清晰（修改內容+影響範圍）
- [ ] 所有註解均為繁體中文
- [ ] 完整可直接貼上程式碼（無省略）
- [ ] 功能不破壞既有運作

---

## 🔗 Quick Reference

### File Paths (Most Common)

```
Project Root:
  /home/user/tianying-security/

Main System:
  /home/user/tianying-security/tianying-monitor/

Configuration:
  ./monitor-config.yaml

Python Scripts:
  ./workflow-monitor.py
  ./skill-version-manager.py
  ./regression-tester.py
  ./failure-classifier.py

Skills:
  ./skills/tianying-tool-converter.md
  ./skills/skill-updater.md

Documentation:
  ./README.md
  ./LEVEL3_CHECKLIST_ARCHITECTURE.md
  ./DEPLOYMENT_GUIDE_LEVEL3.md

Logs (generated):
  /tmp/failure-log.json
  /tmp/auto-update-summary.txt
  /tmp/tianying-auto-update.log
```

### Common Commands

```bash
# Monitoring
python3 workflow-monitor.py --mode review-log

# Learning
python3 workflow-monitor.py --mode auto-learn

# Testing
python3 regression-tester.py

# Version Management
python3 skill-version-manager.py --list-versions

# Classification
python3 failure-classifier.py --analyze

# Snapshots
python3 snapshot-generator-simple.py
```

---

## 🎯 Next Steps for AI Assistants

1. **First Read**: Review `README.md` for quick overview
2. **Then Read**: Study `LEVEL3_CHECKLIST_ARCHITECTURE.md` for system design
3. **Deep Dive**: Review both skills in `skills/` directory
4. **Practice**: Try running monitoring commands locally
5. **Contribute**: Make improvements to scripts or documentation

---

## 📞 Support & Issues

### When You're Stuck

1. Check the **Troubleshooting Guide** above
2. Review relevant **skill documentation** (SKILL_*.md)
3. Check **failure log**: `python3 workflow-monitor.py --mode review-log`
4. Review recent **git history**: `git log --oneline -10`
5. Check **regression test results**: `cat regression-history.json`

### Before Creating an Issue

- [ ] Reproduced the problem locally
- [ ] Checked existing issues/documentation
- [ ] Gathered error message and context
- [ ] Identified which component is affected

---

## 📝 待辦事項追蹤 (Backlog)

### 🔴 高優先 - UI優化

#### [TODO-01] 打烊後快速登錄工具 → 登錄介面明顯化
- 整體字型放大
- 欄位標題文字換色（專櫃/廠商 批次登記、進場時間、退場時間 等）
- 重點欄位（專櫃/廠商 批次登記、進場時間、退場時間）底色換色
- **位置**：`index.html` → `tpl-closing` (base64 解碼後)
- **狀態**：✅ 完成（2026-06-22）

#### [TODO-02] 打烊後快速登錄工具 → 今日介面明顯化
- 整體字型放大（參考標準：登錄介面右下角放大鏡施工單查詢的資料字大小）
- **位置**：`index.html` → `tpl-closing` 今日 tab
- **狀態**：✅ 完成（2026-06-22）

### 🟡 中優先 - 新工具開發

#### [TODO-03] 開店前快速登錄工具 → 資料庫共用評估（已評估，待確認）

**評估結果（2026-06-22）**：

打烊後快速登錄工具的三個資料庫：

| 資料庫 | localStorage key | 雲端同步 | Google Sheet |
|--------|-----------------|---------|-------------|
| 廠商／專櫃資料庫 | `hsh_shops` | ✅ 手動同步 | ID: `1TnN3iJb1w9XTuw0-QuNrtXEOa71KCCy7y8Q3_1b1FmI` |
| 監工人員資料庫 | `hsh_persons` | ✅ 手動同步 | 同上 |
| 檢查者資料庫 | `hsh_ins` | ✅ 手動同步 | 同上 |
| 施工類型 | `hsh_wt` | ✅ 手動同步 | 同上 |

**同步機制**：
- GAS URL: `AKfycbwZ5f7h_Lv_MOCxPrqPpBPKA917-JKmEz5DDekYixLDsGf1QAKCTOuVxwo18OYKX7a4ng/exec`
- 雲端同步為**手動觸發**（拉取/推送按鈕），不是即時自動
- 進出記錄自動寫入 Google Sheets（不需手動）
- 分頁名稱：`進出資料表`

**建議共用方案（確認後再動工）**：
- 方案A（推薦）：開店前工具使用**相同 GAS URL** → 共用廠商/監工/檢查者三個資料庫，只寫入不同分頁（`開店進出資料表`）
- 方案B：開店前工具讀取同一 localStorage，直接共享本地端資料，不需新增GAS
- 關鍵差異：進出記錄分頁名稱需區分（打烊用「進出資料表」，開店用「開店進出資料表」）

**等待確認後動工**

#### [TODO-04] 班表查詢工具 → 移除上傳功能
- 班表上傳 tab 目前僅 `canE`（管理員）角色可見（`k: "upload", l: "⬆ 上傳"`）
- 統一由「資料上傳工具」(`tpl-upload`) 上傳班表
- 做法：移除 `upload` tab 條件判斷，讓所有角色都不顯示上傳頁籤
- **位置**：`index.html` 班表功能 tabs 陣列（第18664行）
- **狀態**：✅ 完成（2026-06-22）

#### [TODO-05] 班表查詢工具 → 介面優化（字體、排版）
- 問題：字太小、排版雜亂，同事年紀大眼睛不好
- 需求：放大整體字型，簡化排版，增加行距與對比
- **位置**：`index.html` 班表功能 CSS + JSX
- **狀態**：⏳ 評估中（等確認設計方向）

### 🟠 需設計確認後再動工

#### [TODO-06] 主管帳號首頁 → 待審報告卡片（設計稿待確認）

**規格**：
- 條件：登入帳號為公司主管時，首頁四格卡片下面兩個改為：
  - 「待審報告」：讀取**事故報告**試算表，顯示未處理筆數
  - 「待審匿名回報」：讀取**匿名表揚/舉報**試算表，顯示未處理筆數
- 試算表需新增「狀態」欄位：`未讀` / `已讀` / `處理中` / `已處理`
- 首頁卡片顯示狀態 ≠ `已處理` 的筆數
- 主管可點進去查看列表 → 點單筆查看詳情 → 有按鈕可修改狀態

**需產出設計稿（等確認後才做 GAS 串接）**：
- [ ] 主管首頁卡片 UI
- [ ] 案件列表頁 UI
- [ ] 案件詳情頁 UI（含狀態修改按鈕）

**同步需修改**：
- `tool_report.html` GAS 試算表新增「狀態」欄位
- `tool_feedback.html` GAS 試算表新增「狀態」欄位
- **狀態**：⏳ 設計稿製作中（等確認再串接）

---

## 📄 Document Versions

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-22 | Initial CLAUDE.md creation |
| 1.1 | 2026-06-22 | 新增團隊架構、設計規範、GAS標準、TODO-01~06 |

---

**Last Updated**: 2026-06-22  
**For Questions**: Refer to project documentation or contact the project owner  
**Branch**: `claude/claude-md-docs-4bz58p`
