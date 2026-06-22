#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全監控系統 - 整合運行器（Windows 版本）
"""

import os
import sys
import time
import subprocess
from datetime import datetime

# ============ 配置 ============

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DETECTOR = os.path.join(BASE_DIR, "delivery-detector-simple.py")
GENERATOR = os.path.join(BASE_DIR, "snapshot-generator-simple.py")
LOG_FILE = os.path.join(BASE_DIR, "auto-snapshot-runner.log")
INTERVAL = 600  # 10 分鐘

# ============ 函數 ============

def log(msg, level="INFO"):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = "[{}] [{}] {}".format(ts, level, msg)
    print(line)
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(line + "\n")
    except:
        pass

def run(script):
    """執行子腳本"""
    name = os.path.basename(script)
    try:
        result = subprocess.run(
            [sys.executable, script],
            capture_output=True,
            text=True,
            timeout=120,
            encoding='utf-8',
            errors='replace'
        )
        if result.returncode == 0:
            log("OK: {}".format(name), "SUCCESS")
            return True
        else:
            log("FAIL: {}".format(name), "ERROR")
            if result.stderr:
                log("  >> {}".format(result.stderr[:300]), "ERROR")
            return False
    except Exception as e:
        log("ERROR: {} - {}".format(name, e), "ERROR")
        return False

def run_once():
    """執行一次完整流程"""
    log("=" * 50)
    log("開始執行")

    ok1 = run(DETECTOR)
    time.sleep(3)
    ok2 = run(GENERATOR)

    total = sum([ok1, ok2])
    log("完成！成功 {}/2 個任務".format(total))
    log("=" * 50)
    return total == 2

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true', help='只執行一次')
    parser.add_argument('--log', action='store_true', help='查看日誌')
    args = parser.parse_args()

    # 查看日誌
    if args.log:
        if os.path.exists(LOG_FILE):
            print("")
            print("最近日誌（{}）：".format(LOG_FILE))
            print("")
            with open(LOG_FILE, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            for line in lines[-30:]:
                print(line.rstrip())
        else:
            print("日誌不存在")
        return

    # 執行
    log("天鷹保全 - 自動整合流程啟動")
    log("執行間隔：{} 秒（{} 分鐘）".format(INTERVAL, INTERVAL // 60))

    if args.once:
        run_once()
        log("單次執行完成")
        return

    i = 0
    while True:
        i += 1
        log("--- 第 {} 輪 ---".format(i))
        try:
            run_once()
            log("等待 {} 秒...".format(INTERVAL))
            time.sleep(INTERVAL)
        except KeyboardInterrupt:
            log("用戶中斷，已停止")
            break
        except Exception as e:
            log("異常：{}，等待後重試".format(e), "ERROR")
            time.sleep(INTERVAL)

if __name__ == '__main__':
    main()
