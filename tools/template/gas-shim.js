/*
 * gas-shim.js — שכבת תאימות ל-GitHub Pages (מצב דמו)
 *
 * מחליפה את google.script.run / google.script.url של Apps Script, כך שדפי המערכת (ללא שינוי)
 * ירוצו על אחסון סטטי. את הלוגיקה של השרת מריץ code.js האמיתי, מול "גיליון" מדומה שנשמר
 * ב-localStorage של הדפדפן (מפתחות bsdemo:*). אין שרת, אין Google Sheets, אין נתונים אמיתיים.
 *
 * הבדלים מהפריסה האמיתית: הנתונים נשמרים בדפדפן הנוכחי בלבד; ייצוא Excel נוצר בדפדפן (SheetJS) ללא
 * צבעים וגרדיאנט (המיזוגים נשמרים); אין הרשאות, אין מפתח API, אין הצפנת טופס.
 */
(function () {
  'use strict';

  var SHIM_SRC = (document.currentScript && document.currentScript.src) || location.href;
  var BASE = new URL('.', SHIM_SRC);                       // תיקיית הדמו (תומך בתת-נתיב של github.io/<repo>/)
  var ROUTER_URL = new URL('index.html', BASE).href;       // "כתובת ה-Web App" של הדמו
  var LS = 'bsdemo:';
  var SHEETS_KEY = LS + 'sheets:v1';

  // ---------------------------------------------------------------------------------------------
  // 1. גיליון מדומה
  // ---------------------------------------------------------------------------------------------
  var sheetIdSeq = 1000;

  function FakeSheet(name, ss) {
    this.name = name; this.ss = ss;
    this.cells = new Map();        // "r,c" -> ערך
    this.merges = [];              // {r, c, nr, nc}
    this.lastRow = 0; this.lastCol = 0;
    this.maxRows = 1000; this.maxCols = 26;
    this.id = ++sheetIdSeq; this.rules = [];
    var self = this;
    this.proxy = new Proxy(this, { get: function (t, k) {
      if (k in t) return t[k];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return function () { return self.proxy; };
    } });
  }
  FakeSheet.prototype._set = function (r, c, v) {
    this.cells.set(r + ',' + c, v);
    if (r > this.lastRow) this.lastRow = r;
    if (c > this.lastCol) this.lastCol = c;
    if (r > this.maxRows) this.maxRows = r;
    if (c > this.maxCols) this.maxCols = c;
  };
  FakeSheet.prototype._get = function (r, c) {
    var v = this.cells.get(r + ',' + c);
    return v === undefined ? '' : v;
  };
  FakeSheet.prototype.getName = function () { return this.name; };
  FakeSheet.prototype.setName = function (n) { this.name = n; return this.proxy; };
  FakeSheet.prototype.getSheetId = function () { return this.id; };
  FakeSheet.prototype.getParent = function () { return this.ss; };
  FakeSheet.prototype.getLastRow = function () { return this.lastRow; };
  FakeSheet.prototype.getLastColumn = function () { return this.lastCol; };
  FakeSheet.prototype.getMaxRows = function () { return this.maxRows; };
  FakeSheet.prototype.getMaxColumns = function () { return this.maxCols; };
  FakeSheet.prototype.insertRowsAfter = function (pos, n) { this.maxRows += n; };
  FakeSheet.prototype.insertColumnsAfter = function (pos, n) { this.maxCols += n; };
  FakeSheet.prototype.setFrozenRows = function () {};
  FakeSheet.prototype.setFrozenColumns = function () {};
  FakeSheet.prototype.autoResizeColumn = function () {};
  FakeSheet.prototype.getConditionalFormatRules = function () { return this.rules; };
  FakeSheet.prototype.setConditionalFormatRules = function (r) { this.rules = r; };
  FakeSheet.prototype.appendRow = function (arr) {
    var r = this.lastRow + 1;
    for (var i = 0; i < arr.length; i++) this._set(r, i + 1, arr[i]);
    return this;
  };
  FakeSheet.prototype.getRange = function (r, c, nr, nc) {
    return makeRange(this, r, c, nr || 1, nc || 1);
  };
  FakeSheet.prototype.getDataRange = function () {
    return makeRange(this, 1, 1, Math.max(this.lastRow, 1), Math.max(this.lastCol, 1));
  };
  FakeSheet.prototype.toArray = function () {
    var out = [];
    for (var r = 1; r <= this.lastRow; r++) {
      var row = [];
      for (var c = 1; c <= this.lastCol; c++) row.push(this._get(r, c));
      out.push(row);
    }
    return out;
  };
  FakeSheet.prototype.fromArray = function (aoa) {
    var self = this;
    aoa.forEach(function (row, i) { row.forEach(function (v, j) { if (v !== '') self._set(i + 1, j + 1, v); }); });
  };

  function FakeRange(sheet, r, c, nr, nc) { this.sheet = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  FakeRange.prototype.getValues = function () {
    var out = [];
    for (var i = 0; i < this.nr; i++) { var row = []; for (var j = 0; j < this.nc; j++) row.push(this.sheet._get(this.r + i, this.c + j)); out.push(row); }
    return out;
  };
  FakeRange.prototype.getDisplayValues = function () {
    return this.getValues().map(function (row) { return row.map(function (v) { return v === '' || v == null ? '' : String(v); }); });
  };
  FakeRange.prototype.getValue = function () { return this.sheet._get(this.r, this.c); };
  FakeRange.prototype.setValues = function (vals) {
    for (var i = 0; i < vals.length; i++) for (var j = 0; j < vals[i].length; j++) this.sheet._set(this.r + i, this.c + j, vals[i][j]);
    return this;
  };
  FakeRange.prototype.setValue = function (v) { this.sheet._set(this.r, this.c, v); return this; };
  FakeRange.prototype.mergeVertically = function () {   // ממזג כל עמודה בנפרד, כמו Apps Script
    for (var j = 0; j < this.nc; j++) this.sheet.merges.push({ r: this.r, c: this.c + j, nr: this.nr, nc: 1 });
    return this;
  };
  FakeRange.prototype.merge = function () { this.sheet.merges.push({ r: this.r, c: this.c, nr: this.nr, nc: this.nc }); return this; };
  function makeRange(sheet, r, c, nr, nc) {
    var range = new FakeRange(sheet, r, c, nr, nc), proxy = null;
    // כל שיטת עיצוב אחרת (צבעים, גבולות, פילטר...) נבלעת בשקט ומחזירה את אותו טווח (שרשור). חשוב: מחזירים את ה-Proxy.
    proxy = new Proxy(range, { get: function (t, k) {
      if (k in t) return t[k];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return function () { return proxy; };
    } });
    return proxy;
  }

  function FakeSpreadsheet(name) { this.name = name; this.sheets = [new FakeSheet('Sheet1', this)]; this.id = 'demo-ss-' + Math.random().toString(36).slice(2); }
  FakeSpreadsheet.prototype.getSheets = function () { return this.sheets.map(function (s) { return s.proxy; }); };
  FakeSpreadsheet.prototype.getId = function () { return this.id; };
  FakeSpreadsheet.prototype.getSheetByName = function (n) { var f = this.sheets.find(function (s) { return s.name === n; }); return f ? f.proxy : null; };
  FakeSpreadsheet.prototype.insertSheet = function (n) { var s = new FakeSheet(n, this); this.sheets.push(s); return s.proxy; };
  FakeSpreadsheet.prototype.deleteSheet = function (s) { this.sheets = this.sheets.filter(function (x) { return x !== s && x.proxy !== s; }); };

  // ---------------------------------------------------------------------------------------------
  // 2. נתוני הדמו הראשוניים (סכימה זהה לגיליון האמיתי)
  // ---------------------------------------------------------------------------------------------
  var CUSTOMER_HEADERS = ['ID (מזהה)', 'שם הלקוח', 'כתובת', 'איש קשר', 'טלפון', 'כותרת הפרויקט', 'תאריך הצעה', 'שטח גג', 'טופס 4',
    'מכסה מחח"י', 'מקורות חשמל (JSON)', 'צרכנים (JSON)', 'הספק פאנלים', 'קיבולת אגירה', 'מצברים', 'ממירים', 'פאנלים', 'התקנה', 'תוספות',
    'עלות מערכת', 'חיסכון שנתי', 'תשואה', 'רווח מצטבר', 'הערות ניתוח', 'תמונות לקוח (JSON)', 'רכיבי מערכת (JSON)', 'כרטיסייה פעילה (אינדקס)',
    'עוצמת ממיר נדרשת', 'נתוני חישוב גולמיים (JSON)', 'נתוני צריכה מועשרים (JSON)', 'המלצת גודל מערכת (JSON)', 'נתוני ייצור מועשרים (JSON)'];
  var CATALOG_HEADERS = ['קטגוריה', 'יצרן', 'דגם', 'מחיר יחידה (₪)', 'תמונה', 'מידות', 'הספק', 'קיבולת', 'מגבלת הכפלה', 'מגבלת שרשור',
    'BMS כלול', 'עוצמה', 'היברידי', 'התאמה למערכת', 'קבוצת התאמה'];
  var CATALOG_ROWS = [
    ['פאנלים', 'JA Solar', 'JAM72 550W', 2400, '', '2.58', 550, '', '', '', '', '', '', 'הכל', ''],
    ['פאנלים', 'Jinko', 'Tiger Neo 585W', 2600, '', '2.70', 585, '', '', '', '', '', '', 'הכל', ''],
    ['מצברים', 'BYD', 'HVS 10.2', 21000, '', '', '', 10.2, '', '', 'כן', '', '', 'הכל', 'BYD'],
    ['מצברים', 'Huawei', 'LUNA2000-5', 9500, '', '', '', 5, 3, '', 'לא', '', '', 'הכל', 'HUAWEI'],
    ['ממירים', 'Huawei', 'SUN2000-8KTL (היברידי)', 7800, '', '', '', '', '', '', '', 8, 'כן', 'הכל', 'HUAWEI'],
    ['ממירים', 'SolarEdge', 'SE10K', 6900, '', '', '', '', '', '', '', 10, 'לא', 'סולארי', ''],
    ['התקנה', 'בראשית סולאר', 'התקנה וחיבור מערכת', 9000, '', '', '', '', '', '', '', '', '', 'הכל', ''],
    ['תוספות', 'בראשית סולאר', 'מערכת ניטור', 1200, '', '', '', '', '', '', '', '', '', 'הכל', '']
  ];
  function today() { var d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
  function demoCustomer(id, name, addr, contact, phone, title, roof) {
    var o = {}; CUSTOMER_HEADERS.forEach(function (h) { o[h] = ''; });
    o['ID (מזהה)'] = id; o['שם הלקוח'] = name; o['כתובת'] = addr; o['איש קשר'] = contact; o['טלפון'] = phone;
    o['כותרת הפרויקט'] = title; o['תאריך הצעה'] = today(); o['שטח גג'] = String(roof);
    ['מקורות חשמל (JSON)', 'צרכנים (JSON)', 'מצברים', 'ממירים', 'פאנלים', 'התקנה', 'תוספות', 'תמונות לקוח (JSON)', 'רכיבי מערכת (JSON)'].forEach(function (h) { o[h] = '[]'; });
    return CUSTOMER_HEADERS.map(function (h) { return o[h]; });
  }
  function seedAoa() {
    return {
      'לקוחות ופרוייקטים': [CUSTOMER_HEADERS,
        demoCustomer('BS-1001', 'דמו: משפחת כהן', 'הדגמה 1, תל אביב', 'ישראל כהן', '050-0000001', 'מערכת סולארית עם אגירה (דמו)', 120),
        demoCustomer('BS-1002', 'דמו: עסק קטן', 'הדגמה 2, חיפה', 'דנה לוי', '050-0000002', 'מערכת סולארית לעסק (דמו)', 200)],
      'מחירון': [CATALOG_HEADERS].concat(CATALOG_ROWS),
      'הגדרות': [['מקורות חשמל', 'צרכנים'], ['חברת החשמל', 'מזגן'], ['חשמל מתחדש', 'תנור'], ['גנרטור', 'כביסה'], ['אחר', 'אחר']]
    };
  }

  function loadActiveSpreadsheet() {
    var ss = new FakeSpreadsheet('active');
    ss.sheets = [];
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(SHEETS_KEY) || 'null'); } catch (e) { stored = null; }
    var data = stored || seedAoa();
    Object.keys(data).forEach(function (n) { var s = ss.insertSheet(n); s.fromArray(data[n]); });
    if (!stored) persist(ss);
    return ss;
  }
  function persist(ss) {
    var out = {}; ss.sheets.forEach(function (s) { out[s.name] = s.toArray(); });
    try { localStorage.setItem(SHEETS_KEY, JSON.stringify(out)); }
    catch (e) { console.error('[דמו] שמירה ל-localStorage נכשלה (חריגה ממכסת הדפדפן?)', e); throw e; }
  }

  // ---------------------------------------------------------------------------------------------
  // 3. שירותי Apps Script המדומים שזמינים ל-code.js
  // ---------------------------------------------------------------------------------------------
  var active = loadActiveSpreadsheet();
  var lastCreatedSS = null;

  function bytesToBase64(bytes) {
    var bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray ? bytes.subarray(i, i + CH) : bytes.slice(i, i + CH));
    return btoa(bin);
  }
  // המרת גיליון מדומה (ערכים + מיזוגים, בלי עיצוב) לקובץ xlsx בעזרת SheetJS שנטען בדף
  function fakeSsToXlsxBytes(ss) {
    if (typeof XLSX === 'undefined') throw new Error('ספריית SheetJS (XLSX) לא נטענה. נדרש חיבור אינטרנט ל-CDN.');
    var wb = XLSX.utils.book_new();
    ss.sheets.forEach(function (sh) {
      var aoa = [];
      for (var r = 1; r <= sh.lastRow; r++) {
        var row = new Array(sh.lastCol);
        for (var c = 1; c <= sh.lastCol; c++) { var v = sh.cells.get(r + ',' + c); row[c - 1] = (v === undefined || v === '') ? null : v; }
        aoa.push(row);
      }
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = sh.merges.map(function (m) { return { s: { r: m.r - 1, c: m.c - 1 }, e: { r: m.r - 1 + m.nr - 1, c: m.c - 1 + m.nc - 1 } }; });
      XLSX.utils.book_append_sheet(wb, ws, String(sh.name).replace(/[\\\/?*\[\]:]/g, '_').slice(0, 31) || 'Sheet');
    });
    return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));   // SheetJS מחזיר ArrayBuffer; מומרים ל-Uint8Array
  }

  var services = {
    SpreadsheetApp: {
      getActiveSpreadsheet: function () { return active; },
      create: function (name) { lastCreatedSS = new FakeSpreadsheet(name); return lastCreatedSS; },
      BorderStyle: { SOLID: 'SOLID' },
      newConditionalFormatRule: function () { var b = { setGradientMinpoint: function () { return b; }, setGradientMaxpoint: function () { return b; }, setRanges: function () { return b; }, build: function () { return {}; } }; return b; },
      getUi: function () { return { alert: function (m) { console.log('[דמו] alert:', m); } }; }
    },
    PropertiesService: { getScriptProperties: function () { return { getProperty: function () { return null; }, setProperty: function () {} }; } },
    ScriptApp: { getService: function () { return { getUrl: function () { return ROUTER_URL; } }; }, getOAuthToken: function () { return ''; } },
    HtmlService: {}, ContentService: { createTextOutput: function (s) { return { setMimeType: function () { return s; } }; }, MimeType: { JSON: 'JSON' } },
    Utilities: { getUuid: function () { return 'demo-' + Math.random().toString(36).slice(2); }, base64Encode: function (bytes) { return bytesToBase64(bytes); } },
    UrlFetchApp: { fetch: function () {            // "ייצוא ל-xlsx" של הגיליון הזמני האחרון שנוצר
      if (!lastCreatedSS) throw new Error('אין גיליון זמני לייצוא');
      var bytes = fakeSsToXlsxBytes(lastCreatedSS);
      return { getBlob: function () { return { getBytes: function () { return bytes; } }; } };
    } },
    DriveApp: { getFileById: function () { return { setTrashed: function () {} }; }, searchFiles: function () { return { hasNext: function () { return false; } }; } },
    Logger: { log: function () { console.log.apply(console, arguments); } },
    Session: { getActiveUser: function () { return { getEmail: function () { return 'demo@localhost'; } }; } }
  };

  // ---------------------------------------------------------------------------------------------
  // 4. טעינת code.js האמיתי בהקשר מבודד (בלי התנגשות שמות עם סקריפט הדף)
  // ---------------------------------------------------------------------------------------------
  var EXPOSED = ['getInitialData', 'getCustomerData', 'saveCustomerData', 'updateCalculatorResults', 'saveConsumptionAnalysis',
    'saveSizingRecommendation', 'getWebAppUrl', 'generateConsumptionExcelReport'];
  var server = null;
  var serverReady = fetch(new URL('code.js', BASE)).then(function (r) {
    if (!r.ok) throw new Error('code.js לא נמצא (' + r.status + ')');
    return r.text();
  }).then(function (src) {
    var names = Object.keys(services);
    var body = src + '\n;return {' + EXPOSED.map(function (n) { return n + ': typeof ' + n + " === 'function' ? " + n + ' : undefined'; }).join(', ') + '};';
    var factory = new Function(names.join(','), body);
    server = factory.apply(null, names.map(function (n) { return services[n]; }));
  }).catch(function (e) { console.error('[דמו] טעינת code.js נכשלה:', e); throw e; });

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  // ---------------------------------------------------------------------------------------------
  // 5. google.script.run / google.script.url / google.script.host
  // ---------------------------------------------------------------------------------------------
  function makeRunner() {
    var ok = null, fail = null, user = null, proxy = null;
    var runner = {
      // חשוב: השרשרת חייבת להחזיר את ה-Proxy (לא את האובייקט הגולמי), אחרת שם הפונקציה אחרי withSuccessHandler לא יזוהה
      withSuccessHandler: function (fn) { ok = fn; return proxy; },
      withFailureHandler: function (fn) { fail = fn; return proxy; },
      withUserObject: function (o) { user = o; return proxy; }
    };
    proxy = new Proxy(runner, { get: function (t, name) {
      if (name in t) return t[name];
      if (typeof name !== 'string') return undefined;
      return function () {
        var args = Array.prototype.slice.call(arguments).map(clone);
        var successFn = ok, failFn = fail, userObj = user;
        serverReady.then(function () {
          var fn = server && server[name];
          if (typeof fn !== 'function') throw new Error('פונקציית שרת לא קיימת בדמו: ' + name);
          var res = fn.apply(null, args);
          if (name === 'saveCustomerData' || name === 'updateCalculatorResults' || name === 'saveConsumptionAnalysis' || name === 'saveSizingRecommendation') persist(active);
          return clone(res);
        }).then(function (res) {
          setTimeout(function () { if (successFn) successFn(res, userObj); }, 30);
        }).catch(function (e) {
          console.error('[דמו] שגיאת שרת ב-' + name + ':', e);
          setTimeout(function () { if (failFn) failFn(e, userObj); }, 30);
        });
      };
    } });
    return proxy;
  }
  function parseQuery() {
    var p = {}, ps = {};
    new URLSearchParams(location.search).forEach(function (v, k) { if (!(k in p)) p[k] = v; (ps[k] = ps[k] || []).push(v); });
    return { parameter: p, parameters: ps };
  }
  window.google = window.google || {};
  window.google.script = {
    url: { getLocation: function (cb) { var q = parseQuery(); setTimeout(function () { cb({ hash: location.hash.replace(/^#/, ''), parameter: q.parameter, parameters: q.parameters, queryString: location.search.replace(/^\?/, '') }); }, 0); } },
    host: { close: function () { window.close(); }, setHeight: function () {}, setWidth: function () {}, origin: location.origin },
    history: { push: function () {}, replace: function () {}, setChangeHandler: function () {} }
  };
  Object.defineProperty(window.google.script, 'run', { get: makeRunner, enumerable: true });

  // ---------------------------------------------------------------------------------------------
  // 6. סרגל דמו: ניווט + איפוס
  // ---------------------------------------------------------------------------------------------
  window.bsDemo = {
    reset: function () {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(LS) === 0 || k === 'pendingQuote' || k === 'stage1ConsumptionAnalysis'; }).forEach(function (k) { localStorage.removeItem(k); });
      location.href = ROUTER_URL;
    },
    routerUrl: ROUTER_URL
  };
  function addBar() {
    if (document.getElementById('bsdemo-bar')) return;
    var cid = new URLSearchParams(location.search).get('clientId') || 'BS-1001';
    var q = function (p) { return ROUTER_URL + '?page=' + p + '&clientId=' + encodeURIComponent(cid); };
    var bar = document.createElement('div');
    bar.id = 'bsdemo-bar'; bar.setAttribute('dir', 'rtl');
    bar.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;background:#12283F;color:#fff;font:12px/1.4 Heebo,Arial,sans-serif;padding:6px 10px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.35);max-width:96vw;opacity:.93';
    bar.innerHTML = '<b style="color:#F39C12">מצב דמו</b> · הנתונים נשמרים בדפדפן שלך · ' +
      '<a href="' + ROUTER_URL + '" style="color:#9fd3ff">CRM</a> · <a href="' + q('consumption') + '" style="color:#9fd3ff">שלב 1</a> · ' +
      '<a href="' + q('sizing') + '" style="color:#9fd3ff">שלב 2</a> · <a href="' + q('finance') + '" style="color:#9fd3ff">שלב 3</a> · ' +
      '<a href="' + q('print') + '" style="color:#9fd3ff">הצעה</a> · ' +
      '<a href="#" id="bsdemo-reset" style="color:#ffb3a7">איפוס נתוני דמו</a> · <a href="#" id="bsdemo-x" style="color:#ccc">✕</a>';
    document.body.appendChild(bar);
    var st = document.createElement('style'); st.textContent = '@media print{#bsdemo-bar{display:none!important}}'; document.head.appendChild(st);
    document.getElementById('bsdemo-reset').onclick = function (e) { e.preventDefault(); if (confirm('למחוק את כל נתוני הדמו בדפדפן הזה ולהתחיל מחדש?')) window.bsDemo.reset(); };
    document.getElementById('bsdemo-x').onclick = function (e) { e.preventDefault(); bar.remove(); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBar); else addBar();
})();
