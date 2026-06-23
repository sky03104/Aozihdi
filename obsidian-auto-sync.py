# obsidian-auto-sync.py
# 監控下載資料夾，自動把 .md 檔搬到正確 Vault 位置

import os
import shutil
import time

DOWNLOADS = r"C:\Users\USER\Downloads"
VAULT     = r"C:\Users\USER\OneDrive\文件\GitHub\tianying-security"

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

def get_target_folder(filename):
    if filename in FILE_MAP:
        return FILE_MAP[filename]
    if filename.startswith("tpl-"):
        return "02-工具開發"
    if filename.startswith("doc") or "GAS" in filename:
        return "03-GAS日誌"
    return None

def sync_once():
    try:
        files = os.listdir(DOWNLOADS)
    except Exception:
        return
    for filename in files:
        if not filename.endswith(".md"):
            continue
        folder = get_target_folder(filename)
        if folder is None:
            continue
        src     = os.path.join(DOWNLOADS, filename)
        dst_dir = os.path.join(VAULT, folder)
        dst     = os.path.join(dst_dir, filename)
        try:
            os.makedirs(dst_dir, exist_ok=True)
            shutil.copy2(src, dst)
            os.remove(src)
            print(f"[OK] {filename} → {folder}/", flush=True)
        except Exception as e:
            print(f"[錯誤] {filename}: {e}", flush=True)

print("🦅 天鷹 Obsidian 自動同步啟動（家裡電腦）", flush=True)
while True:
    sync_once()
    time.sleep(20)
