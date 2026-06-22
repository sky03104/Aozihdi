#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 優先級排序器 v1.0  (Track C-C3)
============================================
整合 failure-log.json，依緊急度/優先級/年齡計分，
輸出排序後的行動佇列 + 行動建議。

用法：
  python priority-sorter.py              輸出優先行動佇列（前 10 筆）
  python priority-sorter.py --limit 5    只顯示前 5 項
  python priority-sorter.py --section    依 SKILL.md 節點分組
  python priority-sorter.py --output     存 JSON 到 reports/
"""
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List

BASE_DIR    = Path(__file__).parent
FAILURE_LOG = BASE_DIR / "failure-log.json"
REPORTS_DIR = BASE_DIR / "reports"

# 優先級基礎分
_PRI_SCORE: Dict[str, float] = {
    "critical": 3.0,
    "important": 2.0,
    "optional": 0.5,
    "unknown": 0.1,
}

_PRI_ICON: Dict[str, str] = {
    "critical":  "[C]",
    "important": "[I]",
    "optional":  "[O]",
    "unknown":   "[?]",
}


def score_item(item: Dict, now: datetime) -> float:
    """
    綜合分 = 優先級分 + 年齡加成 + 重複加成
    年齡加成：每天 +0.1，上限 +2.0
    重複加成：每次額外出現 +0.3
    """
    base = _PRI_SCORE.get(item.get("priority", "unknown"), 0.1)

    age_bonus = 0.0
    ts_str    = item.get("timestamp", "")
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.split("+")[0].split("Z")[0])
            age_days  = (now - ts).total_seconds() / 86400
            age_bonus = min(age_days * 0.1, 2.0)
        except Exception:
            pass

    recur_bonus = float(item.get("recurrence", 0)) * 0.3

    return round(base + age_bonus + recur_bonus, 3)


def load_and_score() -> List[Dict]:
    """讀取 failure-log.json，過濾 pending，計分排序"""
    if not FAILURE_LOG.exists():
        return []

    log = json.loads(FAILURE_LOG.read_text(encoding="utf-8"))
    all_items = log.get("failures", []) + log.get("discoveries", [])
    pending   = [i for i in all_items if i.get("status") == "pending_learn"]

    now = datetime.now()
    for item in pending:
        item["_score"] = score_item(item, now)

    return sorted(pending, key=lambda x: -x.get("_score", 0))


def print_flat(items: List[Dict], limit: int):
    """純排序列表輸出"""
    for i, item in enumerate(items[:limit], 1):
        pri   = item.get("priority", "unknown")
        tool  = item.get("tool", "?")
        etype = (item.get("error_type") or item.get("case_name", "?"))[:45]
        score = item.get("_score", 0)
        sec   = item.get("classified_section", "未分類")
        ts    = item.get("timestamp", "")[:10]

        print(f"  #{i:2d}  {_PRI_ICON.get(pri,'[?]')}  score={score:5.2f}  {ts}")
        print(f"       工具：{tool}")
        print(f"       問題：{etype}")
        print(f"       節點：{sec}")
        print()


def print_by_section(items: List[Dict], limit: int):
    """依 SKILL.md 節點分組輸出"""
    sections: Dict[str, List[Dict]] = {}
    for item in items[:limit]:
        sec = item.get("classified_section", "未分類")
        sections.setdefault(sec, []).append(item)

    # 依最高 score 排序節點
    for sec, group in sorted(sections.items(), key=lambda x: -max(i.get("_score", 0) for i in x[1])):
        top_score = max(i.get("_score", 0) for i in group)
        print(f"  [{sec}]  {len(group)} 筆  最高分 {top_score:.2f}")
        for item in group:
            pri   = item.get("priority", "unknown")
            tool  = item.get("tool", "?")
            etype = (item.get("error_type") or item.get("case_name", "?"))[:40]
            score = item.get("_score", 0)
            print(f"    {_PRI_ICON.get(pri,'[?]')} {score:5.2f}  {tool}  {etype}")
        print()


def print_action_advice(items: List[Dict]):
    """行動建議"""
    critical_cnt  = sum(1 for i in items if i.get("priority") == "critical")
    important_cnt = sum(1 for i in items if i.get("priority") == "important")
    total         = len(items)

    print(f"  統計  total={total}  critical={critical_cnt}  important={important_cnt}")
    print()

    if critical_cnt >= 2:
        print("  [行動] critical >= 2 -> 立即執行 auto-learn")
        print("         python workflow-monitor.py --mode auto-learn")
    elif important_cnt >= 4:
        print("  [行動] important >= 4 -> 建議執行 auto-learn")
        print("         python workflow-monitor.py --mode auto-learn")
    elif total > 0:
        print(f"  [等待] 積累中，尚未達閾值（critical<2，important<4）")
        print(f"         可執行 python failure-classifier.py --enrich 更新分類")
    else:
        print("  [OK] 無待處理項目")


def main():
    ap = argparse.ArgumentParser(description="天鷹優先級排序器 v1.0")
    ap.add_argument("--limit",   type=int, default=10,         help="顯示前 N 筆（預設 10）")
    ap.add_argument("--section", action="store_true",           help="依 SKILL.md 節點分組顯示")
    ap.add_argument("--output",  action="store_true",           help="存 JSON 到 reports/")
    args = ap.parse_args()

    items = load_and_score()

    sep = "=" * 60
    print(f"\n{sep}\n優先行動佇列\n{sep}")

    if not items:
        print("  [OK] 無待處理項目（failure-log.json 空或不存在）")
        return

    print(f"共 {len(items)} 筆 pending  顯示前 {min(args.limit, len(items))} 筆\n")

    if args.section:
        print_by_section(items, args.limit)
    else:
        print_flat(items, args.limit)

    print_action_advice(items)

    if args.output:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        ts   = datetime.now().strftime("%Y%m%d-%H%M%S")
        path = REPORTS_DIR / f"priority-queue-{ts}.json"
        path.write_text(
            json.dumps(
                {"generated_at": datetime.now().isoformat(), "queue": items},
                ensure_ascii=False, indent=2
            ),
            encoding="utf-8"
        )
        print(f"\n[OK] 已儲存：{path}")


if __name__ == "__main__":
    main()
