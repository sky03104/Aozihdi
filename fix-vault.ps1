# fix-vault.ps1
# 執行方式：右鍵 run-fix.bat → 以系統管理員身分執行
$root = "C:\Users\天鷹\Documents\GitHub\tianying-security"

Write-Host "=== 天鷹 Vault 整理工具 ===" -ForegroundColor Cyan
Write-Host "目標：$root" -ForegroundColor Gray
Write-Host ""

# 1. 建立子資料夾
$dirs = @("00-天鷹-MOC","01-專案狀態","02-工具開發","03-GAS日誌",
          "10-學習筆記","11-生活規劃","12-知識庫","99-Daily","_Templates")
foreach ($d in $dirs) {
    New-Item -Path "$root\$d" -ItemType Directory -Force | Out-Null
    Write-Host "[建立] $d" -ForegroundColor Green
}

Write-Host ""

# 2. 移動根目錄的 md 檔到正確位置
$moves = [ordered]@{
    "系統總覽.md"      = "00-天鷹-MOC"
    "插件安裝清單.md"  = "00-天鷹-MOC"
    "project-state.md" = "01-專案狀態"
    "_工具開發模板.md" = "02-工具開發"
    "_GAS修改模板.md"  = "03-GAS日誌"
    "_學習筆記模板.md" = "10-學習筆記"
    "_生活規劃模板.md" = "11-生活規劃"
    "_知識卡模板.md"   = "12-知識庫"
    "Daily.md"         = "_Templates"
    "學習筆記.md"      = "_Templates"
}

foreach ($file in $moves.Keys) {
    $src = "$root\$file"
    $dst = "$root\$($moves[$file])\$file"
    if (Test-Path $src) {
        Move-Item -Path $src -Destination $dst -Force
        Write-Host "[移動] $file  ->  $($moves[$file])/" -ForegroundColor Yellow
    } else {
        Write-Host "[跳過] $file（不在根目錄，可能已在正確位置）" -ForegroundColor Gray
    }
}

Write-Host ""

# 3. 更新 .gitignore
$gitignore = "$root\.gitignore"
$marker = "# Obsidian"
$existing = if (Test-Path $gitignore) { Get-Content $gitignore -Raw -Encoding UTF8 } else { "" }

if ($existing -notlike "*$marker*") {
    $additions = @"

# Obsidian（本機設定，不進 repo）
.obsidian/

# 個人筆記（本機私有，不進 repo）
10-學習筆記/
11-生活規劃/
12-知識庫/
99-Daily/
_Templates/
"@
    Add-Content -Path $gitignore -Value $additions -Encoding UTF8
    Write-Host "[更新] .gitignore 已加入 Obsidian 忽略規則" -ForegroundColor Green
} else {
    Write-Host "[略過] .gitignore 已有 Obsidian 規則" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== 完成！===" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步：" -ForegroundColor White
Write-Host "  1. 開啟 Obsidian" -ForegroundColor White
Write-Host "  2. Open folder as vault" -ForegroundColor White
Write-Host "     -> C:\Users\天鷹\Documents\GitHub\tianying-security" -ForegroundColor Yellow
Write-Host "  3. 安裝插件（見 00-天鷹-MOC/插件安裝清單.md）" -ForegroundColor White
Write-Host ""
Read-Host "按 Enter 結束"
