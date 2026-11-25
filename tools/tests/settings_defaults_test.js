/* בדיקה: ברירות המחדל של settings.js זהות בדיוק לקבועים שהיו מוטמעים בדפים לפני לוח ההגדרות (נלקחים מהעותקים בארכיב).
 * הרצה מתיקיית הריפו:  node tools/tests/settings_defaults_test.js */
const assert = require('assert'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
global.window = {}; global.document = { readyState: 'complete', body: null, head: null, addEventListener() {} };
global.localStorage = { getItem: () => null, setItem() {} };
require(path.join(ROOT, 'settings.js'));
const S = window.BS_SETTINGS;
function block(t, name, op, cl) {
  const m = new RegExp('(?:const|let)\\s+' + name + '\\s*=\\s*\\' + op).exec(t);
  const i = t.indexOf(op, m.index); let d = 0;
  for (let j = i; j < t.length; j++) { if (t[j] === op) d++; else if (t[j] === cl) { d--; if (d === 0) return t.slice(i, j + 1); } }
}
const old = fs.readFileSync(path.join(ROOT, 'archive/pages/SystemSizing.html'), 'utf8');
const lit = (s) => new Function('return ' + s)();
assert.deepStrictEqual(S.calcConstants(), lit(block(old, 'CALC_CONSTANTS', '{', '}')));
assert.deepStrictEqual(S.propertyTypes(), lit(block(old, 'CONSUMPTION_DISTRIBUTION', '{', '}')));
console.log('✅ ברירות המחדל של CALC_CONSTANTS וטבלת סוגי הנכס זהות לקוד הישן (' + S.fields.length + ' הגדרות בסך הכול)');
