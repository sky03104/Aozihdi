#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 系統儀表板 v1.0  (Week 4)
==========================================
整合 failure-log / regression-history / version-manifest / notify，
單一畫面顯示完整系統狀態與需注意事項。

用法：
  python status-dashboard.py           顯示儀表板
  python status-dashboard.py --save    另存到 reports/dashboard-YYYYMMDD.txt
  python status-dashboard.py --json    輸出 JSON（供自動化讀取）
"""
import json
import sys
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List

BASE_DIR     = Path(__file__).parent
FAILURE_LOG  = BASE_DIR / 'failure-log.json'
REG_HISTORY  = BASE_DIR / 'regression-history.json'
VERSION_MANI = BASE_DIR / 'version-manifest.json'
NOTIFY_FILE  = BASE_DIR / 'skill-update-notification.txt'
REPORTS_DIR  = BASE_DIR / 'reports'


def _load(path: Path) -> Dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}


def _sec(title: str, lines: List[str]) -> List[str]:
    out = [f'\n{title}', '-' * len(title)]
    out.extend(lines)
    return out


def build_dashboard() -> Dict:
    """收集所有資料，回傳結構化儀表板資料"""
    log   = _load(FAILURE_LOG)
    hist  = _load(REG_HISTORY)
    mani  = _load(VERSION_MANI)

    # ── 失敗統計 ─────────────────────────────────────────
    all_items  = log.get('failures', []) + log.get('discoveries', [])
    pending    = [i for i in all_items if i.get('status') == 'pending_learn']
    learned    = [i for i in all_items if i.get('status') == 'learned']
    critical   = [i for i in pending   if i.get('priority') == 'critical']
    important  = [i for i in pending   if i.get('priority') == 'important']
    last_fail  = max((i.get('timestamp','') for i in all_items), default='')[:16]

    # ── 技能狀態 ─────────────────────────────────────────
    runs         = hist.get('runs', [])
    latest_run   = runs[-1] if runs else {}
    skill_results = latest_run.get('results', {})
    last_test_ts = latest_run.get('timestamp', '')[:16]
    fail_skills  = [k for k, v in skill_results.items() if not v.get('passed', True)]

    # ── 備份狀態 ─────────────────────────────────────────
    skills_backup = mani.get('skills', {})
    now_dt = datetime.now()
    stale_backups = []
    for skill, entry in skills_backup.items():
        backups = entry.get('backups', [])
        if not backups:
            stale_backups.append(f"{skill}（無備份）")
            continue
        try:
            last = datetime.fromisoformat(backups[-1]['timestamp'].split('+')[0].split('Z')[0])
            if (now_dt - last).days > 14:
                stale_backups.append(f"{skill}（{(now_dt-last).days}天前）")
        except Exception:
            pass

    # ── 上次學習 ─────────────────────────────────────────
    last_learn_ver  = ''
    last_learn_time = ''
    last_learn_rules = 0
    if NOTIFY_FILE.exists():
        for line in NOTIFY_FILE.read_text(encoding='utf-8').splitlines():
            if '版本：' in line:
                last_learn_ver = line.split('：', 1)[-1].strip()
            elif '時間：' in line:
                last_learn_time = line.split('：', 1)[-1].strip()[:16]
            elif '新增規則：' in line:
                try:
                    last_learn_rules = int(line.split('：', 1)[-1].split()[0])
                except Exception:
                    pass

    # ── 健康度計算 ────────────────────────────────────────
    penalty = 0
    if len(critical) >= 2:    penalty += 25
    elif len(critical) == 1:  penalty += 10
    if len(important) >= 4:   penalty += 10
    elif len(important) >= 2: penalty += 5
    if len(fail_skills) > 0:  penalty += 25 * len(fail_skills)
    if len(stale_backups) > 0: penalty += 5 * len(stale_backups)
    health = max(0, 100 - penalty)
    grade  = ('A' if health >= 80 else 'B' if health >= 60 else 'C' if health >= 40 else 'D')

    # ── 警示項目 ──────────────────────────────────────────
    alerts = []
    if len(critical) >= 2:
        alerts.append(('high',   f"critical {len(critical)} 筆 -> 立即 --mode auto-learn"))
    elif len(critical) == 1:
        alerts.append(('medium', f"critical {len(critical)} 筆，差 1 筆觸發閾值"))
    if len(important) >= 4:
        alerts.append(('high',   f"important {len(important)} 筆 -> 建議 auto-learn"))
    if fail_skills:
        alerts.append(('high',   f"技能驗證失敗：{', '.join(fail_skills)}"))
    if stale_backups:
        alerts.append(('low',    f"備份老化：{', '.join(stale_backups[:3])}"))
    if len(pending) > 20:
        alerts.append(('medium', f"pending {len(pending)} 筆，建議 log-cleaner.py --archive"))

    return {
        'generated_at':   datetime.now().isoformat(),
        'health':         health,
        'health_grade':   grade,
        'failure': {
            'pending':   len(pending),
            'critical':  len(critical),
            'important': len(important),
            'learned':   len(learned),
            'total':     len(all_items),
            'last_fail': last_fail,
        },
        'skills': {
            'last_test': last_test_ts,
            'results':   {k: {
                'passed':   v.get('passed', True),
                'version':  v.get('metrics', {}).get('latest_version', '?'),
                'h3_count': v.get('metrics', {}).get('h3_rule_count', 0),
            } for k, v in skill_results.items()},
            'fail_list': fail_skills,
        },
        'backup': {
            'skills':         {k: {
                'version': v.get('current_version', '?'),
                'count':   len(v.get('backups', [])),
                'last':    v.get('backups', [{}])[-1].get('timestamp','')[:10] if v.get('backups') else '無',
            } for k, v in skills_backup.items()},
            'stale': stale_backups,
        },
        'last_learn': {
            'version': last_learn_ver,
            'time':    last_learn_time,
            'rules':   last_learn_rules,
        },
        'alerts': alerts,
    }


def render_terminal(d: Dict) -> str:
    """格式化終端輸出"""
    lines = []
    ts  = d['generated_at'][:16]
    h   = d['health']
    g   = d['health_grade']
    sep = '=' * 56

    lines += [
        '',
        sep,
        '天鷹保全監控系統 · 系統儀表板',
        sep,
        f'更新時間：{ts}',
        f'系統健康：{h}/100  [{g}]',
    ]

    # 失敗紀錄
    f = d['failure']
    fail_lines = [
        f"  pending  {f['pending']:3d}   critical {f['critical']:3d}  important {f['important']:3d}",
        f"  learned  {f['learned']:3d}   total    {f['total']:3d}",
    ]
    if f['last_fail']:
        fail_lines.append(f"  最後失敗：{f['last_fail']}")
    if not FAILURE_LOG.exists():
        fail_lines = ['  failure-log.json 不存在（尚無記錄）']
    lines += _sec('失敗紀錄', fail_lines)

    # 技能狀態
    sk     = d['skills']
    sk_lines = []
    if sk['last_test']:
        sk_lines.append(f"  上次測試：{sk['last_test']}")
    if sk['results']:
        for name, info in sk['results'].items():
            ok  = '[OK]' if info['passed'] else '[NG]'
            ver = info['version'] or '無版本'
            h3  = info['h3_count']
            sk_lines.append(f"  {ok}  {name:<32} {ver:<8}  規則/步驟 {h3}")
    else:
        sk_lines.append('  無記錄（執行 regression-tester.py 後顯示）')
    lines += _sec('技能狀態', sk_lines)

    # 版本備份
    bk     = d['backup']
    bk_lines = []
    if bk['skills']:
        for name, info in bk['skills'].items():
            bk_lines.append(
                f"  {name:<32} {info['version']:<8}  "
                f"{info['count']} 份備份  最後 {info['last']}"
            )
    else:
        bk_lines.append('  無備份（執行 skill-version-manager.py --backup-all）')
    lines += _sec('版本備份', bk_lines)

    # 上次自動學習
    ll      = d['last_learn']
    ll_lines = []
    if ll['version']:
        ll_lines += [
            f"  版本：{ll['version']}",
            f"  時間：{ll['time']}",
            f"  新增規則：{ll['rules']} 個",
        ]
    else:
        ll_lines.append('  尚無自動學習記錄')
    lines += _sec('上次自動學習', ll_lines)

    # 警示
    al = d['alerts']
    al_lines = []
    icons = {'high': '[!!]', 'medium': '[! ]', 'low': '[ i]'}
    for pri, msg in sorted(al, key=lambda x: {'high':0,'medium':1,'low':2}.get(x[0],3)):
        al_lines.append(f"  {icons.get(pri,'[ ]')} {msg}")
    if not al_lines:
        al_lines.append('  目前無緊急事項')
    lines += _sec('需注意', al_lines)

    lines += ['', sep]
    return '\n'.join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description='天鷹系統儀表板 v1.0')
    ap.add_argument('--save', action='store_true', help='另存到 reports/dashboard-YYYYMMDD.txt')
    ap.add_argument('--json', action='store_true', help='輸出 JSON 格式')
    args = ap.parse_args()

    data = build_dashboard()

    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return

    output = render_terminal(data)
    print(output)

    if args.save:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        ts   = datetime.now().strftime('%Y%m%d-%H%M%S')
        path = REPORTS_DIR / f'dashboard-{ts}.txt'
        path.write_text(output, encoding='utf-8')
        print(f'[OK] 已儲存：{path}')


if __name__ == '__main__':
    main()
