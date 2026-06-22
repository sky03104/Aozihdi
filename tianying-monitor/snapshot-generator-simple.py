#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全監控系統 - 快照生成器（Windows 版本）
"""

import os
import json
import subprocess
from datetime import datetime

# ============ 配置（Windows 路徑）============

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "delivery-log.json")
SNAPSHOT_DIR = os.path.join(BASE_DIR, "project-snapshots")
STATE_FILE = os.path.join(BASE_DIR, "project-state.md")

# ============ 主要函數 ============

def generate_version():
    """生成版本號：2026-06-22_v1"""
    today = datetime.now().strftime("%Y-%m-%d")
    counter = 1

    if os.path.exists(SNAPSHOT_DIR):
        for fname in os.listdir(SNAPSHOT_DIR):
            if fname.startswith(today) and fname.endswith('.md'):
                try:
                    n = int(fname.replace(today + '_v', '').replace('.md', ''))
                    counter = max(counter, n + 1)
                except:
                    pass

    return "{}_v{}".format(today, counter)

def load_log():
    """載入交付日誌"""
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []
    return []

def scan_local_files():
    """掃描本地 tianying-monitor 資料夾的檔案"""
    files = []
    try:
        for fname in os.listdir(BASE_DIR):
            fpath = os.path.join(BASE_DIR, fname)
            if os.path.isfile(fpath):
                stat = os.stat(fpath)
                files.append({
                    'name': fname,
                    'size': stat.st_size,
                    'mtime': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    'type': os.path.splitext(fname)[1].lstrip('.') or 'unknown'
                })
    except Exception as e:
        print("掃描失敗：{}".format(e))
    return sorted(files, key=lambda x: x['name'])

def generate_snapshot(version, files, log):
    """生成 project-state.md 內容"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    lines = []
    lines.append("# 天鷹保全專案狀態快照 - {}".format(version))
    lines.append("")
    lines.append("- **版本**：{}".format(version))
    lines.append("- **生成時間**：{}".format(now))
    lines.append("- **檔案數量**：{}".format(len(files)))
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 資料夾檔案清單")
    lines.append("")

    for f in files:
        size_kb = f['size'] / 1024
        lines.append("- **{}** ({:.1f} KB) - {}".format(f['name'], size_kb, f['mtime']))

    if log:
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 最近交付紀錄（最新 10 筆）")
        lines.append("")
        recent = log[-10:] if len(log) > 10 else log
        for entry in reversed(recent):
            lines.append("- {} - {}".format(entry['name'], entry['detected_at']))

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("*此快照由天鷹保全監控系統自動生成，勿手動編輯。*")

    return "\n".join(lines)

def git_commit(version):
    """Git 自動提交"""
    try:
        repo_dir = os.path.dirname(BASE_DIR)
        subprocess.run(['git', 'add', '.'], cwd=repo_dir, capture_output=True)

        status = subprocess.run(
            ['git', 'status', '--porcelain'],
            cwd=repo_dir, capture_output=True, text=True
        )

        if not status.stdout.strip():
            print("Git：無改動，跳過提交")
            return

        msg = "chore: auto snapshot {} ({})".format(
            version,
            datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        )
        subprocess.run(['git', 'commit', '-m', msg], cwd=repo_dir, capture_output=True)
        subprocess.run(['git', 'push', 'origin', 'main'], cwd=repo_dir, capture_output=True)
        print("Git 提交成功：{}".format(msg))

    except Exception as e:
        print("Git 提交失敗（不影響快照生成）：{}".format(e))

def main():
    print("")
    print("=" * 50)
    print("天鷹保全 - 快照生成器")
    print("=" * 50)

    # 確保快照目錄存在
    if not os.path.exists(SNAPSHOT_DIR):
        os.makedirs(SNAPSHOT_DIR)

    version = generate_version()
    print("版本號：{}".format(version))

    files = scan_local_files()
    print("掃描到 {} 個檔案".format(len(files)))

    log = load_log()
    print("載入 {} 筆交付紀錄".format(len(log)))

    content = generate_snapshot(version, files, log)

    # 保存快照備份
    backup_path = os.path.join(SNAPSHOT_DIR, "{}.md".format(version))
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("快照備份：{}".format(backup_path))

    # 更新 project-state.md
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    print("已更新：{}".format(STATE_FILE))

    # Git 提交
    git_commit(version)

    print("=" * 50)
    print("快照生成完成！版本：{}".format(version))
    print("=" * 50)

if __name__ == '__main__':
    main()
