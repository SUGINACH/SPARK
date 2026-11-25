/* בדיקת מודול החגים (holidays.js): זהה לפונקציית יום הטוב הקודמת על 2020-2035, תאריכי ייחוס של חגים אחרים (כולל דחיות),
 * שלוש ההבחנות, והשפעת הגדרות. הרצה מתיקיית הריפו:  node tools/tests/holidays_test.js */
const assert = require('assert'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
function load(overrides) {
  global.window = {}; global.document = { readyState: 'complete', body: null, head: null, addEventListener() {} };
  const store = overrides ? { bs_settings_v1: JSON.stringify(overrides) } : {};
  global.localStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } };
  const p1 = path.join(ROOT, 'settings.js'), p2 = path.join(ROOT, 'holidays.js');
  delete require.cache[require.resolve(p1)]; require(p1);
  global.BS_SETTINGS = window.BS_SETTINGS;   // בדפדפן הוא גלובל; ב-node צריך לחבר אותו
  delete require.cache[require.resolve(p2)]; require(p2);
  return window.BS_HOLIDAYS;
}
const ds = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const D = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
let H = load();

// 1. יום טוב: זהה בדיוק לפונקציה הקודמת (תמונת מצב 2020-2035)
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'yomtov_2020_2035.json'), 'utf8'));
const mine = [];
for (let y = 2020; y <= 2035; y++) for (let m = 0; m < 12; m++) for (let d = 1, n = new Date(y, m + 1, 0).getDate(); d <= n; d++) if (H.isYomTov(new Date(y, m, d))) mine.push(ds(new Date(y, m, d)));
assert.deepStrictEqual(mine, golden);
console.log('✅ יום טוב זהה לפונקציה הקודמת על 2020-2035 (' + golden.length + ' ימים)');

// 2. תאריכי ייחוס (ידועים מבחוץ). כולל דחיות: 17 בתמוז ותשעה באב 2025 נדחו משבת לראשון; יום העצמאות 2025 הוקדם משבת לחמישי, ו-2024 נדחה משני לשלישי; יום השואה 2024 נדחה מראשון לשני
const has = (date, name) => H.names(D(date)).split(', ').includes(name);
const cases = [
  ['2025-12-15', 'חנוכה'], ['2025-12-22', 'חנוכה'], ['2026-12-05', 'חנוכה'], ['2026-12-12', 'חנוכה'],
  ['2025-03-14', 'פורים'], ['2026-03-03', 'פורים'], ['2024-03-24', 'פורים'], ['2027-03-23', 'פורים'],
  ['2026-02-02', 'ט"ו בשבט'], ['2025-05-16', 'ל"ג בעומר'], ['2025-05-26', 'יום ירושלים'],
  ['2025-08-03', 'תשעה באב'], ['2026-07-23', 'תשעה באב'], ['2025-07-13', 'י"ז בתמוז'], ['2026-07-02', 'י"ז בתמוז'],
  ['2025-05-01', 'יום העצמאות'], ['2025-04-30', 'יום הזיכרון'], ['2024-05-14', 'יום העצמאות'], ['2024-05-13', 'יום הזיכרון'], ['2026-04-22', 'יום העצמאות'],
  ['2024-05-06', 'יום השואה'], ['2026-04-14', 'יום השואה'], ['2026-09-14', 'צום גדליה'], ['2025-09-25', 'צום גדליה'],
  ['2026-04-01', 'ערב פסח'], ['2026-04-03', 'חול המועד פסח'], ['2026-04-07', 'חול המועד פסח'], ['2026-09-27', 'חול המועד סוכות'], ['2026-10-02', 'חול המועד סוכות'],
  ['2026-09-11', 'ערב ראש השנה'], ['2026-09-20', 'ערב יום כיפור'], ['2026-09-25', 'ערב סוכות'], ['2026-05-21', 'ערב שבועות']
];
for (const [date, name] of cases) assert(has(date, name), date + ' אמור להיות ' + name + ' אך התקבל: "' + H.names(D(date)) + '"');
for (const [date, name] of [['2025-12-14', 'חנוכה'], ['2025-12-23', 'חנוכה'], ['2026-12-04', 'חנוכה'], ['2026-12-13', 'חנוכה'], ['2025-08-02', 'תשעה באב'], ['2025-05-03', 'יום העצמאות'], ['2024-05-05', 'יום השואה'], ['2024-05-13', 'יום העצמאות']])
  assert(!has(date, name), date + ' לא אמור להיות ' + name);
console.log('✅ ' + cases.length + ' תאריכי ייחוס (חנוכה/פורים/דחיות/ערבי חג/חול המועד) נכונים, וגבולות חנוכה מדויקים');

// 3. שלוש ההבחנות
const hanukkah = D('2026-12-06'), rh = D('2026-09-13'), cholPesach = D('2026-04-05'), regular = D('2026-06-10');
assert(H.isAnyHoliday(hanukkah) && !H.isYomTov(hanukkah), 'חנוכה: הבחנה 1 כן, 2 לא');
assert(H.isAnyHoliday(cholPesach) && !H.isYomTov(cholPesach), 'חול המועד: הבחנה 1 כן, 2 לא');
assert(H.isAnyHoliday(rh) && H.isYomTov(rh), 'ראש השנה: 1 ו-2');
assert(!H.isAnyHoliday(regular) && !H.isYomTov(regular) && !H.isTouHoliday(regular));
console.log('✅ הבחנה 1 (כל יום מיוחד) מול הבחנה 2 (יום טוב בלבד)');

// 4. תעו"ז (הבחנה 3): ברירת מחדל = חודשים מרץ-נובמבר (כפי שמוטמע ומאומת מול לוח הרשות), ורק יום טוב
assert(H.isTouHoliday(rh), 'ר"ה בספטמבר: חג לתעו"ז');
assert(!H.isTouHoliday(cholPesach), 'חול המועד אינו יום טוב: לא חג לתעו"ז');
assert(!H.isTouHoliday(hanukkah), 'חנוכה בדצמבר: לא');
H = load({ v: 1, values: { 'touHoliday.month12': 1, 'touHoliday.month09': 0 }, tables: {} });
assert(!H.isTouHoliday(rh), 'ספטמבר כובה בהגדרות: ר"ה אינו חג לתעו"ז');
assert(!H.isTouHoliday(hanukkah), 'דצמבר הופעל אבל ברירת המחדל היא יום טוב בלבד: חנוכה עדיין לא');
H = load({ v: 1, values: { 'touHoliday.month12': 1, 'touHoliday.scopeAll': 1 }, tables: {} });
assert(H.isTouHoliday(hanukkah), 'דצמבר מופעל + כל יום מיוחד: חנוכה כן');
console.log('✅ תעו"ז: חודשים וטווח (יום טוב / כל יום מיוחד) נשלטים מההגדרות');

// 5. הגדרות הבחנה 1
H = load({ v: 1, values: { 'holiday.on.hanukkah': 0 }, tables: { extraHolidays: ['2026-11-26'] } });
assert(!H.isAnyHoliday(hanukkah), 'חנוכה כובה: אינו יום חריג');
assert(H.isYomTov(D('2026-09-13')), 'יום טוב אינו ניתן לכיבוי');
assert(H.isAnyHoliday(D('2026-11-26')) && /יום מיוחד/.test(H.names(D('2026-11-26'))), 'תאריך נוסף ידני נספר');
assert(!H.isYomTov(D('2026-11-26')), 'תאריך ידני אינו יום טוב');
console.log('✅ כיבוי יום מיוחד, ותאריך נוסף ידני: רק הבחנה 1');

H = load();
const y26 = H.listYear(2026);
assert(y26.length > 45 && y26.length < 90, 'מספר ימים מיוחדים ב-2026 סביר: ' + y26.length);
console.log('✅ 2026: ' + y26.length + ' ימים מיוחדים, מתוכם ' + y26.filter((x) => x.yomTov).length + ' ימי יום טוב');
console.log('כל בדיקות החגים עברו');

// 6. רצף קדוש ארוך (גיבוי שבת+חג): 2026-2027 עד יומיים; ר"ה תשפ"ט יום חמישי-שישי + שבת = 3 ימים (21/9/2028)
H = load();
const c1 = H.longestHolyChain(2026, 2); assert.strictEqual(c1.days, 2, '2026-2027: 2 ימים רצופים לכל היותר');
const c2 = H.longestHolyChain(2026, 10); assert.strictEqual(c2.days, 3); assert.strictEqual(c2.from, '2028-09-21'); assert.strictEqual(c2.to, '2028-09-23');
console.log('✅ רצף קדוש: 2026-2027 עד ' + c1.days + ' ימים; ב-10 השנים הקרובות ' + c2.days + ' (' + c2.from + ' עד ' + c2.to + ')');
console.log('כל בדיקות החגים (כולל רצף) עברו');
