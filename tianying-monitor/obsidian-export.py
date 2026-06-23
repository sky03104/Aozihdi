#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · Obsidian 狀態匯出器 v1.0  (Week 6)
==============================================
將 tianying-monitor 系統狀態即時匯出為 Obsidian .md 文件。
每次執行會覆蓋更新，保持 Obsidian vault 內容最新。

匯出檔案：<vault>/天鷹保全/監控系統狀態.md

vault 路徑偵測順序：
  1. monitor-config.yaml 的 obsidian_vault_path
  2. tianying-monitor/ 的上層目錄（即倉庫根目錄）

用法：
  python obsidian-export.py              匯出到 Obsidian vault
  python obsidian-export.py --dry-run    預覽，不寫入 vault
  python obsidian-export.py --path <dir> 指定 vault 根目錄

Task Scheduler 建議：每天 08:05（dashboard 快照後 5 分鐘執行）
"""
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

BASE_DIR     = Path(__file__).parent
CONFIG_FILE  = BASE_DIR / 'monitor-config.yaml'
FAILURE_LOG  = BASE_DIR / 'failure-log.json'
REG_HISTORY  = BASE_DIR / 'regression-history.json'
VERSION_MANI = BASE_DIR / 'version-manifest.json'
NOTIFY_FILE  = BASE_DIR / 'skill-update-notification.txt'

# Obsidian 資料夾名稱（vault 內）
OBSIDIAN_FOLDER = '天鷹保全'
OBSIDIAN_FILE   = '監控系統狀態.md'


def _load(path: Path) -> Dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}


def detect_vault_path() -> Optional[Path]:
    """偵測 Obsidian vault 根目錄"""
    # 1. monitor-config.yaml 指定
    if CONFIG_FILE.exists():
        for line in CONFIG_FILE.read_text(encoding='utf-8').splitlines():
            s = line.strip()
            if s.startswith('obsidian_vault_path:'):
                val = s.split(':', 1)[1].strip().strip('"').strip("'")
                if val:
                    p = Path(val)
                    if p.exists():
                        return p

    # 2. 自動推斷（tianying-monitor\ 的上層，即 tianying-security\）
    parent = BASE_DIR.parent
    if parent.exists():
        return parent

    return None


def build_obsidian_md() -> str:
    """生成 Obsidian 狀態文件內容"""
    now      = datetime.now()
    ts       = now.strftime('%Y-%m-%d %H:%M:%S')
    date_tag = now.strftime('%Y-%m-%d')

    log   = _load(FAILURE_LOG)
    hist  = _load(REG_HISTORY)
    mani  = _load(VERSION_MANI)

    # 失敗統計
    all_items  = log.get('failures', []) + log.get('discoveries', [])
    pending    = [i for i in all_items if i.get('status') == 'pending_learn']
    learned    = [i for i in all_items if i.get('status') == 'learned']
    critical   = [i for i in pending   if i.get('priority') == 'critical']
    important  = [i for i in pending   if i.get('priority') == 'important']

    # 技能狀態
    runs         = hist.get('runs', [])
    latest_run   = runs[-1] if runs else {}
    skill_results = latest_run.get('results', {})
    last_test_ts = latest_run.get('timestamp', '')[:10]
    fail_skills  = [k for k, v in skill_results.items() if not v.get('passed', True)]

    # 備份狀態
    skills_backup = mani.get('skills', {})

    # 健康度
    penalty = 0
    if len(critical) >= 2:   penalty += 25
    elif len(critical) == 1: penalty += 10
    if len(important) >= 4:  penalty += 10
    if len(fail_skills) > 0: penalty += 25 * len(fail_skills)
    health = max(0, 100 - penalty)
    grade  = 'A' if health >= 80 else ('B' if health >= 60 else 'C' if health >= 40 else 'D')

    # 上次學習
    learn_ver  = ''
    learn_time = ''
    if NOTIFY_FILE.exists():
        for line in NOTIFY_FILE.read_text(encoding='utf-8').splitlines():
            if '版本：' in line:
                learn_ver  = line.split('：', 1)[-1].strip()
            elif '時間：' in line:
                learn_time = line.split('：', 1)[-1].strip()[:16]

    # ── Markdown 生成 ────────────────────────────────────
    lines = [
        f"# 天鷹保全監控系統狀態",
        f"",
        f"updated:: {ts}",
        f"health:: {health}",
        f"grade:: {grade}",
        f"",
        f"---",
        f"",
        f"## 系統健康度",
        f"",
        f"**{health}/100** \\[{grade}\\]",
        f"",
        f"> 更新時間：{ts}",
        f"",
        f"---",
        f"",
        f"## 失敗紀錄",
        f"",
        f"| 狀態 | 數量 |",
        f"|------|------|",
        f"| pending | {len(pending)} |",
        f"| critical | {len(critical)} |",
        f"| important | {len(important)} |",
        f"| learned | {len(learned)} |",
        f"| 總計 | {len(all_items)} |",
        f"",
    ]

    # 警示
    if critical or fail_skills:
        lines += ["### 警示", ""]
        if len(critical) >= 2:
            lines.append(f"- 🔴 critical {len(critical)} 筆，達觸發閾值 → 執行 auto-learn")
        if fail_skills:
            lines.append(f"- 🔴 技能驗證失敗：{', '.join(fail_skills)}")
        lines.append("")

    # 技能狀態
    lines += [
        "---",
        "",
        "## 技能狀態",
        f"",
        f"上次測試：{last_test_ts or '無記錄'}",
        f"",
        f"| 技能 | 版本 | 規則/步驟 | 狀態 |",
        f"|------|------|---------|------|",
    ]
    for skill, res in skill_results.items():
        m    = res.get('metrics', {})
        ver  = m.get('latest_version', '無版本')
        h3   = m.get('h3_rule_count', 0)
        ok   = '✅' if res.get('passed', True) else '❌'
        lines.append(f"| {skill} | {ver} | {h3} | {ok} |")
    if not skill_results:
        lines.append("| 無記錄 | - | - | - |")
    lines.append("")

    # 版本備份
    lines += [
        "---",
        "",
        "## 版本備份",
        "",
        "| 技能 | 版本 | 備份數 | 最後備份 |",
        "|------|------|--------|---------|",
    ]
    for skill, entry in skills_backup.items():
        ver     = entry.get('current_version', '?')
        cnt     = len(entry.get('backups', []))
        last_ts = entry.get('backups', [{}])[-1].get('timestamp', '無')[:10] if entry.get('backups') else '無'
        lines.append(f"| {skill} | {ver} | {cnt} | {last_ts} |")
    if not skills_backup:
        lines.append("| 無備份記錄 | - | 0 | - |")
    lines.append("")

    # 上次自動學習
    lines += [
        "---",
        "",
        "## 上次自動學習",
        "",
        f"- 版本：{learn_ver or '無記錄'}",
        f"- 時間：{learn_time or '-'}",
        "",
        "---",
        "",
        "## 相關連結",
        "",
        f"- [[天鷹保全]]",
        f"- [[漢神巨蛋作業系統]]",
        f"- 月報：[[monthly-{now.strftime('%Y%m')}]]",
        "",
    ]

    return '\n'.join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description='天鷹 Obsidian 匯出器 v1.0')
    ap.add_argument('--dry-run', action='store_true', help='預覽，不寫入 vault')
    ap.add_argument('--path',    metavar='DIR',       help='手動指定 vault 根目錄')
    args = ap.parse_args()

    # 偵測 vault 路徑
    if args.path:
        vault = Path(args.path)
    else:
        vault = detect_vault_path()

    if not vault or not vault.exists():
        print(f"[ERR] 找不到 Obsidian vault 路徑")
        print(f"      在 monitor-config.yaml 加入：obsidian_vault_path: \"C:\\...\\vault\"")
        print(f"      或使用 --path <dir> 手動指定")
        return

    # 生成 Markdown
    content = build_obsidian_md()

    if args.dry_run:
        print(f"[預覽] vault：{vault}")
        print(f"       檔案：{OBSIDIAN_FOLDER}/{OBSIDIAN_FILE}")
        print()
        print(content)
        return

    # 寫入 vault
    target_dir  = vault / OBSIDIAN_FOLDER
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / OBSIDIAN_FILE
    target_file.write_text(content, encoding='utf-8')

    print(f"[OK] 已匯出至 Obsidian vault")
    print(f"     {target_file}")

    # 顯示健康度摘要
    for line in content.splitlines():
        if '健康度' in line or '/100' in line:
            print(f"     {line.strip()}")
            break


if __name__ == '__main__':
    main()
