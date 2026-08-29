# Aozihdi — 天鷹保全 APP（SQL 試作版）

> ⚠️ **這是試作版，不是正式環境。**
> 正式版在 [sky03104/tianying-security](https://github.com/sky03104/tianying-security)，
> 現場員工實際使用的網站也是從那邊部署，本 repo 的改動不會影響正式站。

## 這個 repo 是什麼

從 `tianying-security` 於 2026-08-29 完整複製（含全部 git 歷史），
用來試作「改走 SQL（Supabase）」的新版本，可以放心大改、隨時跟正式版比對。

## ⚠️ 動手前必看

複製當下所有工具裡寫死的 **GAS 部署網址、Supabase 連線、Google Sheets ID 都還指向正式環境**。
直接在這裡按下送出，資料會寫進正式資料表。

要改哪支工具，**第一件事是先把該工具的後端位址換成測試用的**（測試 GAS 部署 ／ 測試試算表 ／ 測試 Supabase 專案），確認隔離後再開始改功能。

## 部署

GitHub Pages：`https://sky03104.github.io/Aozihdi/`（與正式站各自獨立，互不影響）
