#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全監控系統 - 自動交付檢測器（Windows 版本）
"""

import os
import json
from datetime import datetime, timedelta

# ============ 配置（Windows 路徑）============

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "delivery-log.json")
WATCH_DIR = BASE_DIR  # 監控同一個資料夾

# ============ 主要函數 ============

def scan_new_files(minutes=10):
    """掃描最近 N 分鐘內新增的檔案"""
    cutoff = datetime.now() - timedelta(minutes=minutes)
    new_files = []

    try:
        for filename in os.listdir(WATCH_DIR):
            filepath = os.path.join(WATCH_DIR, filename)

            if not os.path.isfile(filepath):
                continue

            ext = os.path.splitext(filename)[1].lower()
            if ext not in ['.html', '.md', '.py', '.json', '.yaml', '.yml', '.sh', '.bat']:
                continue

            mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            if mtime > cutoff:
                new_files.append({
                    'name': filename,
                    'size': os.path.getsize(filepath),
                    'mtime': mtime.strftime('%Y-%m-%d %H:%M:%S'),
                    'type': ext.lstrip('.')
                })
    except Exception as e:
        print("掃描失敗：{}".format(e))

    return sorted(new_files, key=lambda x: x['mtime'])

def save_log(new_files):
    """儲存交付紀錄"""
    logs = []
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, 'r', encoding='utf-8') as f:
                logs = json.load(f)
        except:
            logs = []

    for item in new_files:
        # 防止重複
        duplicate = any(
            x['name'] == item['name'] and x['mtime'] == item['mtime']
            for x in logs
        )
        if not duplicate:
            item['detected_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            logs.append(item)

    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(logs, f, indent=2, ensure_ascii=False)

    return logs

def main():
    print("")
    print("=" * 50)
    print("天鷹保全 - 交付檢測器")
    print("=" * 50)
    print("監控目錄：{}".format(WATCH_DIR))

    new_files = scan_new_files(minutes=10)

    if new_files:
        print("偵測到 {} 個新檔案：".format(len(new_files)))
        for f in new_files:
            print("  [{}] {} ({} bytes)".format(f['type'].upper(), f['name'], f['size']))
        save_log(new_files)
        print("已記錄到：{}".format(LOG_FILE))
    else:
        print("無新檔案（最近 10 分鐘內）")

    print("=" * 50)

if __name__ == '__main__':
    main()
