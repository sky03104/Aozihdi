@echo off
REM 天鷹保全 · 監控系統一鍵設定 (Windows)
REM 用法: 雙擊執行此檔案，或在 cmd 中執行 setup.bat
REM
REM 功能:
REM   1. 檢查 Python 是否安裝
REM   2. 建立必要的目錄
REM   3. 設定 Windows Task Scheduler 自動執行
REM   4. 驗證所有檔案

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo 天鷹保全 · 監控系統自動部署 v3.0
echo ==========================================
echo.

REM 取得當前目錄
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

echo 部署目錄: %SCRIPT_DIR%
echo.

REM ===== 檢查 Python =====
echo [1/5] 檢查 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ 未找到 Python!
    echo.
    echo 請先安裝 Python 3.8+ (https://www.python.org/downloads/)
    echo 安裝時務必勾選「Add Python to PATH」
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VER=%%i
echo ✅ Python %PYTHON_VER% 已安裝

REM ===== 檢查檔案 =====
echo.
echo [2/5] 檢查必要檔案...
set MISSING=0

if not exist "%SCRIPT_DIR%\workflow-monitor.py" (
    echo ❌ 缺少: workflow-monitor.py
    set MISSING=1
)
if not exist "%SCRIPT_DIR%\monitor-config.yaml" (
    echo ❌ 缺少: monitor-config.yaml
    set MISSING=1
)
if not exist "%SCRIPT_DIR%\auto-update.sh" (
    echo ⚠️  提示: auto-update.sh（Mac/Linux 用，Windows 用不到）
)

if %MISSING% equ 1 (
    echo.
    echo ❌ 檔案不完整，請確保所有檔案都在 %SCRIPT_DIR%
    pause
    exit /b 1
)

echo ✅ 所有必要檔案已就位

REM ===== 建立臨時目錄 =====
echo.
echo [3/5] 建立臨時目錄...
if not exist "%temp%\tianying-logs" mkdir "%temp%\tianying-logs"
echo ✅ 臨時目錄已建立: %temp%\tianying-logs

REM ===== 建立 Task Scheduler 排程 =====
echo.
echo [4/5] 設定自動執行排程...

REM 檢查排程是否已存在
schtasks /query /tn "tianying-auto-update" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  排程已存在，移除舊排程...
    schtasks /delete /tn "tianying-auto-update" /f >nul 2>&1
)

REM 建立新排程（每 6 小時執行一次）
schtasks /create ^
    /tn "tianying-auto-update" ^
    /tr "python %SCRIPT_DIR%\workflow-monitor.py --mode auto-learn" ^
    /sc hourly ^
    /mo 6 ^
    /f >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ 排程已建立: 每 6 小時自動執行一次
) else (
    echo ❌ 建立排程失敗
    echo.
    echo 你可以手動建立:
    echo   schtasks /create /tn "tianying-auto-update" /tr "python %SCRIPT_DIR%\workflow-monitor.py --mode auto-learn" /sc hourly /mo 6 /f
    pause
    exit /b 1
)

REM ===== 驗證 =====
echo.
echo [5/5] 驗證系統...

echo.
echo 執行一次監控掃描...
python "%SCRIPT_DIR%\workflow-monitor.py" --mode review-log

echo.
echo.
echo ==========================================
echo ✅ 部署完成!
echo ==========================================
echo.
echo 系統已設定：
echo   • Python 環境: 已驗證
echo   • 監控引擎: 已安裝
echo   • 自動排程: 已啟用（每 6 小時執行）
echo   • 臨時目錄: %temp%\tianying-logs
echo.
echo 查看排程詳情:
echo   schtasks /query /tn "tianying-auto-update" /v
echo.
echo 查看失敗日誌:
echo   python "%SCRIPT_DIR%\workflow-monitor.py" --mode review-log
echo.
echo 下一步: 開始使用!
echo   1. 上傳工具給 Claude 轉換
echo   2. 若失敗，系統自動記錄
echo   3. 6 小時後系統自動學習
echo.
pause
