# Graph Report - .  (2026-07-14)

## Corpus Check
- Large corpus: 376 files · ~1,583,684 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 535 nodes · 778 edges · 57 communities (40 shown, 17 thin omitted)
- Extraction: 93% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- GAS 端點總覽
- Obsidian 知識庫索引
- 監控系統自動學習與部署
- E2E 測試套件
- 自動快照與交付偵測
- 監控系統主控制器
- AI Agents 團隊工作流
- 最終驗證器
- 技能版本管理
- 開店登錄 GAS 後端
- 工作紀錄與班別規則
- 監控月報生成
- Vault 筆記規則與範本
- GAS 授權範圍設定
- 告警分發器
- 日誌清理工具
- 主動建議引擎
- 自動更新腳本
- 失敗分類器
- brain_map 維護規則
- monitor-config 驗證器
- SKILL 回歸測試
- 快照生成器
- brain_map 咖哩海域圖譜
- PWA manifest 設定
- 任務角色偵測器
- AI 小助手語音對話
- HTML工具語法檢查Hook
- Obsidian 匯出工具
- 趨勢分析ASCII圖
- 待開發功能目標清單
- GAS 通訊硬規則
- Obsidian 自動同步腳本
- React/QA 硬性規範
- 監控系統健康度報告
- 車牌辨識 GAS
- 施工單查詢 GAS
- 通用 API 呼叫封裝
- 資料庫同步
- 每日筆記範本
- 專案設定路由
- 天鷹色彩編碼規範
- setup 腳本
- skill-updater 技能定義
- tianying-tool-converter 技能定義
- 前端埋點函式
- 車位計算函式
- 每日清理觸發器
- 雲端開工協議
- TODO-12哨表自動化
- TODO-25無線電工具

## God Nodes (most connected - your core abstractions)
1. `E2ETestSuite` - 18 edges
2. `tianying-monitor README.md（監控系統概述）` - 17 edges
3. `FinalValidator` - 15 edges
4. `AI Agents 團隊工作流程總覽` - 15 edges
5. `天鷹保全管理系統 專案狀態快照` - 15 edges
6. `WORKFLOW_GAS_URL（跨工具任務紀錄 GAS endpoint）` - 15 edges
7. `ToolMonitor` - 12 edges
8. `SkillAutoUpdater` - 12 edges
9. `_run()` - 11 edges
10. `資深全端工程師 Agent` - 10 edges

## Surprising Connections (you probably didn't know these)
- `學習筆記範本（_Templates）` --semantically_similar_to--> `學習筆記範本`  [INFERRED] [semantically similar]
  _Templates/學習筆記.md → 10-學習筆記/_學習筆記模板.md
- `tool_work.html 核心邏輯說明（今晚/明早/歷史）` --semantically_similar_to--> `早班晚班時段定義規則`  [INFERRED] [semantically similar]
  _CLAUDE.md → AGENTS.md
- `互動寵物功能目標（類傳說對決源寶）` --semantically_similar_to--> `TODO-28 吉祥物動畫補完（4段接力）`  [INFERRED] [semantically similar]
  TASK_CARD.md → CLAUDE.md
- `log.md Vault Operations Log 指標檔` --conceptually_related_to--> `index.md Vault 索引目錄（For future Claude）`  [INFERRED]
  log.md → index.md
- `GAS_URL（AI 對話 Gemini Proxy）` --semantically_similar_to--> `GAS_URL（停車場誤差計算 GAS）`  [INFERRED] [semantically similar]
  tool_ai_chat.html → tool_car.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **開店/打烊工具共用 _SharedDB 資料庫流程** — tool_opening_html, 開店前_gas_built_in_gas_url, 打烊後gas_db_gas_url_sharedb [EXTRACTED 0.90]
- **事故報告／表揚 主管審核狀態流程** — 事故與表揚_後端_gas_v3_1, tool_report_html, tool_feedback_html, 狀態模型_事故表揚 [EXTRACTED 0.90]
- **執行→檢視→主協調者 三層檢視循環** — claude_agents_資深全端工程師_senior_fullstack, claude_agents_代碼審查官_code_reviewer, claude_agents_主協調者_coordinator [EXTRACTED 0.90]
- **knowledge-graph maintenance workflow across brain_map docs** — claude_md_知識星空大腦維護規則, claude_code_brain_map_維護指令原稿, brain_map_html_咖哩海域知識圖譜 [INFERRED 0.85]
- **航海日誌埋點涵蓋的所有工具** — tool_work_html_施工單查詢工具, tool_signin_html_簽到工具, tool_car_html_車輛管理工具, tool_report_html_報表工具, tool_feedback_html_回饋工具, liff_leave_html_line_liff請假系統, post_html_張貼公告工具, index_html_主選單 [EXTRACTED 1.00]
- **天鷹保全專案指令文件層級（個人設定/專案規則/歸檔）** — agents_天鷹保全app個人設定路由, claude_md_專案速覽, claude_md_路由表, docs_技術經驗筆記_主檔, docs_歸檔_已完成待辦_主檔 [INFERRED 0.85]
- **監控系統每日/每月自動報告管線** — tianying_monitor_workflow_monitor_py, tianying_monitor_status_dashboard_py, tianying_monitor_alert_dispatcher_py, tianying_monitor_monthly_summary_py, tianying_monitor_obsidian_export_py [EXTRACTED 0.90]
- **失敗記錄→自動學習→回歸測試→版本備份 閉環** — tianying_monitor_workflow_monitor_py, tianying_monitor_failure_classifier_py, tianying_monitor_regression_tester_py, tianying_monitor_skill_version_manager_py, tianying_monitor_monitor_config_yaml [EXTRACTED 0.90]
- **前端工具與各自 GAS 端點的通訊模式** — tool_car_html_gas_url, tool_ai_chat_html_gas_url, tool_ai_chat_html_workflow_gas_url [INFERRED 0.75]
- **開店/打烊工具共用 _SharedDB（廠商/監工/檢查者）同步流程** — tool_opening, tool_closing, gas_shareddb [EXTRACTED 0.90]
- **表揚/事故報告 共用管理後台 GAS 審核流程** — tool_feedback, tool_report, gas_admin_feedback_report [EXTRACTED 0.90]
- **各工具統一呼叫 logWorkflow()/WORKFLOW_GAS_URL 記錄任務動作** — tool_closing, tool_opening, tool_signin, tool_logistics, tool_handover, tool_feedback, tool_report, tool_emergency, gas_workflow_log [EXTRACTED 0.95]

## Communities (57 total, 17 thin omitted)

### Community 0 - "GAS 端點總覽"
Cohesion: 0.05
Nodes (30): 操作手冊/README.md（三份操作手冊 PDF 產製說明）, 效能體檢報告_2026-07-04.md（APP 全站效能體檢）, empId 工號狀態傳遞規範, ACCOUNT_GAS_URL（帳號/正職兼職白名單 GAS）, ADMIN_GAS_URL（表揚/事故報告 共用管理 GAS）, CON_GAS_URL（施工單查詢 GAS）, BUILT_IN_GAS_URL / DB_GAS_URL（共用廠商/監工/檢查者 _SharedDB）, WORKFLOW_GAS_URL（跨工具任務紀錄 GAS endpoint） (+22 more)

### Community 1 - "Obsidian 知識庫索引"
Cohesion: 0.06
Nodes (41): Obsidian 插件安裝清單, 天鷹保全知識中樞 MOC, 天鷹保全管理系統 專案狀態快照, 工具開發模板, tpl-car 停車場車位計算 工具筆記, 事故報告／匿名表揚 後端 GAS v3.1 部署說明, 天鷹 AI 小助手 GAS 部署說明, 帶班交接事項工具 GAS 部署說明 (+33 more)

### Community 2 - "監控系統自動學習與部署"
Cohesion: 0.08
Nodes (31): 自動學習觸發閾值（critical>=2 / important>=4）, 雙電腦同步流程（公司/家用）, 等級3：完全自動化監控模式, alert-dispatcher.py（閾值告警分發）, config-validator.py（monitor-config.yaml 驗證）, DEPLOYMENT_GUIDE_LEVEL3.md（等級3部署指南）, e2e-test.py（端對端測試套件 T1-T8）, failure-classifier.py（失敗分類增強） (+23 more)

### Community 3 - "E2E 測試套件"
Cohesion: 0.17
Nodes (13): E2ETestSuite, main(), Path, T1：記錄失敗（workflow-monitor --mode convert）, T2：失敗分類（failure-classifier --summary）, T3：系統掃描（workflow-monitor --mode scan）, T4：優先排序（priority-sorter）, T5：主動建議（proactive-suggestion --health） (+5 more)

### Community 4 - "自動快照與交付偵測"
Cohesion: 0.13
Nodes (22): datetime, log(), main(), run(), run_once(), main(), save_log(), scan_new_files() (+14 more)

### Community 5 - "監控系統主控制器"
Cohesion: 0.16
Nodes (5): main(), review-log 後自動執行 proactive-suggestion.py, auto-learn 成功後依序觸發：分類器 → 優先排序 → 回歸測試, SkillAutoUpdater, ToolMonitor

### Community 6 - "AI Agents 團隊工作流"
Cohesion: 0.17
Nodes (23): 物流車輛統計工具 GAS 部署說明, AI Agents 團隊工作流程總覽, QA測試工程師 Agent, UIUX視覺設計師 Agent, 主協調者 Agent, 代碼審查官 Agent, 創意總監 Agent, 安全審查官 Agent (+15 more)

### Community 7 - "最終驗證器"
Cohesion: 0.32
Nodes (4): FinalValidator, main(), Path, _run()

### Community 8 - "技能版本管理"
Cohesion: 0.19
Nodes (17): backup_skill(), bump_minor(), list_versions(), load_manifest(), main(), Path, 回滾 skills/<name>.md 到備份版本, 顯示 skills/<name>.md 與上次備份的文字差異 (+9 more)

### Community 9 - "開店登錄 GAS 後端"
Cohesion: 0.14
Nodes (11): 開店前進出快速登錄工具 GAS 部署說明, deleteRow(), doGet() 開店前 GAS, doPost() 開店前 GAS, getTodayRows(), updateRow(), 2026-07-06 修復：updateRow/deleteRow 未處理 bug, 開店前進出快速登錄工具 (tool_opening.html) (+3 more)

### Community 10 - "工作紀錄與班別規則"
Cohesion: 0.22
Nodes (14): logWorkflow() 前端埋點函式, WORKFLOW_GAS_URL 端點, tool_work.html 核心邏輯說明（今晚/明早/歷史）, Xinyu-jarvis（小鈺）姊妹專案說明, 早班晚班時段定義規則, index.html 主選單入口（3.2MB）, index.md Vault 索引目錄（For future Claude）, liff_leave.html LINE LIFF 請假系統 (+6 more)

### Community 11 - "監控月報生成"
Cohesion: 0.23
Nodes (13): collect_dashboard_snapshots(), collect_regression_month(), collect_weekly_reports(), extract_health_from_snapshot(), extract_weekly_stats(), generate_monthly_report(), get_learn_history_from_notify(), _load() (+5 more)

### Community 12 - "Vault 筆記規則與範本"
Cohesion: 0.17
Nodes (12): 航海日誌 GAS 部署指南, GAS 修改記錄範本, 學習筆記範本, 生活規劃週計劃範本, 知識卡範本, AI-First Vault Rule（自解釋筆記規則）, Auto-Save Rules（自動存檔規則）, Vault Folder Map (+4 more)

### Community 13 - "GAS 授權範圍設定"
Cohesion: 0.17
Nodes (11): https://www.googleapis.com/auth/drive, https://www.googleapis.com/auth/script.external_request, https://www.googleapis.com/auth/spreadsheets, dependencies, exceptionLogging, oauthScopes, runtimeVersion, timeZone (+3 more)

### Community 14 - "告警分發器"
Cohesion: 0.26
Nodes (11): check_conditions(), _get_webhook_url(), _load(), main(), Path, 將告警寫入 alerts/ 目錄，回傳檔案路徑, POST 告警到 GAS webhook，由 GAS 發 LINE push, 從 monitor-config.yaml 讀取 alert_webhook_url（可選） (+3 more)

### Community 15 - "日誌清理工具"
Cohesion: 0.33
Nodes (11): do_archive(), do_dedup(), do_history(), do_trim(), _load(), main(), Path, 將 learned/ignored 項目移至 archive-log.json (+3 more)

### Community 16 - "主動建議引擎"
Cohesion: 0.26
Nodes (11): analyze_failures(), analyze_regression(), analyze_versions(), compute_health(), _load(), main(), print_report(), Path (+3 more)

### Community 17 - "自動更新腳本"
Cohesion: 0.45
Nodes (10): check_prerequisites(), cleanup(), generate_summary(), log_msg(), main(), scan_failures(), send_notification(), auto-update.sh script (+2 more)

### Community 18 - "失敗分類器"
Cohesion: 0.35
Nodes (10): build_summary(), classify_item(), classify_log(), load_patterns(), main(), print_summary(), Path, 批量分類 failure-log.json 的所有紀錄 (+2 more)

### Community 19 - "brain_map 維護規則"
Cohesion: 0.20
Nodes (10): 收工觸發語自動化流程, EDGES 關聯識別規則, NODES 節點識別規則, TOPICS 主題分類規則, brain_map 增量更新指令集, 新增節點座標自動分配公式, 知識星空大腦 Claude Code 維護指令原稿, CLAUDE.md 路由表（歸檔文件索引） (+2 more)

### Community 20 - "monitor-config 驗證器"
Cohesion: 0.29
Nodes (9): _extract_patterns(), _extract_thresholds(), main(), print_fix_template(), Path, 回傳 (passes, warnings, errors), 解析 failure_patterns 區塊, _read_lines() (+1 more)

### Community 21 - "SKILL 回歸測試"
Cohesion: 0.36
Nodes (8): check_skill(), compare_with_last(), load_history(), main(), print_report(), Path, 驗證單一 SKILL.md，回傳結構化結果, save_history()

### Community 22 - "快照生成器"
Cohesion: 0.36
Nodes (8): generate_snapshot(), generate_version(), git_commit(), load_log(), main(), 掃描本地 tianying-monitor 資料夾的檔案, 生成 project-state.md 內容, scan_local_files()

### Community 23 - "brain_map 咖哩海域圖譜"
Cohesion: 0.29
Nodes (8): 海賊王人物團隊配置對應表, brain_map.html 咖哩海域 3D 知識圖譜, TODO-22 APP 全站健檢, TODO-29 咖哩海域跑步動畫補完（RUN_IMG_MAP）, 知識星空大腦 brain_map.html 維護規則, brain_map 自動同步規則（結構性變動觸發）, 角色地點對應表（已搬至 docs/角色地點對應表.md）, 技術經驗筆記.md（踩坑教訓彙編）

### Community 24 - "PWA manifest 設定"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 26 - "AI 小助手語音對話"
Cohesion: 0.25
Nodes (8): GAS_URL（AI 對話 Gemini Proxy）, initRecog()（語音辨識初始化）, parseOpen(text), sendMessage(text, fromVoice), speakText(text), GAS_URL（停車場誤差計算 GAS）, saveToSheet(), toast(msg, type)

### Community 27 - "HTML工具語法檢查Hook"
Cohesion: 0.33
Nodes (6): { execFileSync }, fs, main(), os, path, readStdin()

### Community 28 - "Obsidian 匯出工具"
Cohesion: 0.52
Nodes (6): build_obsidian_md(), detect_vault_path(), _load(), main(), Path, 偵測 Obsidian vault 根目錄

### Community 29 - "趨勢分析ASCII圖"
Cohesion: 0.43
Nodes (6): ascii_chart(), extract_series(), load_runs(), main(), 回傳 [(timestamp, value), ...] 時間序列, 生成 ASCII 趨勢圖，回傳 lines 清單

### Community 30 - "待開發功能目標清單"
Cohesion: 0.33
Nodes (6): TODO-27 多案場版開發方向, TODO-28 吉祥物動畫補完（4段接力）, AI 對話助手（多智慧結晶體）目標, 互動寵物功能目標（類傳說對決源寶）, 多案場版本規劃目標, 當下任務卡（TASK_CARD.md）

### Community 31 - "GAS 通訊硬規則"
Cohesion: 0.50
Nodes (4): Never 禁止清單（React19/UUID主鍵/工號遺失等）, GAS doPost 函數簽名標準, 前後端通訊 JSON 格式規範, 試算表主鍵規範（純數字流水號）

### Community 32 - "Obsidian 自動同步腳本"
Cohesion: 0.83
Nodes (3): get_folder(), log(), scan_and_move()

### Community 33 - "React/QA 硬性規範"
Cohesion: 0.67
Nodes (3): React 18.3.1 硬性規範（禁 19.x）, QA 檢查清單 Pre-Push Validation, HTML 工具格式標準（基礎框架+QA清單）

### Community 34 - "監控系統健康度報告"
Cohesion: 0.67
Nodes (3): 監控系統狀態.md（天鷹保全監控系統健康度報告）, tianying-tool-converter（技能）, skill-updater（技能 v1.1）

## Ambiguous Edges - Review These
- `進出資料表 分頁（A~L 欄）` → `exportDailyExcel()`  [AMBIGUOUS]
  03-GAS日誌/tool_opening_GAS_部署說明.md · relation: conceptually_related_to
- `Xinyu-jarvis（小鈺）姊妹專案說明` → `tool_work.html 施工單/動火申請查詢工具`  [AMBIGUOUS]
  AGENTS.md · relation: references
- `apiCall()` → `loadItems()`  [AMBIGUOUS]
  tool_handover.html · relation: calls

## Knowledge Gaps
- **92 isolated node(s):** `name`, `short_name`, `start_url`, `display`, `background_color` (+87 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `進出資料表 分頁（A~L 欄）` and `exportDailyExcel()`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Xinyu-jarvis（小鈺）姊妹專案說明` and `tool_work.html 施工單/動火申請查詢工具`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `apiCall()` and `loadItems()`?**
  _Edge tagged AMBIGUOUS (relation: calls) - confidence is low._
- **What connects `name`, `short_name`, `start_url` to the rest of the system?**
  _92 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `GAS 端點總覽` be split into smaller, more focused modules?**
  _Cohesion score 0.051207729468599035 - nodes in this community are weakly interconnected._
- **Should `Obsidian 知識庫索引` be split into smaller, more focused modules?**
  _Cohesion score 0.06219512195121951 - nodes in this community are weakly interconnected._
- **Should `監控系統自動學習與部署` be split into smaller, more focused modules?**
  _Cohesion score 0.08172043010752689 - nodes in this community are weakly interconnected._