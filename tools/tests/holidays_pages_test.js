/* בדיקת חיבור החגים לדפים (D21), ב-jsdom: חלון קדושה לימים רצופים, השלמת יום טוב חסר, תעו"ז בשלושת הדפים, וזיהוי יום חריג עם שם החג.
 * הרצה: python3 -m http.server 8774 &  ואז  node tools/tests/holidays_pages_test.js   (דורש npm i jsdom@22) */
const { JSDOM, VirtualConsole } = require('jsdom'); const assert = require('assert');
const BASE = process.env.BASE || 'http://localhost:8774';
async function open(page) {
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', (e) => { const m = String(e.message); if (!/Could not load|Not implemented/.test(m)) errs.push(m.slice(0, 160)); });
  const dom = await JSDOM.fromURL(BASE + '/' + page, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) { w.fetch = (...a) => fetch(...a); w.alert = () => {}; } });
  await new Promise((r) => setTimeout(r, 2500)); return { w: dom.window, errs };
}
(async () => {
  // ---- תעו"ז בשלושת הדפים ----
  for (const page of ['consumption.html', 'sizing.html', 'finance.html']) {
    const { w, errs } = await open(page);
    const r = JSON.parse(w.eval(`JSON.stringify({
      rhSun: classifyHour(new Date(2026,8,13,18)),        // ר"ה, קיץ, חג: שפל
      monAfter: classifyHour(new Date(2026,8,14,18)),     // יום שני רגיל: פסגה
      hanukkahWinter: classifyHour(new Date(2026,11,6,18)), // חורף: פסגה בכל יום
      purimTransition: classifyHour(new Date(2026,2,3,18)), // פורים אינו יום טוב: פסגה
      pesachTransition: classifyHour(new Date(2026,3,2,18)) // פסח, מעבר, יום טוב: שפל
    })`));
    assert.strictEqual(r.rhSun.season, 'summer'); assert.strictEqual(r.rhSun.isPeak, false, page + ': ר"ה צריך להיות שפל');
    assert.strictEqual(r.monAfter.isPeak, true); assert.strictEqual(r.hanukkahWinter.isPeak, true); assert.strictEqual(r.purimTransition.isPeak, true);
    assert.strictEqual(r.pesachTransition.season, 'transition'); assert.strictEqual(r.pesachTransition.isPeak, false, page + ': פסח צריך להיות שפל');
    assert.strictEqual(errs.length, 0, page + ' שגיאות ריצה: ' + errs.join('|'));
    console.log('✅ ' + page + ': תעו"ז לפי חגים מהלוח העברי (ר"ה/פסח = שפל; פורים/חנוכה/יום רגיל = פסגה)');
    w.close();
  }
  // ---- שלב 1 ----
  const { w, errs } = await open('consumption.html');
  const out = JSON.parse(w.eval(`(function(){
    const r = {};
    const win = getHolyWindow(new Date(2026,8,13,12));            // ר"ה: שבת 12/9 + ראשון 13/9
    r.chain = { first: win.first.toDateString(), last: win.last.toDateString(), startDay: win.start.getDate(), endDay: win.end.getDate() };
    r.shabbatOnly = (function(){ const x = getHolyWindow(new Date(2026,5,13,12)); return x.first.toDateString() === new Date(2026,5,13).toDateString() && x.start.getDate() === 12 && x.end.getDate() === 13; })();
    r.weekday = getHolyWindow(new Date(2026,5,10,12));
    // סדרה שעתית 22/3-19/4/2026. חול=10, קדושה=3. נמחק כל חלון יום הטוב של פסח (חמישי 2/4)
    const series = [];
    const pesachKey = new Date(2026,3,2).toDateString();
    for (let d = 0; d < 28; d++) for (let h = 0; h < 24; h++) {
      const dt = new Date(2026,2,22+d,h,30), hw = getHolyWindow(dt), inHoly = hw && dt >= hw.start && dt <= hw.end;
      if (inHoly && hw.key === pesachKey) continue;
      series.push({ date: new Date(2026,2,22+d,h,0), kwh: inHoly ? 3 : 10 });
    }
    window._unifiedResult = { finalSeries: series, confidence: 'high', sourcesUsed: ['iec'] };
    document.getElementById('ignoreMissingShabbat').checked = true; document.getElementById('shabbatUpliftSlider').value = '15';
    const p = computeShabbatFillPlan(), g = p.grid;
    const idx = (y,m,d,h) => Math.round((new Date(y,m,d) - p.win.start) / 86400000) * 24 + h;
    r.stats = { filled: p.stats.filledHours, windows: p.stats.shabbats, unfilled: p.stats.unfilledHours };
    r.pesachNoon = g.sums[idx(2026,3,2,12)];            // חמישי יום טוב, שעה 12: 10 × 1.15
    r.pesachEveNight = g.sums[idx(2026,3,1,23)];        // ליל החג (ערב, אחרי כניסה)
    r.sat4Existing = g.sums[idx(2026,3,4,12)];          // שבת 4/4 קיימת: לא נדרסה
    r.noon10 = g.sums[idx(2026,3,14,12)];               // יום רגיל (14/4): לא נגעו. שימו לב: 8/4 הוא שביעי של פסח, קדוש
    // ---- יום חריג עם שם חג: חנוכה (שלישי 8/12/2026) ----
    const s2 = []; for (let d = 0; d < 28; d++) for (let h = 0; h < 24; h++) s2.push({ date: new Date(2026,10,25+d,h,0), kwh: 5 });
    const ex = detectExceptionDays(s2).filter(e => /חנוכה/.test(e.reason)).map(e => ({ d: e.date.getDate(), reason: e.reason }));
    r.hanukkahExceptions = ex.length; r.hanukkahReasonSample = ex[0] && ex[0].reason;
    return JSON.stringify(r);
  })()`));
  console.log(JSON.stringify(out));
  assert.deepStrictEqual(out.chain, { first: 'Sat Sep 12 2026', last: 'Sun Sep 13 2026', startDay: 11, endDay: 13 });
  assert(out.shabbatOnly, 'שבת רגילה: חלון שישי-שבת כמו קודם'); assert.strictEqual(out.weekday, null);
  assert(out.stats.filled > 20 && out.stats.windows >= 1 && out.stats.unfilled === 0, 'הושלמו שעות יום הטוב');
  assert.strictEqual(Math.round(out.pesachNoon * 100) / 100, 11.5, 'חמישי יום טוב שעה 12: 10 x 1.15');
  assert(out.pesachEveNight > 0, 'ליל החג מולא'); assert.strictEqual(out.sat4Existing, 3); assert.strictEqual(out.noon10, 10);
  assert.strictEqual(out.hanukkahExceptions, 6, 'ימי חנוכה בימי חול (ראשון-שישי, ללא שני השבתות) זוהו כיום חריג עם שם'); assert(/חנוכה/.test(out.hanukkahReasonSample));
  console.log('✅ שלב 1: חלון ר"ה (שבת+ראשון) אחד, שבת רגילה כבעבר, השלמת יום טוב חסר (10→11.5), חנוכה מזוהה כיום חריג עם שם');
  assert.strictEqual(errs.length, 0, 'שגיאות ריצה: ' + errs.join('|'));
  w.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
