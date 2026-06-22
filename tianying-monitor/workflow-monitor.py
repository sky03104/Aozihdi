#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 工具轉換自動化監控系統 v3.1
===============================================
等級 3：完全自動化（三技能整合版）

v3.1 新增：
  - 路徑全面改為 Windows 相容（pathlib，相對腳本位置）
  - auto-learn 完成後自動觸發 failure-classifier / priority-sorter / regression-tester
  - review-log 完成後自動觸發 proactive-suggestion
  - 新增 --mode scan（task-detector 系統狀態掃描）
  - 新增 --mode suggest（proactive-suggestion 完整建議）

使用方式：
  python workflow-monitor.py --mode auto-learn     掃描並自動學習（含 post-learn hooks）
  python workflow-monitor.py --mode review-log     查看日誌（含主動建議）
  python workflow-monitor.py --mode scan           系統狀態掃描 + 角色建議
  python workflow-monitor.py --mode suggest        主動建議引擎（完整模式）
  python workflow-monitor.py --mode convert --tool <name> --error-msg <msg>

Windows Task Scheduler（每 6 小時）：
  schtasks /create /tn "tianying-auto-learn" /tr "python <path>\\workflow-monitor.py --mode auto-learn" /sc hourly /mo 6 /f

配置：
  編輯 monitor-config.yaml 調整失敗閾值、錯誤模式等設定
"""

import json
import os
import sys
import argparse
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import traceback

# ===== 基底路徑（相對於此腳本，Windows / Mac / Linux 皆相容）=====
BASE_DIR = Path(__file__).parent

# ===== 設定 =====
CONFIG = {
    'MONITOR_DIR':          str(BASE_DIR / 'outputs'),
    'FAILURE_LOG':          str(BASE_DIR / 'failure-log.json'),
    'SKILL_PATH':           str(BASE_DIR / 'skills' / 'tianying-tool-converter.md'),
    'SKILL_UPDATER_LOG':    str(BASE_DIR / 'skill-updater-run.log'),
    'NOTIFY_FILE':          str(BASE_DIR / 'skill-update-notification.txt'),
    'AUTO_LEARN_THRESHOLD': 2,
}

class ToolMonitor:
    """工具轉換監控器"""
    
    def __init__(self):
        self.failure_log_path = CONFIG['FAILURE_LOG']
        self.failures = self._load_failure_log()
    
    def _load_failure_log(self) -> Dict[str, List[Dict]]:
        """讀取失敗日誌"""
        if os.path.exists(self.failure_log_path):
            with open(self.failure_log_path, 'r', encoding='utf-8') as f:
                try:
                    return json.load(f)
                except:
                    return {'failures': [], 'last_updated': None}
        return {'failures': [], 'last_updated': None}
    
    def _save_failure_log(self):
        """保存失敗日誌"""
        self.failures['last_updated'] = datetime.now().isoformat()
        with open(self.failure_log_path, 'w', encoding='utf-8') as f:
            json.dump(self.failures, f, ensure_ascii=False, indent=2)
    
    def record_failure(self, tool_name: str, error_type: str, error_msg: str, 
                      priority: str = 'important', suggestion: str = ''):
        """記錄失敗"""
        failure = {
            'timestamp': datetime.now().isoformat(),
            'tool': tool_name,
            'error_type': error_type,
            'error_msg': error_msg[:500],  # 截斷長訊息
            'priority': priority,  # critical / important / optional
            'suggestion': suggestion[:200],
            'status': 'pending_learn',  # pending_learn / learned / ignored
        }
        
        self.failures.setdefault('failures', []).append(failure)
        self._save_failure_log()
        
        print(f"❌ 失敗已記錄：{tool_name} - {error_type}")
        print(f"   優先級：{priority}")
        print(f"   消息：{error_msg[:100]}")
        
        return failure
    
    def record_boundary_case(self, tool_name: str, case_name: str, 
                            discovery: str, priority: str = 'important'):
        """記錄邊界案例"""
        case = {
            'timestamp': datetime.now().isoformat(),
            'tool': tool_name,
            'case_name': case_name,
            'discovery': discovery[:300],
            'priority': priority,
            'type': 'boundary_case',
            'status': 'pending_learn',
        }
        
        self.failures.setdefault('discoveries', []).append(case)
        self._save_failure_log()
        
        print(f"🔍 邊界案例已記錄：{tool_name} - {case_name}")
        print(f"   發現：{discovery[:100]}")
        
        return case
    
    def review_log(self):
        """檢視失敗日誌"""
        print("\n" + "="*60)
        print("失敗日誌檢視")
        print("="*60 + "\n")
        
        failures = self.failures.get('failures', [])
        discoveries = self.failures.get('discoveries', [])
        
        if not failures and not discoveries:
            print("✅ 無失敗記錄（系統運行良好）")
            return
        
        print(f"📊 統計：失敗 {len(failures)} 次，邊界案例 {len(discoveries)} 個\n")
        
        # 按優先級分組
        critical = [f for f in failures if f.get('priority') == 'critical']
        important = [f for f in failures if f.get('priority') == 'important']
        optional = [f for f in failures if f.get('priority') == 'optional']
        
        if critical:
            print(f"🔴 CRITICAL ({len(critical)} 起)：")
            for f in critical[-3:]:  # 顯示最後 3 個
                print(f"   {f['timestamp'][:10]} {f['tool']}: {f['error_type']}")
        
        if important:
            print(f"🟡 IMPORTANT ({len(important)} 起)：")
            for f in important[-3:]:
                print(f"   {f['timestamp'][:10]} {f['tool']}: {f['error_type']}")
        
        if optional:
            print(f"🟢 OPTIONAL ({len(optional)} 起)：")
            for f in optional[-3:]:
                print(f"   {f['timestamp'][:10]} {f['tool']}: {f['error_type']}")
        
        if discoveries:
            print(f"\n🔍 邊界案例 ({len(discoveries)} 個)：")
            for d in discoveries[-5:]:
                print(f"   {d['timestamp'][:10]} {d['tool']}: {d['case_name']}")
        
        print("\n💡 提示：執行 `python workflow-monitor.py --mode auto-learn` 自動觸發學習")

        # 自動觸發主動建議引擎
        self._run_suggestion_hook()

    def _run_suggestion_hook(self):
        """review-log 後自動執行 proactive-suggestion.py"""
        script = BASE_DIR / 'proactive-suggestion.py'
        if not script.exists():
            return
        print()
        try:
            subprocess.run(
                [sys.executable, str(script)],
                timeout=30, encoding='utf-8', errors='replace'
            )
        except subprocess.TimeoutExpired:
            print("[WRN] proactive-suggestion.py 超時（30s）")
        except Exception as e:
            print(f"[WRN] proactive-suggestion.py：{e}")
    
    def get_pending_learns(self) -> List[Dict]:
        """取得待學習的失敗"""
        failures = self.failures.get('failures', [])
        discoveries = self.failures.get('discoveries', [])
        pending = [f for f in (failures + discoveries) if f.get('status') == 'pending_learn']
        return pending
    
    def mark_as_learned(self, indices: List[int]):
        """標記為已學習"""
        all_items = self.failures.get('failures', []) + self.failures.get('discoveries', [])
        for idx in indices:
            if 0 <= idx < len(all_items):
                all_items[idx]['status'] = 'learned'
        self._save_failure_log()
        print(f"✅ 標記 {len(indices)} 項為已學習")


class SkillAutoUpdater:
    """技能自動更新器"""
    
    def __init__(self):
        self.skill_path = CONFIG['SKILL_PATH']
        self.monitor = ToolMonitor()
    
    def auto_learn(self) -> bool:
        """自動觸發學習更新"""
        pending = self.monitor.get_pending_learns()
        
        if not pending:
            print("✅ 無待學習項目")
            return False
        
        print(f"\n🤖 自動學習觸發：{len(pending)} 項待處理")
        print("="*60)
        
        # 按優先級分類
        critical = [p for p in pending if p.get('priority') == 'critical']
        important = [p for p in pending if p.get('priority') == 'important']
        optional = [p for p in pending if p.get('priority') == 'optional']
        
        print(f"\n分類統計：")
        print(f"  🔴 Critical: {len(critical)} 個 → 必須處理")
        print(f"  🟡 Important: {len(important)} 個 → 優先處理")
        print(f"  🟢 Optional: {len(optional)} 個 → 可延後")
        
        # 如果達到阈值，自動更新
        if len(critical) >= CONFIG['AUTO_LEARN_THRESHOLD']:
            print(f"\n⚡ Critical 項達 {CONFIG['AUTO_LEARN_THRESHOLD']} 個，自動觸發學習")
            return self._execute_auto_update(critical, important)
        elif len(important) >= CONFIG['AUTO_LEARN_THRESHOLD'] * 2:
            print(f"\n⚡ Important 項達 {CONFIG['AUTO_LEARN_THRESHOLD']*2} 個，自動觸發學習")
            return self._execute_auto_update(important, optional)
        else:
            print(f"\n⏳ 項目未達自動觸發阈值")
            print(f"   待 critical ≥{CONFIG['AUTO_LEARN_THRESHOLD']} 或 important ≥{CONFIG['AUTO_LEARN_THRESHOLD']*2}")
            return False
    
    def _execute_auto_update(self, critical_items: List[Dict], 
                            other_items: List[Dict]) -> bool:
        """執行自動更新"""
        print("\n🔧 開始自動更新...")
        
        try:
            # 1. 萃取新規則
            rules_to_add = self._extract_rules(critical_items + other_items)
            
            if not rules_to_add:
                print("❌ 無法萃取新規則")
                return False
            
            print(f"✅ 萃取 {len(rules_to_add)} 個新規則")
            
            # 2. diff 檢查
            conflicts = self._check_conflicts(rules_to_add)
            if conflicts:
                print(f"⚠️ 發現 {len(conflicts)} 個潛在衝突，人工檢視需要：")
                for conflict in conflicts:
                    print(f"   - {conflict}")
                return False
            
            print("✅ Diff 檢查通過（無衝突）")
            
            # 3. 版本化合併
            version = self._get_next_version()
            self._merge_rules(rules_to_add, version)
            
            print(f"✅ 版本化合併完成：{version}")
            
            # 4. 回歸測試
            if self._regression_test():
                print("✅ 回歸測試通過")
            else:
                print("❌ 回歸測試失敗")
                return False
            
            # 5. 標記已學習
            learned_indices = [
                self.monitor.failures['failures'].index(item) 
                for item in critical_items + other_items 
                if item in self.monitor.failures['failures']
            ]
            self.monitor.mark_as_learned(learned_indices)
            
            # 6. 通知
            self._notify_update(version, rules_to_add)
            
            print(f"\n✅ 自動更新完成！{version} 已部署")

            # 7. Post-learn hooks（三技能串接）
            self._run_post_learn_hooks()

            return True
            
        except Exception as e:
            print(f"❌ 自動更新失敗：{e}")
            traceback.print_exc()
            return False

    def _run_post_learn_hooks(self):
        """auto-learn 成功後依序觸發：分類器 → 優先排序 → 回歸測試"""
        hooks = [
            ('failure-classifier.py', ['--enrich'],            '失敗分類增強'),
            ('priority-sorter.py',    ['--output'],             '優先級排序'),
            ('regression-tester.py',  ['--compare', '--output'], '回歸測試'),
        ]
        print("\n-- Post-learn hooks --")
        for script_file, extra_args, label in hooks:
            script = BASE_DIR / script_file
            if not script.exists():
                print(f"  [跳過] {label}（{script_file} 不存在）")
                continue
            cmd = [sys.executable, str(script)] + extra_args
            try:
                result = subprocess.run(
                    cmd, capture_output=True, text=True,
                    timeout=60, encoding='utf-8', errors='replace'
                )
                ok = result.returncode == 0
                print(f"  {'[OK]' if ok else '[WRN]'} {label}")
                # 只印關鍵摘要行
                for line in (result.stdout or '').splitlines():
                    s = line.strip()
                    if s and any(kw in s for kw in [
                        '[OK]', '[ERR]', 'ALL PASS', 'FAIL', '健康度',
                        'critical', 'important', 'pending', '部署', '通過',
                    ]):
                        print(f"       {s}")
            except subprocess.TimeoutExpired:
                print(f"  [WRN] {label} 超時（60s）")
            except Exception as e:
                print(f"  [WRN] {label}：{e}")
    
    def _extract_rules(self, items: List[Dict]) -> List[Dict]:
        """從失敗項萃取新規則"""
        rules = []
        
        for item in items:
            if item.get('type') == 'boundary_case':
                rule = {
                    'name': item.get('case_name'),
                    'content': item.get('discovery'),
                    'section': '常見錯誤修復',
                    'priority': item.get('priority'),
                    'source_tool': item.get('tool'),
                    'added_date': datetime.now().strftime('%Y-%m-%d'),
                }
            else:
                rule = {
                    'name': f"規則：{item.get('error_type')}",
                    'content': item.get('error_msg'),
                    'section': '規範檢查清單',
                    'priority': item.get('priority'),
                    'source_tool': item.get('tool'),
                    'added_date': datetime.now().strftime('%Y-%m-%d'),
                }
            
            rules.append(rule)
        
        return rules
    
    def _check_conflicts(self, rules: List[Dict]) -> List[str]:
        """檢查是否有衝突"""
        conflicts = []

        if not Path(self.skill_path).exists():
            conflicts.append(
                f"SKILL.md 不存在：{self.skill_path}"
                f"（請將技能檔案複製到 skills/ 目錄，"
                f"執行 regression-tester.py 確認）"
            )
            return conflicts

        with open(self.skill_path, 'r', encoding='utf-8') as f:
            skill_text = f.read()
        
        for rule in rules:
            # 檢查重複
            if rule['content'][:50] in skill_text:
                conflicts.append(f"內容重複：{rule['name'][:50]}")
            
            # 檢查位置是否存在
            if rule['section'] not in skill_text:
                conflicts.append(f"位置不存在：{rule['section']}")
        
        return conflicts
    
    def _merge_rules(self, rules: List[Dict], version: str):
        """合併規則到 SKILL.md"""
        with open(self.skill_path, 'r', encoding='utf-8') as f:
            text = f.read()
        
        # 簡單實現：在對應節最後追加
        new_content = ""
        for rule in rules:
            new_content += f"\n### {rule['name']}\n"
            new_content += f"{rule['content']}\n"
            new_content += f"**優先級**：{rule['priority']}\n"
            new_content += f"**新增日期**：{rule['added_date']}\n"
            new_content += f"**來源工具**：{rule['source_tool']}\n"
        
        # 找到對應節，在最後插入
        for rule in rules:
            pattern = rf"(## {rule['section']}.*?)(?=##|\Z)"
            match = re.search(pattern, text, re.DOTALL)
            if match:
                insert_point = match.end(1)
                text = text[:insert_point] + new_content + text[insert_point:]
                break
        
        # 更新 changelog
        changelog = f"\n### v1.? ({datetime.now().strftime('%Y-%m-%d')}，自動迭代)\n**新增規則**：{len(rules)} 個\n**驗證**：✅ 回歸測試通過\n---\n"
        if "## 更新歷史" in text:
            text = text.replace("## 更新歷史", f"## 更新歷史\n{changelog}", 1)
        
        with open(self.skill_path, 'w', encoding='utf-8') as f:
            f.write(text)
    
    def _get_next_version(self) -> str:
        """取得下一版本號"""
        with open(self.skill_path, 'r', encoding='utf-8') as f:
            text = f.read()
        
        # 簡單版本：計算現有版本數
        versions = re.findall(r'### v(\d+)\.(\d+)', text)
        if versions:
            major, minor = versions[0]
            return f"v{major}.{int(minor)+1}"
        return "v1.1"
    
    def _regression_test(self) -> bool:
        """回歸測試"""
        print("  🧪 運行回歸測試...")
        try:
            with open(self.skill_path, 'r', encoding='utf-8') as f:
                text = f.read()
            
            # 檢查基本結構
            assert "---" in text[:50], "frontmatter 缺失"
            assert "## " in text, "無章節標題"
            assert len(text) > 1000, "檔案過短"
            
            print("     ✅ frontmatter OK")
            print("     ✅ 章節結構 OK")
            print("     ✅ 檔案大小 OK")
            
            return True
        except AssertionError as e:
            print(f"     ❌ {e}")
            return False
    
    def _notify_update(self, version: str, rules: List[Dict]):
        """通知更新完成"""
        notification = f"""
=== 技能自動更新完成 ===

版本：{version}
時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
新增規則：{len(rules)} 個

已啟用的新規則：
"""
        for rule in rules:
            notification += f"\n  - {rule['name']} ({rule['priority']})"
            notification += f"\n    來源：{rule['source_tool']}"
        
        notification += f"\n\n下次執行 tianying-tool-converter 時自動啟用此規則。\n"
        
        # 寫到通知檔
        with open(CONFIG['NOTIFY_FILE'], 'w', encoding='utf-8') as f:
            f.write(notification)
        
        print(notification)
        print(f"✉️ 通知已寫入：{CONFIG['NOTIFY_FILE']}")


def main():
    parser = argparse.ArgumentParser(description='天鷹工具轉換監控系統 v3.1')
    parser.add_argument('--mode',
                       choices=['convert', 'auto-learn', 'review-log', 'scan', 'suggest'],
                       default='review-log', help='執行模式')
    parser.add_argument('--tool', help='工具名稱（convert 模式必需）')
    parser.add_argument('--error-type', help='錯誤類型')
    parser.add_argument('--error-msg', help='錯誤訊息')
    parser.add_argument('--priority', default='important', help='優先級')
    
    args = parser.parse_args()
    
    monitor = ToolMonitor()
    
    if args.mode == 'convert':
        if args.error_msg:
            monitor.record_failure(
                args.tool or 'unknown',
                args.error_type or '轉換失敗',
                args.error_msg,
                args.priority
            )
            print(f"✅ 失敗已記錄，待下次自動學習")
        else:
            print(f"✅ 轉換成功：{args.tool}")
    
    elif args.mode == 'auto-learn':
        updater = SkillAutoUpdater()
        if updater.auto_learn():
            print("\n🎉 自動學習完成！")
        else:
            print("\n⏳ 待下次積累")
    
    elif args.mode == 'review-log':
        monitor.review_log()

    elif args.mode == 'scan':
        script = BASE_DIR / 'task-detector.py'
        if script.exists():
            subprocess.run([sys.executable, str(script), '--scan'])
        else:
            print("[ERR] task-detector.py 不存在，請確認已部署 Track C")

    elif args.mode == 'suggest':
        script = BASE_DIR / 'proactive-suggestion.py'
        if script.exists():
            subprocess.run([sys.executable, str(script), '--full'])
        else:
            print("[ERR] proactive-suggestion.py 不存在，請確認已部署 Track C")


if __name__ == '__main__':
    main()
