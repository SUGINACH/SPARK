/*
 * gas-shim.js - מתאם בין דפי האתר (ללא שינוי) לשרת הנתונים.
 *
 * הדפים קוראים ל-google.script.run.<פונקציה>(...) כמו בעבר. המתאם הזה מממש את הממשק הזה באחד משני מצבים:
 *  - מצב api  : קריאות נשלחות ב-fetch (POST, text/plain) לנקודת הקצה של Apps Script (Code.gs), עם מפתח גישה.
 *               Apps Script משמש רק לקריאה וכתיבה של Google Sheets. האתר עצמו מתארח בנפרד (GitHub Pages).
 *  - מצב demo : כל הלוגיקה של Code.gs רצה בדפדפן מול גיליון מדומה שנשמר ב-localStorage (בלי שרת ובלי נתונים אמיתיים).
 * המצב נקבע לפי כתובת ה-API: localStorage['bs:api'].url (כפתור "חיבור" בסרגל) או BS_CONFIG.API_URL (config.js).
 * ייצוא Excel: exportMode=server (Apps Script, עם צבעים) או client (בדפדפן, SheetJS: ערכים ומיזוגים בלי צבעים).
 */
(function () {
  'use strict';

  var SHIM_SRC = (document.currentScript && document.currentScript.src) || location.href;
  var BASE = new URL('.', SHIM_SRC);                         // תיקיית האתר (תומך בתת-נתיב של github.io/<repo>/)
  var ROUTER_URL = new URL('index.html', BASE).href;
  var CFG_KEY = 'bs:api';
  var DEMO_PREFIX = 'bsdemo:';
  var SHEETS_KEY = DEMO_PREFIX + 'sheets:v1';
  var WRITE_ACTIONS = ['saveCustomerData', 'updateCalculatorResults', 'saveConsumptionAnalysis', 'saveSizingRecommendation'];

  // ---------------------------------------------------------------------------------------------
  // 1. הגדרות חיבור
  // ---------------------------------------------------------------------------------------------
  function readCfg() {
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {}; } catch (e) { stored = {}; }
    var file = window.BS_CONFIG || {};
    var url = String(stored.url || file.API_URL || '').trim();
    var mode = url ? 'api' : 'demo';
    return { mode: mode, url: url, key: String(stored.key || ''), exportMode: stored.exportMode || file.EXPORT_MODE || (mode === 'api' ? 'server' : 'client') };
  }
  var CFG = readCfg();
  function saveCfg(patch) {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {}; } catch (e) { s = {}; }
    Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete s[k]; else s[k] = patch[k]; });
    localStorage.setItem(CFG_KEY, JSON.stringify(s));
    CFG = readCfg();
  }

  // ---------------------------------------------------------------------------------------------
  // 2. מצב api: POST לנקודת הקצה של Apps Script
  // ---------------------------------------------------------------------------------------------
  // Content-Type: text/plain הוא "בקשה פשוטה" ב-CORS (בלי preflight, ש-Apps Script אינו מטפל בו). התשובה תמיד HTTP 200 עם {ok,...}.
  function postJson(url, key, action, args) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, args: args, key: key }), redirect: 'follow' })
      .catch(function () { throw new Error('לא ניתן להגיע לשרת הנתונים. בדקו חיבור לאינטרנט, את כתובת ה-Web App (/exec) ושהפריסה מוגדרת Who has access: Anyone.'); })
      .then(function (r) {
        if (!r.ok) throw new Error('שרת הנתונים החזיר HTTP ' + r.status);
        return r.text();
      })
      .then(function (txt) {
        try { return JSON.parse(txt); }
        catch (e) { throw new Error('שרת הנתונים החזיר תשובה שאינה JSON (ייתכן שהכתובת שגויה או שהפריסה דורשת התחברות לחשבון גוגל).'); }
      });
  }
  function ensureKey() {
    if (CFG.key) return Promise.resolve(CFG.key);
    var k = window.prompt('הזינו את מפתח הגישה לשרת הנתונים (Google Sheets):', '');
    if (!k || !k.trim()) return Promise.reject(new Error('לא הוזן מפתח גישה'));
    saveCfg({ key: k.trim() });
    return Promise.resolve(CFG.key);
  }
  function callApi(action, args, retried) {
    return ensureKey().then(function (key) { return postJson(CFG.url, key, action, args); }).then(function (j) {
      if (j && j.ok) return j.result;
      if (j && j.code === 'unauthorized' && !retried) { saveCfg({ key: null }); return callApi(action, args, true); }   // מפתח שגוי: שואלים שוב פעם אחת
      var e = new Error((j && j.error) || 'שגיאת שרת'); e.code = j && j.code; throw e;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // 3. שרת מקומי בדפדפן (מצב demo וייצוא Excel בצד לקוח): Code.gs האמיתי מול גיליון מדומה
  // ---------------------------------------------------------------------------------------------
  var active = null, lastCreatedSS = null, localServerP = null;
  function persist() {
    try { localStorage.setItem(SHEETS_KEY, JSON.stringify(active.toJSON())); }
    catch (e) { console.error('[דמו] שמירה ל-localStorage נכשלה (חריגה ממכסת הדפדפן?)', e); throw e; }
  }
  function loadActive() {
    if (CFG.mode !== 'demo') return new BSFake.FakeSpreadsheet('empty');
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(SHEETS_KEY) || 'null'); } catch (e) { stored = null; }
    var ss = BSFake.FakeSpreadsheet.fromJSON(stored || BS_SEED.makeSeed());
    active = ss; if (!stored) persist();
    return ss;
  }
  var services = {
    SpreadsheetApp: {
      getActiveSpreadsheet: function () { return active; },
      create: function (name) { lastCreatedSS = new BSFake.FakeSpreadsheet(name); return lastCreatedSS; },
      BorderStyle: { SOLID: 'SOLID' },
      newConditionalFormatRule: function () { var b = { setGradientMinpoint: function () { return b; }, setGradientMaxpoint: function () { return b; }, setRanges: function () { return b; }, build: function () { return {}; } }; return b; },
      getUi: function () { return { alert: function (m) { console.log('[דמו] alert:', m); } }; }
    },
    PropertiesService: { getScriptProperties: function () { return { getProperty: function () { return null; }, setProperty: function () {} }; } },
    ScriptApp: { getService: function () { return { getUrl: function () { return ROUTER_URL; } }; }, getOAuthToken: function () { return ''; } },
    HtmlService: {}, ContentService: { createTextOutput: function (s) { return { setMimeType: function () { return s; } }; }, MimeType: { JSON: 'JSON' } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    Utilities: { getUuid: function () { return 'demo-' + Math.random().toString(36).slice(2); }, base64Encode: function (bytes) { return BSFake.bytesToBase64(bytes); } },
    UrlFetchApp: { fetch: function () {                       // "ייצוא ל-xlsx" של הגיליון הזמני האחרון שנוצר
      if (!lastCreatedSS) throw new Error('אין גיליון זמני לייצוא');
      var bytes = BSFake.toXlsxBytes(lastCreatedSS, window.XLSX);
      return { getBlob: function () { return { getBytes: function () { return bytes; } }; } };
    } },
    DriveApp: { getFileById: function () { return { setTrashed: function () {} }; }, searchFiles: function () { return { hasNext: function () { return false; } }; } },
    Logger: { log: function () { console.log.apply(console, arguments); } },
    Session: { getActiveUser: function () { return { getEmail: function () { return 'demo@localhost'; } }; } }
  };
  function localServer() {
    if (localServerP) return localServerP;
    localServerP = fetch(new URL('apps-script/Code.gs', BASE)).then(function (r) {
      if (!r.ok) throw new Error('apps-script/Code.gs לא נמצא (' + r.status + ')');
      return r.text();
    }).then(function (src) {
      active = loadActive();
      var names = Object.keys(services);
      // Code.gs נטען בהקשר מבודד (בלי התנגשות שמות עם סקריפט הדף); הנתב API_ACTIONS_ הוא מקור האמת לרשימת הפעולות
      var factory = new Function(names.join(','), src + '\n;return API_ACTIONS_;');
      return factory.apply(null, names.map(function (n) { return services[n]; }));
    }).catch(function (e) { console.error('[דמו] טעינת Code.gs נכשלה:', e); throw e; });
    return localServerP;
  }
  function callLocal(name, args) {
    return localServer().then(function (actions) {
      var fn = actions[name];
      if (typeof fn !== 'function') throw new Error('פעולה לא קיימת: ' + name);
      var res = fn.apply(null, args);
      if (CFG.mode === 'demo' && WRITE_ACTIONS.indexOf(name) !== -1) persist();
      return res;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // 4. google.script.run / google.script.url / google.script.host
  // ---------------------------------------------------------------------------------------------
  function dispatch(name, args) {
    if (name === 'getWebAppUrl') return Promise.resolve(ROUTER_URL);          // כתובת האתר עצמו (הנתב)
    var local = CFG.mode === 'demo' || (name === 'generateConsumptionExcelReport' && CFG.exportMode === 'client');
    return local ? callLocal(name, args) : callApi(name, args);
  }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function makeRunner() {
    var ok = null, fail = null, user = null, proxy = null;
    var runner = {
      // חשוב: השרשרת מחזירה את ה-Proxy (לא את האובייקט הגולמי), אחרת שם הפונקציה אחרי withSuccessHandler לא יזוהה
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
        dispatch(name, args).then(function (res) {
          var out = clone(res);
          setTimeout(function () { if (successFn) successFn(out, userObj); }, 0);
        }).catch(function (e) {
          console.error('[שרת] שגיאה ב-' + name + ':', e);
          setTimeout(function () { if (failFn) failFn(e, userObj); }, 0);
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
  // 5. סרגל מצב + חלון חיבור
  // ---------------------------------------------------------------------------------------------
  function clearDemoData() {
    Object.keys(localStorage).filter(function (k) { return k.indexOf(DEMO_PREFIX) === 0 || k === 'pendingQuote' || k === 'stage1ConsumptionAnalysis'; }).forEach(function (k) { localStorage.removeItem(k); });
  }
  function openConnect() {
    if (document.getElementById('bsdemo-modal')) return;
    var m = document.createElement('div');
    m.id = 'bsdemo-modal'; m.setAttribute('dir', 'rtl');
    m.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(18,40,63,.55);display:flex;align-items:center;justify-content:center;font:14px/1.5 Heebo,Arial,sans-serif';
    var field = 'width:100%;box-sizing:border-box;padding:8px;margin:4px 0 12px;border:1px solid #ccd;border-radius:8px;font:13px monospace;direction:ltr';
    m.innerHTML = '<div style="background:#fff;color:#12283F;border-radius:14px;padding:20px;width:min(520px,94vw);box-shadow:0 12px 40px rgba(0,0,0,.4)">' +
      '<h3 style="margin:0 0 4px">חיבור ל-Google Sheets</h3>' +
      '<div style="color:#5b6b7c;font-size:12px;margin-bottom:12px">האתר נשאר באחסון הנפרד שלו. Apps Script משמש רק לקריאה וכתיבה של נתוני הגיליון.</div>' +
      '<label>כתובת ה-Web App (מסתיימת ב-/exec)</label><input id="bsc-url" style="' + field + '" placeholder="https://script.google.com/macros/s/.../exec">' +
      '<label>מפתח גישה</label><input id="bsc-key" type="password" style="' + field + '" placeholder="המפתח שהוגדר ב-setApiKey_oneTime">' +
      '<label>ייצוא Excel</label><select id="bsc-exp" style="' + field + ';direction:rtl;font-family:inherit"><option value="server">בשרת (Apps Script): עם צבעים וגרדיאנט</option><option value="client">בדפדפן: ערכים ומיזוגים, בלי צבעים</option></select>' +
      '<div id="bsc-msg" style="min-height:22px;font-size:13px;margin-bottom:10px"></div>' +
      '<button id="bsc-test" style="padding:8px 14px;border-radius:999px;border:1px solid #12283F;background:#fff;cursor:pointer">בדיקת חיבור</button> ' +
      '<button id="bsc-save" style="padding:8px 14px;border-radius:999px;border:0;background:#1E8449;color:#fff;cursor:pointer">שמירה והפעלה</button> ' +
      '<button id="bsc-off" style="padding:8px 14px;border-radius:999px;border:1px solid #C0392B;background:#fff;color:#C0392B;cursor:pointer">ניתוק (חזרה לדמו)</button> ' +
      '<button id="bsc-close" style="padding:8px 14px;border-radius:999px;border:0;background:#eee;cursor:pointer">סגירה</button></div>';
    document.body.appendChild(m);
    var $ = function (id) { return document.getElementById(id); };
    $('bsc-url').value = CFG.url; $('bsc-key').value = CFG.key; $('bsc-exp').value = CFG.mode === 'api' ? CFG.exportMode : 'server';   // חיבור ראשון: ייצוא בשרת (עם צבעים) כברירת מחדל
    var say = function (t, ok) { $('bsc-msg').style.color = ok ? '#1E8449' : '#C0392B'; $('bsc-msg').textContent = t; };
    $('bsc-test').onclick = function () {
      var url = $('bsc-url').value.trim(), key = $('bsc-key').value.trim();
      if (!url || !key) return say('יש להזין כתובת ומפתח.', false);
      say('בודק...', true);
      postJson(url, key, 'ping', []).then(function (j) {
        if (j && j.ok) say('החיבור תקין. שרת: ' + j.result.service + ' גרסה ' + j.result.version, true);
        else say('השרת ענה: ' + ((j && j.error) || 'שגיאה') + (j && j.code ? ' (' + j.code + ')' : ''), false);
      }).catch(function (e) { say(e.message, false); });
    };
    $('bsc-save').onclick = function () {
      var url = $('bsc-url').value.trim(), key = $('bsc-key').value.trim();
      if (!url || !key) return say('יש להזין כתובת ומפתח.', false);
      saveCfg({ url: url, key: key, exportMode: $('bsc-exp').value });
      location.href = ROUTER_URL;
    };
    $('bsc-off').onclick = function () { saveCfg({ url: null, key: null, exportMode: null }); location.href = ROUTER_URL; };
    $('bsc-close').onclick = function () { m.remove(); };
  }
  window.bsDemo = {
    reset: function () { clearDemoData(); location.href = ROUTER_URL; },
    openConnect: openConnect,
    config: function () { return { mode: CFG.mode, url: CFG.url, exportMode: CFG.exportMode, hasKey: !!CFG.key }; },
    routerUrl: ROUTER_URL
  };
  function addBar() {
    if (document.getElementById('bsdemo-bar')) return;
    var cid = new URLSearchParams(location.search).get('clientId') || 'BS-1001';
    var q = function (p) { return ROUTER_URL + '?page=' + p + '&clientId=' + encodeURIComponent(cid); };
    var live = CFG.mode === 'api';
    var bar = document.createElement('div');
    bar.id = 'bsdemo-bar'; bar.setAttribute('dir', 'rtl');
    bar.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;background:#12283F;color:#fff;font:12px/1.4 Heebo,Arial,sans-serif;padding:6px 10px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.35);max-width:96vw;opacity:.93';
    var a = function (href, text, color, id) { return '<a href="' + href + '"' + (id ? ' id="' + id + '"' : '') + ' style="color:' + (color || '#9fd3ff') + '">' + text + '</a>'; };
    bar.innerHTML = (live ? '<b id="bsdemo-mode" style="color:#6fdc8c">מחובר ל-Google Sheets</b>' : '<b id="bsdemo-mode" style="color:#F39C12">מצב דמו</b> · הנתונים נשמרים בדפדפן שלך') + ' · ' +
      a(ROUTER_URL, 'CRM') + ' · ' + a(q('consumption'), 'שלב 1') + ' · ' + a(q('sizing'), 'שלב 2') + ' · ' + a(q('finance'), 'שלב 3') + ' · ' + a(q('print'), 'הצעה') + ' · ' +
      a('#', 'חיבור', '#ffd38a', 'bsdemo-connect') + (live ? '' : ' · ' + a('#', 'איפוס נתוני דמו', '#ffb3a7', 'bsdemo-reset')) + ' · ' + a('#', '✕', '#ccc', 'bsdemo-x');
    document.body.appendChild(bar);
    var st = document.createElement('style'); st.textContent = '@media print{#bsdemo-bar,#bsdemo-modal{display:none!important}}'; document.head.appendChild(st);
    document.getElementById('bsdemo-connect').onclick = function (e) { e.preventDefault(); openConnect(); };
    var rs = document.getElementById('bsdemo-reset');
    if (rs) rs.onclick = function (e) { e.preventDefault(); if (confirm('למחוק את כל נתוני הדמו בדפדפן הזה ולהתחיל מחדש?')) window.bsDemo.reset(); };
    document.getElementById('bsdemo-x').onclick = function (e) { e.preventDefault(); bar.remove(); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBar); else addBar();
})();
