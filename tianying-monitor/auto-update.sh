#!/bin/bash
# 天鷹保全 · 自動化監控 & 技能學習執行腳本
# ============================================
# 用法：
#   ./auto-update.sh                    # 手動執行一次
#   crontab -e && 加入下行              # 自動定時執行
#   0 */6 * * * /path/to/auto-update.sh # 每 6 小時執行
#
# 流程：
#   1. 掃描失敗日誌
#   2. 判斷是否達到自動觸發阈值
#   3. 執行 skill-updater
#   4. 通知用戶（若有更新）

set -e

# ===== 配置 =====
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/auto-update.log"
FAILURE_LOG="/tmp/failure-log.json"
NOTIFY_FILE="/tmp/skill-update-notification.txt"
CONFIG_YAML="/tmp/monitor-config.yaml"
PYTHON_SCRIPT="/tmp/workflow-monitor.py"
PYTHON="python3"

# ===== 函式 =====

log_msg() {
    local msg="$1"
    local level="${2:-INFO}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $msg" | tee -a "$LOG_FILE"
}

check_prerequisites() {
    log_msg "檢查前置條件..."
    
    # 檢查 Python 3
    if ! command -v $PYTHON &> /dev/null; then
        log_msg "❌ 未找到 $PYTHON" "ERROR"
        return 1
    fi
    
    # 檢查監控腳本
    if [ ! -f "$PYTHON_SCRIPT" ]; then
        log_msg "❌ 未找到監控腳本：$PYTHON_SCRIPT" "ERROR"
        return 1
    fi
    
    # 檢查失敗日誌
    if [ ! -f "$FAILURE_LOG" ]; then
        log_msg "⚠️ 失敗日誌不存在，將在首次失敗時建立" "WARN"
    fi
    
    log_msg "✅ 前置條件檢查通過"
    return 0
}

scan_failures() {
    log_msg "掃描失敗日誌..."
    
    if [ ! -f "$FAILURE_LOG" ]; then
        log_msg "無失敗日誌" "INFO"
        echo 0
        return
    fi
    
    # 計算各優先級失敗數
    local critical=$($PYTHON -c "
import json
with open('$FAILURE_LOG') as f:
    data = json.load(f)
    failures = data.get('failures', [])
    print(len([f for f in failures if f.get('priority') == 'critical' and f.get('status') == 'pending_learn']))
" 2>/dev/null || echo 0)
    
    local important=$($PYTHON -c "
import json
with open('$FAILURE_LOG') as f:
    data = json.load(f)
    failures = data.get('failures', [])
    print(len([f for f in failures if f.get('priority') == 'important' and f.get('status') == 'pending_learn']))
" 2>/dev/null || echo 0)
    
    log_msg "待學習項目：Critical=$critical，Important=$important"
    
    echo "$critical:$important"
}

should_trigger_update() {
    local counts="$1"
    local critical=$(echo "$counts" | cut -d: -f1)
    local important=$(echo "$counts" | cut -d: -f2)
    
    # 配置的阈值（來自 monitor-config.yaml）
    local critical_threshold=2
    local important_threshold=4
    
    if [ "$critical" -ge "$critical_threshold" ]; then
        log_msg "✅ Critical 項達 $critical_threshold，觸發自動更新" "INFO"
        return 0
    fi
    
    if [ "$important" -ge "$important_threshold" ]; then
        log_msg "✅ Important 項達 $important_threshold，觸發自動更新" "INFO"
        return 0
    fi
    
    log_msg "⏳ 未達自動觸發阈值，待下次積累" "INFO"
    return 1
}

trigger_auto_learn() {
    log_msg "觸發自動學習..."
    
    # 調用 Python 監控系統的自動學習模式
    if $PYTHON "$PYTHON_SCRIPT" --mode auto-learn >> "$LOG_FILE" 2>&1; then
        log_msg "✅ 自動學習完成"
        return 0
    else
        log_msg "❌ 自動學習失敗" "ERROR"
        return 1
    fi
}

send_notification() {
    if [ -f "$NOTIFY_FILE" ]; then
        log_msg "發送通知..."
        
        # 內容寫入日誌
        cat "$NOTIFY_FILE" >> "$LOG_FILE"
        
        # 可選：發送 Slack / 郵件（需配置 webhook / SMTP）
        # TODO: 實作可選的 Slack / Email 通知
        
        log_msg "✉️ 通知已發送"
        return 0
    fi
}

generate_summary() {
    log_msg "生成執行摘要..."
    
    local summary_file="/tmp/auto-update-summary.txt"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$summary_file" << EOF
=== 自動化監控執行摘要 ===

執行時間：$timestamp
狀態：✅ 完成

失敗日誌掃描：
$(tail -10 "$LOG_FILE" | grep -E "待學習|Critical|Important" || echo "  無")

更新結果：
$([ -f "$NOTIFY_FILE" ] && tail -5 "$NOTIFY_FILE" || echo "  無更新")

詳細日誌：$LOG_FILE

---
下次執行：6 小時後（自動）
或手動執行：./auto-update.sh
EOF
    
    cat "$summary_file" | tee -a "$LOG_FILE"
    log_msg "摘要已生成：$summary_file"
}

cleanup() {
    log_msg "清理臨時檔案..."
    
    # 保留 FAILURE_LOG（用於歷史追蹤）
    # 清理 NOTIFY_FILE（防止舊通知累積）
    # 保留 LOG_FILE（審計日誌）
    
    # 可選：歸檔舊日誌
    local archive_dir="/tmp/skill-updates-archive"
    mkdir -p "$archive_dir"
    
    # 保留近 7 天的日誌，歸檔更舊的
    find "$archive_dir" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    log_msg "清理完成"
}

# ===== 主流程 =====

main() {
    local exit_code=0
    
    echo ""
    echo "=========================================="
    echo "天鷹保全 · 自動化監控 v3.0"
    echo "開始時間：$(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
    echo ""
    
    # 1. 前置檢查
    if ! check_prerequisites; then
        log_msg "❌ 前置條件檢查失敗" "ERROR"
        exit_code=1
        goto cleanup
    fi
    
    # 2. 掃描失敗日誌
    local counts=$(scan_failures)
    if [ -z "$counts" ]; then
        log_msg "❌ 掃描失敗日誌出錯" "ERROR"
        exit_code=1
        goto cleanup
    fi
    
    # 3. 判斷是否觸發
    if should_trigger_update "$counts"; then
        # 4. 觸發自動學習
        if trigger_auto_learn; then
            log_msg "✅ 自動學習成功"
            
            # 5. 發送通知
            send_notification
        else
            log_msg "❌ 自動學習失敗" "ERROR"
            exit_code=1
        fi
    fi
    
    # 6. 生成摘要
    generate_summary
    
    # 7. 清理
    cleanup
    
    echo ""
    echo "=========================================="
    echo "結束時間：$(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
    echo ""
    
    return $exit_code
}

# 執行
main
exit $?
