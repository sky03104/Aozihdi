#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 失敗分類增強器 v1.0  (Track B-B1)
============================================
繼承 monitor-config.yaml 的 failure_patterns，
對 failure-log.json 精準分類 + SKILL.md 節點映射。
無需安裝第三方庫，純標準庫實作。

用法：
  python failure-classifier.py              分類 + 輸出報告
  python failure-classifier.py --enrich     豐富化寫回 failure-log.json
  python failure-classifier.py --summary    僅摘要，不存報告檔
"""
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

# ── 路徑（相對於此腳本，即 tianying-monitor\ 內）
BASE_DIR    = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "monitor-config.yaml"
FAILURE_LOG = BASE_DIR / "failure-log.json"
REPORTS_DIR = BASE_DIR / "reports"

# ── 優先級排序
_PRI_ORDER: Dict[str, int] = {
    "critical": 0, "important": 1, "optional": 2, "unknown": 3
}

# ── 預設模式（monitor-config.yaml 讀取失敗時的後備）
_DEFAULT_PATTERNS: List[Dict] = [
    {"pattern": "node --check failed",      "priority": "critical",  "section": "SOP 驗證"},
    {"pattern": "grep verification failed", "priority": "critical",  "section": "規範檢查清單"},
    {"pattern": "React version mismatch",   "priority": "critical",  "section": "品牌規範"},
    {"pattern": "GAS action conflict",      "priority": "critical",  "section": "GAS 設計方案"},
    {"pattern": "empId not passed",         "priority": "important", "section": "工號狀態傳遞修正"},
    {"pattern": "image upload failed",      "priority": "important", "section": "照片上傳統一方案"},
    {"pattern": "permission undefined",     "priority": "important", "section": "權限規劃"},
    {"pattern": "return path incorrect",    "priority": "important", "section": "品牌規範"},
]


# ─────────────────────────────────────────────────────────
# 解析 monitor-config.yaml（無需 pyyaml）
# ─────────────────────────────────────────────────────────
def load_patterns(cfg: Path) -> List[Dict]:
    """從 monitor-config.yaml 解析 failure_patterns"""
    if not cfg.exists():
        print(f"[警告] 找不到 {cfg.name}，使用內建預設模式")
        return _DEFAULT_PATTERNS

    text     = cfg.read_text(encoding="utf-8")
    patterns: List[Dict] = []
    in_block = False
    cur: Dict = {}

    for line in text.splitlines():
        stripped = line.strip()

        # 進入 failure_patterns 區塊
        if not in_block:
            if "failure_patterns:" in line:
                in_block = True
            continue

        # 離開條件：縮排 <= 2 的非 # 非 - YAML 鍵（如 auto_trigger:）
        if stripped and not stripped.startswith("#") and not stripped.startswith("-"):
            indent = len(line) - len(line.lstrip())
            if indent <= 2 and ":" in stripped:
                break

        if not stripped or stripped.startswith("#"):
            continue

        if stripped.startswith("- pattern:"):
            if cur.get("pattern"):
                patterns.append(cur)
            cur = {"pattern": stripped.split(":", 1)[1].strip().strip('"')}
        elif stripped.startswith("priority:") and cur.get("pattern"):
            cur["priority"] = stripped.split(":", 1)[1].strip().strip('"')
        elif stripped.startswith("section:") and cur.get("pattern"):
            cur["section"] = stripped.split(":", 1)[1].strip().strip('"')

    if cur.get("pattern"):
        patterns.append(cur)

    if not patterns:
        print("[警告] 未讀到 failure_patterns，使用內建預設模式")
        return _DEFAULT_PATTERNS

    print(f"[OK] 讀取 {len(patterns)} 條錯誤模式（來源：{cfg.name}）")
    return patterns


# ─────────────────────────────────────────────────────────
# 分類核心
# ─────────────────────────────────────────────────────────
def classify_item(item: Dict, patterns: List[Dict]) -> Dict:
    """對單一失敗/邊界案例進行分類增強"""
    # 組合所有文字欄位做模糊比對
    search_text = " ".join([
        item.get("error_type", ""),
        item.get("error_msg",  ""),
        item.get("case_name",  ""),
        item.get("discovery",  ""),
    ]).lower()

    best_section = "未分類"
    best_pattern = None
    best_score   = 0.0
    inferred_pri = item.get("priority", "unknown")

    for p in patterns:
        kw = p.get("pattern", "").lower()
        if not kw or kw not in search_text:
            continue
        # 關鍵字越長 → 比對越精準 → 信心值越高
        score = len(kw) / max(len(search_text), 1)
        if score > best_score:
            best_score   = score
            best_section = p.get("section", "未分類")
            best_pattern = p.get("pattern")
            # 若 item 本身無優先級，從 config pattern 推斷
            if p.get("priority") and inferred_pri == "unknown":
                inferred_pri = p["priority"]

    return {
        **item,
        "priority":                  inferred_pri,
        "classified_section":        best_section,
        "matched_pattern":           best_pattern,
        "classification_confidence": round(best_score, 4),
        "classified_at":             datetime.now().isoformat(),
    }


def classify_log(log: Dict, patterns: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """批量分類 failure-log.json 的所有紀錄"""
    failures    = [classify_item(f, patterns) for f in log.get("failures",    [])]
    discoveries = [classify_item(d, patterns) for d in log.get("discoveries", [])]
    return failures, discoveries


# ─────────────────────────────────────────────────────────
# 摘要 & 輸出
# ─────────────────────────────────────────────────────────
def build_summary(failures: List[Dict], discoveries: List[Dict]) -> Dict:
    all_items = failures + discoveries
    by_pri: Dict[str, int] = {}
    by_sec: Dict[str, int] = {}

    for it in all_items:
        pri = it.get("priority", "unknown")
        sec = it.get("classified_section", "未分類")
        by_pri[pri] = by_pri.get(pri, 0) + 1
        by_sec[sec] = by_sec.get(sec, 0) + 1

    return {
        "generated_at":    datetime.now().isoformat(),
        "total":           len(all_items),
        "failures":        len(failures),
        "discoveries":     len(discoveries),
        "by_priority":     dict(sorted(by_pri.items(), key=lambda x: _PRI_ORDER.get(x[0], 9))),
        "by_section":      dict(sorted(by_sec.items(), key=lambda x: -x[1])),
        "high_confidence": sum(1 for i in all_items if i.get("classification_confidence", 0) >= 0.05),
        "unclassified":    sum(1 for i in all_items if i.get("classified_section") == "未分類"),
        "pending_learn":   sum(1 for i in all_items if i.get("status") == "pending_learn"),
    }


def print_summary(s: Dict, report_path: Path) -> None:
    sep = "=" * 60
    print(f"\n{sep}")
    print("失敗分類增強報告")
    print(sep)
    print(f"共 {s['total']} 筆  失敗 {s['failures']}  邊界案例 {s['discoveries']}")
    print(f"高信心分類 {s['high_confidence']}  未分類 {s['unclassified']}  待學習 {s['pending_learn']}")
    print()

    labels = [
        ("critical",  "[CRITICAL ]"),
        ("important", "[IMPORTANT]"),
        ("optional",  "[OPTIONAL ]"),
        ("unknown",   "[UNKNOWN  ]"),
    ]
    for pri, label in labels:
        cnt = s["by_priority"].get(pri, 0)
        if cnt:
            print(f"  {label} {cnt} 筆")

    print("\n  SKILL.md 目標節點分佈：")
    for sec, cnt in s["by_section"].items():
        bar = chr(9608) * min(cnt * 3, 24)  # █
        print(f"  {bar:<24} {cnt:2d}  {sec}")

    print(f"\n  報告：{report_path}")


def save_report(failures: List[Dict], discoveries: List[Dict], s: Dict) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = REPORTS_DIR / f"classification-{ts}.json"
    path.write_text(
        json.dumps(
            {"summary": s, "failures": failures, "discoveries": discoveries},
            ensure_ascii=False, indent=2
        ),
        encoding="utf-8"
    )
    return path


# ─────────────────────────────────────────────────────────
# 入口
# ─────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description="天鷹失敗分類增強器 v1.0")
    ap.add_argument("--enrich",  action="store_true", help="豐富化寫回 failure-log.json")
    ap.add_argument("--summary", action="store_true", help="僅摘要，不存報告檔")
    args = ap.parse_args()

    # 讀取 patterns
    patterns = load_patterns(CONFIG_FILE)

    # 讀取 failure-log.json
    if not FAILURE_LOG.exists():
        print("  failure-log.json 不存在，尚無記錄")
        return

    log: Dict = json.loads(FAILURE_LOG.read_text(encoding="utf-8"))

    if not log.get("failures") and not log.get("discoveries"):
        print("[OK] 無失敗紀錄，分類器閒置")
        return

    # 分類
    failures, discoveries = classify_log(log, patterns)
    summary               = build_summary(failures, discoveries)

    # 輸出
    report_path = Path("（未存檔）")
    if not args.summary:
        report_path = save_report(failures, discoveries, summary)

    print_summary(summary, report_path)

    # 豐富化寫回
    if args.enrich:
        log["failures"]        = failures
        log["discoveries"]     = discoveries
        log["last_classified"] = datetime.now().isoformat()
        FAILURE_LOG.write_text(
            json.dumps(log, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print("[OK] failure-log.json 已豐富化（含 classified_section 欄位）")


if __name__ == "__main__":
    main()
