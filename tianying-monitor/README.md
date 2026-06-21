# Tianying Security · Tool Conversion Monitoring System

**Automation Level 3: Fully Automated, Zero Manual Intervention**

> Upload Tool → Auto Convert → Failure Auto-Logged → Learn Every 6 Hours → Skills Evolve → Next Time Smarter

---

## 📋 Directory Structure

```
tianying-monitor/
├─ setup.bat              ← One-click deployment (Windows)
├─ setup.sh               ← One-click deployment (Mac/Linux)
├─ workflow-monitor.py    ← Monitoring core engine
├─ auto-update.sh         ← Auto-execution script
├─ monitor-config.yaml    ← Configuration (customizable)
├─ README.md              ← This file (English)
├─ README_TW.md           ← Chinese documentation
├─ .gitignore            ← Git ignore file
└─ logs/                  ← Auto-generated (execution logs)
```

---

## 🚀 Quick Start (3 Steps, 3 Minutes)

### Step 1: Download the Folder

```bash
# Method A: Using Git (Recommended)
git clone https://github.com/sky03104/sky03104.github.io
cd sky03104.github.io/tianying-monitor

# Method B: Manual download
# Download the entire tianying-monitor folder from GitHub
```

### Step 2: One-Click Deployment

#### Windows:
Double-click `setup.bat`, wait for completion (automatically checks Python, configures Task Scheduler)

#### Mac/Linux:
```bash
bash setup.sh
# or
chmod +x setup.sh && ./setup.sh
```

### Step 3: Verify Success

Run:
```bash
python3 workflow-monitor.py --mode review-log
```

You should see:
```
============================================================
Failure Log Review
============================================================

✅ No failure records (System running well)
```

✅ Done! System is automatically running.

---

## 📖 What Does This System Do?

```
【Automatic Loop】(Zero Manual Intervention)

1️⃣  You upload a tool to Claude
    ↓
2️⃣  Claude automatically converts it (Tianying APP standards)
    ↓
3️⃣  Failure? → Automatically logged to central log
    ↓
4️⃣  Background monitoring: Scans every 6 hours
    ↓
5️⃣  Threshold reached? → Automatically triggers learning
    - critical ≥2 errors
    - or important ≥4 errors
    ↓
6️⃣  Automatic execution:
    - Extract new rules
    - Verify no conflicts
    - Version-based merge
    - Regression testing
    - Update skills
    ↓
7️⃣  Next conversion auto-applies new rules
    ↓
✅ Loop repeats, skills get smarter
```

### Configuration File Explanation

Edit `monitor-config.yaml` to adjust:

```yaml
auto_trigger:
  critical_threshold: 2        # Trigger learning when ≥2 critical errors
  important_threshold: 4       # Trigger learning when ≥4 important errors
  time_based: "0 */6 * * *"   # Scan every 6 hours

notification:
  enabled: true
  channels:
    - type: "file"
      enabled: true            # File notification (default)
    - type: "slack"
      webhook_url: ""          # Optional: Slack notification
      enabled: false
```

---

## 🛠️ Common Commands

### View failure log
```bash
python3 workflow-monitor.py --mode review-log
```

### Manually trigger learning
```bash
python3 workflow-monitor.py --mode auto-learn
```

### View execution logs

#### Windows:
```cmd
type %temp%\auto-update-summary.txt
```

#### Mac/Linux:
```bash
cat /tmp/auto-update-summary.txt
tail -50 /tmp/tianying-auto-update.log
```

### Verify schedule

#### Windows:
```cmd
schtasks /query /tn "tianying-auto-update" /v
```

#### Mac/Linux:
```bash
crontab -l
```

---

## 🔄 Multi-Computer Synchronization

### Quick deployment on a new computer:

```bash
# 1. Clone or download
git clone https://github.com/sky03104/sky03104.github.io
cd sky03104.github.io/tianying-monitor

# 2. One-click deployment
# Windows: Double-click setup.bat
# Mac/Linux: bash setup.sh

# Done! Skills automatically sync
```

### No need to re-learn on every computer
- Skills (SKILL.md) exist in Claude environment
- Just log into Claude, new rules automatically take effect
- No need to reinstall skills on each computer

---

## ⚠️ Troubleshooting

### Schedule not running?

#### Windows:
```cmd
REM Check Task Scheduler
schtasks /query /tn "tianying-auto-update"

REM Recreate schedule
setup.bat
```

#### Mac/Linux:
```bash
# Check Cron
crontab -l | grep workflow-monitor

# Manually test
python3 workflow-monitor.py --mode auto-learn
```

### Python not found?

```bash
# Check Python location
which python3
which python

# Verify version
python3 --version
# Should be 3.8+ version
```

### Schedule ran but no updates?

Check if failure log reached threshold:
```bash
python3 workflow-monitor.py --mode review-log
```

Thresholds:
- critical ≥2 required to trigger
- or important ≥4 required to trigger

To trigger early, manually run:
```bash
python3 workflow-monitor.py --mode auto-learn
```

---

## 📊 System Architecture

```
Cloud (Claude Environment)
├─ SKILL_tianying-tool-converter.md  (Tool conversion skill)
├─ SKILL_skill-updater.md            (Auto-learning skill)
└─ failure-log.json                  (Failure log)
   ↑
   │ Auto-sync
   │
Local (Your Computer)
└─ tianying-monitor/
   ├─ workflow-monitor.py
   ├─ auto-update.sh
   ├─ monitor-config.yaml
   └─ logs/                          (Local execution logs)
```

---

## 🔐 Security

System has multiple protections:

1. **Regression tests must pass** → Cannot deploy broken updates
2. **Diff checking** → Detects conflicts, pauses waiting for manual confirmation
3. **Auto-backup** → Backs up SKILL.md before updating
4. **Complete logs** → Can trace every update's time, reason, changes

---

## 📝 Daily Usage

### What you do:
```
✅ Upload tools to Claude
✅ Periodically check logs (optional)
✅ Trust system auto-learning
```

### What you don't do:
```
❌ Manually trigger learning
❌ Manually update skills
❌ Manually verify regression tests
❌ Manually create versions

→ Everything is automated
```

---

## 🎯 Long-term Benefits

```
Week 1: Manual conversion failures
  → Auto-logged

Week 2: Failures accumulate to threshold
  → Auto-trigger learning → v1.1 born

Week 3: New rules take effect
  → Tool success rate +20%

Week 4-12: Continuous iteration
  → v1.2, v1.3, v1.4, ...
  → More edge cases covered
  → Skill completeness reaches 95%+

Month 3+: Stable running
  → New tools auto-adapted
  → Monthly updates (maintenance level)
```

---

## 📞 Support

Encounter problems?

1. Check **Troubleshooting** section
2. View execution logs
3. Manually test once: `python3 workflow-monitor.py --mode review-log`
4. Tell me the specific error message

---

## 📜 Version History

- **v3.0** (2026-06-22): Fully automated version
  - Windows/Mac/Linux one-click deployment
  - Task Scheduler / Cron auto-execution
  - GitHub version control
  - Multi-computer synchronization

---

## 📄 License

MIT License - Free to use, modify, distribute

---

**Ready? Run `setup.bat` (Windows) or `bash setup.sh` (Mac/Linux) and start your automation journey!** 🚀
