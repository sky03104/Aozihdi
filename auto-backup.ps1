# 天鷹保全 — 全自動備份同步

$ProjectRoot = "C:\Users\USER\tianying-security"
$BackupPath = "D:\Backup\tianying-security"
$LogFile = "$ProjectRoot\.backup-log.txt"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Set-Location $ProjectRoot

Write-Host "📦 開始備份同步..." -ForegroundColor Cyan

# === Git 推送 ===
Write-Host "`n🔄 Git 自動推送..."
git add -A
git commit -m "auto: backup $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Git 推送成功" -ForegroundColor Green
} else {
    Write-Host "⚠️  Git 推送有問題" -ForegroundColor Yellow
}

# === 外部備份 ===
Write-Host "`n💾 外部備份..."
if (-not (Test-Path $BackupPath)) {
    New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
}

$BackupFolder = "$BackupPath\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
robocopy $ProjectRoot $BackupFolder /E /R:1 /W:1 | Out-Null
Write-Host "✅ 備份完成：$BackupFolder" -ForegroundColor Green

# === 完成 ===
Write-Host "`n✨ 備份同步完成！`n" -ForegroundColor Green
Read-Host "按 Enter 結束"