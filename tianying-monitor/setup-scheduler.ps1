# 天鷹保全監控系統 - Task Scheduler 一鍵設定 (Week 5 修正版)
# ================================================================
# 執行方式：
#   cd C:\Users\...\tianying-monitor
#   powershell -ExecutionPolicy Bypass -File setup-scheduler.ps1
# ================================================================

$D = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$P = "python"

Write-Host ""
Write-Host "======================================"
Write-Host "  天鷹保全 Task Scheduler 設定"
Write-Host "  路徑：$D"
Write-Host "======================================"
Write-Host ""

# tianying-auto-learn
Write-Host "  tianying-auto-learn  (每 6 小時)" -NoNewline
$r = cmd /c "schtasks /create /tn ""tianying-auto-learn"" /tr ""$P $D\workflow-monitor.py --mode auto-learn"" /sc HOURLY /mo 6 /st 06:00 /f" 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host "  OK" -ForegroundColor Green } else { Write-Host "  FAIL: $r" -ForegroundColor Red }

# tianying-regression
Write-Host "  tianying-regression  (每天 02:00)" -NoNewline
$r = cmd /c "schtasks /create /tn ""tianying-regression"" /tr ""$P $D\regression-tester.py --compare --output"" /sc DAILY /st 02:00 /f" 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host "  OK" -ForegroundColor Green } else { Write-Host "  FAIL: $r" -ForegroundColor Red }

# tianying-log-clean
Write-Host "  tianying-log-clean   (每月 1 日 03:00)" -NoNewline
$r = cmd /c "schtasks /create /tn ""tianying-log-clean"" /tr ""$P $D\log-cleaner.py --all"" /sc MONTHLY /d 1 /st 03:00 /f" 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host "  OK" -ForegroundColor Green } else { Write-Host "  FAIL: $r" -ForegroundColor Red }

# tianying-dashboard
Write-Host "  tianying-dashboard   (每天 08:00)" -NoNewline
$r = cmd /c "schtasks /create /tn ""tianying-dashboard"" /tr ""$P $D\status-dashboard.py --save"" /sc DAILY /st 08:00 /f" 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host "  OK" -ForegroundColor Green } else { Write-Host "  FAIL: $r" -ForegroundColor Red }

# tianying-alert
Write-Host "  tianying-alert       (每小時 :30)" -NoNewline
$r = cmd /c "schtasks /create /tn ""tianying-alert"" /tr ""$P $D\alert-dispatcher.py"" /sc HOURLY /st 00:30 /f" 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host "  OK" -ForegroundColor Green } else { Write-Host "  FAIL: $r" -ForegroundColor Red }

Write-Host ""
Write-Host "======================================"
Write-Host "  完成。已設定的 tianying-* 排程："
Write-Host "======================================"
schtasks /query /fo table 2>&1 | Select-String "tianying"
