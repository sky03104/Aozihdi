#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 回歸測試報告器 v1.0  (Track B-B3)
============================================
對 skills/ 內的 SKILL.md 執行：
  - 結構驗證（frontmatter、節點、內容大小）
  - 規則 / 步驟計數追蹤（### 標題數）
  - 歷史比對（成長趨勢）
  - 格式化測試報告輸出

用法：
  python regression-tester.py                      測試全部 skills
  python regression-tester.py --skill <name>       只測試指定 skill（不含 .md）
  python regression-tester.py --compare            顯示與上次成長比對
  python regression-tester.py --output             存 JSON 報告到 reports/

SKILL.md 放置路徑：tianying-monitor/skills/<skill-name>.md
（首次執行自動建立 skills/ 目錄並給出提示）
"""
import json
import re
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# ── 路徑
BASE_DIR     = Path(__file__).parent
SKILLS_DIR   = BASE_DIR / "skills"
REPORTS_DIR  = BASE_DIR / "reports"
HISTORY_FILE = BASE_DIR / "regression-history.json"

# ── 最低合格標準
MIN_CHARS = 500
MIN_H2    = 2


# ─────────────────────────────────────────────────────────
# 單一 SKILL.md 驗證
# ─────────────────────────────────────────────────────────
def check_skill(path: Path) -> Dict:
    """驗證單一 SKILL.md，回傳結構化結果"""
    result: Dict = {
        "skill":      path.stem,
        "checked_at": datetime.now().isoformat(),
        "passed":     True,
        "errors":     [],
        "warnings":   [],
        "metrics":    {},
    }

    if not path.exists():
        result["passed"] = False
        result["errors"].append("檔案不存在")
        return result

    text  = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    # 1. Frontmatter 檢查
    if not text.startswith("---"):
        result["errors"].append("缺少 frontmatter（應以 --- 開頭）")
        result["passed"] = False
    else:
        fm_end = text.find("\n---", 3)
        if fm_end == -1:
            result["errors"].append("frontmatter 未關閉（缺第二個 ---）")
            result["passed"] = False
        else:
            fm = text[3:fm_end]
            if "name:" not in fm:
                result["warnings"].append("frontmatter 缺 name: 欄位")
            if "description:" not in fm:
                result["warnings"].append("frontmatter 缺 description: 欄位")

    # 2. 節點結構
    h2_list = re.findall(r"^## .+", text, re.MULTILINE)
    h3_list = re.findall(r"^### .+", text, re.MULTILINE)

    if len(h2_list) < MIN_H2:
        result["errors"].append(f"## 二級節點不足（{len(h2_list)} < {MIN_H2}）")
        result["passed"] = False

    # 3. 內容大小
    char_count = len(text)
    if char_count < MIN_CHARS:
        result["errors"].append(f"內容過短（{char_count} 字元 < {MIN_CHARS}）")
        result["passed"] = False

    # 4. 日期格式
    bad_dates: List[str] = []
    for d in re.findall(r"\d{4}-\d{2}-\d{2}", text):
        try:
            datetime.strptime(d, "%Y-%m-%d")
        except ValueError:
            bad_dates.append(d)
    if bad_dates:
        result["warnings"].append(f"疑似無效日期：{bad_dates[:3]}")

    # 5. 版本記錄
    versions = re.findall(r"^### (v\d+\.\d+)", text, re.MULTILINE)

    # 6. 優先級關鍵字分佈
    priority_counts = {
        "critical":  text.lower().count("critical"),
        "important": text.lower().count("important"),
        "optional":  text.lower().count("optional"),
    }

    result["metrics"] = {
        "char_count":       char_count,
        "line_count":       len(lines),
        "h2_section_count": len(h2_list),
        "h3_rule_count":    len(h3_list),
        "sections":         h2_list[:8],
        "priority_counts":  priority_counts,
        "has_changelog":    bool(re.search(r"^## 更新歷史", text, re.MULTILINE)),
        "latest_version":   versions[0] if versions else None,
        "version_count":    len(versions),
    }
    return result


# ─────────────────────────────────────────────────────────
# 歷史記錄
# ─────────────────────────────────────────────────────────
def load_history() -> Dict:
    if not HISTORY_FILE.exists():
        return {"runs": []}
    try:
        return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"runs": []}


def save_history(history: Dict, run: Dict) -> None:
    history.setdefault("runs", []).append(run)
    history["runs"] = history["runs"][-50:]      # 保留最近 50 次
    HISTORY_FILE.write_text(
        json.dumps(history, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def compare_with_last(curr: Dict[str, Dict], history: Dict) -> Dict:
    """本次 vs 歷史最後一次，計算成長差異"""
    runs = history.get("runs", [])
    if not runs:
        return {}

    last = runs[-1].get("results", {})   # 歷史最後一次（save_history 之前呼叫，所以 -1 = 上次）
    out: Dict = {}

    for skill, res in curr.items():
        cm = res.get("metrics", {})
        lm = last.get(skill, {}).get("metrics", {})
        if not lm:
            out[skill] = {"status": "新增"}
            continue
        rd = cm.get("h3_rule_count", 0) - lm.get("h3_rule_count", 0)
        cd = cm.get("char_count",    0) - lm.get("char_count",    0)
        out[skill] = {
            "trend":     ("成長(+)" if rd > 0 else ("縮減(-)" if rd < 0 else "持平")),
            "rule_diff": rd,
            "char_diff": cd,
        }
    return out


# ─────────────────────────────────────────────────────────
# 報告輸出
# ─────────────────────────────────────────────────────────
def print_report(results: Dict[str, Dict], comparisons: Dict) -> None:
    sep       = "=" * 60
    all_pass  = all(r.get("passed") for r in results.values())
    status    = "[ALL PASS]" if all_pass else "[FAILED  ]"

    print(f"\n{sep}")
    print("回歸測試報告")
    print(sep)
    print(f"整體狀態：{status}")
    print(f"時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    for skill, res in results.items():
        icon = "[OK]" if res.get("passed") else "[NG]"
        m    = res.get("metrics", {})
        ver  = m.get("latest_version") or "無版本記錄"
        print(f"  {icon} {skill}  [{ver}]")

        if m:
            print(
                f"       字元 {m.get('char_count', 0):>7,}  "
                f"行數 {m.get('line_count', 0):>5,}  "
                f"##節點 {m.get('h2_section_count', 0):>2}  "
                f"###規則/步驟 {m.get('h3_rule_count', 0):>4}"
            )

        for err in res.get("errors",   []):
            print(f"       [ERR] {err}")
        for wrn in res.get("warnings", []):
            print(f"       [WRN] {wrn}")

        # 成長比對
        c = comparisons.get(skill, {})
        if c.get("trend"):
            sr = "+" if c["rule_diff"] >= 0 else ""
            sc = "+" if c["char_diff"] >= 0 else ""
            print(
                f"       [{c['trend']}]  "
                f"規則/步驟 {sr}{c['rule_diff']}  "
                f"字元 {sc}{c['char_diff']:,}"
            )
        print()

    total  = len(results)
    passed = sum(1 for r in results.values() if r.get("passed"))
    pct    = f"{passed / total * 100:.0f}%" if total else "N/A"
    print(f"通過 {passed}/{total}  ({pct})")


# ─────────────────────────────────────────────────────────
# 入口
# ─────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description="天鷹 SKILL.md 回歸測試報告器 v1.0")
    ap.add_argument("--skill",   metavar="NAME", help="只測試指定 skill（不含 .md）")
    ap.add_argument("--compare", action="store_true", help="顯示與上次成長比對")
    ap.add_argument("--output",  action="store_true", help="存 JSON 報告到 reports\\")
    args = ap.parse_args()

    # 確保 skills\ 目錄存在
    if not SKILLS_DIR.exists():
        SKILLS_DIR.mkdir(parents=True)
        print("[INFO] 已建立 skills\\ 目錄")
        print("       請將 SKILL.md 複製到此目錄")
        print("       格式：skills\\<skill-name>.md")
        print("       範例：skills\\tianying-tool-converter.md")
        return

    # 決定要測試哪些 skills
    if args.skill:
        targets = [SKILLS_DIR / f"{args.skill}.md"]
    else:
        targets = sorted(SKILLS_DIR.glob("*.md"))

    if not targets:
        print("[INFO] skills\\ 目錄為空，請先複製 SKILL.md 到此目錄")
        return

    # 執行驗證
    results: Dict[str, Dict] = {}
    for path in targets:
        print(f"  >> 檢查 {path.stem}...", end="", flush=True)
        res = check_skill(path)
        results[path.stem] = res
        print(" OK" if res["passed"] else " FAIL")

    # 歷史 & 比對（compare 在 save_history 之前呼叫，使 runs[-1] = 上次）
    history     = load_history()
    comparisons = compare_with_last(results, history) if args.compare else {}

    # 存入本次歷史
    run_record = {"timestamp": datetime.now().isoformat(), "results": results}
    save_history(history, run_record)

    # 輸出報告
    print_report(results, comparisons)

    if args.output:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        ts   = datetime.now().strftime("%Y%m%d-%H%M%S")
        path = REPORTS_DIR / f"regression-{ts}.json"
        path.write_text(
            json.dumps(
                {"results": results, "comparisons": comparisons},
                ensure_ascii=False, indent=2
            ),
            encoding="utf-8"
        )
        print(f"\n[OK] 報告已儲存：{path}")


if __name__ == "__main__":
    main()
