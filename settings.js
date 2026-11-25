/* בראשית סולאר: לוח הגדרות משותף.
 * כל ערך משוער / ממוצע / ניתן לשינוי שהיה קבוע בקוד הדפים מוגדר כאן, עם ברירת מחדל זהה לערך שהיה בקוד.
 * הדפים קוראים את הערכים דרך BS_SETTINGS (get / calcConstants / propertyTypes / knownHolidays).
 * שינויים נשמרים בדפדפן (localStorage) ובשרת (גיליון "הגדרות מערכת", דרך getAppSettings/saveAppSettings) כשהשרת תומך.
 * חישובים נטענים בעת פתיחת הדף, לכן אחרי שמירה יש לרענן.
 * הקובץ נטען אחרי gas-shim.js ולפני סקריפטי הדף. */
(function () {
  'use strict';
  var LS_KEY = 'bs_settings_v1';
  var DEF_PROPERTY_TYPES = {
        'בית פרטי': { label: 'בית פרטי', desc: 'תנודתי (בוקר/ערב). שיא מיזוג בקיץ ודודי חשמל וחימום בחורף. פעילות מלאה בסופי שבוע.', winter: 0.35, summer: 0.45, transition: 0.20, sunHours: 0.30, offpeakWinter: 0.65, peakWinter: 0.35, offpeakSummer: 0.60, peakSummer: 0.40, weekday: 0.71, weekend: 0.29 },
        'משרד ציבורי/מסחרי': { label: 'משרד ציבורי/מסחרי', desc: 'עומס צהריים מרכזי (08:00-17:30). אפס צריכה בסופי שבוע וערבים.', winter: 0.30, summer: 0.45, transition: 0.25, sunHours: 0.75, offpeakWinter: 0.85, peakWinter: 0.15, offpeakSummer: 0.80, peakSummer: 0.20, weekday: 0.92, weekend: 0.08 },
        'מוסד לימודי (יסודי/תיכון)': { label: 'מוסד לימודי (יסודי/תיכון)', desc: 'סגור ביולי-אוגוסט. שיא צריכה בחורף ומעבר. מתרוקן אחה"צ. מגבלות קרינה סביבתיות.', winter: 0.45, summer: 0.15, transition: 0.40, sunHours: 0.85, offpeakWinter: 0.95, peakWinter: 0.05, offpeakSummer: 0.95, peakSummer: 0.05, weekday: 0.95, weekend: 0.05 },
        'מוסד אקדמי (אוניברסיטה/מכללה)': { label: 'מוסד אקדמי (אוניברסיטה/מכללה)', desc: 'עבודה רציפה כולל מעבדות מחקר, סמסטר קיץ דליל וספריות פתוחות בערב.', winter: 0.35, summer: 0.35, transition: 0.30, sunHours: 0.65, offpeakWinter: 0.80, peakWinter: 0.20, offpeakSummer: 0.75, peakSummer: 0.25, weekday: 0.88, weekend: 0.12 },
        'ישיבה/פנימייה': { label: 'ישיבה / פנימייה', desc: 'פעילות 24/7 סביב בית המדרש וחדרי אוכל. חופשות (בין הזמנים) קוטעות שיאים. שבת עמוסה.', winter: 0.35, summer: 0.40, transition: 0.25, sunHours: 0.45, offpeakWinter: 0.70, peakWinter: 0.30, offpeakSummer: 0.75, peakSummer: 0.25, weekday: 0.70, weekend: 0.30 },
        'בית כנסת': { label: 'בית כנסת', desc: 'עומסי קיצון קצרים (Spikes). צריכת שיא בסופי שבוע ובשעות תפילה (ערב). שפל מוחלט במעבר.', winter: 0.35, summer: 0.45, transition: 0.20, sunHours: 0.25, offpeakWinter: 0.80, peakWinter: 0.20, offpeakSummer: 0.70, peakSummer: 0.30, weekday: 0.40, weekend: 0.60 },
        'מלון תיירות ונופש': { label: 'מלון תיירות ונופש', desc: 'עומס בסיס חזק וקבוע למתקני המלון. שיא הקיץ בתיירות. זינוק צריכה אנושית אחה"צ וערב.', winter: 0.30, summer: 0.45, transition: 0.25, sunHours: 0.45, offpeakWinter: 0.75, peakWinter: 0.25, offpeakSummer: 0.70, peakSummer: 0.30, weekday: 0.65, weekend: 0.35 },
        'מתחמי אירוח/צימרים': { label: 'מתחמי אירוח / צימרים', desc: 'פעילות ממוקדת בסופי שבוע ובעונת הקיץ בלבד. ריק כמעט לחלוטין בימי חול חורפיים ומעבר.', winter: 0.25, summer: 0.55, transition: 0.20, sunHours: 0.40, offpeakWinter: 0.70, peakWinter: 0.30, offpeakSummer: 0.65, peakSummer: 0.35, weekday: 0.35, weekend: 0.65 },
        'עסק קמעונאי (סופרמרקט/פארם)': { label: 'עסק קמעונאי (סופרמרקט/פארם)', desc: 'שעות פעילות ארוכות מאד (22:00). חללי קירור מסחריים כבדים בקיץ. שביתה בסופי שבוע (כשר).', winter: 0.30, summer: 0.45, transition: 0.25, sunHours: 0.50, offpeakWinter: 0.75, peakWinter: 0.25, offpeakSummer: 0.70, peakSummer: 0.30, weekday: 0.85, weekend: 0.15 },
        'עסק תעשייתי (משמרת יום)': { label: 'עסק תעשייתי (משמרת יום)', desc: 'מנועים ומדחסים בפעילות יום, אדישות יחסית לאקלים אך עם צורכי קירור מכונות. סיום לפני שעות פסגה.', winter: 0.32, summer: 0.38, transition: 0.30, sunHours: 0.80, offpeakWinter: 0.90, peakWinter: 0.10, offpeakSummer: 0.85, peakSummer: 0.15, weekday: 0.95, weekend: 0.05 }
    };
  var DEF_HOLIDAYS = [
        "2020-09-18", "2020-09-19", "2020-09-20", "2020-09-27", "2020-09-28", "2021-09-06", "2021-09-07", "2021-09-08", "2021-09-15", "2021-09-16", "2021-09-20", "2021-09-21", "2021-09-27", "2021-09-28", "2022-06-04", "2022-06-05", "2022-09-25", "2022-09-26", "2022-09-27", "2023-09-15", "2023-09-16", "2023-09-17", "2023-09-24", "2023-09-25", "2023-09-29", "2023-09-30", "2024-06-11", "2024-06-12", "2025-06-01", "2025-06-02", "2025-09-22", "2025-09-23", "2025-09-24", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-20", "2026-09-21", "2026-09-25", "2026-09-26", "2027-06-10", "2027-06-11", "2028-09-20", "2028-09-21", "2028-09-22", "2028-09-29", "2028-09-30", "2029-09-09", "2029-09-10", "2029-09-11", "2029-09-18", "2029-09-19", "2029-09-23", "2029-09-24", "2029-09-30", "2030-06-06", "2030-06-07", "2030-09-27", "2030-09-28", "2030-09-29"
    ];

  var GROUPS = [
    ['tariff', 'תעריפים ומדרגות'],
    ['prod', 'ייצור ושטח גג'],
    ['storage', 'אגירה, ממיר וחיפוש גודל'],
    ['fin', 'כלכלה ומיסוי'],
    ['analysis', 'ניתוח צריכה, יום עברי ומיקום'],
    ['crm', 'הערכה גסה בהצעת המחיר']
  ];
  var CALC_ROOTS = ['staircase', 'storageT100Factor', 'tou', 'compTariff', 'transitionCompFromSource', 'urbanPremium', 'urbanPremiumYears',
    'yieldBase', 'degradation', 'battery', 'vatRate', 'discountRate', 'privateTaxExemption', 'privateTaxRate', 'privateTaxFlatCap', 'replacements'];

  var FIELDS = [];
  function f(key, group, label, def, unit, note, o) {
    FIELDS.push(Object.assign({ key: key, group: group, label: label, def: def, unit: unit || '', note: note || '' }, o || {}));
  }
  var KWH = '₪/קוט"ש', PCT = { pct: true };

  // ---- תעריפים ----
  f('staircase.p15', 'tariff', 'סף מדרגה 1', 15, 'קוו"ט');
  f('staircase.p100', 'tariff', 'סף מדרגה 2', 100, 'קוו"ט');
  f('staircase.p300', 'tariff', 'סף מדרגה 3', 300, 'קוו"ט');
  f('staircase.p630', 'tariff', 'סף מדרגה 4 (תקרת הספק מערכת)', 630, 'קוו"ט', 'משמש גם כתקרה בחיפוש הגודל המומלץ');
  f('staircase.t15', 'tariff', 'תעריף עד סף 1', 0.48, KWH);
  f('staircase.t100', 'tariff', 'תעריף סף 1 עד סף 2', 0.3936, KWH);
  f('staircase.t300', 'tariff', 'תעריף סף 2 עד סף 3', 0.3437, KWH);
  f('staircase.t630', 'tariff', 'תעריף סף 3 עד סף 4', 0.2844, KWH);
  f('staircase.disc', 'tariff', 'מקדם הנחה כללי למדרגות', 1, '', '1 = ללא הנחה');
  f('storageT100Factor', 'tariff', 'מקדם למדרגה 2 כשיש אגירה', 0.95, '', 'הנחה של 5% על המדרגה כשיש אגירה');
  f('tou.winter_peak', 'tariff', 'תעו"ז חורף, פסגה', 0.9774, KWH);
  f('tou.winter_low', 'tariff', 'תעו"ז חורף, שפל', 0.4022, KWH);
  f('tou.transition_peak', 'tariff', 'תעו"ז מעבר, פסגה', 0.4293, KWH);
  f('tou.transition_low', 'tariff', 'תעו"ז מעבר, שפל', 0.3945, KWH);
  f('tou.summer_peak', 'tariff', 'תעו"ז קיץ, פסגה', 1.4597, KWH);
  f('tou.summer_low', 'tariff', 'תעו"ז קיץ, שפל', 0.4358, KWH);
  f('compTariff.upTo300.winter', 'tariff', 'תעריף משלים עד 300 קוו"ט, חורף', 0.932, KWH, 'קובע את שווי הפסגה בחישוב ארביטראז\' האגירה');
  f('compTariff.upTo300.summer', 'tariff', 'תעריף משלים עד 300 קוו"ט, קיץ', 1.3424, KWH);
  f('compTariff.upTo300.transition', 'tariff', 'תעריף משלים עד 300 קוו"ט, מעבר', 0.3721, KWH);
  f('compTariff.above300.winter', 'tariff', 'תעריף משלים מעל 300 קוו"ט, חורף', 0.8339, KWH);
  f('compTariff.above300.summer', 'tariff', 'תעריף משלים מעל 300 קוו"ט, קיץ', 1.2011, KWH);
  f('compTariff.above300.transition', 'tariff', 'תעריף משלים מעל 300 קוו"ט, מעבר', 0.3329, KWH);
  f('transitionCompFromSource', 'tariff', 'תעריף עונת מעבר בקובץ המקור', 0.55, KWH, 'במקום נוסחת הבלנד העקבית');
  f('urbanPremium', 'tariff', 'פרמיה אורבנית', 0.06, KWH);
  f('urbanPremiumYears', 'tariff', 'שנות פרמיה אורבנית', 17, 'שנים', 'בקובץ המקור הפרמיה חלה בשנים 1-17 בלבד');

  // ---- ייצור ושטח גג ----
  f('yieldBase', 'prod', 'תפוקה שנתית לקוו"ט', 1600, 'קוט"ש/קוו"ט/שנה',
    'ערך יחיד לכל המערכת. בהערכה הגסה בהצעת המחיר היה 1650 (סתירה): הוכרע 1600, הערך המאומת מקובצי המקור.');
  f('degradation', 'prod', 'שחיקת פאנלים שנתית', 0.0025, '%/שנה', 'לינארית: שנה n = 1 - שחיקה × (n-1)', PCT);
  f('roof.m2PerKwpNew', 'prod', 'שטח גג לקוו"ט, פאנלים מודרניים', 5.5, 'מ"ר/קוו"ט',
    'משמש בשלבים 2-3. בענפים ההיסטוריים (Red/Gold/Green) היה 7.5 (סתירה): הוכרע 5.5 לפי החלטה A7.');
  f('roof.m2PerKwpExisting', 'prod', 'שטח גג לקוו"ט, מערכת קיימת/ישנה', 7.5, 'מ"ר/קוו"ט', 'ברירת מחדל לשדה בשלב 1 (מערכת ישנה). הוא ערך נפרד מתוך כוונה, לא סתירה.');

  // הערכת ייצור עבר (שלב 1, כשאין מונה ייצור): פיזור התפוקה השנתית לחודשים ולשעות היום
  var MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var MONTH_YIELD_FACTORS = [0.66, 0.77, 0.96, 1.10, 1.19, 1.29, 1.29, 1.24, 1.10, 0.96, 0.77, 0.67];
  MONTH_NAMES.forEach(function (n, i) {
    f('prodEst.month' + (i < 9 ? '0' : '') + (i + 1), 'prod', 'מקדם עונתיות ייצור, ' + n, MONTH_YIELD_FACTORS[i], '×',
      i === 0 ? 'יחסי בין החודשים בלבד (ממוצע ≈ 1, התפוקה השנתית נשמרת). מקור: ענף Red, לא אומת מול נתוני ייצור אמיתיים.' : '');
  });
  f('prodEst.shapeExponent', 'prod', 'חדות עקומת הייצור היומית', 1, '', 'עקומת ייצור יומית = sin(זריחה→שקיעה) בחזקת הערך. 1 = סינוס רגיל; גבוה יותר = שיא חד יותר סביב הצהריים.');

  // ---- אגירה ----
  f('battery.dod', 'storage', 'עומק פריקה (DoD)', 0.95, '%', '', PCT);
  f('battery.effCharge', 'storage', 'יעילות טעינה', 0.93, '%', '', PCT);
  f('battery.effDischarge', 'storage', 'יעילות פריקה', 0.94, '%', '', PCT);
  f('battery.cRate', 'storage', 'קצב טעינה/פריקה (C)', 0.2, 'C');
  f('storage.degradationPct', 'storage', 'שחיקת סוללה שנתית (להצעה המודפסת)', 2.2, '%/שנה', 'מועבר לדף ההצעה המודפסת כנתון גולמי');
  f('storage.factorShabbat', 'storage', 'מכפיל גיבוי שבת', 1.2, '×', 'סוללה = צריכת שבת × מכפיל ÷ DoD');
  f('storage.factorHoliday', 'storage', 'מכפיל גיבוי שבת + חג', 2.2, '×');
  f('storage.factorNoBackup', 'storage', 'סוללה מוצעת ללא גיבוי: מכפיל הספק פאנלים', 0.75, 'קוט"ש לכל קוו"ט');
  f('inverter.peakMargin', 'storage', 'מרווח ביטחון על פיק צריכה (ממיר)', 1.15, '×', 'הספק ממיר = המקסימום בין קצב הסוללה לפיק בפועל × מרווח');
  f('search.minPvKw', 'storage', 'חיפוש גודל: הספק פאנלים מינימלי', 3, 'קוו"ט');
  f('search.ceilFloorMult', 'storage', 'חיפוש סוללה: תקרה כמכפיל של הרצפה', 1.2, '×');
  f('search.ceilPeakMult', 'storage', 'חיפוש סוללה: תקרה כמכפיל של פיק יומי טיפוסי', 1.5, '×');
  f('search.ceilMinKwh', 'storage', 'חיפוש סוללה: תקרה מינימלית', 10, 'קוט"ש');

  // ---- כלכלה ----
  f('vatRate', 'fin', 'מע"מ', 0.18, '%', '', PCT);
  f('discountRate', 'fin', 'שיעור היוון', 0.035, '%', '', PCT);
  f('privateTaxExemption', 'fin', 'פטור ממס ליחיד', 27900, '₪');
  f('privateTaxRate', 'fin', 'שיעור מס ליחיד', 0.10, '%', '', PCT);
  f('privateTaxFlatCap', 'fin', 'תקרת מסלול מס מופחת', 120000, '₪', 'טרם אומתה מול רו"ח');
  f('replacements.inverterYear', 'fin', 'שנת החלפת ממיר', 14, 'שנה');
  f('replacements.inverterCostPct', 'fin', 'עלות החלפת ממיר, אחוז מהשקעה', 0.15, '%', '', PCT);
  f('replacements.batteryYear', 'fin', 'שנת החלפת סוללה', 15, 'שנה');
  f('replacements.batteryCostPct', 'fin', 'עלות החלפת סוללה, אחוז מעלות הסוללה', 0.60, '%', '', PCT);
  f('corpTax.rate', 'fin', 'מס חברות', 0.23, '%', '', PCT);
  f('corpTax.depreciationRate', 'fin', 'פחת שנתי (חברה)', 0.25, '%', 'אחוז מההשקעה בכל שנת פחת', PCT);
  f('corpTax.depreciationYears', 'fin', 'מספר שנות פחת', 4, 'שנים');

  // ---- ניתוח צריכה ----
  f('stats.trimFraction', 'analysis', 'חיתוך קצוות בממוצע מקוצץ', 0.15, '%', 'מכל קצה', PCT);
  f('stats.shabbatTrimFraction', 'analysis', 'חיתוך קצוות בממוצע צריכת שבת', 0.1, '%', 'מכל קצה, בהערכת שבת מנתונים בפועל', PCT);
  f('hebrewDay.boundaryOffsetMin', 'analysis', 'יום עברי: היסט גבול יום', 4, 'דקות');
  f('hebrewDay.entryOffsetMin', 'analysis', 'יום עברי: היסט כניסת שבת/חג', -20, 'דקות');
  f('hebrewDay.exitOffsetMin', 'analysis', 'יום עברי: היסט צאת שבת/חג', 40, 'דקות');
  f('location.lat', 'analysis', 'קו רוחב לחישוב שקיעה', 32.0853, '°', 'ברירת מחדל: תל אביב, לכל הלקוחות (D22)');
  f('location.lon', 'analysis', 'קו אורך לחישוב שקיעה', 34.7818, '°');

  // ---- CRM ----
  f('crm.roughTariff', 'crm', 'תעריף ממוצע להערכה גסה', 0.55, KWH, 'חיסכון גס = הספק × תפוקה שנתית × תעריף. מוצג רק עד שיש נתוני מחשבון אמיתיים.');

  var TABLE_COLS = [['winter', 'חורף'], ['summer', 'קיץ'], ['transition', 'מעבר'], ['sunHours', 'שעות שמש'], ['offpeakWinter', 'שפל חורף'],
    ['peakWinter', 'פסגת חורף'], ['offpeakSummer', 'שפל קיץ'], ['peakSummer', 'פסגת קיץ'], ['weekday', 'ימי חול'], ['weekend', 'סופ"ש']];

  // ---------------- מצב ושמירה ----------------
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function emptyState() { return { v: 1, updatedAt: 0, values: {}, tables: {} }; }
  function loadLocal() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (s && typeof s === 'object') { s.values = s.values || {}; s.tables = s.tables || {}; return s; }
    } catch (e) { /* אין אחסון או JSON פגום: ברירות מחדל */ }
    return emptyState();
  }
  var state = loadLocal();
  function persistLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* אחסון חסום */ } }

  var byKey = {};
  FIELDS.forEach(function (x) { byKey[x.key] = x; });

  function get(key) {
    var fld = byKey[key];
    if (!fld) throw new Error('BS_SETTINGS: מפתח לא מוכר: ' + key);
    var v = state.values[key];
    return (typeof v === 'number' && isFinite(v)) ? v : fld.def;
  }
  function setPath(obj, path, val) {
    var p = path.split('.'), o = obj;
    for (var i = 0; i < p.length - 1; i++) { o = o[p[i]] = o[p[i]] || {}; }
    o[p[p.length - 1]] = val;
  }
  function calcConstants() {
    var out = {};
    FIELDS.forEach(function (x) { if (CALC_ROOTS.indexOf(x.key.split('.')[0]) !== -1) setPath(out, x.key, get(x.key)); });
    return out;
  }
  function propertyTypes() { return clone(state.tables.propertyTypes || DEF_PROPERTY_TYPES); }
  function knownHolidays() { return clone(state.tables.knownHolidays || DEF_HOLIDAYS); }

  // ---------------- סנכרון עם השרת ----------------
  function hasServer() { return !!(window.google && google.script && google.script.run); }
  function sameContent(a, b) { return JSON.stringify([a.values, a.tables]) === JSON.stringify([b.values, b.tables]); }
  // שמירה מהירה של כמה ערכים (למשל מחלון "הגדרות תעריפים" בדפי השלבים). מקומי + שרת, בלי ממשק.
  function saveValues(map) {
    Object.keys(map).forEach(function (k) {
      if (!byKey[k]) return;
      var v = map[k];
      if (typeof v !== 'number' || !isFinite(v) || v === byKey[k].def) delete state.values[k]; else state.values[k] = v;
    });
    state.updatedAt = Date.now(); persistLocal();
    var b = document.getElementById('bsSetBtn'); if (b) b.classList.toggle('bs-dirty', hasOverrides());
    pushServer(function () { /* שקט */ });
  }
  function pullServer() {
    if (!hasServer()) return;
    try {
      google.script.run.withSuccessHandler(function (txt) {
        if (!txt) return;
        var srv; try { srv = JSON.parse(txt); } catch (e) { return; }
        if (!srv || typeof srv !== 'object') return;
        srv.values = srv.values || {}; srv.tables = srv.tables || {};
        if (sameContent(srv, state)) return;
        if ((srv.updatedAt || 0) >= (state.updatedAt || 0)) {
          state = srv; persistLocal();
          showBanner('ההגדרות עודכנו מהשרת. רענן את הדף כדי להחיל אותן בחישובים.');
        }
      }).withFailureHandler(function () { /* שרת ללא תמיכה או לא זמין: נשארים עם ההגדרות המקומיות */ }).getAppSettings();
    } catch (e) { /* ignore */ }
  }
  function pushServer(cb) {
    if (!hasServer()) return cb('local', 'נשמר בדפדפן בלבד (אין חיבור לשרת).');
    try {
      google.script.run.withSuccessHandler(function () { cb('server', 'נשמר בדפדפן ובשרת.'); })
        .withFailureHandler(function (err) {
          var m = String((err && err.message) || err || '');
          if (/unknown_action|לא מוכרת/.test(m)) cb('local', 'נשמר בדפדפן בלבד: גרסת השרת הנוכחית אינה תומכת בשמירת הגדרות (יש לפרוס את Code.gs המעודכן).');
          else if (/forbidden|הרשאה|צפייה בלבד/.test(m)) cb('local', 'נשמר בדפדפן בלבד: למשתמש "צפייה בלבד" אין הרשאת שמירה בשרת.');
          else cb('local', 'נשמר בדפדפן בלבד: השמירה בשרת נכשלה (' + m + ').');
        }).saveAppSettings(JSON.stringify(state));
    } catch (e) { cb('local', 'נשמר בדפדפן בלבד: ' + e.message); }
  }

  // ---------------- תוויות דינמיות בדפים ----------------
  function fmtVal(key, fmt) {
    var v = get(key);
    if (fmt === 'pct') return (Math.round(v * 10000) / 100) + '%';
    return String(Math.round(v * 1e6) / 1e6);
  }
  function applyLabels() {
    var nodes = document.querySelectorAll('[data-bs-setting]');
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute('data-bs-setting');
      if (byKey[k]) nodes[i].textContent = fmtVal(k, nodes[i].getAttribute('data-bs-fmt'));
    }
    var defs = document.querySelectorAll('[data-bs-default]');
    for (var j = 0; j < defs.length; j++) {
      var dk = defs[j].getAttribute('data-bs-default');
      if (byKey[dk]) defs[j].value = String(get(dk));
    }
  }

  // ---------------- ממשק ----------------
  var CSS = '#bsSetBtn{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));left:8px;z-index:2147483000;background:#1f2d3d;color:#fff;border:0;border-radius:20px;padding:7px 14px;font:600 14px Heebo,Arial,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}' +
    '#bsSetBtn.bs-dirty::after{content:" ●";color:#f5a623}' +
    '#bsSetPanel{position:fixed;top:0;bottom:0;left:0;width:min(640px,100vw);z-index:2147483001;background:#fff;color:#1f2d3d;direction:rtl;font:14px Heebo,Arial,sans-serif;box-shadow:4px 0 24px rgba(0,0,0,.35);transform:translateX(-105%);transition:transform .2s;display:flex;flex-direction:column}' +
    '#bsSetPanel.open{transform:none}' +
    '#bsSetPanel header{padding:12px 16px;background:#1f2d3d;color:#fff;display:flex;gap:10px;align-items:center}#bsSetPanel header h2{margin:0;font-size:17px;flex:1}' +
    '#bsSetPanel .bs-body{flex:1;overflow:auto;padding:10px 16px 20px}' +
    '#bsSetPanel details{border:1px solid #d8dee6;border-radius:8px;margin:10px 0;background:#fafbfc}#bsSetPanel summary{cursor:pointer;padding:9px 12px;font-weight:700}' +
    '#bsSetPanel .bs-row{display:grid;grid-template-columns:1fr 130px 32px;gap:6px 8px;align-items:center;padding:6px 12px;border-top:1px solid #eef1f5}' +
    '#bsSetPanel .bs-row.changed{background:#fff6e0}#bsSetPanel .bs-lbl small{display:block;color:#6b7785;font-size:12px}' +
    '#bsSetPanel input[type=number],#bsSetPanel input[type=text],#bsSetPanel textarea{width:100%;box-sizing:border-box;padding:5px 6px;border:1px solid #b9c3cf;border-radius:5px;font:inherit}' +
    '#bsSetPanel .bs-unit{color:#6b7785;font-size:12px;margin-inline-start:4px}' +
    '#bsSetPanel button.bs-mini{border:1px solid #b9c3cf;background:#fff;border-radius:5px;cursor:pointer;padding:3px 6px}' +
    '#bsSetPanel footer{padding:10px 16px;border-top:1px solid #d8dee6;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#f4f6f8}' +
    '#bsSetPanel footer button{padding:7px 12px;border-radius:6px;border:1px solid #1f2d3d;background:#fff;cursor:pointer;font:600 13px inherit}' +
    '#bsSetPanel footer button.primary{background:#1f2d3d;color:#fff}#bsSetStatus{flex-basis:100%;font-size:13px;min-height:18px}' +
    '#bsSetPanel table{border-collapse:collapse;width:100%;font-size:12px}#bsSetPanel td,#bsSetPanel th{border:1px solid #e1e6ec;padding:2px 3px}#bsSetPanel td input{min-width:48px;padding:3px}' +
    '#bsBanner{position:fixed;top:calc(48px + env(safe-area-inset-top,0px));left:8px;z-index:2147483000;background:#fff3cd;border:1px solid #e0b43c;border-radius:8px;padding:8px 12px;font:13px Heebo,Arial,sans-serif;direction:rtl;max-width:340px}' +
    '@media print{#bsSetBtn,#bsSetPanel,#bsBanner{display:none!important}}';

  function mk(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) for (var k in props) { if (k === 'text') e.textContent = props[k]; else if (k === 'cls') e.className = props[k]; else e.setAttribute(k, props[k]); }
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function showBanner(msg) {
    if (!document.body) return;
    var b = document.getElementById('bsBanner') || mk('div', { id: 'bsBanner' });
    b.textContent = msg + ' ';
    var r = mk('button', { cls: 'bs-mini', text: 'רענן עכשיו' }); r.onclick = function () { location.reload(); };
    b.appendChild(r); document.body.appendChild(b);
  }

  var panel, draft, statusEl;
  function toDisplay(fld, v) { return fld.pct ? Math.round(v * 1e8) / 1e6 : v; }
  function fromDisplay(fld, v) { return fld.pct ? Math.round(v * 1e6) / 1e8 : v; }
  function setStatus(msg, bad) { if (statusEl) { statusEl.textContent = msg; statusEl.style.color = bad ? '#b00020' : '#1b6e3a'; } }

  function buildPanel() {
    if (panel) panel.remove();
    draft = { values: clone(state.values), tables: { propertyTypes: propertyTypes(), knownHolidays: knownHolidays() } };
    var body = mk('div', { cls: 'bs-body' });
    body.appendChild(mk('p', { text: 'ערכים משוערים וממוצעים שמשפיעים על החישובים. שורה צהובה = שונה מברירת המחדל. השינויים נכנסים לתוקף אחרי שמירה ורענון הדף.' }));
    GROUPS.forEach(function (g) {
      var det = mk('details', null, [mk('summary', { text: g[1] })]);
      FIELDS.filter(function (x) { return x.group === g[0]; }).forEach(function (fld) {
        var cur = (typeof draft.values[fld.key] === 'number') ? draft.values[fld.key] : fld.def;
        var inp = mk('input', { type: 'number', step: 'any', value: String(toDisplay(fld, cur)) });
        var row = mk('div', { cls: 'bs-row' });
        function refresh() { row.classList.toggle('changed', typeof draft.values[fld.key] === 'number' && draft.values[fld.key] !== fld.def); }
        inp.oninput = function () {
          var n = parseFloat(inp.value);
          if (isFinite(n)) { var v = fromDisplay(fld, n); if (v === fld.def) delete draft.values[fld.key]; else draft.values[fld.key] = v; }
          refresh();
        };
        var lbl = mk('div', { cls: 'bs-lbl' }, [mk('span', { text: fld.label }), mk('span', { cls: 'bs-unit', text: fld.unit })]);
        if (fld.note) lbl.appendChild(mk('small', { text: fld.note }));
        var rst = mk('button', { cls: 'bs-mini', title: 'ברירת מחדל: ' + toDisplay(fld, fld.def), text: '↺' });
        rst.type = 'button';
        rst.onclick = function () { delete draft.values[fld.key]; inp.value = String(toDisplay(fld, fld.def)); refresh(); };
        row.appendChild(lbl); row.appendChild(inp); row.appendChild(rst); refresh(); det.appendChild(row);
      });
      body.appendChild(det);
    });
    // טבלת סוגי נכס
    var tdet = mk('details', null, [mk('summary', { text: 'פיזור צריכה לפי סוג נכס (שימוש כשאין קובץ חח"י)' })]);
    var tbl = mk('table'), head = mk('tr', null, [mk('th', { text: 'סוג נכס' })]);
    TABLE_COLS.forEach(function (c) { head.appendChild(mk('th', { text: c[1] })); });
    tbl.appendChild(head);
    Object.keys(draft.tables.propertyTypes).forEach(function (name) {
      var row = draft.tables.propertyTypes[name], tr = mk('tr', null, [mk('td', { text: name })]);
      TABLE_COLS.forEach(function (c) {
        var i = mk('input', { type: 'number', step: 'any', value: String(row[c[0]]) });
        i.oninput = function () { var n = parseFloat(i.value); if (isFinite(n)) row[c[0]] = n; };
        tr.appendChild(mk('td', null, [i]));
      });
      tbl.appendChild(tr);
    });
    tdet.appendChild(mk('div', { style: 'overflow-x:auto;padding:6px 8px' }, [tbl]));
    tdet.appendChild(mk('p', { style: 'padding:0 12px;font-size:12px;color:#6b7785', text: 'בכל שורה: חורף+קיץ+מעבר = 1, שפל+פסגה = 1 לכל עונה, ימי חול+סופ"ש = 1. סטייה תוצג כאזהרה בשמירה.' }));
    body.appendChild(tdet);
    // חגים
    var hdet = mk('details', null, [mk('summary', { text: 'ימי חג/חריגה ידועים (תאריך בכל שורה, YYYY-MM-DD)' })]);
    var ta = mk('textarea', { rows: '10' }); ta.value = draft.tables.knownHolidays.join('\n');
    ta.oninput = function () { draft.tables.knownHolidays = ta.value.split(/\s+/).filter(Boolean); };
    hdet.appendChild(mk('div', { style: 'padding:6px 12px' }, [ta]));
    hdet.appendChild(mk('p', { style: 'padding:0 12px;font-size:12px;color:#6b7785', text: 'הרשימה הקיימת מכסה בעיקר יוני וספטמבר (D21). אפשר להוסיף כאן חגים נוספים.' }));
    body.appendChild(hdet);

    statusEl = mk('div', { id: 'bsSetStatus' });
    var save = mk('button', { cls: 'primary', text: 'שמור' }); save.type = 'button'; save.onclick = onSave;
    var reset = mk('button', { text: 'אפס הכול לברירת מחדל' }); reset.type = 'button'; reset.onclick = onResetAll;
    var exp = mk('button', { text: 'ייצוא' }); exp.type = 'button'; exp.onclick = onExport;
    var imp = mk('button', { text: 'ייבוא' }); imp.type = 'button'; imp.onclick = onImport;
    var close = mk('button', { text: 'סגור' }); close.type = 'button'; close.onclick = function () { panel.classList.remove('open'); };
    var h = mk('header', null, [mk('h2', { text: '⚙️ לוח הגדרות' })]);
    var x = mk('button', { cls: 'bs-mini', text: '✕' }); x.type = 'button'; x.onclick = close.onclick; h.appendChild(x);
    panel = mk('div', { id: 'bsSetPanel' }, [h, body, mk('footer', null, [save, reset, exp, imp, close, statusEl])]);
    document.body.appendChild(panel);
  }

  function validateDraft() {
    var warns = [];
    var pt = draft.tables.propertyTypes;
    Object.keys(pt).forEach(function (n) {
      var r = pt[n];
      TABLE_COLS.forEach(function (c) { if (typeof r[c[0]] !== 'number' || !isFinite(r[c[0]])) warns.push(n + ': ערך לא תקין ב"' + c[1] + '"'); });
      function chk(sum, what) { if (Math.abs(sum - 1) > 0.011) warns.push(n + ': ' + what + ' אינם מסתכמים ל-1 (' + sum.toFixed(3) + ')'); }
      chk(r.winter + r.summer + r.transition, 'חורף+קיץ+מעבר');
      chk(r.offpeakWinter + r.peakWinter, 'שפל+פסגה בחורף');
      chk(r.offpeakSummer + r.peakSummer, 'שפל+פסגה בקיץ');
      chk(r.weekday + r.weekend, 'ימי חול+סופ"ש');
    });
    var badDates = draft.tables.knownHolidays.filter(function (d) { return !/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(new Date(d + 'T00:00:00').getTime()); });
    return { warns: warns, badDates: badDates };
  }
  function onSave() {
    var v = validateDraft();
    if (v.badDates.length) { setStatus('תאריכים לא תקינים ברשימת החגים: ' + v.badDates.slice(0, 3).join(', '), true); return; }
    var next = emptyState();
    next.values = clone(draft.values);
    if (JSON.stringify(draft.tables.propertyTypes) !== JSON.stringify(DEF_PROPERTY_TYPES)) next.tables.propertyTypes = clone(draft.tables.propertyTypes);
    var hol = draft.tables.knownHolidays.slice().sort();
    if (JSON.stringify(hol) !== JSON.stringify(DEF_HOLIDAYS.slice().sort())) next.tables.knownHolidays = hol;
    next.updatedAt = Date.now();
    state = next; persistLocal();
    document.getElementById('bsSetBtn').classList.toggle('bs-dirty', hasOverrides());
    pushServer(function (kind, msg) {
      setStatus(msg + (v.warns.length ? ' אזהרות: ' + v.warns.slice(0, 3).join('; ') : '') + ' יש לרענן את הדף להחלת הערכים.', kind === 'local' && /נכשלה|אינה תומכת/.test(msg));
      showBanner('ההגדרות נשמרו.');
    });
  }
  function hasOverrides() { return Object.keys(state.values).length > 0 || Object.keys(state.tables).length > 0; }
  function onResetAll() {
    if (!confirm('לאפס את כל ההגדרות לברירות המחדל?')) return;
    state = emptyState(); state.updatedAt = Date.now(); persistLocal(); buildPanel(); panel.classList.add('open');
    document.getElementById('bsSetBtn').classList.remove('bs-dirty');
    pushServer(function (k, msg) { setStatus('אופסו לברירות מחדל. ' + msg + ' יש לרענן את הדף.'); showBanner('ההגדרות אופסו.'); });
  }
  function onExport() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = mk('a', { href: URL.createObjectURL(blob), download: 'bereshit-settings.json' }); document.body.appendChild(a); a.click(); a.remove();
  }
  function onImport() {
    var inp = mk('input', { type: 'file', accept: 'application/json' });
    inp.onchange = function () {
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var s = JSON.parse(rd.result);
          if (!s || typeof s !== 'object') throw new Error('מבנה לא תקין');
          Object.keys(s.values || {}).forEach(function (k) { if (!byKey[k] || typeof s.values[k] !== 'number') throw new Error('מפתח לא תקין: ' + k); });
          state = { v: 1, updatedAt: Date.now(), values: s.values || {}, tables: s.tables || {} };
          persistLocal(); buildPanel(); panel.classList.add('open'); setStatus('יובא. יש ללחוץ "שמור" כדי לשמור גם בשרת, ואז לרענן.');
        } catch (e) { setStatus('ייבוא נכשל: ' + e.message, true); }
      };
      rd.readAsText(inp.files[0]);
    };
    inp.click();
  }
  function openPanel() { buildPanel(); panel.classList.add('open'); }

  function init() {
    if (!document.body || document.getElementById('bsSetBtn')) return;
    document.head.appendChild(mk('style', { text: CSS }));
    var b = mk('button', { id: 'bsSetBtn', type: 'button', title: 'ערכים משוערים וממוצעים של החישובים', text: '⚙️ הגדרות' });
    if (hasOverrides()) b.classList.add('bs-dirty');
    b.onclick = openPanel;
    document.body.appendChild(b);
    applyLabels();
    pullServer();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.BS_SETTINGS = {
    get: get, saveValues: saveValues, calcConstants: calcConstants, propertyTypes: propertyTypes, knownHolidays: knownHolidays,
    openPanel: openPanel, fields: FIELDS, defaults: { propertyTypes: DEF_PROPERTY_TYPES, knownHolidays: DEF_HOLIDAYS }
  };
})();
