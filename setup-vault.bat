@echo off
chcp 65001 >nul
setlocal

set VAULT=C:\Users\天鷹\Documents\GitHub\tianying-security
set SRC=%~dp0

echo.
echo =========================================
echo   天鷹保全 Obsidian Vault 初始化腳本
echo =========================================
echo.

:: 建立專案資料夾（tracked by git）
for %%D in (
  "00-天鷹-MOC"
  "01-專案狀態"
  "02-工具開發"
  "03-GAS日誌"
) do (
  mkdir "%VAULT%\%%~D" 2>nul
  echo [建立] %%~D
)

:: 建立個人資料夾（gitignored，不進 GitHub）
for %%D in (
  "10-學習筆記"
  "11-生活規劃"
  "12-知識庫"
  "99-Daily"
  "_Templates"
) do (
  mkdir "%VAULT%\%%~D" 2>nul
  echo [建立] %%~D  ^(private^)
)

echo.
echo [複製] Markdown 檔案...

:: 複製 MOC
copy /Y "%SRC%00-天鷹-MOC\系統總覽.md"        "%VAULT%\00-天鷹-MOC\系統總覽.md"       >nul
copy /Y "%SRC%01-專案狀態\project-state.md"    "%VAULT%\01-專案狀態\project-state.md"  >nul
copy /Y "%SRC%02-工具開發\_工具開發模板.md"    "%VAULT%\02-工具開發\_工具開發模板.md"  >nul
copy /Y "%SRC%03-GAS日誌\_GAS修改模板.md"      "%VAULT%\03-GAS日誌\_GAS修改模板.md"    >nul
copy /Y "%SRC%10-學習筆記\_學習筆記模板.md"    "%VAULT%\10-學習筆記\_學習筆記模板.md"  >nul
copy /Y "%SRC%11-生活規劃\_生活規劃模板.md"    "%VAULT%\11-生活規劃\_生活規劃模板.md"  >nul
copy /Y "%SRC%12-知識庫\_知識卡模板.md"        "%VAULT%\12-知識庫\_知識卡模板.md"       >nul
copy /Y "%SRC%_Templates\Daily.md"             "%VAULT%\_Templates\Daily.md"           >nul
copy /Y "%SRC%_Templates\學習筆記.md"          "%VAULT%\_Templates\學習筆記.md"        >nul
copy /Y "%SRC%插件安裝清單.md"                 "%VAULT%\插件安裝清單.md"               >nul

echo.
echo [更新] .gitignore ...
>> "%VAULT%\.gitignore" echo.
>> "%VAULT%\.gitignore" echo # ── Obsidian（本機設定，不進 repo）──
>> "%VAULT%\.gitignore" echo .obsidian/
>> "%VAULT%\.gitignore" echo.
>> "%VAULT%\.gitignore" echo # ── 個人筆記（本機私有）──
>> "%VAULT%\.gitignore" echo 10-學習筆記/
>> "%VAULT%\.gitignore" echo 11-生活規劃/
>> "%VAULT%\.gitignore" echo 12-知識庫/
>> "%VAULT%\.gitignore" echo 99-Daily/
>> "%VAULT%\.gitignore" echo _Templates/

echo.
echo =========================================
echo   ✅ Vault 初始化完成！
echo =========================================
echo.
echo 下一步：
echo   1. 開啟 Obsidian → Open folder as vault
echo      選 C:\Users\天鷹\Documents\GitHub\tianying-security
echo   2. 安裝插件（見 插件安裝清單.md）
echo   3. 啟用 Obsidian Git → 設定 auto commit
echo.
pause
