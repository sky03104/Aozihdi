# 天鷹保全 — 全自動雙向同步備份

$ProjectRoot = "C:\Users\USER\tianying-security"
$BackupPath = "D:\Backup\tianying-security"

Set-Location $ProjectRoot

Write-Host "📦 開始雙向同步..." -ForegroundColor Cyan

# === 拉取最新 ===
Write-Host "`n⬇️  從 GitHub 拉取最新..."
git pull origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 拉取成功" -ForegroundColor Green
} else {
    Write-Host "⚠️  拉取有衝突，請檢查" -ForegroundColor Yellow
}

# === 推送改動 ===
Write-Host "`n⬆️  推送本機改動到 GitHub..."
git add -A
git commit -m "auto: sync $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>$null

git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 推送成功" -ForegroundColor Green
} else {
    Write-Host "⚠️  推送有問題" -ForegroundColor Yellow
}

# === 外部備份 ===
Write-Host "`n💾 備份到外部硬碟..."
if (-not (Test-Path $BackupPath)) {
    New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
}

$BackupFolder = "$BackupPath\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
robocopy $ProjectRoot $BackupFolder /E /R:1 /W:1 | Out-Null
Write-Host "✅ 備份完成：$BackupFolder" -ForegroundColor Green

# === 完成 ===
Write-Host "`n✨ 雙向同步完成！`n" -ForegroundColor Green
Read-Host "按 Enter 結束"