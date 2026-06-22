#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 日誌清理工具 v1.0  (Week 3)
==========================================
維護 failure-log.json 和 regression-history.json，
防止資料無限增長影響系統效能。

用法：
  python log-cleaner.py                  顯示目前日誌狀態
  python log-cleaner.py --status         同上
  python log-cleaner.py --all            全部清理（去重+歸檔+截斷）
  python log-cleaner.py --dedup          去重（同 error_type+tool，7天內保留最新）
  python log-cleaner.py --archive        歸檔 learned/ignored 到 archive-log.json
  python log-cleaner.py --trim 50        pending 只保留最近 50 筆
  python log-cleaner.py --history 30     regression-history 只保留最近 30 次
  python log-cleaner.py --all --dry-run  預覽（不實際修改）

建議排程：每月執行一次 --all
"""
import json
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

BASE_DIR    = Path(__file__).parent
FAILURE_LOG = BASE_DIR / 'failure-log.json'
ARCHIVE_LOG = BASE_DIR / 'archive-log.json'
REG_HISTORY = BASE_DIR / 'regression-history.json'


def _load(path: Path) -> Dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}


def _save(path: Path, data: Dict, dry_run: bool) -> None:
    if not dry_run:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


# ── 狀態顯示 ─────────────────────────────────────────────
def show_status() -> None:
    sep = '=' * 50
    print(f"\n{sep}\n日誌狀態\n{sep}")

    if FAILURE_LOG.exists():
        log   = _load(FAILURE_LOG)
        all_  = log.get('failures', []) + log.get('discoveries', [])
        p     = sum(1 for i in all_ if i.get('status') == 'pending_learn')
        l     = sum(1 for i in all_ if i.get('status') == 'learned')
        ig    = sum(1 for i in all_ if i.get('status') == 'ignored')
        kb    = FAILURE_LOG.stat().st_size // 1024
        print(f"  failure-log.json      {kb:4d} KB  共 {len(all_):3d} 筆")
        print(f"    pending={p}  learned={l}  ignored={ig}")
        if p > 20:
            print(f"    [WRN] pending 過多，建議 --archive 或 --trim 50")
    else:
        print("  failure-log.json      不存在")

    if ARCHIVE_LOG.exists():
        arc = _load(ARCHIVE_LOG)
        kb  = ARCHIVE_LOG.stat().st_size // 1024
        print(f"  archive-log.json      {kb:4d} KB  共 {len(arc.get('items',[]))} 筆")

    if REG_HISTORY.exists():
        hist = _load(REG_HISTORY)
        runs = hist.get('runs', [])
        kb   = REG_HISTORY.stat().st_size // 1024
        print(f"  regression-history    {kb:4d} KB  共 {len(runs):3d} 次記錄")
        if runs:
            last_ts = runs[-1].get('timestamp', '')[:10]
            print(f"    最後一次：{last_ts}")
        if len(runs) > 30:
            print(f"    [WRN] 記錄過多，建議 --history 30")
    else:
        print("  regression-history    不存在")


# ── 去重 ─────────────────────────────────────────────────
def do_dedup(log: Dict) -> Tuple[Dict, int]:
    """相同 error_type + tool，7 天內只保留最新一筆"""
    failures = log.get('failures', [])
    before   = len(failures)
    seen: Dict[str, datetime] = {}
    keep: List[Dict] = []
    seven_days = timedelta(days=7)

    for item in sorted(failures, key=lambda x: x.get('timestamp', ''), reverse=True):
        key = f"{item.get('error_type', '')}:{item.get('tool', '')}"
        try:
            ts = datetime.fromisoformat(item.get('timestamp', '').split('+')[0].split('Z')[0])
        except Exception:
            keep.append(item)
            continue

        if key not in seen:
            seen[key] = ts
            keep.append(item)
        else:
            # 超過 7 天的重複保留（可能是真的新發生）
            if seen[key] - ts > seven_days:
                keep.append(item)

    log['failures'] = keep
    return log, before - len(keep)


# ── 歸檔 ─────────────────────────────────────────────────
def do_archive(log: Dict, dry_run: bool) -> Tuple[Dict, int]:
    """將 learned/ignored 項目移至 archive-log.json"""
    to_arch: List[Dict] = []
    stay_f:  List[Dict] = []
    stay_d:  List[Dict] = []

    for item in log.get('failures', []):
        if item.get('status') in ('learned', 'ignored'):
            to_arch.append({**item, '_archived_at': datetime.now().isoformat()})
        else:
            stay_f.append(item)

    for item in log.get('discoveries', []):
        if item.get('status') in ('learned', 'ignored'):
            to_arch.append({**item, '_archived_at': datetime.now().isoformat()})
        else:
            stay_d.append(item)

    if to_arch and not dry_run:
        arc = _load(ARCHIVE_LOG)
        arc.setdefault('items', []).extend(to_arch)
        arc['last_updated'] = datetime.now().isoformat()
        _save(ARCHIVE_LOG, arc, False)

    log['failures']    = stay_f
    log['discoveries'] = stay_d
    return log, len(to_arch)


# ── 截斷 pending ─────────────────────────────────────────
def do_trim(log: Dict, keep_n: int) -> Tuple[Dict, int]:
    """pending 項目只保留最近 N 筆"""
    failures = log.get('failures', [])
    pending  = [i for i in failures if i.get('status') == 'pending_learn']
    others   = [i for i in failures if i.get('status') != 'pending_learn']

    if len(pending) <= keep_n:
        return log, 0

    pending_sorted = sorted(pending, key=lambda x: x.get('timestamp', ''), reverse=True)
    removed = len(pending) - keep_n
    log['failures'] = others + pending_sorted[:keep_n]
    return log, removed


# ── regression-history 截斷 ──────────────────────────────
def do_history(hist: Dict, keep_n: int) -> Tuple[Dict, int]:
    """只保留最近 N 次回歸測試記錄"""
    runs   = hist.get('runs', [])
    before = len(runs)
    if before <= keep_n:
        return hist, 0
    hist['runs'] = runs[-keep_n:]
    return hist, before - keep_n


# ── 入口 ─────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description='天鷹日誌清理工具 v1.0')
    ap.add_argument('--all',     action='store_true', help='全部清理（dedup+archive+trim 50+history 30）')
    ap.add_argument('--dedup',   action='store_true', help='去重')
    ap.add_argument('--archive', action='store_true', help='歸檔 learned/ignored')
    ap.add_argument('--trim',    type=int, metavar='N', help='pending 只保留最近 N 筆')
    ap.add_argument('--history', type=int, metavar='N', help='regression-history 只保留最近 N 次')
    ap.add_argument('--dry-run', action='store_true', help='預覽，不實際執行')
    ap.add_argument('--status',  action='store_true', help='顯示目前狀態')
    args = ap.parse_args()

    # 無子命令 or --status → 只顯示狀態
    any_action = any([args.all, args.dedup, args.archive, args.trim, args.history])
    if args.status or not any_action:
        show_status()
        return

    dry    = args.dry_run
    prefix = '[DRY] ' if dry else ''
    dirty  = False

    # ── failure-log 操作 ─────────────────────────────────
    need_fail = any([args.all, args.dedup, args.archive, args.trim])
    if need_fail:
        if not FAILURE_LOG.exists():
            print("[SKIP] failure-log.json 不存在")
        else:
            log   = _load(FAILURE_LOG)
            total = 0

            if args.all or args.dedup:
                log, n = do_dedup(log)
                print(f"  {prefix}去重：移除 {n} 筆重複")
                total += n

            if args.all or args.archive:
                log, n = do_archive(log, dry)
                print(f"  {prefix}歸檔：{n} 筆 -> archive-log.json")
                total += n

            trim_n = 50 if args.all else args.trim
            if trim_n:
                log, n = do_trim(log, trim_n)
                print(f"  {prefix}截斷：移除 {n} 筆舊 pending（保留最近 {trim_n}）")
                total += n

            if total > 0:
                _save(FAILURE_LOG, log, dry)
                tag = '[預覽]' if dry else '[OK]'
                print(f"  {tag} failure-log.json 共清理 {total} 筆")
                dirty = True
            else:
                print("  [OK] failure-log.json 無需清理")

    # ── regression-history 操作 ──────────────────────────
    hist_n = 30 if args.all else args.history
    if hist_n:
        if not REG_HISTORY.exists():
            print("[SKIP] regression-history.json 不存在")
        else:
            hist = _load(REG_HISTORY)
            hist, n = do_history(hist, hist_n)
            if n > 0:
                _save(REG_HISTORY, hist, dry)
                tag = '[預覽]' if dry else '[OK]'
                print(f"  {tag} regression-history：移除 {n} 筆舊記錄（保留 {hist_n}）")
                dirty = True
            else:
                print(f"  [OK] regression-history 無需截斷（{len(hist.get('runs',[]))} 筆）")

    if not dirty:
        print("[OK] 全部資料均在合理範圍，無需清理")

    print()
    show_status()


if __name__ == '__main__':
    main()
