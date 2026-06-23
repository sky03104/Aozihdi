#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 告警分發器 v1.0  (Week 5)
==========================================
閾值達標時自動記錄告警，並可選擇發送 LINE push。

觸發條件：
  critical >= 2     → CRITICAL 告警
  important >= 4    → WARNING  告警
  技能回歸測試失敗  → CRITICAL 告警

輸出：
  alerts/alert-YYYYMMDD-HHMMSS.txt  本地告警記錄

LINE push 設定（可選）：
  在 monitor-config.yaml 加入：
    alert_webhook_url: "https://script.google.com/.../exec"
  GAS 端接收 {"action":"monitoring_alert","message":"..."} 並 push LINE

用法：
  python alert-dispatcher.py           檢查並告警（Task Scheduler 呼叫）
  python alert-dispatcher.py --status  只顯示現況，不寫告警
  python alert-dispatcher.py --test    強制觸發測試告警
"""
import json
import argparse
import urllib.request
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple

BASE_DIR     = Path(__file__).parent
FAILURE_LOG  = BASE_DIR / 'failure-log.json'
REG_HISTORY  = BASE_DIR / 'regression-history.json'
CONFIG_FILE  = BASE_DIR / 'monitor-config.yaml'
ALERTS_DIR   = BASE_DIR / 'alerts'

CRITICAL_THRESHOLD  = 2
IMPORTANT_THRESHOLD = 4


def _load(path: Path) -> Dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}


def _get_webhook_url() -> Optional[str]:
    """從 monitor-config.yaml 讀取 alert_webhook_url（可選）"""
    if not CONFIG_FILE.exists():
        return None
    for line in CONFIG_FILE.read_text(encoding='utf-8').splitlines():
        s = line.strip()
        if s.startswith('alert_webhook_url:'):
            url = s.split(':', 1)[1].strip().strip('"').strip("'")
            return url if url.startswith('http') else None
    return None


def check_conditions() -> List[Tuple[str, str, str]]:
    """
    檢查所有告警條件。
    回傳：[(level, title, detail), ...]
    level: CRITICAL / WARNING / INFO
    """
    alerts: List[Tuple[str, str, str]] = []

    # ── 失敗閾值 ─────────────────────────────────────────
    log   = _load(FAILURE_LOG)
    items = log.get('failures', []) + log.get('discoveries', [])
    pending   = [i for i in items if i.get('status') == 'pending_learn']
    critical  = [i for i in pending if i.get('priority') == 'critical']
    important = [i for i in pending if i.get('priority') == 'important']

    if len(critical) >= CRITICAL_THRESHOLD:
        tools = ', '.join(i.get('tool', '?') for i in critical[:3])
        types = ', '.join(i.get('error_type', '?') for i in critical[:3])
        alerts.append((
            'CRITICAL',
            f"critical 失敗達閾值（{len(critical)}/{CRITICAL_THRESHOLD}）",
            f"工具：{tools}\n問題：{types}",
        ))
    elif len(critical) > 0:
        alerts.append((
            'INFO',
            f"critical 累積中（{len(critical)}/{CRITICAL_THRESHOLD}，差 {CRITICAL_THRESHOLD - len(critical)} 筆）",
            '',
        ))

    if len(important) >= IMPORTANT_THRESHOLD:
        alerts.append((
            'WARNING',
            f"important 失敗達閾值（{len(important)}/{IMPORTANT_THRESHOLD}）",
            '建議執行：python workflow-monitor.py --mode auto-learn',
        ))

    # ── 回歸測試失敗 ─────────────────────────────────────
    hist = _load(REG_HISTORY)
    runs = hist.get('runs', [])
    if runs:
        fails = [k for k, v in runs[-1].get('results', {}).items()
                 if not v.get('passed', True)]
        if fails:
            alerts.append((
                'CRITICAL',
                f"技能驗證失敗：{', '.join(fails)}",
                '執行 regression-tester.py 查看詳情',
            ))

    return alerts


def write_alert_file(alerts: List[Tuple[str, str, str]]) -> Optional[Path]:
    """將告警寫入 alerts/ 目錄，回傳檔案路徑"""
    ALERTS_DIR.mkdir(parents=True, exist_ok=True)
    ts   = datetime.now()
    path = ALERTS_DIR / f"alert-{ts.strftime('%Y%m%d-%H%M%S')}.txt"

    lines = [
        "天鷹保全監控系統 · 告警通知",
        f"時間：{ts.strftime('%Y-%m-%d %H:%M:%S')}",
        f"告警數：{len(alerts)}",
        "",
    ]
    for level, title, detail in alerts:
        lines.append(f"[{level}] {title}")
        for d in (detail.splitlines() if detail else []):
            lines.append(f"  {d}")
        lines.append("")

    lines += [
        "─" * 40,
        "建議處理方式：",
        "  python workflow-monitor.py --mode auto-learn",
        "  python status-dashboard.py",
    ]

    path.write_text('\n'.join(lines), encoding='utf-8')
    return path


def send_webhook(alerts: List[Tuple[str, str, str]], url: str) -> bool:
    """POST 告警到 GAS webhook，由 GAS 發 LINE push"""
    ts  = datetime.now().strftime('%Y-%m-%d %H:%M')
    msg = f"[天鷹監控] {ts}\n"
    for level, title, _ in alerts:
        icon = '🔴' if level == 'CRITICAL' else '🟡'
        msg += f"{icon} {title}\n"
    msg += "\n請執行 --mode auto-learn 處理"

    payload = json.dumps({
        "action": "monitoring_alert",
        "message": msg,
    }).encode('utf-8')

    try:
        req = urllib.request.Request(
            url, data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status in (200, 302)
    except Exception as e:
        print(f"  [WRN] webhook 失敗：{e}")
        return False


def main() -> None:
    ap = argparse.ArgumentParser(description='天鷹告警分發器 v1.0')
    ap.add_argument('--status', action='store_true', help='只顯示狀態，不寫告警')
    ap.add_argument('--test',   action='store_true', help='強制觸發測試告警')
    args = ap.parse_args()

    if args.test:
        alerts = [('CRITICAL', '測試告警 - 請忽略', 'alert-dispatcher.py --test 手動觸發')]
    else:
        alerts = check_conditions()

    # INFO 等級只顯示，不寫檔
    write_list = [(l, t, d) for l, t, d in alerts if l in ('CRITICAL', 'WARNING')]

    # ── --status 模式 ────────────────────────────────────
    if args.status:
        print("\n=== 告警狀態 ===")
        if not alerts:
            print("  [OK] 無告警條件")
        else:
            icons = {'CRITICAL': '[C]', 'WARNING': '[W]', 'INFO': '[i]'}
            for level, title, _ in alerts:
                print(f"  {icons.get(level,'[?]')} {title}")
        return

    # ── 無告警 ───────────────────────────────────────────
    if not write_list:
        if not args.test:
            print("[OK] 無告警條件，系統正常")
        return

    # ── 寫告警檔 ─────────────────────────────────────────
    alert_file = write_alert_file(write_list)
    print(f"[ALERT] {alert_file.name}")
    for level, title, _ in write_list:
        print(f"  [{level}] {title}")

    # ── 可選 webhook ─────────────────────────────────────
    webhook_url = _get_webhook_url()
    if webhook_url:
        ok = send_webhook(write_list, webhook_url)
        print(f"  [{'OK' if ok else 'FAIL'}] LINE webhook 發送")
    else:
        print("  [跳過] 未設定 alert_webhook_url")
        print("         如需 LINE push，在 monitor-config.yaml 加入：")
        print("           alert_webhook_url: \"https://script.google.com/.../exec\"")


if __name__ == '__main__':
    main()
