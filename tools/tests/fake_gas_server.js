/* שרת בדיקה: מחקה נקודת קצה של Apps Script (POST /exec -> 302 -> /echo/<id>, ללא preflight) ומריץ את Code.gs האמיתי מול גיליון מדומה.
   כולל CacheService, PropertiesService, HMAC ו-UrlFetchApp (tokeninfo) מדומים לבדיקת כניסה ותפקידים. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const SITE = process.env.SITE_DIR, PORT = +(process.env.FAKE_PORT || 8971), STATE = process.env.STATE_FILE, KEY = process.env.API_KEY || 'TESTKEY';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'TEST-CLIENT-ID';
const XLSX = require(process.env.XLSX_PATH);
const SEED = require(path.join(SITE, 'seed-data.js')), FAKE = require(path.join(SITE, 'fake-sheets.js'));
const active = fs.existsSync(STATE) ? FAKE.FakeSpreadsheet.fromJSON(JSON.parse(fs.readFileSync(STATE, 'utf8'))) : FAKE.FakeSpreadsheet.fromJSON(SEED.makeSeed());
let lastCreated = null;
const WRITE = ['saveCustomerData', 'updateCalculatorResults', 'saveConsumptionAnalysis', 'saveSizingRecommendation'];
const stats = { locks: 0 };
// --- Cache (TTL בשניות) ---
const cacheMap = new Map();
const CacheService = { getScriptCache: () => ({
  get: (k) => { const e = cacheMap.get(k); if (!e) return null; if (e.exp < Date.now()) { cacheMap.delete(k); return null; } return e.v; },
  put: (k, v, ttl) => cacheMap.set(k, { v: String(v), exp: Date.now() + (ttl || 600) * 1000 }),
  remove: (k) => cacheMap.delete(k) }) };
// --- Properties ---
const props = { BS_API_KEY: KEY, BS_GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID };
if (fs.existsSync(STATE + '.props')) Object.assign(props, JSON.parse(fs.readFileSync(STATE + '.props', 'utf8')));
const PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); fs.writeFileSync(STATE + '.props', JSON.stringify(props)); } }) };
// --- Utilities ---
const toBuf = (x) => (typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(Array.from(x, (b) => b & 255)));
const Utilities = {
  getUuid: () => crypto.randomUUID(),
  base64Encode: (x) => toBuf(x).toString('base64'),
  computeHmacSha256Signature: (value, key) => { const buf = crypto.createHmac('sha256', toBuf(key)).update(toBuf(value)).digest(); return Array.from(buf, (b) => (b > 127 ? b - 256 : b)); }   // בתים חתומים, כמו ב-Apps Script
};
// --- tokeninfo מדומה ---
const now = () => Math.floor(Date.now() / 1000);
const GOOGLE_TOKENS = {
  'GOOD-GOOGLE-ONLY-TOKEN-0000000': { aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email: 'google.only@example.com', email_verified: 'true', exp: String(now() + 3600) },
  'GOOD-VIEWER-GOOGLE-TOKEN-00000': { aud: GOOGLE_CLIENT_ID, iss: 'accounts.google.com', email: 'viewer.g@example.com', email_verified: 'true', exp: String(now() + 3600) },
  'WRONG-AUDIENCE-TOKEN-000000000': { aud: 'SOMEONE-ELSES-CLIENT', iss: 'https://accounts.google.com', email: 'google.only@example.com', email_verified: 'true', exp: String(now() + 3600) },
  'UNLISTED-EMAIL-TOKEN-000000000': { aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email: 'stranger@example.com', email_verified: 'true', exp: String(now() + 3600) },
  'EXPIRED-GOOGLE-TOKEN-000000000': { aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email: 'google.only@example.com', email_verified: 'true', exp: String(now() - 60) },
  'UNVERIFIED-EMAIL-TOKEN-0000000': { aud: GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email: 'google.only@example.com', email_verified: 'false', exp: String(now() + 3600) }
};
const UrlFetchApp = { fetch: (url) => {
  if (String(url).indexOf('https://oauth2.googleapis.com/tokeninfo?id_token=') === 0) {
    const tok = decodeURIComponent(String(url).split('id_token=')[1]); const info = GOOGLE_TOKENS[tok];
    return { getResponseCode: () => (info ? 200 : 400), getContentText: () => JSON.stringify(info || { error: 'invalid_token' }) };
  }
  return { getBlob: () => ({ getBytes: () => FAKE.toXlsxBytes(lastCreated, XLSX) }) };   // ייצוא xlsx של הגיליון הזמני
} };
const services = {
  SpreadsheetApp: { getActiveSpreadsheet: () => active, create: (n) => (lastCreated = new FAKE.FakeSpreadsheet(n)), BorderStyle: { SOLID: 'SOLID' },
    newConditionalFormatRule: () => { const b = { setGradientMinpoint() { return b; }, setGradientMaxpoint() { return b; }, setRanges() { return b; }, build() { return {}; } }; return b; },
    getUi: () => ({ alert() {} }) },
  PropertiesService, CacheService, Utilities, UrlFetchApp,
  ScriptApp: { getService: () => ({ getUrl: () => 'http://localhost/exec' }), getOAuthToken: () => '' },
  HtmlService: {}, ContentService: { createTextOutput: (s) => ({ _s: s, setMimeType() { return this; } }), MimeType: { JSON: 'JSON' } },
  LockService: { getScriptLock: () => ({ waitLock() { stats.locks++; }, releaseLock() {} }) },
  DriveApp: { getFileById: () => ({ setTrashed() {} }), searchFiles: () => ({ hasNext: () => false }) },
  Logger: { log() {} }, Session: { getActiveUser: () => ({ getEmail: () => 'test@localhost' }) }
};
const gas = new Function(Object.keys(services).join(','), fs.readFileSync(path.join(SITE, 'apps-script/Code.gs'), 'utf8') + '\n;return {doGet, doPost, upsertUser_, deactivateUser_};')(...Object.values(services));
// משתמשי בדיקה (נוצרים פעם אחת; בהפעלות הבאות הם כבר בגיליון המשוחזר)
const persist = () => fs.writeFileSync(STATE, JSON.stringify(active.toJSON()));
if (!active.getSheetByName('משתמשים')) {
  gas.upsertUser_('ora', 'Long-Passw0rd-123', 'ora@example.com', 'editor');
  gas.upsertUser_('viewer1', 'Another-Passw0rd-1', 'viewer.g@example.com', 'viewer');
  gas.upsertUser_('gonly', '', 'google.only@example.com', 'editor');
  persist();
}
const echo = new Map(); let seq = 0; const log = [];
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost:' + PORT);
  if (req.method === 'OPTIONS') { log.push({ m: 'OPTIONS', path: u.pathname }); res.writeHead(405); return res.end(); }   // Apps Script אינו מטפל ב-preflight
  if (u.pathname === '/exec') {
    let body = ''; req.on('data', (d) => (body += d));
    req.on('end', () => {
      let out;
      if (req.method === 'POST') {
        let action = null; try { action = JSON.parse(body).action; } catch (e) {}
        log.push({ m: 'POST', ct: req.headers['content-type'], action, bytes: body.length });
        out = gas.doPost({ postData: { contents: body } });
        if (WRITE.includes(action)) persist();
      } else { log.push({ m: 'GET', q: u.search }); out = gas.doGet({ parameter: Object.fromEntries(u.searchParams) }); }
      const id = ++seq; echo.set(id, out._s);
      res.writeHead(302, { Location: '/echo/' + id, 'Access-Control-Allow-Origin': '*' }); res.end();
    });
    return;
  }
  if (u.pathname.startsWith('/echo/')) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); return res.end(echo.get(+u.pathname.split('/').pop())); }
  // --- נקודות עזר לבדיקות בלבד ---
  if (u.pathname === '/__expire') { for (const k of [...cacheMap.keys()]) if (k.startsWith('sess:')) cacheMap.delete(k); res.writeHead(200); return res.end('expired'); }
  if (u.pathname === '/__unlock') { for (const k of [...cacheMap.keys()]) if (k.startsWith('fail:')) cacheMap.delete(k); res.writeHead(200); return res.end('unlocked'); }
  if (u.pathname === '/__deactivate') { gas.deactivateUser_(u.searchParams.get('u')); persist(); res.writeHead(200); return res.end('deactivated'); }
  if (u.pathname === '/__log') { res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); return res.end(JSON.stringify({ log, stats })); }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log('fake apps script on', PORT));
