#!/bin/bash
# 天鷹保全 · 監控系統一鍵設定 (Mac/Linux)
# 用法: bash setup.sh 或 ./setup.sh
#
# 功能:
#   1. 檢查 Python/Node 是否安裝
#   2. 設定 Cron 自動執行
#   3. 驗證所有檔案

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "=========================================="
echo "天鷹保全 · 監控系統自動部署 v3.0"
echo "=========================================="
echo ""

echo "部署目錄: $SCRIPT_DIR"
echo ""

# ===== 檢查 Python =====
echo "[1/5] 檢查 Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3"
    echo "請先安裝: brew install python3 (Mac) 或 apt install python3 (Ubuntu)"
    exit 1
fi

PYTHON_VER=$(python3 --version 2>&1 | awk '{print $2}')
echo "✅ Python $PYTHON_VER 已安裝"

# ===== 檢查檔案 =====
echo ""
echo "[2/5] 檢查必要檔案..."
MISSING=0

if [ ! -f "$SCRIPT_DIR/workflow-monitor.py" ]; then
    echo "❌ 缺少: workflow-monitor.py"
    MISSING=1
fi

if [ ! -f "$SCRIPT_DIR/monitor-config.yaml" ]; then
    echo "❌ 缺少: monitor-config.yaml"
    MISSING=1
fi

if [ ! -f "$SCRIPT_DIR/auto-update.sh" ]; then
    echo "❌ 缺少: auto-update.sh"
    MISSING=1
fi

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "❌ 檔案不完整，請確保所有檔案都在 $SCRIPT_DIR"
    exit 1
fi

echo "✅ 所有必要檔案已就位"

# ===== 設定執行權限 =====
echo ""
echo "[3/5] 設定執行權限..."
chmod +x "$SCRIPT_DIR/auto-update.sh"
chmod +x "$SCRIPT_DIR/workflow-monitor.py"
echo "✅ 執行權限已設定"

# ===== 設定 Cron =====
echo ""
echo "[4/5] 設定自動執行 (Cron)..."

CRON_JOB="0 */6 * * * cd $SCRIPT_DIR && python3 workflow-monitor.py --mode auto-learn >> /tmp/tianying-auto-update.log 2>&1"

# 檢查是否已存在
if crontab -l 2>/dev/null | grep -q "tianying-auto-update\|workflow-monitor.py"; then
    echo "⚠️  Cron 已存在，移除舊設定..."
    crontab -l 2>/dev/null | grep -v "workflow-monitor.py" | crontab -
fi

# 新增新 Cron
(crontab -l 2>/dev/null || echo "") | echo "$CRON_JOB" | crontab -

if crontab -l 2>/dev/null | grep -q "workflow-monitor.py"; then
    echo "✅ Cron 已設定: 每 6 小時自動執行一次"
else
    echo "❌ Cron 設定失敗"
    echo "你可以手動設定:"
    echo "  crontab -e"
    echo "  $CRON_JOB"
    exit 1
fi

# ===== 驗證 =====
echo ""
echo "[5/5] 驗證系統..."
echo ""

python3 "$SCRIPT_DIR/workflow-monitor.py" --mode review-log

echo ""
echo ""
echo "=========================================="
echo "✅ 部署完成!"
echo "=========================================="
echo ""
echo "系統已設定："
echo "  • Python 環境: 已驗證"
echo "  • 監控引擎: 已安裝"
echo "  • 自動排程: 已啟用（每 6 小時執行）"
echo ""
echo "查看 Cron 排程:"
echo "  crontab -l"
echo ""
echo "查看失敗日誌:"
echo "  python3 $SCRIPT_DIR/workflow-monitor.py --mode review-log"
echo ""
echo "查看執行日誌:"
echo "  tail -50 /tmp/tianying-auto-update.log"
echo ""
echo "下一步: 開始使用!"
echo "  1. 上傳工具給 Claude 轉換"
echo "  2. 若失敗，系統自動記錄"
echo "  3. 6 小時後系統自動學習"
echo ""
