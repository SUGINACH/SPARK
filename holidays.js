/* בראשית סולאר: חגים וימים מיוחדים, נגזרים מהלוח העברי לכל שנה (D21).
 * מחליף את הרשימה הקשיחה שכיסתה רק יוני וספטמבר.
 *
 * שלוש הבחנות:
 *   1. isAnyHoliday(date): כל יום מיוחד, גם בלי איסור מלאכה (חנוכה, פורים, חול המועד, צומות, ימי זיכרון...).
 *      לזיהוי צריכה חריגה (גבוהה/נמוכה). כל יום מיוחד שאינו יום טוב ניתן לכיבוי בלוח ההגדרות.
 *   2. isYomTov(date): רק חגים האסורים במלאכה (ר"ה, יוה"כ, סוכות, שמיני עצרת, פסח, שביעי של פסח, שבועות; חג אחד בישראל).
 *      להשלמת צריכה חסרה ולגיבוי גנרטור/אגירה בשבתות וחגים.
 *   3. isTouHoliday(date): לתעו"ז, רק בחודשים שבהם חג משנה את סיווג פסגה/שפל (touHoliday.monthNN בלוח ההגדרות).
 *
 * נטען אחרי settings.js. מנוע הלוח העברי זהה לזה שבדף שלב 1 (מאומת מול נקודות ייחוס), והתוצאה ליום טוב נבדקת מול
 * התוצאות של הפונקציה הקודמת על 2020-2035 (tools/tests/holidays_test.js). */
(function () {
  'use strict';
  var EPOCH = 347998;
  function isLeap(y) { return (7 * y + 1) % 19 < 7; }
  function numMonths(y) { return isLeap(y) ? 13 : 12; }
  function elapsed(y) {
    var m = Math.floor((235 * y - 234) / 19), p = 12084 + 13753 * m, d = 29 * m + Math.floor(p / 25920);
    if ((3 * (d + 1)) % 7 < 3) d++;
    return d;
  }
  function delay(y) {
    var n0 = elapsed(y - 1), n1 = elapsed(y), n2 = elapsed(y + 1);
    if (n2 - n1 === 356) return 2;
    if (n1 - n0 === 382) return 1;
    return 0;
  }
  function newYear(y) { return EPOCH + elapsed(y) + delay(y); }
  function daysInYear(y) { return newYear(y + 1) - newYear(y); }
  function daysInMonth(m, y) {
    var lp = isLeap(y), dy = daysInYear(y);
    var t = { 1: 30, 2: dy % 10 === 5 ? 30 : 29, 3: dy % 10 === 3 ? 29 : 30, 4: 29, 5: 30, 6: lp ? 30 : 29, 7: lp ? 29 : 30, 8: lp ? 30 : 29, 9: lp ? 29 : 30, 10: lp ? 30 : 29, 11: lp ? 29 : 30, 12: lp ? 30 : 29, 13: 29 };
    return t[m] || 29;
  }
  function g2j(Y, M, D) {
    var a = Math.floor((14 - M) / 12), y = Y + 4800 - a, m = M + 12 * a - 3;
    return D + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }
  function j2h(j) {
    var y = Math.floor((j - EPOCH) * 98496.0 / 35975351.0) + 1;
    while (newYear(y + 1) <= j) y++;
    while (newYear(y) > j) y--;
    var doy = j - newYear(y) + 1, m = 1, acc = 0;
    while (m <= numMonths(y)) { var dim = daysInMonth(m, y); if (acc + dim >= doy) break; acc += dim; m++; }
    return { year: y, month: m, day: doy - acc };
  }
  function h2j(y, m, d) { var acc = 0; for (var i = 1; i < m; i++) acc += daysInMonth(i, y); return newYear(y) + acc + d - 1; }
  function weekday(j) { return (j + 1) % 7; }   // 0=ראשון ... 6=שבת

  // מספרי חודשים (תשרי=1). בשנה מעוברת: אדר א'=6, אדר ב'=7 (פורים באדר ב'), ניסן=8
  function mi(y) {
    var lp = isLeap(y);
    return { adar: lp ? 7 : 6, nisan: lp ? 8 : 7, iyar: lp ? 9 : 8, sivan: lp ? 10 : 9, tammuz: lp ? 11 : 10, av: lp ? 12 : 11, elul: lp ? 13 : 12 };
  }

  // ימים מיוחדים (שאינם יום טוב). לכל אחד: מפתח (כמו בהגדרות), שם, ופונקציית זיהוי לפי תאריך עברי + מספר יום יוליאני
  var MINOR = [
    ['erev_rh', 'ערב ראש השנה', function (h, m) { return h.month === m.elul && h.day === 29; }],
    ['tzom_gedalia', 'צום גדליה', function (h) { return h.month === 1 && h.day === (weekday(h2j(h.year, 1, 3)) === 6 ? 4 : 3); }],
    ['erev_yk', 'ערב יום כיפור', function (h) { return h.month === 1 && h.day === 9; }],
    ['erev_sukkot', 'ערב סוכות', function (h) { return h.month === 1 && h.day === 14; }],
    ['chol_sukkot', 'חול המועד סוכות', function (h) { return h.month === 1 && h.day >= 16 && h.day <= 21; }],
    ['hanukkah', 'חנוכה', function (h, m, j) { var d = j - h2j(h.year, 3, 25); return d >= 0 && d <= 7; }],
    ['tevet10', 'עשרה בטבת', function (h) { return h.month === 4 && h.day === 10; }],
    ['tu_bishvat', 'ט"ו בשבט', function (h) { return h.month === 5 && h.day === 15; }],
    ['ta_esther', 'תענית אסתר', function (h, m) { return h.month === m.adar && h.day === (weekday(h2j(h.year, m.adar, 13)) === 6 ? 11 : 13); }],
    ['purim', 'פורים', function (h, m) { return h.month === m.adar && h.day === 14; }],
    ['shushan', 'שושן פורים', function (h, m) { return h.month === m.adar && h.day === 15; }],
    ['erev_pesach', 'ערב פסח', function (h, m) { return h.month === m.nisan && h.day === 14; }],
    ['chol_pesach', 'חול המועד פסח', function (h, m) { return h.month === m.nisan && h.day >= 16 && h.day <= 20; }],
    ['yom_hashoah', 'יום השואה', function (h, m) {   // 27 בניסן; שישי -> חמישי; ראשון -> שני
      if (h.month !== m.nisan) return false;
      var w = weekday(h2j(h.year, m.nisan, 27));
      return h.day === (w === 5 ? 26 : (w === 0 ? 28 : 27));
    }],
    ['yom_hazikaron', 'יום הזיכרון', function (h, m) { return h.month === m.iyar && h.day === atzmaautDay(h.year, m) - 1; }],
    ['yom_haatzmaut', 'יום העצמאות', function (h, m) { return h.month === m.iyar && h.day === atzmaautDay(h.year, m); }],
    ['lag_baomer', 'ל"ג בעומר', function (h, m) { return h.month === m.iyar && h.day === 18; }],
    ['yom_yerushalayim', 'יום ירושלים', function (h, m) { return h.month === m.iyar && h.day === 28; }],
    ['erev_shavuot', 'ערב שבועות', function (h, m) { return h.month === m.sivan && h.day === 5; }],
    ['tzom_tammuz', 'י"ז בתמוז', function (h, m) { return h.month === m.tammuz && h.day === (weekday(h2j(h.year, m.tammuz, 17)) === 6 ? 18 : 17); }],
    ['tisha_bav', 'תשעה באב', function (h, m) { return h.month === m.av && h.day === (weekday(h2j(h.year, m.av, 9)) === 6 ? 10 : 9); }],
    ['tu_bav', 'ט"ו באב', function (h, m) { return h.month === m.av && h.day === 15; }]
  ];
  // 5 באייר; שישי -> חמישי (4), שבת -> חמישי (3), שני -> שלישי (6)
  function atzmaautDay(y, m) {
    var w = weekday(h2j(y, m.iyar, 5));
    return w === 5 ? 4 : (w === 6 ? 3 : (w === 1 ? 6 : 5));
  }

  function yomTovName(h, m) {
    if (h.month === 1) {
      if (h.day === 1 || h.day === 2) return 'ראש השנה';
      if (h.day === 10) return 'יום כיפור';
      if (h.day === 15) return 'סוכות';
      if (h.day === 22) return 'שמיני עצרת / שמחת תורה';
    }
    if (h.month === m.nisan) { if (h.day === 15) return 'פסח'; if (h.day === 21) return 'שביעי של פסח'; }
    if (h.month === m.sivan && h.day === 6) return 'שבועות';
    return null;
  }

  var memo = {}, extraSet = null;
  function key(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function dateStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /** מידע גולמי על יום (בלי תלות בהגדרות): { yomTov: שם|null, minor: [{key,name}], hebrew } */
  function info(dateObj) {
    var k = key(dateObj);
    if (memo[k]) return memo[k];
    var j = g2j(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate()), h = j2h(j), m = mi(h.year);
    var minor = [];
    for (var i = 0; i < MINOR.length; i++) if (MINOR[i][2](h, m, j)) minor.push({ key: MINOR[i][0], name: MINOR[i][1] });
    memo[k] = { yomTov: yomTovName(h, m), minor: minor, hebrew: h };
    return memo[k];
  }

  function extras() {
    if (!extraSet) extraSet = new Set(BS_SETTINGS.extraHolidays());
    return extraSet;
  }
  function enabledMinor(inf) {
    return inf.minor.filter(function (x) { return BS_SETTINGS.get('holiday.on.' + x.key) === 1; });
  }

  // הבחנה 2
  function isYomTov(dateObj) { return info(dateObj).yomTov !== null; }
  // הבחנה 1
  function isAnyHoliday(dateObj) {
    var inf = info(dateObj);
    return inf.yomTov !== null || enabledMinor(inf).length > 0 || extras().has(dateStr(dateObj));
  }
  // הבחנה 3
  function isTouHoliday(dateObj) {
    var mm = dateObj.getMonth() + 1;
    if (BS_SETTINGS.get('touHoliday.month' + (mm < 10 ? '0' : '') + mm) !== 1) return false;
    return BS_SETTINGS.get('touHoliday.scopeAll') === 1 ? isAnyHoliday(dateObj) : isYomTov(dateObj);
  }
  /** שמות היום (לתצוגה), למשל "חנוכה" או "ראש השנה" */
  function names(dateObj) {
    var inf = info(dateObj), out = [];
    if (inf.yomTov) out.push(inf.yomTov);
    enabledMinor(inf).forEach(function (x) { out.push(x.name); });
    if (extras().has(dateStr(dateObj))) out.push('יום מיוחד שהוגדר ידנית');
    return out.join(', ');
  }
  /** רשימת כל הימים המיוחדים בשנה גרגוריאנית: [{date:'YYYY-MM-DD', name, yomTov}] (לפי ההגדרות הנוכחיות) */
  function listYear(year) {
    var out = [];
    for (var mo = 0; mo < 12; mo++) {
      var n = new Date(year, mo + 1, 0).getDate();
      for (var d = 1; d <= n; d++) {
        var dt = new Date(year, mo, d);
        if (isAnyHoliday(dt)) out.push({ date: dateStr(dt), name: names(dt), yomTov: isYomTov(dt) });
      }
    }
    return out;
  }
  /** הרצף הארוך ביותר של ימים קדושים רצופים (שבת ו/או יום טוב) בטווח שנים: { days, from, to } (תאריכי YYYY-MM-DD).
   *  משמש לגיבוי שבת+חג: למשל ר"ה ביום חמישי-שישי ואחריו שבת = 3 ימים רצופים. */
  function longestHolyChain(fromYear, years) {
    var best = { days: 0, from: null, to: null }, cur = 0, curStart = null, prev = null;
    var d = new Date(fromYear, 0, 1), end = new Date(fromYear + years, 0, 1);
    while (d < end) {
      if (d.getDay() === 6 || isYomTov(d)) {
        if (cur === 0) curStart = dateStr(d);
        cur++; prev = dateStr(d);
        if (cur > best.days) best = { days: cur, from: curStart, to: prev };
      } else { cur = 0; }
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    return best;
  }
  function resetCache() { memo = {}; extraSet = null; }

  window.BS_HOLIDAYS = { info: info, isYomTov: isYomTov, isAnyHoliday: isAnyHoliday, isTouHoliday: isTouHoliday, names: names, listYear: listYear, longestHolyChain: longestHolyChain, resetCache: resetCache };
})();
