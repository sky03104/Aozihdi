@echo off
chcp 65001 >nul
powershell -ExecutionPolicy RemoteSigned -File "C:\Users\USER\tianying-security\auto-backup.ps1"
pause