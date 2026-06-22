---
title: Google Drive 認證快速設定指南
subtitle: 為天鷹保全監控系統設定 Google Drive 存取權限
time_estimate: 5-10 分鐘
difficulty: ⭐⭐ 簡單
---

# Google Drive 認證設定指南

> ⏱️ 這個設定只需做一次，之後無需重複操作

---

## 📋 設定前檢查清單

- [ ] 有 Google 帳號（推薦用天鷹保全的 Google 帳號）
- [ ] 能存取 Google Drive
- [ ] Windows 電腦已安裝 Python 3.8+

---

## 🚀 設定步驟（5 分鐘）

### 第 1 步：安裝 pydrive2 庫（1 分鐘）

在 cmd 中執行：

```bash
pip install pydrive2
```

驗證安裝成功：
```bash
python -c "import pydrive2; print('✅ pydrive2 已安裝')"
```

---

### 第 2 步：建立 Google Cloud 專案（2 分鐘）

#### 2a. 打開 Google Cloud Console

訪問：https://console.cloud.google.com/

登入你的 Google 帳號

#### 2b. 建立新專案

1. 點左上角「Google Cloud」
2. 點「選取專案」
3. 點「新增專案」
4. 專案名稱：`天鷹保全監控系統`
5. 點「建立」（等待 30 秒）

---

### 第 3 步：啟用 Google Drive API（2 分鐘）

1. 在 Google Cloud Console 中，搜尋欄輸入：`Google Drive API`
2. 點「Google Drive API」
3. 點藍色「啟用」按鈕
4. 等待 1-2 分鐘

---

### 第 4 步：建立 OAuth 2.0 認證（1 分鐘）

1. 左邊選單 → 「API 和服務」
2. 點「認證」
3. 點「建立認證」 → 選「OAuth 2.0 用戶端 ID」
4. 若提示「設定 OAuth 同意畫面」，則：
   - 點「建立 OAuth 同意畫面」
   - 選「外部」用戶類型
   - 點「建立」
   - 應用程式名稱：`天鷹保全`
   - 用戶支援電子郵件：(填你的 email)
   - 開發者聯絡資訊：(填你的 email)
   - 點「儲存並繼續」
   - 其他欄位保持預設，點「完成」

5. 回到「認證」頁面，點「建立認證」 → 選「OAuth 2.0 用戶端 ID」
6. 應用程式類型選「電腦應用程式」
7. 名稱：`天鷹監控系統`
8. 點「建立」

---

### 第 5 步：取得 Client ID 和 Secret（1 分鐘）

1. 認證建立後，會看到彈窗顯示：
   - **Client ID**
   - **Client Secret**

2. 複製這兩個值，保存到安全的地方

**不要關閉這個彈窗！** ↓ 待續 ↓

---

### 第 6 步：修改認證設定檔（1 分鐘）

在你的 `tianying-monitor` 資料夾中，編輯這 3 個檔案：

#### 6a. 編輯 `delivery-detector-gdrive.py`

找到這一行（大約在第 40 行）：

```python
AUTH_SETTINGS = {
    'client_config_backend': 'settings',
    'client_config': {
        'client_id': 'YOUR_CLIENT_ID.apps.googleusercontent.com',
        'client_secret': 'YOUR_CLIENT_SECRET',
        ...
```

改成（用你的 Client ID 和 Secret）：

```python
AUTH_SETTINGS = {
    'client_config_backend': 'settings',
    'client_config': {
        'client_id': '你複製的_CLIENT_ID.apps.googleusercontent.com',
        'client_secret': '你複製的_CLIENT_SECRET',
        ...
```

**例如**（這是虛假的，只是示意）：
```python
'client_id': '1234567890-abcdefghij.apps.googleusercontent.com',
'client_secret': 'GOCSPX-xyz123abc456',
```

#### 6b. 同樣編輯 `snapshot-generator-gdrive.py`

找到同樣位置，改成同樣的 Client ID 和 Secret

#### 6c. 同樣編輯 `auto-snapshot-runner-gdrive.py`（如果有）

---

## ✅ 驗證設定成功

在 cmd 中執行測試：

```bash
cd C:\Users\天鷹\tianying-security\tianying-monitor

# 只執行一次（用於測試）
python auto-snapshot-runner-gdrive.py --once
```

**首次執行時會出現**：
```
🔐 首次執行，需要授權 Google Drive
請在瀏覽器中授權，然後回到此視窗...
```

此時：
1. 瀏覽器會自動打開
2. 點「允許」授予存取權限
3. 會重導回 `http://localhost:8080`
4. 回到 cmd 視窗，應該看到完成訊息

---

## 📍 授權成功的標誌

執行後應該看到：

```
============================================================
天鷹保全 - 自動整合流程啟動
執行間隔：600 秒（10 分鐘）
============================================================

--- 第 1 輪執行 ---

🔍 天鷹保全 - 自動交付檢測器（Google Drive 版本）
============================================================
🔐 正在連接 Google Drive...
✅ Google Drive 連接成功

📁 掃描目錄：/mnt/user-data/outputs
✅ 無失敗記錄（系統運行良好）

============================================================
✅ 完成！成功執行 2/2 個任務
============================================================
```

**✅ 出現這個，表示設定成功！**

---

## 🔍 常見問題排查

### ❌ 「找不到模組 pydrive2」

**解決方案**：
```bash
pip install pydrive2
```

### ❌ 「Invalid client_id」或「Invalid client_secret」

**解決方案**：
1. 檢查你複製的 Client ID 和 Secret 是否正確
2. 確認沒有額外空格或換行符
3. 重新複製一次（不要手動打字）

### ❌ 「Permission denied」

**解決方案**：
1. 確認 Google Drive 資料夾可以存取
2. 檢查 Google 帳號是否已授權
3. 刪除舊的授權紀錄：
   ```bash
   del %USERPROFILE%\.pydrive2_credentials
   ```
   然後重新執行

### ❌ 「Folder not found」

**解決方案**：
1. 確認 Folder ID 正確：`1bA1fVHR6m5sSL_m08t7as7jtVNqPTlqt`
2. 確認資料夾確實存在於你的 Google Drive
3. 確認你有該資料夾的編輯權限

---

## 🔐 安全提醒

⚠️ **重要**：
- **不要分享** Client ID 和 Secret（視同密碼）
- **不要上傳** `.pydrive2_credentials` 檔案到 GitHub
- 若意外洩露，立即在 Google Cloud Console 重新生成認證

---

## 🎯 下一步

設定完成後：

1. ✅ **驗證成功**：執行 `python auto-snapshot-runner-gdrive.py --once`
2. ✅ **設定排程**：在 Windows Task Scheduler 中設定自動執行（每 10 分鐘）
3. ✅ **查看日誌**：執行 `python auto-snapshot-runner-gdrive.py --log`

---

## 📞 需要幫助？

若設定過程中遇到問題，執行此命令查看詳細日誌：

```bash
python auto-snapshot-runner-gdrive.py --log
```

---

**祝設定順利！** 🎉
