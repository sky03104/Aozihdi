# obsidian-auto-sync.py
# 監控下載資料夾 + Vault 根目錄，自動把 .md 搬到正確位置
# 家裡電腦版（USER）

import os
import shutil
import time

DOWNLOADS = r"C:\Users\USER\Downloads"
VAULT     = r"C:\Users\USER\OneDrive\文件\GitHub\tianying-security"
LOG_FILE  = os.path.join(VAULT, "obsidian-sync.log")

FILE_MAP = {
    "project-state.md"              : "01-專案狀態",
    "系統總覽.md"                   : "00-天鷹-MOC",
    "插件安裝清單.md"               : "00-天鷹-MOC",
    "_工具開發模板.md"              : "02-工具開發",
    "_GAS修改模板.md"               : "03-GAS日誌",
    "tpl-upload.md"                 : "02-工具開發",
    "tpl-closing.md"                : "02-工具開發",
    "tpl-signin.md"                 : "02-工具開發",
    "tpl-emergency.md"              : "02-工具開發",
    "tpl-car.md"                    : "02-工具開發",
    "doc3-天鷹保全APP主GAS.md"      : "03-GAS日誌",
    "doc4-班表上傳GAS.md"           : "03-GAS日誌",
    "FB-GAS-事故報告_匿名表揚GAS.md": "03-GAS日誌",
    "_學習筆記模板.md"              : "10-學習筆記",
    "_生活規劃模板.md"              : "11-生活規劃",
    "_知識卡模板.md"                : "12-知識庫",
    "Daily.md"                      : "_Templates",
    "學習筆記.md"                   : "_Templates",
}

def log(msg):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")

def get_folder(filename):
    if filename in FILE_MAP:
        return FILE_MAP[filename]
    if filename.startswith("tpl-"):
        return "02-工具開發"
    if filename.startswith("doc") or "GAS" in filename:
        return "03-GAS日誌"
    return None

def scan_and_move(scan_dir, skip_subfolders=False):
    try:
        entries = os.listdir(scan_dir)
    except Exception as e:
        log(f"[錯誤] 無法讀取 {scan_dir}: {e}")
        return

    for filename in entries:
        if not filename.endswith(".md"):
            continue

        src = os.path.join(scan_dir, filename)

        # 跳過已在子資料夾內的檔案
        if not os.path.isfile(src):
            continue

        folder = get_folder(filename)
        if folder is None:
            continue

        dst_dir = os.path.join(VAULT, folder)
        dst     = os.path.join(dst_dir, filename)

        # 已經在正確位置就跳過
        if os.path.abspath(src) == os.path.abspath(dst):
            continue

        try:
            os.makedirs(dst_dir, exist_ok=True)
            shutil.copy2(src, dst)
            os.remove(src)
            log(f"[OK] {filename} -> {folder}/")
        except Exception as e:
            log(f"[錯誤] {filename}: {e}")

log("=== 啟動（家裡電腦）===")
while True:
    scan_and_move(DOWNLOADS)       # 掃下載資料夾
    scan_and_move(VAULT)           # 掃 Vault 根目錄（整理誤放的檔案）
    time.sleep(20)
