#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 主動建議引擎 v1.0  (Track C-C2)
============================================
跨三份資料掃描系統狀態，主動提出具體改進建議
並輸出系統健康度評分（0-100）。

資料來源：
  failure-log.json         待處理失敗
  regression-history.json  skill 成長趨勢
  version-manifest.json    版本與備份狀態

用法：
  python proactive-suggestion.py          輸出建議報告
  python proactive-suggestion.py --health 只顯示健康度評分
  python proactive-suggestion.py --full   詳細模式（含原始數據）
  python proactive-suggestion.py --output 存 JSON 到 reports/
"""
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

BASE_DIR     = Path(__file__).parent
FAILURE_LOG  = BASE_DIR / "failure-log.json"
REG_HISTORY  = BASE_DIR / "regression-history.json"
VERSION_MANI = BASE_DIR / "version-manifest.json"
REPORTS_DIR  = BASE_DIR / "reports"

_PRI_LABEL = {
    "high":   "[!!]",
    "medium": "[! ]",
    "low":    "[ i]",
}

# 健康度扣分權重
_PENALTY = {"high": 25, "medium": 10, "low": 3}


def _load(path: Path) -> Dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


# ── 分析器 ────────────────────────────────────────────────

def analyze_failures(log: Dict) -> List[Dict]:
    """failure-log.json -> 失敗相關建議"""
    suggestions: List[Dict] = []
    all_items = log.get("failures", []) + log.get("discoveries", [])
    pending   = [i for i in all_items if i.get("status") == "pending_learn"]

    if not pending:
        return suggestions

    critical_cnt  = sum(1 for i in pending if i.get("priority") == "critical")
    important_cnt = sum(1 for i in pending if i.get("priority") == "important")

    # 閾值判斷
    if critical_cnt >= 2:
        suggestions.append({
            "priority": "high",
            "category": "自動學習閾值",
            "title":    f"critical {critical_cnt} 筆，達觸發閾值（>=2）",
            "action":   "python workflow-monitor.py --mode auto-learn",
            "detail":   f"critical={critical_cnt}  important={important_cnt}  共 {len(pending)} 筆 pending",
        })
    elif important_cnt >= 4:
        suggestions.append({
            "priority": "medium",
            "category": "自動學習閾值",
            "title":    f"important {important_cnt} 筆，達觸發閾值（>=4）",
            "action":   "python workflow-monitor.py --mode auto-learn",
            "detail":   f"important={important_cnt}  共 {len(pending)} 筆 pending",
        })
    else:
        suggestions.append({
            "priority": "low",
            "category": "監控中",
            "title":    f"{len(pending)} 筆 pending，尚未達閾值",
            "action":   "python failure-classifier.py --enrich  （更新分類後等待積累）",
            "detail":   f"critical={critical_cnt}  important={important_cnt}",
        })

    # 節點熱點：同一節點 >= 3 筆
    sec_count: Dict[str, int] = {}
    for item in pending:
        sec = item.get("classified_section", "未分類")
        sec_count[sec] = sec_count.get(sec, 0) + 1

    for sec, cnt in sec_count.items():
        if cnt >= 3 and sec != "未分類":
            suggestions.append({
                "priority": "medium",
                "category": "節點熱點",
                "title":    f"「{sec}」集中 {cnt} 筆失敗",
                "action":   f"優先更新 SKILL.md 的「{sec}」節點",
                "detail":   "建議先備份：python skill-version-manager.py --backup <skill>",
            })

    return suggestions


def analyze_regression(history: Dict) -> List[Dict]:
    """regression-history.json -> 技能健康建議"""
    suggestions: List[Dict] = []
    runs = history.get("runs", [])
    if len(runs) < 2:
        return suggestions

    latest = runs[-1].get("results", {})
    prev   = runs[-2].get("results", {})

    for skill, curr_res in latest.items():
        curr_m = curr_res.get("metrics", {})
        prev_m = prev.get(skill, {}).get("metrics", {})

        # 未通過
        if not curr_res.get("passed"):
            errs = curr_res.get("errors", [])
            suggestions.append({
                "priority": "high",
                "category": "技能驗證失敗",
                "title":    f"{skill} 回歸測試失敗",
                "action":   f"檢查 skills/{skill}.md 結構（詳見 regression-tester.py 輸出）",
                "detail":   "  |  ".join(errs[:2]),
            })

        # 規則數縮減 > 2
        if prev_m:
            rd = curr_m.get("h3_rule_count", 0) - prev_m.get("h3_rule_count", 0)
            if rd < -2:
                suggestions.append({
                    "priority": "high",
                    "category": "技能縮減",
                    "title":    f"{skill} 規則/步驟減少 {abs(rd)} 個",
                    "action":   f"python skill-version-manager.py --rollback {skill}",
                    "detail":   f"前次 {prev_m.get('h3_rule_count',0)} -> 現在 {curr_m.get('h3_rule_count',0)}",
                })

        # 無版本記錄
        if not curr_m.get("latest_version"):
            suggestions.append({
                "priority": "low",
                "category": "版本管理",
                "title":    f"{skill} 無版本記錄（## 更新歷史 缺失）",
                "action":   f"在 skills/{skill}.md 中新增 ## 更新歷史 + ### v1.0 區塊",
                "detail":   "",
            })

    # 持平超過 3 次（成長停滯）
    if len(runs) >= 3:
        for skill, curr_res in latest.items():
            curr_m = curr_res.get("metrics", {})
            stagnant = True
            for run in runs[-3:]:
                prev_m = run.get("results", {}).get(skill, {}).get("metrics", {})
                if prev_m and prev_m.get("h3_rule_count", 0) != curr_m.get("h3_rule_count", 0):
                    stagnant = False
                    break
            if stagnant and curr_m.get("h3_rule_count", 0) > 0:
                suggestions.append({
                    "priority": "low",
                    "category": "成長停滯",
                    "title":    f"{skill} 規則數連 3 次未變化",
                    "action":   "確認是否需要更新技能知識庫",
                    "detail":   f"目前規則/步驟數：{curr_m.get('h3_rule_count',0)}",
                })

    return suggestions


def analyze_versions(manifest: Dict) -> List[Dict]:
    """version-manifest.json -> 備份建議"""
    suggestions: List[Dict] = []
    now = datetime.now()

    for skill, entry in manifest.get("skills", {}).items():
        backups = entry.get("backups", [])

        if not backups:
            suggestions.append({
                "priority": "medium",
                "category": "備份缺失",
                "title":    f"{skill} 尚無備份",
                "action":   f"python skill-version-manager.py --backup {skill}",
                "detail":   "",
            })
            continue

        # 備份老化 > 14 天
        last_ts = backups[-1].get("timestamp", "")
        if last_ts:
            try:
                last_dt  = datetime.fromisoformat(last_ts.split("+")[0].split("Z")[0])
                days_ago = (now - last_dt).total_seconds() / 86400
                if days_ago > 14:
                    suggestions.append({
                        "priority": "low",
                        "category": "備份老化",
                        "title":    f"{skill} 最後備份 {int(days_ago)} 天前",
                        "action":   f"python skill-version-manager.py --backup {skill}",
                        "detail":   f"上次備份：{last_ts[:10]}",
                    })
            except Exception:
                pass

    return suggestions


def compute_health(suggestions: List[Dict]) -> Tuple[int, str]:
    """健康度 0-100，扣分制"""
    penalty = sum(_PENALTY.get(s.get("priority", "low"), 3) for s in suggestions)
    score   = max(0, 100 - penalty)
    if score >= 80:
        grade = "A - 優良"
    elif score >= 60:
        grade = "B - 正常"
    elif score >= 40:
        grade = "C - 需關注"
    else:
        grade = "D - 需立即處理"
    return score, grade


def print_report(suggestions: List[Dict], score: int, grade: str, full: bool):
    sep = "=" * 60
    print(f"\n{sep}\n主動建議報告\n{sep}")
    print(f"系統健康度：{score}/100  [{grade}]")
    print(f"建議數量：{len(suggestions)} 項")
    print()

    if not suggestions:
        print("  [OK] 系統無需特別改進，運行良好")
        return

    for pri_key, label in [("high", "高優先"), ("medium", "中優先"), ("low", "低優先")]:
        group = [s for s in suggestions if s.get("priority") == pri_key]
        if not group:
            continue
        print(f"{_PRI_LABEL[pri_key]} {label}  {len(group)} 項")
        for s in group:
            print(f"  [{s.get('category','?')}]  {s.get('title','')}")
            print(f"   -> {s.get('action','')}")
            if full and s.get("detail"):
                print(f"      {s.get('detail','')}")
        print()


def main():
    ap = argparse.ArgumentParser(description="天鷹主動建議引擎 v1.0")
    ap.add_argument("--health", action="store_true", help="只顯示健康度評分")
    ap.add_argument("--full",   action="store_true", help="詳細模式（含原始數據）")
    ap.add_argument("--output", action="store_true", help="存 JSON 到 reports/")
    args = ap.parse_args()

    log      = _load(FAILURE_LOG)
    history  = _load(REG_HISTORY)
    manifest = _load(VERSION_MANI)

    fail_sugg = analyze_failures(log)
    reg_sugg  = analyze_regression(history)
    ver_sugg  = analyze_versions(manifest)
    all_sugg  = fail_sugg + reg_sugg + ver_sugg

    score, grade = compute_health(all_sugg)

    if args.health:
        print(f"健康度：{score}/100  [{grade}]  建議 {len(all_sugg)} 項")
        return

    print_report(all_sugg, score, grade, args.full)

    if args.output:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        ts   = datetime.now().strftime("%Y%m%d-%H%M%S")
        path = REPORTS_DIR / f"suggestions-{ts}.json"
        path.write_text(
            json.dumps(
                {
                    "generated_at": datetime.now().isoformat(),
                    "health_score": score,
                    "health_grade": grade,
                    "suggestions":  all_sugg,
                },
                ensure_ascii=False, indent=2
            ),
            encoding="utf-8"
        )
        print(f"[OK] 已儲存：{path}")


if __name__ == "__main__":
    main()
