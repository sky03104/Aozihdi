# GitHub 上傳指南（完整步驟）

你已經有 GitHub 帳號和 `sky03104.github.io` 專案了。現在要把監控系統上傳到裡面。

---

## 📍 目標結構

上傳完成後，你的 GitHub 會變成：

```
sky03104.github.io/
├─ tianying-security/              (既有的 APP)
│  ├─ index.html
│  ├─ tool_report.html
│  └─ ...
├─ tianying-monitor/               ← 新增（監控系統）
│  ├─ setup.bat
│  ├─ setup.sh
│  ├─ workflow-monitor.py
│  ├─ auto-update.sh
│  ├─ monitor-config.yaml
│  ├─ README.md
│  ├─ README_TW.md
│  ├─ .gitignore
│  └─ logs/                        (自動建立，不上傳)
└─ ...
```

---

## 🚀 上傳步驟（5 分鐘）

### 步驟 1：在本地建立資料夾結構

```bash
# 進入你的 GitHub 專案目錄
cd ~/GitHub/sky03104.github.io
# 或你保存的其他位置

# 建立新資料夾
mkdir -p tianying-monitor
cd tianying-monitor
```

### 步驟 2：複製檔案進去

把下面這些檔案複製到 `tianying-monitor` 目錄：

```
setup.bat
setup.sh
workflow-monitor.py
auto-update.sh
monitor-config.yaml
README.md
README_TW.md
.gitignore
```

驗證：
```bash
ls -la
# 應該看到上面 8 個檔案
```

### 步驟 3：初始化 Git（若還沒有）

```bash
# 回到專案根目錄
cd ~/GitHub/sky03104.github.io

# 檢查是否已初始化
git status
# 若成功，表示已初始化；若失敗，執行下行
git init
```

### 步驟 4：新增檔案到 Git

```bash
# 進入 tianying-monitor 目錄
cd tianying-monitor

# 新增所有檔案
git add .

# 驗證
git status
# 應該看到綠色的 "new file" 標記
```

### 步驟 5：提交變更

```bash
# 提交到本地
git commit -m "feat: 新增天鷹保全監控系統（等級 3 自動化）

- 工作流監控引擎（workflow-monitor.py）
- 自動執行腳本（auto-update.sh）
- Windows 一鍵部署（setup.bat）
- Mac/Linux 一鍵部署（setup.sh）
- 完整文檔（README_TW.md）

功能：
- 自動捕獲工具轉換失敗
- 每 6 小時自動掃描失敗日誌
- 自動觸發技能學習更新
- 無需人工干預"
```

### 步驟 6：推送到 GitHub

```bash
# 推送到 GitHub
git push origin main
# 或（若分支名不同）
git push origin master
```

驗證：打開 https://github.com/sky03104/sky03104.github.io
應該看到新的 `tianying-monitor` 資料夾。

---

## ✅ 驗證上傳成功

1. 打開 GitHub 頁面：https://github.com/sky03104/sky03104.github.io
2. 應該看到 `tianying-monitor` 資料夾
3. 點進去，應該看到 8 個檔案

---

## 🔄 多台電腦快速同步

現在，換到另一台電腦時：

```bash
# 1. 克隆整個專案
git clone https://github.com/sky03104/sky03104.github.io

# 2. 進入監控系統目錄
cd sky03104.github.io/tianying-monitor

# 3. 一鍵部署
# Windows: 雙擊 setup.bat
# Mac/Linux: bash setup.sh

# 完成！所有設定自動搞定
```

---

## 🔧 日後更新監控系統

若你改進了 `workflow-monitor.py` 或其他檔案：

```bash
# 進入目錄
cd ~/GitHub/sky03104.github.io/tianying-monitor

# 提交變更
git add .
git commit -m "fix: 改進監控引擎性能"
git push origin main
```

---

## ⚠️ 常見問題

### Q: 提交時出現「fatal: not a git repository」

```bash
# 確認你在正確目錄
cd ~/GitHub/sky03104.github.io
git status

# 若還是失敗，初始化
git init
git remote add origin https://github.com/sky03104/sky03104.github.io
```

### Q: Push 時說需要認證

```bash
# 用 SSH key（推薦）
# 或用 Personal Access Token
# GitHub 網頁 → Settings → Developer settings → Personal access tokens → Generate new token
# 選 "repo" 權限，複製 token

# 然後 push 時輸入 token 作為密碼
git push origin main
# 輸入你的 GitHub 帳號
# 輸入 token（當作密碼）
```

### Q: 分支名是 main 還是 master?

```bash
# 檢查
git branch -a

# 若只有 master，就用 master
git push origin master
```

---

## 📋 檢查清單

上傳前驗證：

- [ ] `setup.bat` 存在
- [ ] `setup.sh` 存在
- [ ] `workflow-monitor.py` 存在
- [ ] `auto-update.sh` 存在
- [ ] `monitor-config.yaml` 存在
- [ ] `README.md` 存在
- [ ] `README_TW.md` 存在
- [ ] `.gitignore` 存在
- [ ] `git status` 顯示 8 個新檔案
- [ ] `git push` 無錯誤

---

## 🎉 完成！

現在你的監控系統在 GitHub 上了：

```
https://github.com/sky03104/sky03104.github.io/tree/main/tianying-monitor
```

任何人都可以：
```bash
git clone https://github.com/sky03104/sky03104.github.io
cd tianying-monitor
bash setup.sh  # 或雙擊 setup.bat
```

一鍵部署完成！

---

## 🔐 不上傳什麼？

根據 `.gitignore`，這些不會上傳：

```
- logs/            (執行日誌)
- *.log            (日誌檔)
- __pycache__/     (Python 暫存)
- .DS_Store        (Mac 系統檔)
```

放心上傳，敏感資訊不會洩露。

---

## 💾 日後維護

```bash
# 檢查狀態
git status

# 看最近的提交
git log --oneline

# 看某個檔案的改動歷史
git log --oneline README_TW.md
```

完成！你現在有一個版本化、可複製、多台電腦同步的自動化監控系統。🚀
