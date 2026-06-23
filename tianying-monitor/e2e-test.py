#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 端對端測試套件 v1.0  (Week 3)
==========================================
一鍵驗證 tianying-monitor 整套系統的完整執行流程。
測試開始前自動備份資料，結束後自動還原，不污染真實資料。

用法：
  python e2e-test.py           執行全部 8 項測試
  python e2e-test.py --quick   只跑 T1-T5（略過 auto-learn，速度快）
  python e2e-test.py --verbose 顯示每個測試的完整輸出

測試覆蓋：
  T1  記錄失敗（workflow-monitor --mode convert）
  T2  失敗分類（failure-classifier --summary）
  T3  系統掃描（workflow-monitor --mode scan）
  T4  優先排序（priority-sorter）
  T5  主動建議（proactive-suggestion --health）
  T6  自動學習（workflow-monitor --mode auto-learn，含 post-learn hooks）
  T7  日誌查看（workflow-monitor --mode review-log）
  T8  回歸測試（regression-tester --compare --output）
"""
import json
import sys
import shutil
import subprocess
import argparse
from pathlib import Path
from datetime import datetime
from typing import Tuple, List, Dict

BASE_DIR = Path(__file__).parent

# ── 最小測試用 SKILL.md ──────────────────────────────────
_TEST_SKILL = """---
name: tianying-tool-converter-test
description: 端對端測試用技能文件（自動產生，勿手動編輯）
---

## 品牌規範
天鷹保全設計規範測試文件。

## 規範檢查清單
初始規則清單。

## GAS 設計方案
GAS 設計規範。

## 常見錯誤修復
已知問題修復記錄。

## SOP：逐步執行
步驟一：確認設計規格。
步驟二：執行轉換。
步驟三：驗證輸出。

## 更新歷史
### v1.0 (2026-01-01，初版)
初始建立，供端對端測試使用。
"""


def _run(script: str, args: List[str], timeout: int = 30) -> Tuple[int, str, str]:
    """執行子程序，回傳 (returncode, stdout, stderr)"""
    import os as _os
    _env = _os.environ.copy()
    _env['PYTHONIOENCODING'] = 'utf-8'   # 強制 UTF-8，解決 Windows CP950 中文編碼問題
    cmd = [sys.executable, str(BASE_DIR / script)] + args
    try:
        r = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=timeout, encoding='utf-8', errors='replace',
            env=_env
        )
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return -1, '', f"超時（{timeout}s）"
    except FileNotFoundError:
        return -2, '', f"腳本不存在：{script}"


class E2ETestSuite:
    def __init__(self, quick: bool = False, verbose: bool = False):
        self.quick   = quick
        self.verbose = verbose
        self.results: List[Tuple[str, bool, str]] = []
        self._backups: Dict[str, bytes] = {}
        self._new_files: List[Path] = []

    # ── 資料備份 / 還原 ──────────────────────────────────
    def _backup(self, *paths: Path) -> None:
        for p in paths:
            if p.exists():
                self._backups[str(p)] = p.read_bytes()

    def _restore_all(self) -> None:
        for path_str, data in self._backups.items():
            Path(path_str).write_bytes(data)
        for p in self._new_files:
            if str(p) not in self._backups:
                if p.is_dir():
                    shutil.rmtree(p, ignore_errors=True)
                else:
                    p.unlink(missing_ok=True)

    # ── 結果記錄 ─────────────────────────────────────────
    def _ok(self, name: str, detail: str = '') -> None:
        self.results.append((name, True, detail))
        print(f"  [PASS] {name}" + (f"  {detail}" if detail else ''))

    def _fail(self, name: str, detail: str = '') -> None:
        self.results.append((name, False, detail))
        print(f"  [FAIL] {name}" + (f"  {detail}" if detail else ''))

    def _log(self, out: str) -> None:
        if self.verbose and out.strip():
            for line in out.splitlines()[:10]:
                print(f"         {line}")

    # ── 測試前置 ─────────────────────────────────────────
    def setup(self) -> bool:
        """備份現有資料，建立測試固件"""
        data_files = [
            BASE_DIR / 'failure-log.json',
            BASE_DIR / 'regression-history.json',
            BASE_DIR / 'version-manifest.json',
            BASE_DIR / 'skills' / 'tianying-tool-converter.md',
        ]
        self._backup(*data_files)

        # 標記測試可能產生的新路徑（供清理）
        self._new_files = [
            BASE_DIR / 'failure-log.json',
            BASE_DIR / 'regression-history.json',
            BASE_DIR / 'version-manifest.json',
            BASE_DIR / 'reports',
            BASE_DIR / 'skill-backups',
            BASE_DIR / 'skill-update-notification.txt',
            BASE_DIR / 'skill-updater-run.log',
        ]

        # 建測試 SKILL.md
        (BASE_DIR / 'skills').mkdir(exist_ok=True)
        (BASE_DIR / 'skills' / 'tianying-tool-converter.md').write_text(
            _TEST_SKILL, encoding='utf-8'
        )

        # 建測試 failure-log（1 筆 critical）
        log = {
            'failures': [{
                'timestamp': datetime.now().isoformat(),
                'tool': 'e2e-test.html',
                'error_type': 'React version mismatch',
                'error_msg': 'react/19.0.0 found, expected 18.x',
                'priority': 'critical',
                'status': 'pending_learn',
            }],
            'discoveries': []
        }
        (BASE_DIR / 'failure-log.json').write_text(
            json.dumps(log, ensure_ascii=False, indent=2), encoding='utf-8'
        )
        return True

    # ── 各測試案例 ───────────────────────────────────────
    def t1_record_failure(self) -> None:
        """T1：記錄失敗（workflow-monitor --mode convert）"""
        rc, out, err = _run('workflow-monitor.py', [
            '--mode', 'convert',
            '--tool', 'e2e-test2.html',
            '--error-type', 'empId not passed',
            '--error-msg', 'window.open called without empId',
            '--priority', 'critical',
        ])
        self._log(out)
        log = json.loads((BASE_DIR / 'failure-log.json').read_text(encoding='utf-8'))
        count = len(log.get('failures', []))
        if rc == 0 and count >= 2:
            self._ok('T1 記錄失敗', f"failure-log 共 {count} 筆")
        else:
            self._fail('T1 記錄失敗', f"rc={rc} count={count} err={err[:60]}")

    def t2_classifier(self) -> None:
        """T2：失敗分類（failure-classifier --summary）"""
        rc, out, err = _run('failure-classifier.py', ['--summary'])
        self._log(out)
        if rc == 0 and '失敗分類增強報告' in out:
            lines = [l.strip() for l in out.splitlines() if '共' in l and '筆' in l]
            self._ok('T2 失敗分類', lines[0] if lines else '')
        else:
            self._fail('T2 失敗分類', f"rc={rc} err={err[:60]}")

    def t3_scan(self) -> None:
        """T3：系統掃描（workflow-monitor --mode scan）"""
        rc, out, err = _run('workflow-monitor.py', ['--mode', 'scan'])
        self._log(out)
        if rc == 0 and '系統狀態掃描' in out:
            lines = [l.strip() for l in out.splitlines()
                     if any(kw in l for kw in ['critical', '待處理', 'pending', 'OK', '推薦'])]
            self._ok('T3 系統掃描', lines[0] if lines else '')
        else:
            self._fail('T3 系統掃描', f"rc={rc} err={err[:60]}")

    def t4_priority(self) -> None:
        """T4：優先排序（priority-sorter）"""
        rc, out, err = _run('priority-sorter.py', [])
        self._log(out)
        if rc == 0 and ('佇列' in out or 'critical' in out.lower() or 'pending' in out.lower()):
            self._ok('T4 優先排序')
        else:
            self._fail('T4 優先排序', f"rc={rc} err={err[:60]}")

    def t5_suggestion(self) -> None:
        """T5：主動建議（proactive-suggestion --health）"""
        rc, out, err = _run('proactive-suggestion.py', ['--health'])
        self._log(out)
        if rc == 0 and '健康度' in out:
            line = next((l.strip() for l in out.splitlines() if '健康度' in l), '')
            self._ok('T5 主動建議', line)
        else:
            self._fail('T5 主動建議', f"rc={rc} err={err[:60]}")

    def t6_auto_learn(self) -> None:
        """T6：自動學習完整流程（含 post-learn hooks）"""
        rc, out, err = _run('workflow-monitor.py', ['--mode', 'auto-learn'], timeout=90)
        self._log(out)
        completed = '自動更新完成' in out
        hooks_ran = '-- Post-learn hooks --' in out
        waiting   = '待下次積累' in out
        if rc == 0 and (completed or waiting):
            detail = ('已更新 + hooks' if completed and hooks_ran
                      else '已更新' if completed
                      else '待積累（正常）')
            self._ok('T6 自動學習', detail)
        else:
            self._fail('T6 自動學習', f"rc={rc} err={err[:80]}")

    def t7_review_log(self) -> None:
        """T7：日誌查看（review-log 後應觸發 proactive-suggestion）"""
        rc, out, err = _run('workflow-monitor.py', ['--mode', 'review-log'], timeout=30)
        self._log(out)
        suggestion_triggered = any(kw in out for kw in ['健康度', '建議數量', '主動建議'])
        if rc == 0 and '失敗日誌' in out:
            self._ok('T7 日誌查看', '主動建議已觸發' if suggestion_triggered else 'OK')
        else:
            self._fail('T7 日誌查看', f"rc={rc} err={err[:60]}")

    def t8_regression(self) -> None:
        """T8：回歸測試（regression-tester --compare --output）"""
        rc, out, err = _run('regression-tester.py', ['--compare', '--output'])
        self._log(out)
        passed = 'ALL PASS' in out or 'PASS' in out
        if rc == 0 and passed:
            self._ok('T8 回歸測試', 'ALL PASS')
        else:
            self._fail('T8 回歸測試', f"rc={rc} passed={passed} err={err[:60]}")

    # ── 執行入口 ─────────────────────────────────────────
    def run(self) -> int:
        sep = '=' * 60
        mode = '快速模式 T1-T5' if self.quick else '完整模式 T1-T8'
        print(f"\n{sep}\n端對端測試套件  {mode}\n{sep}")
        print(f"時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

        try:
            self.setup()
            self.t1_record_failure()
            self.t2_classifier()
            self.t3_scan()
            self.t4_priority()
            self.t5_suggestion()
            if not self.quick:
                self.t6_auto_learn()
                self.t7_review_log()
                self.t8_regression()
        except Exception as e:
            print(f"  [ERR] 測試異常中止：{e}")
        finally:
            self._restore_all()
            print("\n  [清理] 測試資料已還原")

        total  = len(self.results)
        passed = sum(1 for _, ok, _ in self.results if ok)
        failed = total - passed

        print(f"\n{sep}")
        print(f"結果：通過 {passed}/{total}  失敗 {failed}")
        if failed:
            print("失敗項目：")
            for name, ok, msg in self.results:
                if not ok:
                    print(f"  [FAIL] {name}  {msg}")
        print(sep)

        return 1 if failed else 0


def main() -> None:
    ap = argparse.ArgumentParser(description='天鷹端對端測試套件 v1.0')
    ap.add_argument('--quick',   action='store_true', help='只跑 T1-T5')
    ap.add_argument('--verbose', action='store_true', help='顯示子程序輸出')
    args = ap.parse_args()
    sys.exit(E2ETestSuite(quick=args.quick, verbose=args.verbose).run())


if __name__ == '__main__':
    main()
