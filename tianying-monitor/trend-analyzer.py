#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 技能趨勢分析器 v1.0  (Week 5)
==========================================
從 regression-history.json 讀取歷史數據，
以 ASCII 趨勢圖顯示技能成長軌跡。

用法：
  python trend-analyzer.py                    顯示全部技能趨勢
  python trend-analyzer.py --skill <name>     只看指定技能
  python trend-analyzer.py --last 15          只看最近 15 次記錄
  python trend-analyzer.py --metric chars     看字元數趨勢（預設：規則/步驟數）
  python trend-analyzer.py --metric sections  看節點數趨勢
"""
import json
import argparse
from pathlib import Path
from typing import Dict, List, Tuple

BASE_DIR    = Path(__file__).parent
REG_HISTORY = BASE_DIR / 'regression-history.json'

CHART_WIDTH  = 36   # 最大顯示點數
CHART_HEIGHT = 8    # 縱軸格數

METRIC_LABEL = {
    'rules':    '規則/步驟數',
    'chars':    '字元數',
    'sections': '節點數',
}
METRIC_KEY = {
    'rules':    'h3_rule_count',
    'chars':    'char_count',
    'sections': 'h2_section_count',
}


def load_runs() -> List[Dict]:
    if not REG_HISTORY.exists():
        return []
    try:
        return json.loads(REG_HISTORY.read_text(encoding='utf-8')).get('runs', [])
    except Exception:
        return []


def extract_series(runs: List[Dict], skill: str, metric_key: str) -> List[Tuple[str, int]]:
    """回傳 [(timestamp, value), ...] 時間序列"""
    series = []
    for run in runs:
        ts  = run.get('timestamp', '')[:10]
        res = run.get('results', {}).get(skill, {})
        m   = res.get('metrics', {})
        if m:
            series.append((ts, m.get(metric_key, 0)))
    return series


def ascii_chart(series: List[Tuple[str, int]], title: str, metric_lbl: str, max_pts: int) -> List[str]:
    """生成 ASCII 趨勢圖，回傳 lines 清單"""
    if not series:
        return [f"  {title}：無資料"]

    pts    = series[-max_pts:]
    values = [v for _, v in pts]
    labels = [t for t, _ in pts]
    n      = len(values)
    h      = CHART_HEIGHT
    min_v  = min(values)
    max_v  = max(values)
    rng    = max_v - min_v or 1

    # 建 grid（h 行 × n 列）
    grid = [[' '] * n for _ in range(h)]
    for x, v in enumerate(values):
        y = int((v - min_v) / rng * (h - 1))
        y = h - 1 - y     # 翻轉：高值在上
        grid[y][x] = chr(9679)  # ●

    lines = [f"\n  {title}  （{metric_lbl}）"]

    # Y 軸 + 資料行
    for i, row in enumerate(grid):
        yval = round(max_v - (i / (h - 1)) * rng)
        lines.append(f"  {yval:5d} |{''.join(row)}")

    # X 軸底線
    lines.append(f"        └{'─' * n}─")

    # 日期標籤（頭尾）
    if n >= 2:
        left  = labels[0]
        right = labels[-1]
        gap   = max(0, n - len(left) - len(right))
        lines.append(f"         {left}{' ' * gap}{right}")

    # 摘要統計
    if n >= 2:
        delta = values[-1] - values[0]
        sign  = '+' if delta >= 0 else ''
        trend = '↑ 成長' if delta > 0 else ('↓ 縮減' if delta < 0 else '→ 持平')
        lines.append(
            f"\n  統計  min={min_v}  max={max_v}  "
            f"最新={values[-1]}  期間變化 {sign}{delta} {trend}"
        )
    elif values:
        lines.append(f"\n  目前：{values[-1]}")

    return lines


def main() -> None:
    ap = argparse.ArgumentParser(description='天鷹技能趨勢分析器 v1.0')
    ap.add_argument('--skill',  metavar='NAME',           help='只分析指定技能（不含 .md）')
    ap.add_argument('--last',   type=int, default=CHART_WIDTH, metavar='N', help='只看最近 N 次（預設 36）')
    ap.add_argument('--metric', choices=['rules', 'chars', 'sections'], default='rules',
                    help='指標 rules=規則/步驟（預設）chars=字元數 sections=節點數')
    args = ap.parse_args()

    runs = load_runs()
    if not runs:
        print("\n[INFO] regression-history.json 無記錄")
        print("       執行 regression-tester.py 至少 2 次後才有趨勢可分析")
        return

    # 收集所有技能名
    all_skills = set()
    for run in runs:
        all_skills.update(run.get('results', {}).keys())

    if args.skill:
        if args.skill not in all_skills:
            print(f"[ERR] 找不到 {args.skill}  已知：{', '.join(sorted(all_skills))}")
            return
        targets = [args.skill]
    else:
        targets = sorted(all_skills)

    m_key = METRIC_KEY[args.metric]
    m_lbl = METRIC_LABEL[args.metric]

    sep = '=' * 56
    print(f"\n{sep}")
    print(f"技能趨勢分析  指標：{m_lbl}  最近 {args.last} 次")
    print(f"歷史共 {len(runs)} 次記錄  技能 {len(all_skills)} 個")
    print(sep)

    for skill in targets:
        series = extract_series(runs, skill, m_key)
        for line in ascii_chart(series, skill, m_lbl, args.last):
            print(line)

    print(f"\n{sep}")
    print("提示：--metric chars 字元數  --last 20 最近 20 次  --skill <name> 指定技能")


if __name__ == '__main__':
    main()
