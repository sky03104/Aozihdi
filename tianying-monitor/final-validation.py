#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全監控系統 · 最終驗收腳本 v1.0  (Week 8)
================================================
一鍵驗收整套 tianying-monitor 系統的完整部署狀態。
通過代表系統可以正式上線全自動運作。

檢查項目：
  V1  必要腳本全部存在（20 個 .py + 2 個 .md）
  V2  Task Scheduler 排程全部建立（6 條）
  V3  monitor-config.yaml 驗證通過
  V4  skills/ 目錄有 SKILL.md 副本
  V5  regression-history.json 有歷史記錄
  V6  e2e-test 快速模式通過（T1-T5）
  V7  e2e-test 完整模式通過（T1-T8）
  V8  status-dashboard 可正常執行

用法：
  python final-validation.py            執行全部驗收
  python final-validation.py --quick    只跑 V1-V5（不含 e2e-test）
  python final-validation.py --report   存驗收報告到 reports/
"""
import json
import subprocess
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Tuple

BASE_DIR = Path(__file__).parent

# ── 必要腳本清單 ──────────────────────────────────────────
# Track A 簡化版名稱可能不同，列為可選（不影響主要驗收）
OPTIONAL_SCRIPTS = [
    "delivery-detector.py",
    "snapshot-generator.py",
    "auto-snapshot-runner.py",
]

REQUIRED_SCRIPTS = [
    # Track B
    "failure-classifier.py",
    "regression-tester.py",
    "skill-version-manager.py",
    # Track C
    "task-detector.py",
    "priority-sorter.py",
    "proactive-suggestion.py",
    # 整合層
    "workflow-monitor.py",
    # 維護
    "log-cleaner.py",
    "e2e-test.py",
    "config-validator.py",
    # 分析
    "status-dashboard.py",
    "trend-analyzer.py",
    "alert-dispatcher.py",
    # 報告
    "monthly-summary.py",
    "obsidian-export.py",
    # 文件
    "README.md",
    "QUICK_REF.md",
]

# ── 必要 Task Scheduler 排程 ──────────────────────────────
REQUIRED_TASKS = [
    "tianying-auto-learn",
    "tianying-regression",
    "tianying-log-clean",
    "tianying-dashboard",
    "tianying-alert",
    "tianying-monthly",
]


def _run(args: List[str], timeout: int = 60) -> Tuple[int, str, str]:
    import os as _os
    _env = _os.environ.copy()
    _env['PYTHONIOENCODING'] = 'utf-8'   # 強制子程序使用 UTF-8，解決 Windows CP950 問題
    try:
        r = subprocess.run(
            [sys.executable] + args,
            capture_output=True, text=True,
            timeout=timeout, encoding='utf-8', errors='replace',
            env=_env
        )
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return -1, '', f'超時（{timeout}s）'
    except Exception as e:
        return -2, '', str(e)


class FinalValidator:
    def __init__(self):
        self.results: List[Tuple[str, bool, str]] = []

    def _ok(self, name: str, detail: str = '') -> None:
        self.results.append((name, True, detail))
        print(f"  [PASS] {name}" + (f"  {detail}" if detail else ''))

    def _fail(self, name: str, detail: str = '') -> None:
        self.results.append((name, False, detail))
        print(f"  [FAIL] {name}" + (f"  {detail}" if detail else ''))

    # ── V1：腳本存在 ─────────────────────────────────────
    def v1_scripts(self) -> None:
        missing  = [s for s in REQUIRED_SCRIPTS if not (BASE_DIR / s).exists()]
        opt_miss = [s for s in OPTIONAL_SCRIPTS if not (BASE_DIR / s).exists()]
        if missing:
            self._fail('V1 必要腳本', f"缺少 {len(missing)} 個：{', '.join(missing[:5])}")
        else:
            note = f"，Track A {len(opt_miss)} 個可選未找到（正常）" if opt_miss else ''
            self._ok('V1 必要腳本', f"共 {len(REQUIRED_SCRIPTS)} 個全部存在{note}")

    # ── V2：Task Scheduler ───────────────────────────────
    def v2_scheduler(self) -> None:
        try:
            result = subprocess.run(
                ['schtasks', '/query', '/fo', 'list'],
                capture_output=True, text=True, timeout=10,
                encoding='utf-8', errors='replace'
            )
            existing = result.stdout
            missing = [t for t in REQUIRED_TASKS if t not in existing]
            if missing:
                self._fail('V2 Task Scheduler', f"缺少 {len(missing)} 條：{', '.join(missing)}")
            else:
                self._ok('V2 Task Scheduler', f"共 {len(REQUIRED_TASKS)} 條全部存在")
        except FileNotFoundError:
            self._fail('V2 Task Scheduler', 'schtasks 指令不可用（非 Windows？）')
        except Exception as e:
            self._fail('V2 Task Scheduler', str(e)[:60])

    # ── V3：config-validator ─────────────────────────────
    def v3_config(self) -> None:
        rc, out, err = _run([str(BASE_DIR / 'config-validator.py')])
        if rc == 0 and 'ALL PASS' in out:
            self._ok('V3 設定檔驗證', 'monitor-config.yaml ALL PASS')
        elif not (BASE_DIR / 'monitor-config.yaml').exists():
            self._fail('V3 設定檔驗證', 'monitor-config.yaml 不存在')
        else:
            self._fail('V3 設定檔驗證', f"rc={rc}")

    # ── V4：skills/ 目錄 ─────────────────────────────────
    def v4_skills(self) -> None:
        skills_dir = BASE_DIR / 'skills'
        if not skills_dir.exists():
            self._fail('V4 skills/ 目錄', '目錄不存在')
            return
        files = list(skills_dir.glob('*.md'))
        if not files:
            self._fail('V4 skills/ 目錄', '目錄為空（需放入 SKILL.md 副本）')
        else:
            self._ok('V4 skills/ 目錄', f"{len(files)} 份：{', '.join(f.stem for f in files)}")

    # ── V5：regression-history ───────────────────────────
    def v5_history(self) -> None:
        hist_file = BASE_DIR / 'regression-history.json'
        if not hist_file.exists():
            self._fail('V5 回歸歷史', '尚無記錄（執行 regression-tester.py 後會建立）')
            return
        try:
            data  = json.loads(hist_file.read_text(encoding='utf-8'))
            runs  = data.get('runs', [])
            last  = runs[-1].get('timestamp', '')[:10] if runs else '無'
            self._ok('V5 回歸歷史', f"共 {len(runs)} 次記錄  最後：{last}")
        except Exception as e:
            self._fail('V5 回歸歷史', str(e)[:60])

    # ── V6：e2e-test 快速 ────────────────────────────────
    def v6_e2e_quick(self) -> None:
        rc, out, err = _run([str(BASE_DIR / 'e2e-test.py'), '--quick'], timeout=60)
        passed = '通過 5/5' in out or '通過 5/' in out
        if rc == 0 and passed:
            self._ok('V6 e2e-test 快速（T1-T5）', '5/5 PASS')
        else:
            lines = [l.strip() for l in out.splitlines() if 'FAIL' in l or '通過' in l]
            self._fail('V6 e2e-test 快速（T1-T5）', lines[0] if lines else f"rc={rc}")

    # ── V7：e2e-test 完整 ────────────────────────────────
    def v7_e2e_full(self) -> None:
        rc, out, err = _run([str(BASE_DIR / 'e2e-test.py')], timeout=120)
        passed = '通過 8/8' in out
        if rc == 0 and passed:
            self._ok('V7 e2e-test 完整（T1-T8）', '8/8 PASS')
        else:
            lines = [l.strip() for l in out.splitlines() if 'FAIL' in l or '通過' in l]
            self._fail('V7 e2e-test 完整（T1-T8）', lines[0] if lines else f"rc={rc}")

    # ── V8：status-dashboard ─────────────────────────────
    def v8_dashboard(self) -> None:
        rc, out, err = _run([str(BASE_DIR / 'status-dashboard.py')])
        if rc == 0 and '天鷹保全監控系統' in out and '/100' in out:
            health_line = next((l.strip() for l in out.splitlines() if '/100' in l), '')
            self._ok('V8 status-dashboard', health_line)
        else:
            self._fail('V8 status-dashboard', f"rc={rc} err={err[:60]}")

    # ── 執行 ─────────────────────────────────────────────
    def run(self, quick: bool = False) -> int:
        sep = '=' * 60
        mode = '快速模式 V1-V5' if quick else '完整模式 V1-V8'
        print(f"\n{sep}")
        print(f"天鷹保全監控系統 · 最終驗收")
        print(f"模式：{mode}")
        print(f"時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(sep)
        print()

        self.v1_scripts()
        self.v2_scheduler()
        self.v3_config()
        self.v4_skills()
        self.v5_history()

        if not quick:
            self.v6_e2e_quick()
            self.v7_e2e_full()
            self.v8_dashboard()

        total  = len(self.results)
        passed = sum(1 for _, ok, _ in self.results if ok)
        failed = total - passed

        print(f"\n{sep}")
        if failed == 0:
            print(f"驗收結果：✅ 全部通過 {passed}/{total}")
            print(f"系統已就緒，可正式上線全自動運作。")
        else:
            print(f"驗收結果：❌ 未通過 {failed}/{total}")
            print(f"\n失敗項目：")
            for name, ok, msg in self.results:
                if not ok:
                    print(f"  [FAIL] {name}  {msg}")
        print(sep)

        return 0 if failed == 0 else 1

    def save_report(self) -> Path:
        reports_dir = BASE_DIR / 'reports'
        reports_dir.mkdir(parents=True, exist_ok=True)
        ts   = datetime.now().strftime('%Y%m%d-%H%M%S')
        path = reports_dir / f"final-validation-{ts}.json"
        path.write_text(
            json.dumps({
                'timestamp': datetime.now().isoformat(),
                'results': [
                    {'check': n, 'passed': ok, 'detail': d}
                    for n, ok, d in self.results
                ],
                'summary': {
                    'total':  len(self.results),
                    'passed': sum(1 for _, ok, _ in self.results if ok),
                    'failed': sum(1 for _, ok, _ in self.results if not ok),
                }
            }, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
        return path


def main() -> None:
    ap = argparse.ArgumentParser(description='天鷹監控系統最終驗收 v1.0')
    ap.add_argument('--quick',  action='store_true', help='只跑 V1-V5（略過 e2e-test）')
    ap.add_argument('--report', action='store_true', help='存驗收報告到 reports/')
    args = ap.parse_args()

    validator = FinalValidator()
    exit_code = validator.run(quick=args.quick)

    if args.report:
        path = validator.save_report()
        print(f"\n📄 驗收報告：{path}")

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
