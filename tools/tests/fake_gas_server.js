/* שרת בדיקה: מחקה נקודת קצה של Apps Script (POST /exec -> 302 -> /echo/<id>, ללא preflight) ומריץ את Code.gs האמיתי מול גיליון מדומה. */
const http = require('http'), fs = require('fs'), path = require('path');
const SITE = process.env.SITE_DIR, PORT = +(process.env.FAKE_PORT || 8971), STATE = process.env.STATE_FILE, KEY = process.env.API_KEY || 'TESTKEY';
const XLSX = require(process.env.XLSX_PATH);
const SEED = require(path.join(SITE, 'seed-data.js')), FAKE = require(path.join(SITE, 'fake-sheets.js'));
const active = fs.existsSync(STATE) ? FAKE.FakeSpreadsheet.fromJSON(JSON.parse(fs.readFileSync(STATE, 'utf8'))) : FAKE.FakeSpreadsheet.fromJSON(SEED.makeSeed());
let lastCreated = null;
const WRITE = ['saveCustomerData', 'updateCalculatorResults', 'saveConsumptionAnalysis', 'saveSizingRecommendation'];
const services = {
  SpreadsheetApp: { getActiveSpreadsheet: () => active, create: (n) => (lastCreated = new FAKE.FakeSpreadsheet(n)), BorderStyle: { SOLID: 'SOLID' },
    newConditionalFormatRule: () => { const b = { setGradientMinpoint() { return b; }, setGradientMaxpoint() { return b; }, setRanges() { return b; }, build() { return {}; } }; return b; },
    getUi: () => ({ alert() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'BS_API_KEY' ? KEY : null), setProperty() {} }) },
  ScriptApp: { getService: () => ({ getUrl: () => 'http://localhost/exec' }), getOAuthToken: () => '' },
  HtmlService: {}, ContentService: { createTextOutput: (s) => ({ _s: s, setMimeType() { return this; } }), MimeType: { JSON: 'JSON' } },
  LockService: { getScriptLock: () => ({ waitLock() { stats.locks++; }, releaseLock() {} }) },
  Utilities: { getUuid: () => 'u-' + Math.random().toString(36).slice(2), base64Encode: (b) => FAKE.bytesToBase64(b) },
  UrlFetchApp: { fetch: () => ({ getBlob: () => ({ getBytes: () => FAKE.toXlsxBytes(lastCreated, XLSX) }) }) },
  DriveApp: { getFileById: () => ({ setTrashed() {} }), searchFiles: () => ({ hasNext: () => false }) },
  Logger: { log() {} }, Session: { getActiveUser: () => ({ getEmail: () => 'test@localhost' }) }
};
const stats = { locks: 0 };
const gas = new Function(Object.keys(services).join(','), fs.readFileSync(path.join(SITE, 'apps-script/Code.gs'), 'utf8') + '\n;return {doGet, doPost};')(...Object.values(services));
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
        if (WRITE.includes(action)) fs.writeFileSync(STATE, JSON.stringify(active.toJSON()));
      } else {
        log.push({ m: 'GET', q: u.search });
        out = gas.doGet({ parameter: Object.fromEntries(u.searchParams) });
      }
      const id = ++seq; echo.set(id, out._s);
      res.writeHead(302, { Location: '/echo/' + id, 'Access-Control-Allow-Origin': '*' }); res.end();
    });
    return;
  }
  if (u.pathname.startsWith('/echo/')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(echo.get(+u.pathname.split('/').pop()));
  }
  if (u.pathname === '/__log') { res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); return res.end(JSON.stringify({ log, stats })); }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log('fake apps script on', PORT));
