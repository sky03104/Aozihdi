@echo off
schtasks /create ^
  /tn "tianying-obsidian-sync" ^
  /tr "pythonw C:\Users\天鷹\Documents\GitHub\tianying-security\obsidian-auto-sync.py" ^
  /sc onlogon ^
  /rl highest ^
  /f
echo.
echo 已註冊！下次登入時自動啟動。
echo 立刻啟動請執行：
echo   pythonw "C:\Users\天鷹\Documents\GitHub\tianying-security\obsidian-auto-sync.py"
pause
