#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 任務角色檢測器 v1.0  (Track C-C1)
============================================
輸入任務描述，自動推薦 auto-team 角色組合與 P0/P1/P2 任務拆解。
亦可掃描系統狀態，推薦下一步行動團隊組合。

用法：
  python task-detector.py "修 tool_report.html 的 React 版本問題"
  python task-detector.py --scan          掃描系統狀態，推薦行動組合
  python task-detector.py --interactive   互動輸入模式
  python task-detector.py --file f.txt    批量分析（每行一個任務）
"""
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List

BASE_DIR    = Path(__file__).parent
FAILURE_LOG = BASE_DIR / "failure-log.json"
REG_HISTORY = BASE_DIR / "regression-history.json"

# ── 角色定義（對應 auto-team SKILL.md）───────────────────
ROLES: Dict[str, Dict] = {
    "PM": {
        "icon": "[PM]", "name": "專案經理",
        "always": True, "keywords": [], "weight": 1.0,
        "desc": "需求釐清、任務拆解、進度追蹤",
    },
    "DEV": {
        "icon": "[DEV]", "name": "全端工程師",
        "always": False, "weight": 0.9,
        "keywords": [
            "寫", "改", "修", "開發", "實作", "建立", "新增", "刪除",
            "bug", "錯誤", "失敗", "程式", "腳本", "GAS", "API",
            "html", "python", "javascript", "js", "css",
            "工具", "頁面", "功能", "上傳", "下載", "fix",
        ],
        "desc": "HTML/JS/GAS/Python 完整實作",
    },
    "QA": {
        "icon": "[QA]", "name": "QA 測試工程師",
        "always": False, "weight": 0.8,
        "triggers_with": ["DEV"],
        "keywords": ["測試", "驗證", "檢查", "確認", "bug", "錯誤", "問題"],
        "desc": "沙盒模擬、邊界測試、交付驗證",
    },
    "ARCH": {
        "icon": "[ARCH]", "name": "系統架構師",
        "always": False, "weight": 0.7,
        "keywords": [
            "架構", "設計", "系統", "規劃", "整合", "分離", "MPA", "重構",
            "拆分", "模組", "相容", "遷移", "升級", "框架",
        ],
        "desc": "技術選型、模組拆分、相容性評估",
    },
    "UI": {
        "icon": "[UI]", "name": "UI/UX 設計師",
        "always": False, "weight": 0.7,
        "keywords": [
            "介面", "ui", "視覺", "版面", "樣式", "css", "色彩", "rwd",
            "手機", "按鈕", "卡片", "圖示", "品牌", "動畫", "splash",
        ],
        "desc": "視覺設計、品牌識別、RWD",
    },
    "TEST": {
        "icon": "[TEST]", "name": "測試驗證小組",
        "always": False, "weight": 0.6,
        "triggers_with": ["DEV"],
        "keywords": [
            "api", "gas", "驗證", "執行", "邊界", "回傳", "模擬",
            "呼叫", "請求", "回應", "json",
        ],
        "desc": "實際執行程式碼、API 驗證",
    },
    "DA": {
        "icon": "[DA]", "name": "股票分析師",
        "always": False, "weight": 0.9,
        "keywords": [
            "股票", "美股", "分析", "基本面", "技術面", "投資", "財報",
            "市場", "etf", "漲", "跌", "報酬", "風險",
        ],
        "desc": "美股資料解讀、技術/基本面分析",
    },
    "LIFE": {
        "icon": "[LIFE]", "name": "生活助理",
        "always": False, "weight": 0.5,
        "keywords": ["日常", "生活", "流程", "排程", "習慣", "清單", "提醒", "行程"],
        "desc": "日常工具規劃、流程自動化",
    },
}

# ── 複雜度 & 優先級信號 ───────────────────────────────────
_COMPLEX_SIGNALS = ["架構", "系統", "整合", "所有", "全部", "遷移", "重構", "多個", "並行", "完整", "全新"]
_SIMPLE_SIGNALS  = ["修一下", "小改", "只要", "簡單", "快速", "一行", "一個"]

_P0_SIGNALS = ["緊急", "立刻", "bug", "錯誤", "壞了", "掛了", "閃退", "無法", "修", "fix", "urgent"]
_P1_SIGNALS = ["新增", "開發", "實作", "功能", "工具", "頁面", "寫"]
_P2_SIGNALS = ["優化", "改善", "美化", "整理", "調整", "建議"]


# ── 核心偵測 ──────────────────────────────────────────────
def detect_roles(text: str) -> List[Dict]:
    tl = text.lower()
    activated: List[Dict] = []
    activated_codes: List[str] = []

    # PM 永遠出動
    activated.append({**ROLES["PM"], "code": "PM", "score": 1.0, "reason": "所有任務必出"})
    activated_codes.append("PM")

    # 關鍵字比對
    for code, role in ROLES.items():
        if code == "PM":
            continue
        hits = [kw for kw in role.get("keywords", []) if kw in tl]
        if hits:
            score = min(len(hits) / max(len(role["keywords"]), 1) * role["weight"] + 0.3, 1.0)
            activated.append({
                **role, "code": code,
                "score": round(score, 2),
                "reason": "關鍵字：" + ", ".join(hits[:3]),
            })
            activated_codes.append(code)

    # 級聯觸發（DEV 出動 -> QA/TEST 必跟）
    for code, role in ROLES.items():
        if code in activated_codes:
            continue
        triggers = role.get("triggers_with", [])
        if any(t in activated_codes for t in triggers):
            activated.append({
                **role, "code": code,
                "score": 0.7,
                "reason": "級聯觸發（" + "/".join(triggers) + " 已出動）",
            })
            activated_codes.append(code)

    return sorted(activated, key=lambda x: -x["score"])


def estimate_complexity(text: str, n_roles: int) -> str:
    tl = text.lower()
    if any(kw in tl for kw in _SIMPLE_SIGNALS) and n_roles <= 2:
        return "simple"
    if n_roles >= 5 or sum(1 for kw in _COMPLEX_SIGNALS if kw in tl) >= 2 or len(text) > 80:
        return "complex"
    return "medium"


def estimate_priority(text: str) -> str:
    tl = text.lower()
    for kw in _P0_SIGNALS:
        if kw in tl:
            return "P0"
    for kw in _P1_SIGNALS:
        if kw in tl:
            return "P1"
    return "P2"


def build_breakdown(roles: List[Dict], priority: str, complexity: str) -> Dict:
    codes    = [r["code"] for r in roles]
    bd: Dict = {"P0": [], "P1": [], "P2": []}

    if "ARCH" in codes and complexity in ("medium", "complex"):
        bd["P0"].append("[ARCH] 技術方案確認")
    if "DEV" in codes:
        if priority == "P0":
            bd["P0"].append("[DEV] 緊急修復核心問題")
        else:
            bd["P1"].append("[DEV] 實作核心功能")
    if "UI" in codes:
        bd["P1"].append("[UI] 視覺規範套用")
    if "DA" in codes:
        bd["P0"].append("[DA] 資料分析")
    if "TEST" in codes or "QA" in codes:
        bd["P2"].append("[TEST+QA] 驗證 + 交付核准")

    return {k: v for k, v in bd.items() if v}


def print_analysis(text: str, roles: List[Dict], complexity: str, priority: str, breakdown: Dict):
    CX = {"simple": "簡單(<1hr)", "medium": "中等(1-3hr)", "complex": "複雜(>3hr)"}
    sep = "=" * 60
    print(f"\n{sep}\n任務角色檢測\n{sep}")
    print(f"任務：{text[:60]}{'...' if len(text) > 60 else ''}")
    print(f"複雜度：{CX.get(complexity, complexity)}  優先級：{priority}")
    print()
    print("出動角色：")
    for r in roles:
        bar = chr(9608) * int(r["score"] * 8)
        print(f"  {r['icon']:7s} {bar:<8} {r['name']:<12}  {r['reason']}")
    print()
    if breakdown:
        print("任務拆解：")
        for lv in ["P0", "P1", "P2"]:
            for item in breakdown.get(lv, []):
                print(f"  [{lv}] {item}")
    print()
    role_str = " + ".join(r["icon"] for r in roles)
    print(f"宣告：{role_str} — 依 P0→P1→P2 執行")


# ── --scan 模式 ───────────────────────────────────────────
def scan_system():
    print("\n=== 系統狀態掃描 ===")
    pending       = 0
    critical_cnt  = 0
    important_cnt = 0

    if FAILURE_LOG.exists():
        log   = json.loads(FAILURE_LOG.read_text(encoding="utf-8"))
        items = log.get("failures", []) + log.get("discoveries", [])
        p     = [i for i in items if i.get("status") == "pending_learn"]
        pending       = len(p)
        critical_cnt  = sum(1 for i in p if i.get("priority") == "critical")
        important_cnt = sum(1 for i in p if i.get("priority") == "important")
        print(f"  待處理：{pending} 筆  critical={critical_cnt}  important={important_cnt}")
    else:
        print("  failure-log.json 不存在（尚無監控資料）")

    skill_fail = []
    if REG_HISTORY.exists():
        history = json.loads(REG_HISTORY.read_text(encoding="utf-8"))
        runs    = history.get("runs", [])
        if runs:
            last = runs[-1].get("results", {})
            skill_fail = [k for k, v in last.items() if not v.get("passed")]
            ok         = len(last) - len(skill_fail)
            print(f"  技能驗證：{ok} 通過  {len(skill_fail)} 失敗" + (f"（{', '.join(skill_fail)}）" if skill_fail else ""))
    else:
        print("  regression-history.json 不存在（先執行 regression-tester.py）")

    print()
    if skill_fail:
        print("  [推薦] [DEV]+[QA] 修復失敗技能 →")
        for sf in skill_fail:
            print(f"         skills/{sf}.md 需修正")
    elif critical_cnt >= 2:
        print("  [推薦] [DEV]+[QA] 處理 critical 失敗 → auto-learn")
        print("         指令：python workflow-monitor.py --mode auto-learn")
    elif important_cnt >= 4:
        print("  [推薦] 執行 auto-learn 清理 important 積壓")
        print("         指令：python workflow-monitor.py --mode auto-learn")
    elif pending > 0:
        print(f"  [等待] 積累中（{pending} 筆），閾值：critical>=2 或 important>=4")
    else:
        print("  [OK] 系統健康，無緊急行動需求")

    # 順便分析時間
    print(f"\n  掃描時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


# ── 入口 ──────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="天鷹任務角色檢測器 v1.0")
    ap.add_argument("task",          nargs="?",          help="任務描述文字")
    ap.add_argument("--scan",        action="store_true", help="掃描系統狀態，推薦行動組合")
    ap.add_argument("--interactive", action="store_true", help="互動輸入模式")
    ap.add_argument("--file",        metavar="FILE",      help="批量分析（每行一個任務）")
    args = ap.parse_args()

    if args.scan:
        scan_system()
        return

    def _analyze(text: str):
        roles      = detect_roles(text)
        complexity = estimate_complexity(text, len(roles))
        priority   = estimate_priority(text)
        breakdown  = build_breakdown(roles, priority, complexity)
        print_analysis(text, roles, complexity, priority, breakdown)

    if args.interactive:
        print("天鷹任務角色檢測器（輸入 q 離開）")
        while True:
            text = input("\n任務描述 > ").strip()
            if text.lower() in ("q", "quit", "exit", "離開"):
                break
            if text:
                _analyze(text)
        return

    if args.file:
        fp = Path(args.file)
        if not fp.exists():
            print(f"[ERR] 找不到 {args.file}")
            return
        for line in fp.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                _analyze(line)
        return

    if args.task:
        _analyze(args.task)
        return

    ap.print_help()


if __name__ == "__main__":
    main()
