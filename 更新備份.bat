@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM 來源（舊版本）
set "SOURCE=D:\咖哩CLAUDE\Projects\天鷹小工具_GitHub"

REM 目標（本機版本）
set "TARGET=C:\Users\USER\tianying-security"

REM 驗證來源存在
if not exist "%SOURCE%" (
    echo ❌ 來源資料夾不存在：%SOURCE%
    pause
    exit /b 1
)

REM 驗證目標存在
if not exist "%TARGET%" (
    echo ❌ 目標資料夾不存在：%TARGET%
    pause
    exit /b 1
)

echo.
echo 🔄 開始複製筆記資料夾...
echo 來源：%SOURCE%
echo 目標：%TARGET%
echo.

REM 複製筆記資料夾
setlocal enabledelayedexpansion

set "folders=00-天鷹-MOC,01-專案資聲,02-工具開發,03GAS日誌,10-學習筆記,11-主要清單,12-知識庫,99-Daily"

for %%F in (%folders%) do (
    if exist "%SOURCE%\%%F" (
        echo 複製 %%F...
        robocopy "%SOURCE%\%%F" "%TARGET%\%%F" /E /Y >nul 2>&1
        if !errorlevel! leq 1 (
            echo ✅ %%F 複製完成
        ) else (
            echo ⚠️  %%F 複製可能有問題
        )
    ) else (
        echo ⏭️  %%F 不存在（略過）
    )
)

echo.
echo ✅ 複製完成！
echo.
echo 下一步：
echo 1. 開啟 Obsidian
echo 2. 重新整理 Vault
echo 3. 筆記應該會出現
echo.
pause