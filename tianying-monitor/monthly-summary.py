#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 月度彙整報告器 v1.0  (Week 6)
==========================================
整合本月所有週報、儀表板快照、回歸歷史，
生成完整月度 Markdown 報告。

用法：
  python monthly-summary.py              生成本月月報
  python monthly-summary.py --month 2026-05   生成指定月份報告
  python monthly-summary.py --preview    預覽（不存檔）

輸出：reports/monthly-YYYYMM.md
"""
import json
import re
import argparse
from pathlib import Path
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple

BASE_DIR    = Path(__file__).parent
REPORTS_DIR = BASE_DIR / 'reports'
REG_HISTORY = BASE_DIR / 'regression-history.json'
FAILURE_LOG = BASE_DIR / 'failure-log.json'
NOTIFY_FILE = BASE_DIR / 'skill-update-notification.txt'


def _load(path: Path) -> Dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}


# ── 資料收集 ─────────────────────────────────────────────

def collect_weekly_reports(month_prefix: str) -> List[Tuple[str, str]]:
    """讀取本月週報（reports/weekly-YYYYMM*.md）"""
    if not REPORTS_DIR.exists():
        return []
    files = sorted(REPORTS_DIR.glob(f"weekly-{month_prefix}*.md"))
    result = []
    for f in files:
        try:
            result.append((f.stem, f.read_text(encoding='utf-8')))
        except Exception:
            pass
    return result


def collect_dashboard_snapshots(month_prefix: str) -> List[Tuple[str, str]]:
    """讀取本月儀表板快照（reports/dashboard-YYYYMM*.txt）"""
    if not REPORTS_DIR.exists():
        return []
    files = sorted(REPORTS_DIR.glob(f"dashboard-{month_prefix}*.txt"))
    result = []
    for f in files:
        try:
            result.append((f.stem, f.read_text(encoding='utf-8')))
        except Exception:
            pass
    return result


def collect_regression_month(runs: List[Dict], month_prefix: str) -> List[Dict]:
    """篩選本月的回歸測試記錄"""
    return [r for r in runs if r.get('timestamp', '').startswith(month_prefix)]


def extract_health_from_snapshot(text: str) -> Optional[int]:
    """從儀表板快照文字擷取健康度分數"""
    for line in text.splitlines():
        m = re.search(r'(\d+)/100', line)
        if m and '健康' in line:
            return int(m.group(1))
    return None


def extract_weekly_stats(weekly_text: str) -> Dict:
    """從週報 Markdown 擷取關鍵數字"""
    stats = {'pending': 0, 'critical': 0, 'important': 0, 'learned': 0}
    for line in weekly_text.splitlines():
        for key in stats:
            m = re.search(rf'\| {key} \| (\d+)', line, re.IGNORECASE)
            if m:
                stats[key] = int(m.group(1))
    return stats


def get_learn_history_from_notify() -> str:
    """從 skill-update-notification.txt 讀取最近學習記錄"""
    if not NOTIFY_FILE.exists():
        return ''
    text = NOTIFY_FILE.read_text(encoding='utf-8')
    lines = []
    for line in text.splitlines():
        if any(kw in line for kw in ['版本', '時間', '新增規則']):
            lines.append(f"  {line.strip()}")
    return '\n'.join(lines) if lines else '  無自動學習記錄'


# ── 報告生成 ─────────────────────────────────────────────

def generate_monthly_report(month_str: str) -> str:
    """生成月度 Markdown 報告文字"""
    month_prefix = month_str.replace('-', '')[:6]  # "202606"
    display_month = f"{month_str[:4]} 年 {month_str[5:7]} 月"
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    weekly_reports   = collect_weekly_reports(month_prefix)
    dash_snapshots   = collect_dashboard_snapshots(month_prefix)
    hist             = _load(REG_HISTORY)
    month_runs       = collect_regression_month(hist.get('runs', []), month_str[:7])
    log              = _load(FAILURE_LOG)
    all_items        = log.get('failures', []) + log.get('discoveries', [])
    learned_this_month = [
        i for i in all_items
        if i.get('status') == 'learned' and i.get('timestamp', '').startswith(month_str[:7])
    ]

    lines = [
        f"# 天鷹保全監控系統 · {display_month} 月度彙整報告",
        f"",
        f"**生成時間**：{now}",
        f"",
        f"---",
        f"",
    ]

    # ── 健康度趨勢 ────────────────────────────────────────
    lines += ["## 健康度趨勢", ""]
    health_scores = [(s[:16], extract_health_from_snapshot(t)) for s, t in dash_snapshots]
    health_scores = [(d, h) for d, h in health_scores if h is not None]

    if health_scores:
        lines.append("| 日期 | 健康度 |")
        lines.append("|------|--------|")
        for d, h in health_scores:
            grade = 'A' if h >= 80 else ('B' if h >= 60 else 'C')
            lines.append(f"| {d} | {h}/100 [{grade}] |")
        avg_health = sum(h for _, h in health_scores) // len(health_scores)
        lines += ["", f"**本月平均健康度：{avg_health}/100**", ""]
    else:
        lines += ["本月無儀表板快照記錄（每天 08:00 自動儲存）", ""]

    # ── 失敗處理統計 ──────────────────────────────────────
    lines += ["---", "", "## 失敗處理統計", ""]

    if weekly_reports:
        all_stats = [extract_weekly_stats(t) for _, t in weekly_reports]
        total_learned  = sum(s['learned']   for s in all_stats)
        total_critical = sum(s['critical']  for s in all_stats)
        total_import   = sum(s['important'] for s in all_stats)
        lines += [
            f"| 指標 | 本月合計 |",
            f"|------|---------|",
            f"| 週報數量 | {len(weekly_reports)} 份 |",
            f"| 累積 critical | {total_critical} 筆 |",
            f"| 累積 important | {total_import} 筆 |",
            f"| 學習完成 | {total_learned} 筆 |",
            f"",
        ]
    elif all_items:
        pending = [i for i in all_items if i.get('status') == 'pending_learn']
        lines += [
            f"- pending：{len(pending)} 筆",
            f"- learned（本月）：{len(learned_this_month)} 筆",
            f"- 總記錄：{len(all_items)} 筆",
            f"",
        ]
    else:
        lines += ["本月無失敗記錄", ""]

    # ── 回歸測試統計 ──────────────────────────────────────
    lines += ["---", "", "## 回歸測試", ""]
    if month_runs:
        all_pass_runs  = sum(1 for r in month_runs
                             if all(v.get('passed', True) for v in r.get('results', {}).values()))
        skill_names = set()
        for r in month_runs:
            skill_names.update(r.get('results', {}).keys())

        lines += [
            f"- 本月測試次數：{len(month_runs)} 次",
            f"- 全部通過次數：{all_pass_runs} 次",
            f"- 測試覆蓋技能：{', '.join(sorted(skill_names)) or '無'}",
            f"",
        ]

        # 技能規則數變化
        if len(month_runs) >= 2:
            first = month_runs[0].get('results', {})
            last  = month_runs[-1].get('results', {})
            lines += ["**技能規則/步驟數變化：**", ""]
            lines += ["| 技能 | 月初 | 月末 | 變化 |"]
            lines += ["|------|------|------|------|"]
            for skill in sorted(skill_names):
                start_h3 = first.get(skill, {}).get('metrics', {}).get('h3_rule_count', 0)
                end_h3   = last.get(skill, {}).get('metrics', {}).get('h3_rule_count', 0)
                delta    = end_h3 - start_h3
                sign     = '+' if delta >= 0 else ''
                lines.append(f"| {skill} | {start_h3} | {end_h3} | {sign}{delta} |")
            lines.append("")
    else:
        lines += ["本月無回歸測試記錄", ""]

    # ── 自動學習記錄 ──────────────────────────────────────
    lines += ["---", "", "## 自動學習", ""]
    learn_log = get_learn_history_from_notify()
    lines += [learn_log, ""]

    # ── 本月週報清單 ──────────────────────────────────────
    if weekly_reports:
        lines += ["---", "", "## 本月週報", ""]
        for name, _ in weekly_reports:
            lines.append(f"- [[{name}]]")
        lines.append("")

    # ── 下月建議 ──────────────────────────────────────────
    lines += [
        "---",
        "",
        "## 下月行動建議",
        "",
    ]

    if health_scores and avg_health < 80:
        lines.append("- [ ] 健康度低於 80，重點改善回歸測試失敗項目")
    else:
        lines.append("- [ ] 維持健康度 >= 80，持續監控")
    lines.append("- [ ] 執行 `python skill-version-manager.py --backup-all` 備份技能")
    lines.append("- [ ] 執行 `python trend-analyzer.py` 確認成長趨勢")
    lines.append("- [ ] 確認兩台電腦 skills/ 目錄保持同步")

    return '\n'.join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description='天鷹月度彙整報告器 v1.0')
    ap.add_argument('--month',   metavar='YYYY-MM', help='指定月份（預設：本月）')
    ap.add_argument('--preview', action='store_true', help='預覽，不存檔')
    args = ap.parse_args()

    month_str = args.month if args.month else datetime.now().strftime('%Y-%m')

    print(f"[INFO] 生成 {month_str} 月度彙整報告...")
    report = generate_monthly_report(month_str)

    if args.preview:
        print(report)
        return

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    month_tag = month_str.replace('-', '')[:6]
    path      = REPORTS_DIR / f"monthly-{month_tag}.md"
    path.write_text(report, encoding='utf-8')
    print(f"[OK] 月報已儲存：{path}")

    # 顯示摘要
    lines = report.splitlines()
    for line in lines[:30]:
        print(line)
    if len(lines) > 30:
        print(f"... （共 {len(lines)} 行）")


if __name__ == '__main__':
    main()
