#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天鷹保全 · 技能版本管理器 v1.0  (Track B-B2)
============================================
管理 skills/ 內 SKILL.md 的版本：備份 / 版本號追蹤 / Rollback / Diff。
純標準庫（json, re, shutil, difflib），無需安裝第三方包。

備份位置：skill-backups/<skill>_<ver>_<timestamp>.md
版本記錄：version-manifest.json

用法：
  python skill-version-manager.py                          顯示版本清單（同 --list）
  python skill-version-manager.py --list                   列出所有技能版本
  python skill-version-manager.py --list-skill <name>     列出指定技能版本
  python skill-version-manager.py --backup <name>         備份指定技能
  python skill-version-manager.py --backup-all            備份全部技能
  python skill-version-manager.py --rollback <name>       回滾到上一版
  python skill-version-manager.py --rollback <name> --to v1.2  回滾到指定版本
  python skill-version-manager.py --diff <name>           顯示與上次備份差異
  python skill-version-manager.py --next-version <name>   預覽下一版本號

SKILL.md 放置：skills/<skill-name>.md
"""
import json
import re
import shutil
import difflib
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# ── 路徑
BASE_DIR      = Path(__file__).parent
SKILLS_DIR    = BASE_DIR / "skills"
BACKUPS_DIR   = BASE_DIR / "skill-backups"
MANIFEST_FILE = BASE_DIR / "version-manifest.json"


# ─────────────────────────────────────────────────────────
# Manifest 管理
# ─────────────────────────────────────────────────────────
def load_manifest() -> Dict:
    """讀取 version-manifest.json"""
    if not MANIFEST_FILE.exists():
        return {"skills": {}, "last_updated": None}
    try:
        return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"skills": {}, "last_updated": None}


def save_manifest(manifest: Dict) -> None:
    """寫入 version-manifest.json"""
    manifest["last_updated"] = datetime.now().isoformat()
    MANIFEST_FILE.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


# ─────────────────────────────────────────────────────────
# 版本號工具
# ─────────────────────────────────────────────────────────
def read_version(path: Path) -> Optional[str]:
    """從 SKILL.md 更新歷史讀取最新版本號（如 v1.3）"""
    if not path.exists():
        return None
    text     = path.read_text(encoding="utf-8")
    versions = re.findall(r"^### (v\d+\.\d+)", text, re.MULTILINE)
    return versions[0] if versions else None


def bump_minor(ver: Optional[str]) -> str:
    """minor +1；無版本記錄則回傳 v1.0"""
    if not ver:
        return "v1.0"
    m = re.match(r"v(\d+)\.(\d+)", ver)
    if not m:
        return "v1.0"
    return f"v{m.group(1)}.{int(m.group(2)) + 1}"


# ─────────────────────────────────────────────────────────
# 備份
# ─────────────────────────────────────────────────────────
def backup_skill(name: str, manifest: Dict) -> bool:
    """備份 skills/<name>.md 到 skill-backups/，記錄 manifest"""
    src = SKILLS_DIR / f"{name}.md"
    if not src.exists():
        print(f"[ERR] 找不到 skills\\{name}.md")
        return False

    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

    ver      = read_version(src) or "v1.0"
    ts       = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst_name = f"{name}_{ver}_{ts}.md"
    dst      = BACKUPS_DIR / dst_name
    shutil.copy2(src, dst)

    # 更新 manifest
    entry = manifest.setdefault("skills", {}).setdefault(name, {
        "current_version": None,
        "backups":         [],
    })
    entry["current_version"] = ver
    entry["backups"].append({
        "version":   ver,
        "file":      dst_name,
        "path":      str(dst),
        "timestamp": datetime.now().isoformat(),
        "size":      src.stat().st_size,
    })

    print(f"[OK] 備份  {name}  {ver}  ->  {dst_name}")
    return True


# ─────────────────────────────────────────────────────────
# Rollback
# ─────────────────────────────────────────────────────────
def rollback_skill(name: str, manifest: Dict, target_ver: Optional[str]) -> None:
    """回滾 skills/<name>.md 到備份版本"""
    entry   = manifest.get("skills", {}).get(name, {})
    backups = entry.get("backups", [])

    if not backups:
        print(f"[ERR] {name} 無備份記錄，無法回滾")
        return

    # 選擇目標備份
    if target_ver:
        cands = [b for b in backups if b.get("version") == target_ver]
        if not cands:
            avail = sorted(set(b["version"] for b in backups))
            print(f"[ERR] 找不到 {name} 的 {target_ver}  可用版本：{', '.join(avail)}")
            return
        target = cands[-1]    # 同版本取最新備份
    else:
        if len(backups) < 2:
            print(f"[ERR] {name} 只有 1 份備份，無法回滾到上一版")
            return
        target = backups[-2]  # 倒數第二份 = 上一版

    src = Path(target["path"])
    if not src.exists():
        print(f"[ERR] 備份檔案不存在：{src}")
        return

    dst = SKILLS_DIR / f"{name}.md"

    # 先備份現版再 rollback
    print(f"  >> 先備份現版本...")
    backup_skill(name, manifest)

    shutil.copy2(src, dst)
    print(f"[OK] 回滾  {name}  ->  {target['version']}  ({target['file']})")


# ─────────────────────────────────────────────────────────
# Diff
# ─────────────────────────────────────────────────────────
def show_diff(name: str, manifest: Dict, context: int = 3) -> None:
    """顯示 skills/<name>.md 與上次備份的文字差異"""
    curr_path = SKILLS_DIR / f"{name}.md"
    if not curr_path.exists():
        print(f"[ERR] 找不到 skills\\{name}.md")
        return

    backups = manifest.get("skills", {}).get(name, {}).get("backups", [])
    if not backups:
        print(f"[INFO] {name} 無備份記錄，請先 --backup")
        return

    prev_path = Path(backups[-1]["path"])
    if not prev_path.exists():
        print(f"[ERR] 上次備份不存在：{prev_path}")
        return

    curr_lines = curr_path.read_text(encoding="utf-8").splitlines(keepends=True)
    prev_lines = prev_path.read_text(encoding="utf-8").splitlines(keepends=True)

    diff = list(difflib.unified_diff(
        prev_lines,
        curr_lines,
        fromfile=f"(備份) {backups[-1]['file']}",
        tofile=f"(現版) {curr_path.name}",
        n=context,
    ))

    if not diff:
        print(f"[INFO] {name}：與上次備份相同，無差異")
        return

    print(f"\n差異  {name}  {backups[-1]['version']} -> 現版")
    print("-" * 60)
    for line in diff[:200]:
        print(line, end="")
    if len(diff) > 200:
        print(f"\n...（共 {len(diff)} 行差異，已截斷顯示前 200 行）")


# ─────────────────────────────────────────────────────────
# 版本清單
# ─────────────────────────────────────────────────────────
def list_versions(name: Optional[str], manifest: Dict) -> None:
    """列出 manifest 記錄的版本歷史"""
    skills = manifest.get("skills", {})

    if not skills:
        print("[INFO] 尚無版本記錄，請先執行 --backup")
        return

    targets = [name] if name else sorted(skills.keys())

    print(f"\n{'=' * 60}")
    print("版本清單")
    print("=" * 60)

    for n in targets:
        entry = skills.get(n)
        if not entry:
            print(f"  {n}：無記錄")
            continue
        backups = entry.get("backups", [])
        curr    = entry.get("current_version", "?")
        print(f"\n  [{n}]  最新版 {curr}  備份數 {len(backups)}")
        for b in backups[-10:]:     # 顯示最近 10 筆
            ts   = b.get("timestamp", "")[:16].replace("T", " ")
            size = b.get("size", 0) // 1024
            print(f"    {b['version']:8s}  {ts}  {size:4d}KB  {b['file']}")


# ─────────────────────────────────────────────────────────
# 入口
# ─────────────────────────────────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description="天鷹技能版本管理器 v1.0")
    ap.add_argument("--list",         action="store_true",  help="列出所有技能版本")
    ap.add_argument("--list-skill",   metavar="NAME",       help="列出指定技能版本")
    ap.add_argument("--backup",       metavar="NAME",       help="備份指定技能")
    ap.add_argument("--backup-all",   action="store_true",  help="備份全部技能")
    ap.add_argument("--rollback",     metavar="NAME",       help="回滾技能到上一版")
    ap.add_argument("--to",           metavar="VERSION",    help="搭配 --rollback，指定目標版本（如 v1.2）")
    ap.add_argument("--diff",         metavar="NAME",       help="顯示與上次備份的文字差異")
    ap.add_argument("--next-version", metavar="NAME",       help="預覽指定技能的下一版本號")
    args = ap.parse_args()

    manifest = load_manifest()
    changed  = False

    # --list / --list-skill
    if args.list or args.list_skill:
        list_versions(args.list_skill, manifest)
        return

    # --next-version（唯讀，不改 manifest）
    if args.next_version:
        src  = SKILLS_DIR / f"{args.next_version}.md"
        curr = read_version(src)
        nxt  = bump_minor(curr)
        print(f"[INFO] {args.next_version}  目前版本：{curr or '（無）'}  建議下一版：{nxt}")
        return

    # --backup
    if args.backup:
        backup_skill(args.backup, manifest)
        changed = True

    # --backup-all
    if args.backup_all:
        if not SKILLS_DIR.exists():
            print(f"[INFO] {SKILLS_DIR} 不存在，請先建立 skills\\ 目錄並放入 SKILL.md")
        else:
            files = sorted(SKILLS_DIR.glob("*.md"))
            if not files:
                print("[INFO] skills\\ 目錄為空")
            for f in files:
                backup_skill(f.stem, manifest)
            changed = True

    # --rollback
    if args.rollback:
        rollback_skill(args.rollback, manifest, args.to)
        changed = True

    # --diff
    if args.diff:
        show_diff(args.diff, manifest)

    # 無任何子命令 -> 顯示版本清單
    no_action = not any([
        args.backup, args.backup_all, args.rollback,
        args.diff, args.next_version,
    ])
    if no_action:
        list_versions(None, manifest)

    # 存回 manifest
    if changed:
        save_manifest(manifest)
        print(f"\n[OK] version-manifest.json 已更新")


if __name__ == "__main__":
    main()
