/*
 * gas-shim.js - מתאם בין דפי האתר (ללא שינוי) לשרת הנתונים.
 *
 * הדפים קוראים ל-google.script.run.<פונקציה>(...) כמו בעבר. המתאם מממש את הממשק הזה באחד משני מצבים:
 *  - מצב api  : קריאות נשלחות ב-fetch (POST, text/plain) לנקודת הקצה של Apps Script (Code.gs). Apps Script משמש רק לקריאה וכתיבה
 *               של Google Sheets. האתר עצמו מתארח בנפרד (GitHub Pages). כניסה: שם משתמש וסיסמה או חשבון Google; אסימון זמני
 *               נשמר ב-sessionStorage (נמחק בסגירת הלשונית) ומשותף ללשוניות פתוחות דרך BroadcastChannel. תפקיד "צפייה בלבד" חוסם כתיבה.
 *  - מצב demo : כל הלוגיקה של Code.gs רצה בדפדפן מול גיליון מדומה ב-localStorage (בלי שרת ובלי נתונים אמיתיים).
 * המצב נקבע לפי כתובת ה-API: localStorage['bs:api'].url (כפתור "חיבור") או BS_CONFIG.API_URL (config.js).
 * ייצוא Excel: exportMode=server (Apps Script, עם צבעים) או client (בדפדפן, SheetJS: ערכים ומיזוגים בלי צבעים).
 */
(function () {
  'use strict';

  var SHIM_SRC = (document.currentScript && document.currentScript.src) || location.href;
  var BASE = new URL('.', SHIM_SRC);                         // תיקיית האתר (תומך בתת-נתיב של github.io/<repo>/)
  var ROUTER_URL = new URL('index.html', BASE).href;
  var CFG_KEY = 'bs:api', TOKEN_KEY = 'bs:token';
  var DEMO_PREFIX = 'bsdemo:';
  var SHEETS_KEY = DEMO_PREFIX + 'sheets:v1';
  var WRITE_ACTIONS = ['saveCustomerData', 'updateCalculatorResults', 'saveConsumptionAnalysis', 'saveSizingRecommendation', 'saveAppSettings'];
  var ROLE_LABEL = { editor: 'עריכה', viewer: 'צפייה בלבד' };

  // ---------------------------------------------------------------------------------------------
  // 1. הגדרות חיבור
  // ---------------------------------------------------------------------------------------------
  function readCfg() {
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {}; } catch (e) { stored = {}; }
    var file = window.BS_CONFIG || {};
    var url = String(stored.url || file.API_URL || '').trim();
    var mode = url ? 'api' : 'demo';
    return { mode: mode, url: url, key: String(stored.key || ''), googleClientId: String(file.GOOGLE_CLIENT_ID || ''),
             exportMode: stored.exportMode || file.EXPORT_MODE || (mode === 'api' ? 'server' : 'client') };
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
  // 2. מצב התחברות: אסימון ב-sessionStorage (עד סגירת הלשונית), משותף ללשוניות דרך BroadcastChannel
  // ---------------------------------------------------------------------------------------------
  var bc = (typeof BroadcastChannel === 'function') ? new BroadcastChannel('bs-auth') : null;
  function getAuth() {
    try { var a = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); return a && a.url === CFG.url ? a : null; } catch (e) { return null; }
  }
  function setAuth(a, silent) {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: a.token, username: a.username, role: a.role, method: a.method, url: CFG.url }));
    if (!silent && bc) bc.postMessage({ type: 'auth', auth: getAuth(), url: CFG.url });
    refreshBar();
  }
  function clearAuth(silent) {
    sessionStorage.removeItem(TOKEN_KEY);
    if (!silent && bc) bc.postMessage({ type: 'logout' });
    refreshBar();
  }
  if (bc) bc.onmessage = function (ev) {
    var d = ev.data || {};
    if (d.type === 'need' && getAuth()) bc.postMessage({ type: 'auth', auth: getAuth(), url: CFG.url });
    else if (d.type === 'auth' && !getAuth() && d.url === CFG.url && d.auth) setAuth(d.auth, true);
    else if (d.type === 'logout') clearAuth(true);
  };
  // לשונית חדשה (למשל נפתחה מה-CRM): מבקשת אסימון מלשוניות פתוחות לפני שמציגה מסך כניסה
  var handshakeP = new Promise(function (resolve) {
    if (CFG.mode !== 'api' || getAuth() || !bc) return resolve();
    var t = setTimeout(resolve, 250);
    bc.addEventListener('message', function onMsg(ev) { if (ev.data && ev.data.type === 'auth') { clearTimeout(t); bc.removeEventListener('message', onMsg); resolve(); } });
    bc.postMessage({ type: 'need' });
  });

  // ---------------------------------------------------------------------------------------------
  // 3. מצב api: POST לנקודת הקצה של Apps Script
  // ---------------------------------------------------------------------------------------------
  // Content-Type: text/plain הוא "בקשה פשוטה" ב-CORS (בלי preflight, ש-Apps Script אינו מטפל בו). התשובה תמיד HTTP 200 עם {ok,...}.
  function postJson(url, auth, action, args) {
    var body = { action: action, args: args };
    if (auth && auth.token) body.token = auth.token; else if (auth && auth.key) body.key = auth.key;
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
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

  var authP = null;
  function ensureAuth() {
    var a = getAuth();
    if (a && a.token) return Promise.resolve({ token: a.token });
    if (CFG.key) return Promise.resolve({ key: CFG.key });                 // מפתח שירות ישן (אופציונלי)
    if (authP) return authP;                                               // כניסה אחת משותפת לכל הקריאות שממתינות
    authP = handshakeP.then(function () {
      var b = getAuth();
      return b && b.token ? { token: b.token } : showLogin('');
    }).then(function (x) { authP = null; return x; }, function (e) { authP = null; throw e; });
    return authP;
  }
  function showLoginOnce(reason) {
    if (authP) return authP;
    authP = showLogin(reason).then(function (x) { authP = null; return x; }, function (e) { authP = null; throw e; });
    return authP;
  }
  function callApi(action, args, retried) {
    return ensureAuth().then(function (auth) { return postJson(CFG.url, auth, action, args); }).then(function (j) {
      if (j && j.ok) return j.result;
      if (j && (j.code === 'unauthorized' || j.code === 'session_expired') && !retried) {   // אסימון פג/מפתח שגוי: נכנסים מחדש ומנסים שוב פעם אחת
        clearAuth(true); if (CFG.key) saveCfg({ key: null });
        return showLoginOnce('ההתחברות פגה או לא תקפה. יש להיכנס מחדש.').then(function () { return callApi(action, args, true); });
      }
      var e = new Error((j && j.error) || 'שגיאת שרת'); e.code = j && j.code; throw e;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // 4. מסך כניסה (שם משתמש וסיסמה, וכפתור Google אם הוגדר GOOGLE_CLIENT_ID)
  // ---------------------------------------------------------------------------------------------
  function whenBody(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function loadGsi() {
    return new Promise(function (res, rej) {
      if (window.google && window.google.accounts && window.google.accounts.id) return res();
      var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('טעינת Google נכשלה')); };
      document.head.appendChild(s);
    });
  }
  function showLogin(reason) {
    return new Promise(function (resolve, reject) {
      whenBody(function () {
        var m = document.createElement('div');
        m.id = 'bsdemo-login'; m.setAttribute('dir', 'rtl');
        m.style.cssText = 'position:fixed;inset:0;z-index:2147483002;background:rgba(18,40,63,.72);display:flex;align-items:center;justify-content:center;font:14px/1.5 Heebo,Arial,sans-serif';
        var f = 'width:100%;box-sizing:border-box;padding:10px;margin:4px 0 12px;border:1px solid #ccd;border-radius:8px;font:14px Heebo,Arial,sans-serif';
        m.innerHTML = '<div style="background:#fff;color:#12283F;border-radius:16px;padding:24px;width:min(380px,92vw);box-shadow:0 14px 44px rgba(0,0,0,.45)">' +
          '<h3 style="margin:0 0 4px;font-size:20px">כניסה למערכת</h3>' +
          '<div id="bsl-reason" style="color:#C0392B;font-size:13px;min-height:18px;margin-bottom:6px">' + (reason || '') + '</div>' +
          '<label>שם משתמש</label><input id="bsl-user" autocomplete="username" style="' + f + '">' +
          '<label>סיסמה</label><input id="bsl-pass" type="password" autocomplete="current-password" style="' + f + '">' +
          '<div id="bsl-msg" style="color:#C0392B;font-size:13px;min-height:20px;margin-bottom:8px"></div>' +
          '<button id="bsl-go" style="padding:10px 22px;border-radius:999px;border:0;background:#1E8449;color:#fff;cursor:pointer;font-size:14px">כניסה</button> ' +
          '<button id="bsl-cancel" style="padding:10px 16px;border-radius:999px;border:0;background:#eee;cursor:pointer;font-size:14px">ביטול</button>' +
          (CFG.googleClientId ? '<div style="margin:16px 0 6px;color:#5b6b7c;font-size:12px;text-align:center">או</div><div id="bsl-google" style="display:flex;justify-content:center"></div>' : '') + '</div>';
        document.body.appendChild(m);
        var $ = function (id) { return document.getElementById(id); };
        var say = function (t) { $('bsl-msg').textContent = t; };
        function finish(res) {
          setAuth({ token: res.token, username: res.username, role: res.role, method: res.method });
          m.remove(); resolve({ token: res.token });
        }
        function submit() {
          var u = $('bsl-user').value.trim(), p = $('bsl-pass').value;
          if (!u || !p) return say('יש להזין שם משתמש וסיסמה.');
          $('bsl-go').disabled = true; say('בודק...');
          postJson(CFG.url, null, 'login', [u, p]).then(function (j) {
            $('bsl-go').disabled = false;
            if (j && j.ok) finish(j.result); else { say((j && j.error) || 'שגיאה'); $('bsl-pass').value = ''; $('bsl-pass').focus(); }
          }).catch(function (e) { $('bsl-go').disabled = false; say(e.message); });
        }
        $('bsl-go').onclick = submit;
        $('bsl-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        $('bsl-user').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('bsl-pass').focus(); });
        $('bsl-cancel').onclick = function () { m.remove(); reject(new Error('לא בוצעה התחברות')); };
        $('bsl-user').focus();
        if (CFG.googleClientId) {
          loadGsi().then(function () {
            window.google.accounts.id.initialize({ client_id: CFG.googleClientId, auto_select: false, callback: function (resp) {
              say('מאמת מול Google...');
              postJson(CFG.url, null, 'loginGoogle', [resp.credential]).then(function (j) { if (j && j.ok) finish(j.result); else say((j && j.error) || 'שגיאה'); }).catch(function (e) { say(e.message); });
            } });
            window.google.accounts.id.renderButton($('bsl-google'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'he' });
          }).catch(function () { var g = $('bsl-google'); if (g) g.textContent = 'כניסה עם Google אינה זמינה כרגע'; });
        }
      });
    });
  }
  function logout() {
    var a = getAuth();
    var done = function () { clearAuth(); location.href = ROUTER_URL; };
    if (a && a.token) postJson(CFG.url, { token: a.token }, 'logout', []).then(done, done); else done();
  }

  // ---------------------------------------------------------------------------------------------
  // 5. שרת מקומי בדפדפן (מצב demo וייצוא Excel בצד לקוח): Code.gs האמיתי מול גיליון מדומה
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
  var localCache = {};
  var services = {
    SpreadsheetApp: {
      getActiveSpreadsheet: function () { return active; },
      create: function (name) { lastCreatedSS = new BSFake.FakeSpreadsheet(name); return lastCreatedSS; },
      BorderStyle: { SOLID: 'SOLID' },
      newConditionalFormatRule: function () { var b = { setGradientMinpoint: function () { return b; }, setGradientMaxpoint: function () { return b; }, setRanges: function () { return b; }, build: function () { return {}; } }; return b; },
      getUi: function () { return { alert: function (m) { console.log('[דמו] alert:', m); } }; }
    },
    PropertiesService: { getScriptProperties: function () { return { getProperty: function () { return null; }, setProperty: function () {} }; } },
    CacheService: { getScriptCache: function () { return { get: function (k) { return k in localCache ? localCache[k] : null; }, put: function (k, v) { localCache[k] = String(v); }, remove: function (k) { delete localCache[k]; } }; } },
    ScriptApp: { getService: function () { return { getUrl: function () { return ROUTER_URL; } }; }, getOAuthToken: function () { return ''; } },
    HtmlService: {}, ContentService: { createTextOutput: function (s) { return { setMimeType: function () { return s; } }; }, MimeType: { JSON: 'JSON' } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    Utilities: { getUuid: function () { return 'demo-' + Math.random().toString(36).slice(2); }, base64Encode: function (bytes) { return BSFake.bytesToBase64(bytes); },
                 computeHmacSha256Signature: function () { throw new Error('כניסה בשם משתמש אינה זמינה במצב דמו'); } },
    UrlFetchApp: { fetch: function () {                       // "ייצוא ל-xlsx" של הגיליון הזמני האחרון שנוצר
      if (!lastCreatedSS) throw new Error('אין גיליון זמני לייצוא');
      var bytes = BSFake.toXlsxBytes(lastCreatedSS, window.XLSX);
      return { getBlob: function () { return { getBytes: function () { return bytes; } }; } };
    } },
    DriveApp: { getFileById: function () { return { setTrashed: function () {} }; }, searchFiles: function () { return { hasNext: function () { return false; } }; } },
    Logger: { log: function () { console.log.apply(console, arguments); } },
    Session: { getActiveUser: function () { return { getEmail: function () { return 'demo@localhost'; } }; } }
  };
  function fetchServerSource() {
    // server-local.js בשורש האתר (נבנה מ-Code.gs); נפילה ל-apps-script/Code.gs אם הקובץ חסר
    return fetch(new URL('server-local.js', BASE)).then(function (r) { return r.ok ? r : fetch(new URL('apps-script/Code.gs', BASE)); }).then(function (r) {
      if (!r.ok) throw new Error('קובץ השרת המקומי (server-local.js) לא נמצא (' + r.status + ')');
      return r.text();
    });
  }
  function localServer() {
    if (localServerP) return localServerP;
    localServerP = fetchServerSource().then(function (src) {
      active = loadActive();
      var names = Object.keys(services);
      // הקוד נטען בהקשר מבודד (בלי התנגשות שמות עם סקריפט הדף); הנתב API_ACTIONS_ הוא מקור האמת לרשימת הפעולות
      var factory = new Function(names.join(','), src + '\n;return API_ACTIONS_;');
      return factory.apply(null, names.map(function (n) { return services[n]; }));
    }).catch(function (e) { console.error('[דמו] טעינת השרת המקומי נכשלה:', e); throw e; });
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
  // 6. google.script.run / google.script.url / google.script.host
  // ---------------------------------------------------------------------------------------------
  function dispatch(name, args) {
    if (name === 'getWebAppUrl') return Promise.resolve(ROUTER_URL);          // כתובת האתר עצמו (הנתב)
    var local = CFG.mode === 'demo' || (name === 'generateConsumptionExcelReport' && CFG.exportMode === 'client');
    if (!local) {
      var a = getAuth();
      if (a && a.role === 'viewer' && WRITE_ACTIONS.indexOf(name) !== -1) {      // חסימה מקומית נוחה; השרת אוכף בנפרד
        return Promise.reject(Object.assign(new Error('למשתמש "צפייה בלבד" אין הרשאה לשמור נתונים.'), { code: 'forbidden' }));
      }
    }
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
  // 7. סרגל מצב + חלון חיבור
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
      '<div style="color:#5b6b7c;font-size:12px;margin-bottom:12px">האתר נשאר באחסון הנפרד שלו. Apps Script משמש רק לקריאה וכתיבה של נתוני הגיליון. הכניסה בשם משתמש וסיסמה (או Google) מתבצעת אחרי השמירה.</div>' +
      '<label>כתובת ה-Web App (מסתיימת ב-/exec)</label><input id="bsc-url" style="' + field + '" placeholder="https://script.google.com/macros/s/.../exec">' +
      '<label>ייצוא Excel</label><select id="bsc-exp" style="' + field + ';direction:rtl;font-family:inherit"><option value="server">בשרת (Apps Script): עם צבעים וגרדיאנט</option><option value="client">בדפדפן: ערכים ומיזוגים, בלי צבעים</option></select>' +
      '<details style="margin-bottom:12px"><summary style="cursor:pointer;color:#5b6b7c;font-size:12px">מפתח שירות ישן (אופציונלי, בלי כניסת משתמש)</summary><input id="bsc-key" type="password" style="' + field + '" placeholder="BS_API_KEY"></details>' +
      '<div id="bsc-msg" style="min-height:22px;font-size:13px;margin-bottom:10px"></div>' +
      '<button id="bsc-test" style="padding:8px 14px;border-radius:999px;border:1px solid #12283F;background:#fff;cursor:pointer">בדיקת חיבור</button> ' +
      '<button id="bsc-save" style="padding:8px 14px;border-radius:999px;border:0;background:#1E8449;color:#fff;cursor:pointer">שמירה והפעלה</button> ' +
      '<button id="bsc-off" style="padding:8px 14px;border-radius:999px;border:1px solid #C0392B;background:#fff;color:#C0392B;cursor:pointer">ניתוק (חזרה לדמו)</button> ' +
      '<button id="bsc-close" style="padding:8px 14px;border-radius:999px;border:0;background:#eee;cursor:pointer">סגירה</button></div>';
    document.body.appendChild(m);
    var $ = function (id) { return document.getElementById(id); };
    $('bsc-url').value = CFG.url; $('bsc-key').value = CFG.key; $('bsc-exp').value = CFG.mode === 'api' ? CFG.exportMode : 'server';
    var say = function (t, ok) { $('bsc-msg').style.color = ok ? '#1E8449' : '#C0392B'; $('bsc-msg').textContent = t; };
    $('bsc-test').onclick = function () {
      var url = $('bsc-url').value.trim();
      if (!url) return say('יש להזין כתובת.', false);
      say('בודק...', true);
      postJson(url, null, 'ping', []).then(function (j) {
        if (j && j.ok) say('החיבור תקין. שרת: ' + j.result.service + ' גרסה ' + j.result.version + (j.result.login ? ' | כניסה: סיסמה' + (j.result.login.google ? ' + Google' : '') : ''), true);
        else say('השרת ענה: ' + ((j && j.error) || 'שגיאה') + (j && j.code ? ' (' + j.code + ')' : ''), false);
      }).catch(function (e) { say(e.message, false); });
    };
    $('bsc-save').onclick = function () {
      var url = $('bsc-url').value.trim();
      if (!url) return say('יש להזין כתובת.', false);
      var key = $('bsc-key').value.trim();
      sessionStorage.removeItem(TOKEN_KEY);
      saveCfg({ url: url, key: key || null, exportMode: $('bsc-exp').value });
      location.href = ROUTER_URL;
    };
    $('bsc-off').onclick = function () { clearAuth(true); saveCfg({ url: null, key: null, exportMode: null }); location.href = ROUTER_URL; };
    $('bsc-close').onclick = function () { m.remove(); };
  }
  window.bsDemo = {
    reset: function () { clearDemoData(); location.href = ROUTER_URL; },
    openConnect: openConnect, logout: logout,
    config: function () { var a = getAuth(); return { mode: CFG.mode, url: CFG.url, exportMode: CFG.exportMode, hasKey: !!CFG.key, user: a ? a.username : null, role: a ? a.role : null, method: a ? a.method : null }; },
    routerUrl: ROUTER_URL
  };
  function barHtml() {
    var cid = new URLSearchParams(location.search).get('clientId') || 'BS-1001';
    var q = function (p) { return ROUTER_URL + '?page=' + p + '&clientId=' + encodeURIComponent(cid); };
    var live = CFG.mode === 'api', a = getAuth();
    var link = function (href, text, color, id) { return '<a href="' + href + '"' + (id ? ' id="' + id + '"' : '') + ' style="color:' + (color || '#9fd3ff') + '">' + text + '</a>'; };
    var who = '';
    if (live) {
      if (a) who = ' · <span id="bsdemo-user"><b>' + a.username.replace(/[<>&]/g, '') + '</b> (' + (ROLE_LABEL[a.role] || a.role) + ')</span> · ' + link('#', 'יציאה', '#ffb3a7', 'bsdemo-logout');
      else if (CFG.key) who = ' · <span id="bsdemo-user">מפתח שירות</span>';
      else who = ' · <span id="bsdemo-user">לא מחובר</span>';
    }
    return (live ? '<b id="bsdemo-mode" style="color:#6fdc8c">מחובר ל-Google Sheets</b>' : '<b id="bsdemo-mode" style="color:#F39C12">מצב דמו</b> · הנתונים נשמרים בדפדפן שלך') + who + ' · ' +
      link(ROUTER_URL, 'CRM') + ' · ' + link(q('consumption'), 'שלב 1') + ' · ' + link(q('sizing'), 'שלב 2') + ' · ' + link(q('finance'), 'שלב 3') + ' · ' + link(q('print'), 'הצעה') + ' · ' +
      link('#', 'חיבור', '#ffd38a', 'bsdemo-connect') + (live ? '' : ' · ' + link('#', 'איפוס נתוני דמו', '#ffb3a7', 'bsdemo-reset')) + ' · ' + link('#', '✕', '#ccc', 'bsdemo-x');
  }
  function wireBar(bar) {
    var on = function (id, fn) { var el = document.getElementById(id); if (el) el.onclick = function (e) { e.preventDefault(); fn(); }; };
    on('bsdemo-connect', openConnect);
    on('bsdemo-logout', logout);
    on('bsdemo-reset', function () { if (confirm('למחוק את כל נתוני הדמו בדפדפן הזה ולהתחיל מחדש?')) window.bsDemo.reset(); });
    on('bsdemo-x', function () { bar.remove(); });
  }
  function refreshBar() {
    var bar = document.getElementById('bsdemo-bar');
    if (!bar) return;
    bar.innerHTML = barHtml(); wireBar(bar);
  }
  function addBar() {
    if (document.getElementById('bsdemo-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'bsdemo-bar'; bar.setAttribute('dir', 'rtl');
    bar.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;background:#12283F;color:#fff;font:12px/1.4 Heebo,Arial,sans-serif;padding:6px 10px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.35);max-width:96vw;opacity:.93';
    bar.innerHTML = barHtml();
    document.body.appendChild(bar); wireBar(bar);
    var st = document.createElement('style'); st.textContent = '@media print{#bsdemo-bar,#bsdemo-modal,#bsdemo-login{display:none!important}}'; document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBar); else addBar();
})();
