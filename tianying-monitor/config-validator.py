#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 設定檔驗證器 v1.0  (Week 4)
==========================================
驗證 monitor-config.yaml 的結構完整性與欄位正確性。
修改設定後執行，確保所有腳本都能正常讀取。

用法：
  python config-validator.py              驗證設定檔
  python config-validator.py --verbose    顯示所有已通過項目
  python config-validator.py --fix        顯示修復建議範本
"""
import re
import argparse
from pathlib import Path
from typing import Dict, List, Tuple

BASE_DIR    = Path(__file__).parent
CONFIG_FILE = BASE_DIR / 'monitor-config.yaml'

# 有效的 priority 值
VALID_PRIORITIES = {'critical', 'important', 'optional'}

# 必須存在的頂層 YAML 鍵（寬鬆檢查，只看關鍵字）
REQUIRED_KEYS = [
    'monitoring',
    'failure_patterns',
]


# ── YAML 手動解析（不依賴 pyyaml）───────────────────────
def _read_lines(path: Path) -> List[str]:
    return path.read_text(encoding='utf-8').splitlines()


def _extract_patterns(text: str) -> List[Dict]:
    """解析 failure_patterns 區塊"""
    patterns = []
    in_block = False
    cur: Dict = {}

    for line in text.splitlines():
        stripped = line.strip()

        if not in_block:
            if 'failure_patterns:' in line:
                in_block = True
            continue

        if stripped and not stripped.startswith('#') and not stripped.startswith('-'):
            indent = len(line) - len(line.lstrip())
            if indent <= 2 and ':' in stripped:
                break

        if not stripped or stripped.startswith('#'):
            continue

        if stripped.startswith('- pattern:'):
            if cur.get('pattern') is not None:
                patterns.append(cur)
            cur = {'pattern': stripped.split(':', 1)[1].strip().strip('"')}
        elif stripped.startswith('priority:') and 'pattern' in cur:
            cur['priority'] = stripped.split(':', 1)[1].strip().strip('"')
        elif stripped.startswith('section:') and 'pattern' in cur:
            cur['section'] = stripped.split(':', 1)[1].strip().strip('"')

    if cur.get('pattern') is not None:
        patterns.append(cur)
    return patterns


def _extract_thresholds(text: str) -> Dict:
    """解析 auto_trigger 閾值"""
    result = {}
    in_block = False

    for line in text.splitlines():
        stripped = line.strip()
        if 'auto_trigger:' in line:
            in_block = True
            continue
        if not in_block:
            continue
        if stripped and not stripped.startswith('#'):
            indent = len(line) - len(line.lstrip())
            if indent <= 2 and ':' in stripped and not stripped.startswith('-'):
                if 'threshold' not in stripped.lower() and 'trigger' not in stripped.lower():
                    break
            if 'critical_threshold:' in stripped or 'threshold' in stripped.lower():
                try:
                    val = int(stripped.split(':', 1)[1].strip())
                    key = stripped.split(':', 1)[0].strip()
                    result[key] = val
                except ValueError:
                    pass

    return result


# ── 驗證邏輯 ─────────────────────────────────────────────
def validate(verbose: bool = False) -> Tuple[List[str], List[str], List[str]]:
    """回傳 (passes, warnings, errors)"""
    passes:   List[str] = []
    warnings: List[str] = []
    errors:   List[str] = []

    # 1. 檔案存在
    if not CONFIG_FILE.exists():
        errors.append(f"找不到設定檔：{CONFIG_FILE}")
        return passes, warnings, errors
    passes.append('設定檔存在')

    text = CONFIG_FILE.read_text(encoding='utf-8')

    # 2. 必要關鍵字
    for key in REQUIRED_KEYS:
        if key + ':' in text or key in text:
            passes.append(f"存在必要鍵：{key}")
        else:
            errors.append(f"缺少必要鍵：{key}")

    # 3. failure_patterns 解析
    patterns = _extract_patterns(text)

    if not patterns:
        errors.append("failure_patterns 無法解析或為空")
    else:
        passes.append(f"failure_patterns 共 {len(patterns)} 條")

        seen_patterns = set()
        for i, p in enumerate(patterns):
            pfx = f"pattern[{i+1}] {repr(p.get('pattern','')[:30])}"

            # 必要欄位
            if not p.get('pattern'):
                errors.append(f"{pfx}：pattern 欄位空白")
            else:
                passes.append(f"{pfx}：pattern OK") if verbose else None

            if not p.get('priority'):
                errors.append(f"{pfx}：缺少 priority 欄位")
            elif p['priority'] not in VALID_PRIORITIES:
                errors.append(f"{pfx}：priority 值無效（{p['priority']}），應為 critical/important/optional")
            else:
                passes.append(f"{pfx}：priority={p['priority']} OK") if verbose else None

            if not p.get('section'):
                errors.append(f"{pfx}：缺少 section 欄位")
            elif len(p['section']) < 2:
                warnings.append(f"{pfx}：section 過短（{p['section']}）")
            else:
                passes.append(f"{pfx}：section OK") if verbose else None

            # 重複檢查
            pat_key = p.get('pattern', '').lower()
            if pat_key in seen_patterns:
                warnings.append(f"{pfx}：pattern 與其他項目重複")
            else:
                seen_patterns.add(pat_key)

        # priority 分佈
        n_critical  = sum(1 for p in patterns if p.get('priority') == 'critical')
        n_important = sum(1 for p in patterns if p.get('priority') == 'important')
        n_optional  = sum(1 for p in patterns if p.get('priority') == 'optional')
        passes.append(f"priority 分佈：critical={n_critical} important={n_important} optional={n_optional}")

        if n_critical == 0:
            warnings.append("無 critical 等級 pattern（建議至少設定 1 條）")

    # 4. 閾值設定
    thresholds = _extract_thresholds(text)
    if thresholds:
        for k, v in thresholds.items():
            if v < 1:
                warnings.append(f"閾值 {k}={v} 過低（建議 >= 1）")
            elif v > 10:
                warnings.append(f"閾值 {k}={v} 過高（可能長期不觸發學習）")
            else:
                passes.append(f"閾值 {k}={v} 合理")
    else:
        warnings.append("未找到 auto_trigger 閾值設定（使用腳本預設值 2）")

    # 5. 編碼檢查
    try:
        CONFIG_FILE.read_text(encoding='utf-8')
        passes.append('UTF-8 編碼正確')
    except UnicodeDecodeError:
        errors.append('非 UTF-8 編碼，部分腳本可能讀取失敗')

    return passes, warnings, errors


def print_fix_template() -> None:
    """顯示最小合法設定範本"""
    print("""
monitor-config.yaml 最小合法範本：
------------------------------------
## 監控規則
monitoring:
  failure_patterns:
    - pattern: "node --check failed"
      priority: "critical"
      section: "SOP 驗證"

    - pattern: "grep verification failed"
      priority: "critical"
      section: "規範檢查清單"

    - pattern: "empId not passed"
      priority: "important"
      section: "工號狀態傳遞修正"

## 自動觸發規則
auto_trigger:
  critical_threshold: 2
  important_threshold: 4
------------------------------------
""")


def main() -> None:
    ap = argparse.ArgumentParser(description='天鷹設定檔驗證器 v1.0')
    ap.add_argument('--verbose', action='store_true', help='顯示所有通過項目')
    ap.add_argument('--fix',     action='store_true', help='顯示修復範本')
    args = ap.parse_args()

    if args.fix:
        print_fix_template()
        return

    passes, warnings, errors = validate(verbose=args.verbose)

    sep = '=' * 56
    print(f"\n{sep}\n設定檔驗證  {CONFIG_FILE.name}\n{sep}")

    if args.verbose:
        for p in passes:
            print(f"  [PASS] {p}")
    else:
        print(f"  通過項目：{len(passes)} 個")

    for w in warnings:
        print(f"  [WARN] {w}")

    for e in errors:
        print(f"  [FAIL] {e}")

    print()
    status = '[ALL PASS]' if not errors else f'[FAIL] {len(errors)} 個錯誤'
    warn_s = f'  警告 {len(warnings)}' if warnings else ''
    print(f"結果：{status}{warn_s}")

    if errors:
        print("\n提示：執行 python config-validator.py --fix 查看修復範本")

    print(sep)


if __name__ == '__main__':
    main()
