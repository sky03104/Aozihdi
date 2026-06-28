# ★ 知識星空大腦 · Claude Code 維護指令
# 將此區塊貼進你的 CLAUDE.md 即可使用

---

## brain_map 知識圖譜（brain_map.html）

此專案包含一個互動式 3D 知識圖譜，用於視覺化專案模組與關聯。

### 使用方式
直接用瀏覽器開啟 `brain_map.html` 即可（無需伺服器）。

---

### Claude Code 維護規則

當我說「**請更新知識圖譜**」時，你必須：

#### Step 1 — 掃描專案
- 讀取專案內所有主要程式檔（依專案語言掃描 .py / .js / .ts / .go / .gs / .html 等）
- 識別每個獨立的功能模組、服務、頁面、API endpoint、資料表

#### Step 2 — 決定主題分類（TOPICS）
- 根據專案性質，決定 3～6 個主題分類
- 每個主題給一個清楚的繁體中文名稱與對應顏色
- 更新 brain_map.html 的 `TOPICS` 物件

建議色碼備選：
- `#D4A800` 金（核心/主要）
- `#818CF8` 靛藍（後端/系統）
- `#4ADE80` 綠（前端/介面）
- `#FB923C` 橙（資料/設定）
- `#38BDF8` 藍（基礎建設/部署）
- `#F87171` 紅（規則/限制/待辦）
- `#A78BFA` 紫（API/整合）
- `#34D399` 青（測試/QA）

#### Step 3 — 識別節點（NODES）
每個獨立功能 = 一個節點，規則如下：
- `id`：從 0 開始的純整數，新增時接續最大 id
- `title`：繁體中文功能名稱，15 字以內
- `topic`：對應 TOPICS 的 key
- `pos`：[x, y, z] 座標（範圍限制在 ±1.4）
- `note`：（選填）一句話說明，可放重要規則、TODO、注意事項

**座標空間分配原則**（依 topic 決定大方向，同 topic 內節點間距 ±0.25～0.45）：
```
第1主題：中央    x∈[-0.3, 0.3],  y∈[-0.3, 0.3],  z∈[ 0.3, 0.8]
第2主題：左前    x∈[-1.4,-0.5],  y∈[-0.3, 0.7]
第3主題：右前    x∈[ 0.5, 1.4],  y∈[-0.3, 0.7]
第4主題：頂部    y∈[ 0.8, 1.4]
第5主題：底部    y∈[-1.4,-0.7]
第6主題：後方    z∈[-1.4,-0.7]
```
若主題數量 < 6，依序取用前 N 個分區。

#### Step 4 — 識別關聯（EDGES）
以下情況建立一條邊：
- 函式 A 呼叫函式 B（直接呼叫關係）
- 模組 A 讀取/寫入模組 B 的資料
- 頁面 A 連結到頁面 B
- 功能 A 依賴功能 B 才能運作
- 同一業務流程的相鄰步驟

#### Step 5 — 更新 brain_map.html
- **只修改** `=== BRAIN_MAP_DATA_START ===` 與 `=== BRAIN_MAP_DATA_END ===` 之間的內容
- 更新 `BRAIN_CONFIG.title` 為專案名稱
- 完整替換 `TOPICS`、`NODES`、`EDGES`
- 不得修改標記外的任何 Three.js 代碼

#### Step 6 — 回報更新摘要
更新完成後，用以下格式回報：
```
✅ 知識圖譜已更新
- 新增節點：X 個（列出標題）
- 新增關聯：Y 條
- 修改節點：Z 個（列出標題與修改原因）
- 主題分類：[列出所有 topic]
```

---

### 增量更新指令

除了「請更新知識圖譜」之外，也支援以下指令：

| 你說的話 | Claude Code 的動作 |
|---|---|
| 「新增節點：XXX，屬於 YYY 主題」 | 新增單一節點，座標自動分配在同主題附近 |
| 「把節點 X 的說明改成 YYY」 | 只更新該節點的 note 欄位 |
| 「在 X 和 Y 之間新增關聯」 | 新增一條 EDGES 記錄 |
| 「刪除節點 XXX」 | 移除節點及所有相關的 EDGES |
| 「把主題 X 的顏色改成 #XXXXXX」 | 只更新 TOPICS 的 color 欄位 |

---

### 新增節點時的座標自動分配公式

```javascript
// 找出同 topic 的所有節點，在其平均位置附近分配
const siblings = NODES.filter(n => n.topic === newNode.topic);
if (siblings.length === 0) {
  // 使用 topic 預設分區中心
} else {
  const avgX = siblings.reduce((s,n) => s+n.pos[0], 0) / siblings.length;
  const avgY = siblings.reduce((s,n) => s+n.pos[1], 0) / siblings.length;
  const avgZ = siblings.reduce((s,n) => s+n.pos[2], 0) / siblings.length;
  // 在平均位置加上 ±0.25～0.45 的隨機偏移（避免重疊）
}
```

---

*brain_map.html 採 Three.js r128，單一 HTML 檔案，瀏覽器直接開啟即用。*
