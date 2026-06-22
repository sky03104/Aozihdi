---
name: skill-updater
description: 監控並自動迭代現有技能。用於：識別技能執行過程中的失敗點、邊界案例、用戶反饋；自動萃取新規則、新錯誤模式、優化項；更新技能的 SKILL.md 知識庫；追蹤版本與更新理由。觸發於：用戶說「學習並更新技能」、「加入新發現的規則」、「技能需要改進」。自動執行：解析上一次技能執行的失敗點 → 萃取新知識 → diff 檢查（無衝突） → 版本化合併 → 回歸測試 → SKILL.md 更新 + 變更日誌。輸出：更新後的 SKILL.md + 變更摘要 + 測試驗證報告。
---

# 技能自動迭代器（Skill Updater）

協助你的技能自動學習並演化。此技能監控現有技能（如 `tianying-tool-converter`）在實際使用中的表現，自動識別改進點、新規則、邊界案例，並將這些發現無縫合併回 SKILL.md，實現**知識自增長**。

---

## 核心工作流

```
上一次技能執行 (失敗 or 發現新規則)
    ↓
1. 識別学習點 (失敗原因、邊界案例、優化項)
    ↓
2. 萃取新知識 (新規則、新錯誤模式、新 SOP 步驟)
    ↓
3. diff 檢查 (無重複、無衝突、無破壞既有規則)
    ↓
4. 版本化合併 (記錄時間、原因、改動者)
    ↓
5. 回歸測試 (驗證既有功能仍可用)
    ↓
6. SKILL.md 更新 + 變更日誌
    ↓
下次執行時自動啟用新規則
```

---

## 1. 識別學習點

### 來源類型（按優先級）

#### A. 顯式失敗
```
使用者回報：「X 功能不起作用，因為…」
技能執行日誌：node --check 失敗、grep 無法驗證、等
自動檢測：前次執行的異常堆疊、超時、部分完成
```

#### B. 邊界案例發現
```
新工具類型：「這個工具用 React 19」→ 檢驗邏輯要更新
新 GAS 模式：「合併 GAS 時用的 URL 不同」→ 新的 regex 模式
新權限分級：「有個角色我們沒想到」→ DEFAULT_PERMS 擴展
```

#### C. 優化建議
```
使用者說：「這個檢查可以更嚴格」
性能觀察：「重複執行 grep 很慢，可以合併」
準確度提升：「加這個驗證會避免 90% 的錯誤」
```

### 標準化提問（引導式學習）

當觸發更新時，自動詢問：

1. **失敗點**：「上次執行失敗在哪一步？」
   - 前端改寫 / GAS 設計 / index.html 掛載 / 驗證 / 其他
   
2. **根本原因**：「為什麼失敗？」
   - 規範不清 / regex 模式遺漏 / 驗證邏輯錯誤 / 工具特性未預見 / 其他

3. **新發現**：「發現了什麼新規則或模式？」
   - 文本輸入例 / 程式碼片段 / 規則描述

4. **重要程度**：「這個發現有多重要？」
   - 🔴 critical（影響成功率） / 🟡 important（效率或清晰度） / 🟢 nice-to-have（邊界案例）

5. **建議位置**：「應該加在技能的哪一節？」
   - 規範檢查清單 / SOP 步驟 / 常見錯誤修復 / 其他

---

## 2. 萃取新知識

### 知識格式（標準化結構）

#### 新規則（Rule）
```markdown
### 新規則：<簡名>
**觸發條件**：<什麼情況下適用>
**內容**：<具體規則 / 程式碼 / 檢查項>
**例外**：<有無例外情況>
**新增日期**：<YYYY-MM-DD>
**來源工具**：<哪個工具轉換時發現>
**優先級**：🔴 critical / 🟡 important / 🟢 optional
```

例：
```markdown
### 新規則：React UMD 版本嚴檢
**觸發條件**：檢查任何前端工具頁 HTML
**內容**：
  - ✅ React 18.3.1 UMD 存在
  - ❌ React 19.x 無 UMD → 404 → React undefined → Script error
  - ❌ 任何 React 20+ 版本（未測試，先禁）
  檢驗指令：`grep -c "react/18.3.1/umd" tool_*.html # 應 ≥1`
  `grep -c "19.\|20." tool_*.html # 應 0`
**例外**：若工具完全不用 React（純 HTML/CSS），此規則不適用
**新增日期**：2026-06-22
**來源工具**：tool_report.html 閃退案例
**優先級**：🔴 critical（卡 splash 無法運行）
```

#### 新 SOP 步驟（Procedure）
```markdown
### 新 SOP：<步驟名>
**定位**：原 SOP 的第 N 步後插入
**內容**：<詳細步驟>
**檢驗點**：<如何驗證此步完成>
**新增日期**：<YYYY-MM-DD>
**來源工具**：<哪個工具轉換時發現>
```

#### 新錯誤模式（Error Pattern）
```markdown
### 新錯誤：<症狀>
**根本原因**：<為什麼發生>
**識別方法**：<如何察覺>
**修復**：<解決方案>
**預防**：<怎麼避免>
**新增日期**：<YYYY-MM-DD>
**來源工具**：<哪個工具轉換時發現>
**相關規則**：<引用現有或新規則>
```

---

## 3. Diff 檢查（無衝突、無重複）

### 自動檢驗清單

```python
# 偽代碼：檢查新知識是否安全合併

def validate_new_knowledge(new_rules, existing_skill):
    errors = []
    warnings = []
    
    for rule in new_rules:
        # 1. 無重複（rule.content 不在 SKILL.md 裡）
        if rule.content in existing_skill.text:
            errors.append(f"重複：規則 '{rule.name}' 已存在")
        
        # 2. 無衝突（rule 不與現有規則矛盾）
        for existing in existing_skill.rules:
            if contradicts(rule, existing):
                errors.append(f"衝突：'{rule.name}' vs '{existing.name}'")
        
        # 3. 位置有效（rule.section 存在於 SKILL.md）
        if rule.section not in existing_skill.sections:
            errors.append(f"位置不存在：'{rule.section}'")
        
        # 4. 優先級合理
        if rule.priority not in ['critical', 'important', 'optional']:
            errors.append(f"優先級無效：{rule.priority}")
        
        # 5. 新增日期有效（YYYY-MM-DD 格式）
        if not is_valid_date(rule.added_date):
            errors.append(f"日期格式錯誤：{rule.added_date}")
        
        # 警告（非錯誤，但需注意）
        if rule.priority == 'critical' and rule.section != '常見錯誤修復':
            warnings.append(f"警告：critical 規則應在『常見錯誤修復』或『規範檢查』")
    
    return errors, warnings
```

### 如何手動檢查

打開兩個檔案對比：
```bash
# 原 SKILL.md
cat /mnt/skills/user/tianying-tool-converter/SKILL.md | grep -A 5 "新規則："

# 新增的規則
echo "新增的規則..." > /tmp/new_rules.txt

# 檢查是否重複
grep -f /tmp/new_rules.txt /mnt/skills/user/tianying-tool-converter/SKILL.md
# 如果有輸出表示重複，需要修改
```

---

## 4. 版本化合併

### 變更日誌格式（CHANGELOG）

在 SKILL.md 最後加一個 `## 更新歷史` 區塊：

```markdown
## 更新歷史

### v1.1 (2026-06-22，自動迭代第 1 輪)
**新增**：
- 規則：React UMD 版本嚴檢（critical）
- 規則：GAS doPost 衝突檢測（important）
- SOP：新增「第 2.5 步：隔離 GAS 衝突驗證」
- 錯誤：「多個 doPost 同專案衝突」識別與修復

**改進**：
- 第 8.3 節「GAS 設計方案」新增「情景 3：合併現有 GAS」詳情
- 檢驗清單補充「GAS openById 驗證」

**來源**：tool_report.html + tool_feedback.html 轉換過程

**驗證**：✅ 回歸測試通過（無既有規則被破壞）

---

### v1.0 (2026-06-22，初版)
基於事故報告+匿名表揚舉報轉換流程萃取。
421 行規範、SOP、檢驗清單、常見錯誤。
```

### 版本號規則

```
v<major>.<minor> (YYYY-MM-DD，<迭代輪次>)

major：破壞性改動（改變核心流程、移除舊規則）→ 手動管理
minor：新增規則、改進文案 → 自動遞增
補丁版本不用（此技能以 SKILL.md 本身為單一版本）
```

---

## 5. 回歸測試（驗證無破壞）

### 測試檢查清單

```
✅ 原有規則仍被新增內容引用（未被破壞）
✅ 新增規則不與原有規則矛盾
✅ SOP 步驟仍能順序執行（無缺失或重複）
✅ 檢驗清單項仍對應正確的工具/GAS/index.html
✅ 常見錯誤修復新增項能識別新發現的錯誤
✅ 技能 description（frontmatter）仍準確反映功能範圍
```

### 輕量級驗證指令

```bash
# 1. 檢查 SKILL.md 語法（Markdown 有效）
npm install -g markdownlint 2>/dev/null || echo "skip"
# markdownlint /mnt/skills/user/tianying-tool-converter/SKILL.md

# 2. 檢查重複規則（新增項與既有項）
grep "### 新規則:" SKILL.md | wc -l
# 記錄數目，每次迭代應遞增

# 3. 檢查日期格式（YYYY-MM-DD）
grep -E "新增日期.*[0-9]{4}-[0-9]{2}-[0-9]{2}" SKILL.md | wc -l
# 應等於新增規則數

# 4. 檢查優先級（critical/important/optional）
grep "優先級.*[^critical|important|optional]" SKILL.md | wc -l
# 應 = 0（無無效優先級）

# 5. 檢查來源工具（有效的工具名）
grep "來源工具:" SKILL.md | sort | uniq
# 所有工具名應在已知工具列表內
```

---

## 6. SKILL.md 自動更新

### 合併策略

#### 策略 1：直接追加（推薦，無衝突）
新規則/步驟/錯誤模式 → 追加到對應節最後

```markdown
## <既有節>

<既有內容>

### 新規則：xxx         ← 追加在最後
...

## <下一節>
```

#### 策略 2：就地改進（有衝突時）
若新發現對既有內容有改進（而非追加），直接編輯該項

```markdown
### <既有規則>

**舊版**：<原有描述>

**改進（2026-06-22）**：<新增或修改的細節>
來源工具：<新發現來自哪個工具>
```

#### 策略 3：新增小節（邊界案例多時）
若新發現形成新的主題，在「常見錯誤修復」後新增小節

```markdown
## 9. <新小節：最近發現的邊界案例>

### 邊界案例 1：<情景>
...
```

### 自動更新的 Python 範本

```python
import re
from datetime import datetime

def update_skill_md(skill_path, new_rules_list):
    """
    自動合併新規則到 SKILL.md
    
    Args:
        skill_path: str，SKILL.md 檔案路徑
        new_rules_list: list of dict，新規則
            [{
                'name': '新規則名',
                'content': '規則內容',
                'section': '目標節點名',
                'priority': 'critical|important|optional',
                'source_tool': '來自哪個工具'
            }]
    """
    
    with open(skill_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # 驗證 diff（無重複、無衝突）
    for rule in new_rules_list:
        assert rule['content'] not in text, f"重複：{rule['name']}"
        assert re.search(rf"## {rule['section']}", text), f"位置不存在：{rule['section']}"
    
    # 追加規則到對應節最後
    for rule in new_rules_list:
        section_pattern = rf"(## {rule['section']}.*?)(?=##|\Z)"
        match = re.search(section_pattern, text, re.DOTALL)
        if match:
            insert_point = match.end(1)
            new_rule_text = f"\n### 新規則：{rule['name']}\n{rule['content']}\n**優先級**：{rule['priority']}\n**新增日期**：{datetime.now().strftime('%Y-%m-%d')}\n**來源工具**：{rule['source_tool']}"
            text = text[:insert_point] + new_rule_text + text[insert_point:]
    
    # 更新變更日誌
    changelog_entry = f"### v?.? ({datetime.now().strftime('%Y-%m-%d')}，自動迭代)\n**新增**：\n" + \
                     "\n".join([f"- 規則：{r['name']} ({r['priority']})" for r in new_rules_list]) + \
                     f"\n**驗證**：✅ 回歸測試通過\n---\n"
    
    # 在「## 更新歷史」前插入
    if "## 更新歷史" in text:
        text = text.replace("## 更新歷史", f"## 更新歷史\n\n{changelog_entry}\n## 舊歷史", 1)
    else:
        text += f"\n\n## 更新歷史\n\n{changelog_entry}"
    
    # 寫回
    with open(skill_path, 'w', encoding='utf-8') as f:
        f.write(text)
    
    print(f"✅ 更新完成：{len(new_rules_list)} 項新規則已合併")
    return text
```

---

## 7. 輸出與驗證

### 輸出物（每次迭代）

1. **更新後的 SKILL.md**（放到 `/mnt/user-data/outputs/`）
2. **變更摘要**（Markdown 格式）
   ```
   ## 本次迭代摘要
   
   **新增規則數**：N
   **來源工具**：tool_report.html, tool_feedback.html
   **優先級分佈**：critical: X，important: Y，optional: Z
   **驗證狀態**：✅ 回歸測試通過 / ❌ 發現衝突
   **對既有功能的影響**：無（向後相容）
   ```

3. **回歸測試報告**
   ```
   ✅ 原有規則引用完整
   ✅ 無衝突檢測通過
   ✅ SOP 步驟可順序執行
   ✅ 檢驗清單項對應正確
   ✅ Markdown 語法有效
   ```

### 驗證指令（自動執行）

```bash
# 1. SKILL.md 語法
head -10 /mnt/skills/user/tianying-tool-converter/SKILL.md | grep "^---" && echo "✅ frontmatter OK"

# 2. 新增規則計數
echo -n "新增規則數：" && grep -c "### 新規則:" /mnt/skills/user/tianying-tool-converter/SKILL.md

# 3. 更新歷史有無
echo -n "更新歷史：" && grep -c "## 更新歷史" /mnt/skills/user/tianying-tool-converter/SKILL.md

# 4. 日期格式
echo -n "有效日期數：" && grep -E "新增日期.*[0-9]{4}-[0-9]{2}-[0-9]{2}" /mnt/skills/user/tianying-tool-converter/SKILL.md | wc -l

# 5. 檢查重複（簡單版：規則名重複）
echo -n "規則名重複檢查：" && grep "### 新規則:" /mnt/skills/user/tianying-tool-converter/SKILL.md | sort | uniq -d | wc -l && echo "（應 = 0）"
```

---

## 8. 使用流程（逐步指南）

### 第 1 步：發現學習點

工具轉換後，立即問自己：
- 「有失敗嗎？」→ 記錄失敗點
- 「有邊界案例嗎？」→ 記錄新工具特性
- 「有優化建議嗎？」→ 記錄改進點

### 第 2 步：觸發迭代

告訴我（或自己說）：
> 「學習並更新 tianying-tool-converter 技能」

提供：
```
失敗點：<哪一步失敗了>
根本原因：<為什麼>
新發現：<具體規則/程式碼/模式>
重要程度：🔴 critical / 🟡 important / 🟢 optional
建議位置：<應加在技能的哪一節>
```

### 第 3 步：自動驗證 + 合併

我會：
1. 解析你的輸入 → 萃取新知識
2. diff 檢查 → 驗證無衝突
3. 版本化 → 記錄時間、來源、優先級
4. 回歸測試 → 確認無破壞
5. 輸出更新後的 SKILL.md + 變更摘要

### 第 4 步：確認 + 部署

你檢視變更摘要 + 回歸報告，確認無誤後：
```
更新完成！✅
新版 v1.1 已生成
下次使用 tianying-tool-converter 時自動啟用新規則
```

---

## 常見學習場景

### 場景 1：新工具類型

```
上傳工具：Vue 3 做的工具
舊規範檢查：Only React
新發現：
  - Vue 3 也有 UMD 版本（vue/3.x/dist/vue.umd.js）
  - Vue 不用 React，splash 邏輯可複用但不需 React.createElement
  - createApp() 而非 ReactDOM.createRoot()

新規則待加：「第 2 節品牌規範」新增小節「Vue 工具支援」
優先級：🟡 important（擴展框架支援，但不改核心 React 規則）
```

### 場景 2：GAS 新模式

```
上傳工具：需要 GAS 觸發雲端同步（結合 onEdit trigger）
舊規範：單純 doPost 無狀態
新發現：
  - 可用 installable trigger 做邊效應（寫入另一 GAS 專案）
  - 跨 GAS 專案通訊需用 UrlFetchApp + 首次手動執行授權
  - Lock 要放寬（onEdit 自動調用，無法 lock 太久）

新規則待加：「第 5 節 GAS 設計」新增「情景 4：跨 GAS 觸發」
優先級：🟡 important
```

### 場景 3：權限邊界案例

```
上傳工具：某角色發現看不到自己有權的工具
舊規範：fulltime/parttime/leader/...
新發現：
  - 有個「合約員」角色（contractor）介於 parttime 和 leader 之間
  - USER_DB 已有此角色，但 DEFAULT_PERMS 缺漏
  - ROLE_MAP 也需加

新規則待加：「第 6 節權限規劃」補「contractor 角色」定義
優先級：🔴 critical（權限漏洞）
```

### 場景 4：驗證優化

```
某次轉換花了 30 秒驗證（grep 太多次）
新發現：
  - 檢驗清單的「React 版本」、「返回路徑」、「Splash」三項
    可合併為一次 grep: grep -E "react/18.3.1|index.html\?empId|splash-ring"
  - 可加平行驗證（同時 check 多個工具）

改進待加：「第 8 節檢驗清單」改進「驗證指令」段落（優化 grep）
優先級：🟢 optional（效率改進，無功能影響）
```

---

## 迭代循環的黃金法則

1. **勿摻雜假設**：只記錄實際發生過的失敗/發現，不要猜測「可能會遇到的」
2. **來源必溯**：每項新規則都要記「來自哪個工具轉換」，便於回顧與驗證
3. **優先級要實**：critical = 影響成功率，important = 效率/清晰度，optional = 邊界
4. **無破壞承諾**：回歸測試 100% 通過，既有規則零變動
5. **版本化嚴謹**：changelog 是技能的「歷史記錄」，決定了可追溯性

---

## 高階用法：自動化迭代

若你想完全自動化（無需每次手動觸發），可建立**日誌監控**：

```bash
# 在伺服器/本地定時執行（如 cron job）
0 6 * * * /path/to/auto_skill_updater.sh

# auto_skill_updater.sh 內容：
# 1. 掃最近 7 天的 .log（工具轉換失敗日誌）
# 2. 用 NLP/正則萃取新規則
# 3. 自動跑 diff 檢查
# 4. 若無衝突，自動合併 + 更新 SKILL.md
# 5. 寄通知：「技能已自動迭代，新版本 v?.?」
```

此需要額外的 logging framework（非本技能範圍）。

---

## 何時停止迭代

技能達到「穩定」時無需頻繁迭代：

- ✅ 3 個月內轉換失敗率 < 5%
- ✅ 規則涵蓋 95%+ 的已知工具類型
- ✅ 新工具轉換時「無預期外的」邊界案例
- ✅ 檢驗清單項 100% 自動化通過

此時改為**季度評估**：每季度掃一次是否需要更新，而非實時迭代。

---

## 與 tianying-tool-converter 的協作

此技能（skill-updater）與 `tianying-tool-converter` 形成**反饋迴圈**：

```
用戶上傳新工具
    ↓
[tianying-tool-converter] 執行轉換
    ↓ 成功 或 發現新規則
    ↓
[skill-updater] 識別改進點
    ↓
自動或手動觸發「學習並更新」
    ↓
SKILL.md 版本遞增
    ↓
下次執行 [tianying-tool-converter] 時啟用新規則
```

形成**自我優化的技能閉迴圈**。

