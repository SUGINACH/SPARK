/* בדיקת שרת: getAppSettings / saveAppSettings מול Code.gs האמיתי וגיליון מדומה.
 * הרצה מתיקיית הריפו:  node tools/tests/settings_server_test.js
 * בודק: ריק בהתחלה, שמירה וקריאה חוזרת, דחיית JSON פגום / גדול מדי / מבנה לא תקין, והרשאות (editor כותב, viewer קורא בלבד). */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..', '..');
const FAKE = require(path.join(ROOT, 'fake-sheets.js'));
const active = new FAKE.FakeSpreadsheet('test');

const cacheMap = new Map();
const props = { BS_API_KEY: 'TESTKEY' };
const toBuf = (x) => (typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(Array.from(x, (b) => b & 255)));
const services = {
  SpreadsheetApp: { getActiveSpreadsheet: () => active },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
  CacheService: { getScriptCache: () => ({
    get: (k) => { const e = cacheMap.get(k); return e && e.exp > Date.now() ? e.v : null; },
    put: (k, v, ttl) => cacheMap.set(k, { v: String(v), exp: Date.now() + (ttl || 600) * 1000 }),
    remove: (k) => cacheMap.delete(k) }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    base64Encode: (x) => toBuf(x).toString('base64'),
    computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', toBuf(k)).update(toBuf(v)).digest(), (b) => (b > 127 ? b - 256 : b))
  },
  UrlFetchApp: { fetch: () => { throw new Error('אין רשת בבדיקה'); } },
  ContentService: { createTextOutput: (s) => ({ _s: s, setMimeType() { return this; } }), MimeType: { JSON: 'JSON' } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Logger: { log() {} }, Session: { getActiveUser: () => ({ getEmail: () => 'test@localhost' }) }
};
const gas = new Function(Object.keys(services).join(','), fs.readFileSync(path.join(ROOT, 'apps-script/Code.gs'), 'utf8') + '\n;return {doPost, upsertUser_};')
  .apply(null, Object.keys(services).map((k) => services[k]));
const call = (req) => JSON.parse(gas.doPost({ postData: { contents: JSON.stringify(req) } })._s);

gas.upsertUser_('צופה', 'ViewerPass1234', '', 'viewer');
const viewerToken = call({ action: 'login', args: ['צופה', 'ViewerPass1234'] }).result.token;
assert.ok(viewerToken, 'כניסת viewer נכשלה');

let r = call({ action: 'getAppSettings', key: 'TESTKEY', args: [] });
assert.strictEqual(r.ok, true); assert.strictEqual(r.result, '');
console.log('✅ ריק בהתחלה');

const doc = JSON.stringify({ v: 1, updatedAt: 1, values: { 'roof.m2PerKwpNew': 6 }, tables: { knownHolidays: ['2031-01-01'] } });
r = call({ action: 'saveAppSettings', key: 'TESTKEY', args: [doc] });
assert.strictEqual(r.ok, true, JSON.stringify(r));
r = call({ action: 'getAppSettings', key: 'TESTKEY', args: [] });
assert.strictEqual(r.result, doc);
console.log('✅ שמירה וקריאה חוזרת (עברית ומספרים נשמרים בדיוק)');

doc.length; // שמירה שנייה דורסת את הראשונה ולא מוסיפה שורות
const doc2 = JSON.stringify({ v: 1, updatedAt: 2, values: {}, tables: {} });
call({ action: 'saveAppSettings', key: 'TESTKEY', args: [doc2] });
assert.strictEqual(call({ action: 'getAppSettings', key: 'TESTKEY', args: [] }).result, doc2);
assert.strictEqual(active.getSheetByName('הגדרות מערכת').getLastRow(), 2);
console.log('✅ שמירה חוזרת דורסת (שורה אחת בלבד)');

for (const [name, arg] of [['JSON פגום', '{not json'], ['מערך במקום אובייקט', '[1,2]'], ['גדול מדי', JSON.stringify({ x: 'a'.repeat(46000) })]]) {
  r = call({ action: 'saveAppSettings', key: 'TESTKEY', args: [arg] });
  assert.strictEqual(r.ok, false, name + ' אמור להידחות');
  assert.strictEqual(call({ action: 'getAppSettings', key: 'TESTKEY', args: [] }).result, doc2, name + ' לא אמור לשנות את המצב');
}
console.log('✅ JSON פגום / מבנה לא תקין / גדול מדי נדחים והמצב נשאר');

r = call({ action: 'getAppSettings', token: viewerToken, args: [] });
assert.strictEqual(r.ok, true); assert.strictEqual(r.result, doc2);
r = call({ action: 'saveAppSettings', token: viewerToken, args: [doc] });
assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'forbidden');
assert.strictEqual(call({ action: 'getAppSettings', key: 'TESTKEY', args: [] }).result, doc2);
console.log('✅ viewer קורא ולא כותב (forbidden), המצב לא השתנה');

r = call({ action: 'getAppSettings', args: [] });
assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'unauthorized');
console.log('✅ בלי אימות: unauthorized');
console.log('כל בדיקות ההגדרות בשרת עברו');
