/**
 * 天鷹保全 · 車牌辨識系統 後端 GAS（獨立部署）
 * ─────────────────────────────────────────────
 * 以「已驗證可辨識」的版本為基準，API 請求方式完全相同
 * （gemini-flash-latest、key 放 URL 參數解決 AQ 金鑰 OAuth 報錯）。
 *
 * 【API Key 設定：兩種方式擇一，屬性優先】
 *   方式一（推薦）：GAS「專案設定 → 指令碼屬性」新增
 *     名稱：GEMINI_API_KEYS  值：多把 key 用逗號分隔（不同 Google Cloud 專案的 key 額度才是分開的）
 *     （也相容舊名稱 GEMINI_API_KEY 單把 key，兩個都設時 KEYS 優先）
 *   方式二：直接把 key 貼進下方 API_KEY_FALLBACK 的引號內（多把同樣逗號分隔）
 *     ⚠️ 只能貼在 GAS 編輯器裡，絕對不可 commit 回 GitHub（公開 repo 會外洩）
 *
 * 【自我檢查】瀏覽器直接開 /exec 網址，狀態頁會顯示金鑰是否已設定。
 *
 * 【部署】改完程式 →「部署 → 管理部署作業 → 編輯 → 版本：新版本」
 *   （不要「新增部署」，網址會變，前端全斷）
 * ───────────────────────────────────────────── */

// ── 設定 ──────────────────────────────────────
var SPREADSHEET_ID   = '1K46ZEq2zbh7Jw5yv3X9aPgyjWZF43ZUJfjc-x-xunnQ'; // 車輛登記試算表
var API_KEY_FALLBACK = ''; // ← 不想用指令碼屬性時，把 key 貼進引號內（僅限 GAS 編輯器，勿上傳 GitHub）

// 取金鑰清單：GEMINI_API_KEYS（多把逗號分隔）> GEMINI_API_KEY（單把舊名）> 備用常數
// 注意：免費額度是算「Google Cloud 專案」不是算金鑰，多把 key 要來自不同專案才有加乘效果
function getApiKeys_() {
  var props = PropertiesService.getScriptProperties();
  var rawKeys = props.getProperty('GEMINI_API_KEYS') || props.getProperty('GEMINI_API_KEY') || API_KEY_FALLBACK || '';
  var keys = [];
  var parts = rawKeys.split(',');
  for (var i = 0; i < parts.length; i++) {
    var k = parts[i].trim();
    if (k) keys.push(k);
  }
  return keys;
}

// ── 狀態頁（直接點開網址時顯示，並自我檢查金鑰）──
function doGet() {
  var keys = getApiKeys_();
  var props = PropertiesService.getScriptProperties();
  var keyStatus = keys.length
    ? '✅ API Key 已設定 ' + keys.length + ' 把（' + keys[0].slice(0, 4) + '…，來源：' +
      (props.getProperty('GEMINI_API_KEYS') || props.getProperty('GEMINI_API_KEY') ? '指令碼屬性' : '程式碼備用欄') + '）'
    : '❌ API Key 未設定！請到「專案設定 → 指令碼屬性」新增 GEMINI_API_KEYS（多把逗號分隔），或貼進程式碼 API_KEY_FALLBACK';
  return HtmlService.createHtmlOutput(
    '<h1>🚗 車牌辨識系統後端運行中</h1>' +
    '<p>請從 GitHub 前端頁面進行操作。若看到此頁面，代表後端部署成功。</p>' +
    '<p>' + keyStatus + '</p>'
  );
}

// ── 主入口（POST）──────────────────────────────
function doPost(e) {
  try {
    var body = e.postData ? e.postData.contents : null;
    if (!body) return jsonOut({ success: false, error: '未收到資料' });
    var payload = JSON.parse(body);

    // --- 功能 A: 車牌辨識 ---
    if (payload.action === 'recognizePlate') {
      var apiKeys = getApiKeys_();
      if (!apiKeys.length) return jsonOut({ success: false, error: 'API Key 未設定：請開 /exec 網址查看設定說明' });

      // 清洗 Base64 資料
      var cleanBase64 = payload.imageBase64.split(',')[1] || payload.imageBase64;

      var apiPayload = {
        "contents": [{
          "parts": [
            { "text": "你是一個專業車牌辨識員，專門辨識台灣車牌。請仔細辨識圖中的車牌號碼，只回傳號碼文字（如 ABC-1234），其餘文字都不填。" +
              "台灣車牌不使用字母 O 與 I，若看到圓形字元請判斷為數字 0、看到直線字元請判斷為數字 1，其餘容易混淆的字元（如 B/8、S/5、Z/2、D/0）請依上下文與台灣車牌常見格式判斷最合理的結果。" +
              "若照片模糊、角度太斜、或完全看不到車牌，回 NONE，不要用猜的填答案。" },
            { "inline_data": { "mime_type": "image/jpeg", "data": cleanBase64 }}
          ]
        }],
        "generationConfig": {
          "temperature": 0,
          "maxOutputTokens": 200
        },
        "safetySettings": [
          { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
          { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
          { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
          { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }
        ]
      };

      var options = {
        "method": "post",
        "contentType": "application/json",
        "payload": JSON.stringify(apiPayload),
        "muteHttpExceptions": true
      };

      // 雙層備援：外層模型、內層金鑰——先用最準的模型把所有金鑰額度用完，
      // 才降到備援模型（每個模型/每把金鑰的免費額度都是分開計算的）。
      // 2026-07-12 起因：-latest 被 Google 指到 gemini-3.5-flash，免費層限 20 次/日，
      // 快速連拍很快撞頂（實機截圖確認）。
      // 注意：2026-07-11 曾發現金鑰對 gemini-2.0-flash 配額為 0（打不通），
      // 所以備援鏈不放 2.0 系列；鏈上模型若配額為 0 也會自然跳下一個。
      // 2026-07-14 移除 gemini-2.5-flash：Google 已下架此模型（"no longer available to
      // new users"），回應是 HTTP 200 包一個文字錯誤、沒有標準 429/500/503 碼，舊版重試判斷
      // 判不出來會直接中止整個請求，導致鏈上排在它後面的健康模型完全沒機會被試到——金鑰越多，
      // 越容易先耗光主模型額度後撞上這個死模型，反而讓成功率變差，這才是
      // 「多把金鑰額度不升反降」的真正原因。
      // 2026-07-14 同日再移除 gemini-2.5-flash-lite：查證到 Google 開發者論壇回報同一天
      // 開始對這個型號回傳一樣的「no longer available」404，比官方公告的10月關閉日提前
      // 快3個月——寫死版本號的模型隨時可能被提前收回。鏈上只留兩個帶 -latest 的別名
      // （Google 保證這類別名永遠指向目前還活著的最新版本，不會有這個問題）。
      // 2026-07-22：兩個 -latest 別名同時回「Request contains an invalid argument」，
      // 代表問題不是特定模型，而是兩者都吃的共同參數壞掉——已移除 generationConfig 裡的
      // thinkingConfig（那是給支援「思考」的模型用的欄位，-latest 別名現在指到的版本
      // 顯然不吃這個欄位）。
      var MODELS = [
        'gemini-flash-latest',      // 主力（現指 3.5-flash，最準）
        'gemini-flash-lite-latest'  // 備援（額度較高，換速度換準度）
      ];
      var lastError = '';
      var deadKeys = {}; // 金鑰無效/沒權限 → 之後的模型也不用再試這把
      for (var mi = 0; mi < MODELS.length; mi++) {
        for (var ki = 0; ki < apiKeys.length; ki++) {
          if (deadKeys[ki]) continue;
          var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODELS[mi] + ':generateContent?key=' + apiKeys[ki];
          var res = UrlFetchApp.fetch(url, options); // key 放 URL 參數：解決 AQ 金鑰 OAuth 報錯（已驗證版本作法）
          var result = JSON.parse(res.getContentText());

          if (result.error) {
            var msg = String(result.error.message || '');
            var code = result.error.code || res.getResponseCode();
            lastError = 'API 報錯(' + MODELS[mi] + '/金鑰' + (ki + 1) + '): ' + msg;
            // 額度爆掉(429)/伺服器忙(500,503) → 換下一把金鑰或下一個模型
            if (code === 429 || code === 500 || code === 503 || /quota|exhausted|overloaded/i.test(msg)) continue;
            // 金鑰本身壞掉（無效/沒權限）→ 這把作廢，換下一把；不是最後一把就繼續
            if (code === 400 && /api key/i.test(msg) || code === 403) { deadKeys[ki] = true; continue; }
            // 模型被下架/找不到（Google 常包成 HTTP 200 + 文字訊息，沒有標準錯誤碼）
            // → 這個模型對所有金鑰都沒用，直接跳下一個模型，不要整組中止
            if (/no longer available|not found|not supported/i.test(msg)) break;
            // 2026-07-22：其他未分類的 400（例如 invalid argument）曾發生在單一模型上，
            // 但備援模型用同一組請求格式卻能正常辨識——代表問題常常是「這個模型版本」
            // 的問題，不是請求本身壞掉。改成跳下一個模型再試，撞到才是真的沒救；
            // 不要一遇到沒分類的錯誤就整個放棄，浪費掉備援模型的機會。
            break;
          }

          if (result.candidates && result.candidates[0] && result.candidates[0].content) {
            var raw = result.candidates[0].content.parts[0].text.trim().toUpperCase();
            if (raw !== "" && !raw.includes("NONE")) {
              // 只接受套得出合法台灣車牌格式的結果；套不出格式（代表AI看到的
              // 是ETC貼紙、停車證等雜訊，或只看到半截車牌）一律當辨識失敗，
              // 不要把原始文字硬塞進去——寧可手動輸入，不要塞錯資料進登記紀錄。
              // 2026-07-23：拿掉「套不出格式就照原樣回傳」的舊 fallback後才發現，
              // 之前ETC/OR8/AHX-這類明顯不是車牌的文字全被當成功登記進試算表。
              var plate = extractPlate_(raw);
              if (plate) return jsonOut({ success: true, plate: plate, raw: raw, model: MODELS[mi] });
              // 套不出格式：把AI原始看到的文字一起附上，讓保全知道AI誤判了什麼
              // （例如ETC貼紙、半截車牌），方便判斷要重拍還是直接手動輸入。
              return jsonOut({ success: false, error: "辨識失敗：AI看到的文字對不上車牌格式（AI回應：" + raw.slice(0, 50) + "），請重拍或手動輸入", raw: raw });
            }
            // 模型判定完全沒看到車牌（回NONE或空白）＝照片問題，換模型/金鑰也認不出來，直接回報
            return jsonOut({ success: false, error: "辨識失敗：請確保照片清晰且包含車牌" });
          }
          // 沒有 candidates 也沒有 error（罕見），當暫時性問題繼續換
          lastError = '模型無回應(' + MODELS[mi] + '/金鑰' + (ki + 1) + ')';
        }
      }
      return jsonOut({ success: false, error: '所有模型×金鑰的額度都已用完，請稍等 1 分鐘再拍，或手動輸入車牌。' + (lastError ? '（' + lastError + '）' : '') });
    }

    // --- 功能 B: 資料登記到試算表 ---
    if (payload.action === 'vehicleReg') {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      // 依類型名稱找對應分頁（原本寫死 getSheets()[0]永遠抓最左邊分頁，
      // 若有人在Sheets手動調過分頁順序，所有類型都會被寫到同一頁——
      // 2026-07-11踩過這坑）。找不到對應分頁時明確報錯，不要沉默寫錯地方。
      var sheet = ss.getSheetByName(payload.typeLabel);
      if (!sheet) return jsonOut({ success: false, error: '找不到「' + payload.typeLabel + '」分頁，請確認試算表分頁名稱是否與類型名稱一致' });
      var timestamp = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
      // 上鎖：append+抓行號要當成一個原子操作，避免多支手機同時登記時，
      // 兩個請求的 getLastRow() 讀到彼此交錯後的行號，回傳給前端的 row 對不上實際寫入的那一列。
      var lock = LockService.getScriptLock();
      lock.waitLock(10000);
      var newRow;
      try {
        sheet.appendRow([
          timestamp,
          payload.typeLabel,
          payload.plate,
          "'" + (payload.operator || '未登入')  // ' 前綴：工號純數字，防試算表吃掉開頭 0
        ]);
        newRow = sheet.getLastRow();
      } finally {
        lock.releaseLock();
      }
      // row 回傳給前端：辨識錯誤時前端可用這個列號呼叫 updatePlate 就地修正，不用手動開試算表改。
      return jsonOut({ success: true, row: newRow });
    }

    // --- 功能 C: 修正已登記的車牌（辨識錯誤但已送出時，前端「最近登記」列表可就地編輯）---
    if (payload.action === 'updatePlate') {
      var ss2 = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheet2 = ss2.getSheetByName(payload.typeLabel);
      if (!sheet2) return jsonOut({ success: false, error: '找不到「' + payload.typeLabel + '」分頁' });
      var row2 = parseInt(payload.row, 10);
      if (!row2 || row2 < 2) return jsonOut({ success: false, error: '列號無效' });
      var newPlate = String(payload.plate || '').trim().toUpperCase();
      if (!newPlate) return jsonOut({ success: false, error: '車牌不可為空' });
      sheet2.getRange(row2, 3).setValue(newPlate); // C欄＝車牌（欄位順序見 vehicleReg：時間/類型/車牌/登記人）
      return jsonOut({ success: true });
    }

    return jsonOut({ success: false, error: '未知動作：' + payload.action });

  } catch (err) {
    return jsonOut({ success: false, error: '後端發生錯誤: ' + err.toString() });
  }
}

// ── 台灣車牌格式提取＋正規化（套不出格式回空字串，由呼叫端 fallback）──
function extractPlate_(text) {
  var clean = String(text || '').toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  if (!clean || clean.indexOf('NONE') >= 0) return '';
  // 台灣車牌沒有 O / I：AI 若誤判成字母，修正為數字
  clean = clean.replace(/O/g, '0').replace(/I/g, '1');
  // 由長到短比對，避免長車牌被短格式截斷
  var patterns = [
    /[A-Z]{3}-?[0-9]{4}/,      // 新式汽車 ABC-1234
    /[0-9]{4}-?[A-Z]{2,3}/,    // 4321-AB / 4321-ABC
    /[A-Z]{3}-?[0-9]{3}/,      // 新式機車 ABC-123
    /[A-Z]{2}-?[0-9]{3,4}/,    // 舊式 AB-1234 / AB-123
    /[0-9]{3}-?[A-Z]{3}/,      // 321-ABC
    /[A-Z][0-9]{2}-?[0-9]{3}/, // 電動車 E12-345
    /[0-9]{2,3}-?[A-Z]{2}/     // 舊式輕機 12-AB
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = clean.match(patterns[i]);
    if (m && m[0].replace(/-/g, '').length >= 4) {
      var p = m[0];
      // 沒有連字號時，在字母／數字交界補上（台灣車牌標準格式）
      if (p.indexOf('-') < 0) {
        for (var j = 1; j < p.length; j++) {
          var prevIsDigit = p.charCodeAt(j - 1) <= 57;
          var curIsDigit  = p.charCodeAt(j) <= 57;
          if (prevIsDigit !== curIsDigit) { p = p.slice(0, j) + '-' + p.slice(j); break; }
        }
      }
      return p;
    }
  }
  return '';
}

// 輔助函式：回傳 JSON 格式
function jsonOut(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═════════════════════════════════════════════
 * 每日登記摘要 Email（主管/公司看得到登記資料）
 * ─────────────────────────────────────────────
 * 統計窗：昨天 08:00 ～ 今天 08:00（涵蓋整個晚班，班別定義：晚班 20:00～隔天 08:00）
 *
 * 【啟用步驟（只要做一次）】
 * 1. 「專案設定 → 指令碼屬性」新增：
 *      名稱：SUMMARY_EMAILS   值：收件人 email（多人用逗號分隔）
 * 2. 編輯器上方函數選 setupDailyTrigger → 執行 →（首次會跳授權，全部允許）
 *    → 之後每天早上 08:00~09:00 自動寄出，不用再管
 * 3. 想馬上看效果：函數選 testDailySummary → 執行 → 收信箱
 *
 * 注意：排程吃「最新存檔」的程式，貼上存檔即可，這部分不用重新部署。
 *       專案時區務必為 Asia/Taipei（專案設定可查）。
 * ═════════════════════════════════════════════ */

var SUMMARY_EMAILS_FALLBACK = ''; // ← 不想用指令碼屬性時，把收件人貼進引號內（僅限 GAS 編輯器，勿上傳 GitHub）

function getSummaryEmails_() {
  return (PropertiesService.getScriptProperties().getProperty('SUMMARY_EMAILS') || SUMMARY_EMAILS_FALLBACK || '').trim();
}

// 建立每日 08:00 排程（重跑會先清掉舊排程，不會重複寄）
function setupDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendDailySummary') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('sendDailySummary').timeBased().everyDays(1).atHour(8).create();
  Logger.log('✅ 排程已建立：每天 08:00~09:00 寄出登記摘要');
}

// 立即寄一封測試（統計窗與正式版相同）
function testDailySummary() {
  sendDailySummary();
  Logger.log('✅ 測試信已寄出，請收信箱（含垃圾郵件夾）');
}

function sendDailySummary() {
  var emails = getSummaryEmails_();
  if (!emails) throw new Error('收件人未設定：請在「專案設定 → 指令碼屬性」新增 SUMMARY_EMAILS（多人用逗號分隔）');

  var tz  = 'Asia/Taipei';
  var now = new Date();
  // 時間戳存的是 'yyyy-MM-dd HH:mm:ss' 台北時間字串 → 直接用字串比大小，避開時區換算陷阱
  var todayStr     = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var yesterdayStr = Utilities.formatDate(new Date(now.getTime() - 86400000), tz, 'yyyy-MM-dd');
  var startKey = yesterdayStr + ' 08:00:00';
  var endKey   = todayStr     + ' 08:00:00';

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  // 原本只讀 getSheets()[0]（最左邊分頁），三種類型分開存在不同分頁時
  // 只會統計到其中一頁，其他分頁的登記全部漏掉（2026-07-11發現連帶修正）。
  // 改成三種類型分頁都讀，合併統計。
  var TYPE_LABELS = ['館內機車', '館內汽車', '新莊停車場'];
  var rows = [];
  for (var s = 0; s < TYPE_LABELS.length; s++) {
    var typeSheet = ss.getSheetByName(TYPE_LABELS[s]);
    if (!typeSheet) continue;
    rows = rows.concat(typeSheet.getDataRange().getValues());
  }

  var hits = [];        // [時間, 類型, 車牌, 登記人]
  var byType = {};      // 類型 → 台數
  for (var i = 0; i < rows.length; i++) {
    var ts = rows[i][0];
    // 儲存格可能是字串或已被試算表轉成 Date，統一格式化後比對
    var key = (ts instanceof Date)
      ? Utilities.formatDate(ts, tz, 'yyyy-MM-dd HH:mm:ss')
      : String(ts || '');
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(key)) continue; // 跳過表頭/空列/爛值
    if (key < startKey || key >= endKey) continue;
    var type = String(rows[i][1] || '未分類');
    hits.push([key, type, String(rows[i][2] || ''), String(rows[i][3] || '')]);
    byType[type] = (byType[type] || 0) + 1;
  }
  hits.sort(); // 依時間排序

  var dateLabel = yesterdayStr.slice(5).replace('-', '/') + ' 08:00 ～ ' + todayStr.slice(5).replace('-', '/') + ' 08:00';
  var subject = '【天鷹保全】過夜車輛登記摘要 ' + dateLabel + '（共 ' + hits.length + ' 台）';
  var sheetUrl = 'https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID;

  // 統計列
  var statHtml = '';
  for (var t in byType) {
    statHtml += '<span style="display:inline-block;margin:0 12px 6px 0;padding:4px 12px;background:#FFF7DB;border:1px solid #E5C84A;border-radius:14px;font-size:13px;color:#7A6200;">' +
                t + '：<b>' + byType[t] + '</b> 台</span>';
  }
  if (!statHtml) statHtml = '<span style="font-size:13px;color:#888;">本時段無登記紀錄</span>';

  // 明細表
  var trHtml = '';
  for (var j = 0; j < hits.length; j++) {
    trHtml += '<tr>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #EEE;font-size:13px;">' + hits[j][0].slice(11, 16) + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #EEE;font-size:13px;">' + hits[j][1] + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #EEE;font-size:14px;font-weight:bold;letter-spacing:1px;">' + hits[j][2] + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #EEE;font-size:13px;color:#666;">' + hits[j][3] + '</td>' +
      '</tr>';
  }
  var tableHtml = hits.length
    ? '<table style="border-collapse:collapse;width:100%;max-width:520px;margin-top:14px;">' +
      '<tr style="background:#1A1C22;color:#FFD700;">' +
      '<th style="padding:8px 10px;font-size:12px;text-align:left;">時間</th>' +
      '<th style="padding:8px 10px;font-size:12px;text-align:left;">類型</th>' +
      '<th style="padding:8px 10px;font-size:12px;text-align:left;">車牌</th>' +
      '<th style="padding:8px 10px;font-size:12px;text-align:left;">登記人</th>' +
      '</tr>' + trHtml + '</table>'
    : '';

  var htmlBody =
    '<div style="font-family:\'Microsoft JhengHei\',sans-serif;max-width:560px;">' +
    '<div style="padding:14px 18px;background:#0A0C10;border-radius:10px 10px 0 0;">' +
    '<div style="color:#D4A800;font-size:17px;font-weight:bold;letter-spacing:2px;">🦅 天鷹保全 · 過夜車輛登記摘要</div>' +
    '<div style="color:#8A95A8;font-size:12px;margin-top:4px;">' + dateLabel + '（晚班全時段）</div>' +
    '</div>' +
    '<div style="padding:16px 18px;border:1px solid #E5E5E5;border-top:none;border-radius:0 0 10px 10px;">' +
    '<div style="font-size:14px;margin-bottom:10px;">合計 <b style="font-size:18px;color:#B8860B;">' + hits.length + '</b> 台</div>' +
    statHtml + tableHtml +
    '<div style="margin-top:16px;"><a href="' + sheetUrl + '" style="font-size:13px;color:#1A73E8;">📊 開啟完整登記試算表</a></div>' +
    '<div style="margin-top:10px;font-size:11px;color:#AAA;">此信由系統每日 08:00 自動寄出 · TIANYING SECURITY</div>' +
    '</div></div>';

  MailApp.sendEmail({ to: emails, subject: subject, htmlBody: htmlBody });
}
