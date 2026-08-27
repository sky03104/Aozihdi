/* ================================================================
   施工單「報到換證」後端 GAS
   ----------------------------------------------------------------
   用途：tool_work.html 施工單查詢工具，按下「報到換證」時呼叫此 Web App，
         在試算表 O 欄（第 15 欄）寫入「報到時間戳」。
   注意：這支與「上傳工具後端」（getOrders / 上傳 rows・fireRows 那支 v2.0）
         是不同的兩支 Script，請勿混淆。本支只負責報到換證的寫入。

   2026-08-27 SQL遷移階段4：報到成功寫入Sheets的O欄後，同步更新Supabase
   對應列的checked_in_at（用B~K十欄重建dedupe_key找到那一列）。這是
   獨立的Apps Script專案，要另外在「專案設定→Script Properties」設定
   SUPABASE_URL / SUPABASE_SECRET_KEY，不會沿用其他專案的設定。

   ── 每天制（2026-06-29 改）──────────────────────────────────────
   O 欄不再寫死「已報到換證」字面值，改寫「報到的日期時間」(yyyy-MM-dd HH:mm)。
   前端 tool_work.html 的 isCheckinActive() 會據此判斷：
     現在仍在這次施工時段內 → 顯示「已報到換證」；
     過了該筆退場時間 / 隔天   → 自動回「報到換證」（可再按）。
   讓綠十字這種「整月每天來」的常態單，每天都能各自報到。

   ── 比對邏輯 ────────────────────────────────────────────────────
   優先用 ID(A欄) 比對；否則用 廠商(C)+月(D)+日(E)+進場時間(F) 組合比對。
   （與前端 checkinMatchKey 一致）

   ── 試算表欄位 A~O ──────────────────────────────────────────────
   A=流水號 B=申請單位 C=廠商 D=月 E=日 F=進場時間 G=退場時間
   H=人數 I=監工 J=施工地點 K=施工項目 L=施工日期 M=退場日期
   N=備註 O=報到時間戳

   ── 部署 ────────────────────────────────────────────────────────
   改動後務必：部署 → 管理部署 → 編輯(鉛筆) → 版本「新版本」→ 部署
   （走「編輯既有部署」，網址不變；勿「新增部署」以免換網址導致前端斷線）
   ================================================================ */

// 2026-08-27 SQL遷移階段4：報到成功後同步更新Supabase的checked_in_at，
// Sheets仍照常寫入不受影響。失敗只記log不擋Sheets這邊的正常流程。
function supabaseConfig3_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_URL');
  var key = props.getProperty('SUPABASE_SECRET_KEY');
  if (!url || !key) throw new Error('請先設定 SUPABASE_URL 與 SUPABASE_SECRET_KEY');
  return { url: url.replace(/\/+$/, ''), key: key };
}

function supabaseRequest3_(method, path, body, extraHeaders) {
  var cfg = supabaseConfig3_();
  var headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' };
  if (extraHeaders) { for (var k in extraHeaders) headers[k] = extraHeaders[k]; }
  var options = { method: method, headers: headers, muteHttpExceptions: true };
  if (body !== undefined) options.payload = JSON.stringify(body);
  var resp = UrlFetchApp.fetch(cfg.url + path, options);
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code >= 400) throw new Error('Supabase請求失敗（' + code + '）：' + text);
  return text ? JSON.parse(text) : null;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheetName = data.sheet;
    var ss = SpreadsheetApp.openById('1QuNkwu9zgPidUfSgWpqyT1M9X683IU-0LhXTc23hw-A');
    var sheet = ss.getSheetByName(sheetName);
    if(!sheet) throw new Error('找不到分頁：' + sheetName);
    var values = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < values.length; i++) {
      var rowId = String(values[i][0]).trim();
      var dataId = String(data.id || '').trim();
      // 主要用ID比對，次要用廠商+月+日+進場時間
      var byId = dataId && dataId !== 'null' && rowId === dataId;
      var byCombo = !byId && (String(values[i][2]).trim() === String(data.vendor || '').trim())
                    && (String(values[i][3]).trim() === String(data.month || '').trim())
                    && (String(values[i][4]).trim() === String(data.day || '').trim())
                    && (String(values[i][5]).trim() === String(data.inTime || '').trim());
      if(byId || byCombo) {
        // O 欄 = 第15欄。每天制：寫「報到時間戳」而非永久字面值，前端據此判定是否過退場時間
        var checkinTime = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm');
        sheet.getRange(i + 1, 15).setValue(checkinTime);
        found = true;

        // 同步Supabase：用B~K十欄重建dedupe_key找到對應列更新checked_in_at
        try {
          var row = values[i];
          var key = [row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10]]
            .map(function (v) { return String(v == null ? '' : v).trim(); }).join('§');
          var table = (sheetName === '動火申請查詢') ? 'fire_permits' : 'construction_orders';
          var isoTime = checkinTime.replace(' ', 'T') + ':00+08:00';
          supabaseRequest3_('PATCH', '/rest/v1/' + table + '?dedupe_key=eq.' + encodeURIComponent(key),
            { checked_in_at: isoTime });
        } catch (syncErr) {
          console.error('同步Supabase報到時間失敗（不影響Sheets已成功更新）：' + syncErr.toString());
        }

        break;
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify({ success: found, msg: found ? 'OK' : '找不到對應資料列' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, msg: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
