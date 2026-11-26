/* בדיקת המלצת הגודל בשלב 2 (jsdom): NPV מול IRR, ללא הזרמה (צריכה עצמית) כתלות בצריכה, אגירה לפי סימולציה, וסימולציה בלי הזנת גודל.
 * הרצה: python3 -m http.server 8777 &  ואז  node tools/tests/sizing_recommendation_test.js   (דורש npm i jsdom@22) */
const { JSDOM, VirtualConsole } = require('jsdom'); const assert = require('assert');
const BASE = process.env.BASE || 'http://localhost:8777';
async function open() {
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', (e) => { const m = String(e.message); if (!/Could not load|Not implemented/.test(m)) errs.push(m.slice(0, 200)); });
  const dom = await JSDOM.fromURL(BASE + '/sizing.html', { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.fetch = (...a) => fetch(...a); w.alert = () => {}; w.Element.prototype.scrollIntoView = () => {}; } });
  await new Promise((r) => setTimeout(r, 2500)); return { w: dom.window, errs };
}
(async () => {
  const { w, errs } = await open();
  // סדרה שעתית שנתית. יום: 8-17 צריכה "mult*3", ערב 17-22 "mult*2", לילה "mult*0.7"
  const run = (mult, zero, objective, extra) => JSON.parse(w.eval(`(function(){
    const $=id=>document.getElementById(id);
    const s=[]; for(let d=0;d<365;d++) for(let h=0;h<24;h++) s.push({date:new Date(2025,0,1+d,h,0),kwh:${mult}*(h>=8&&h<17?3:(h>=17&&h<22?2:0.7))});
    stage1ConsumptionSeries=s; globalRawSeries=s; lastRecommendation=null;
    $('futureGrowthSlider').value='0'; onFutureGrowthChange();
    $('rec_roofArea').value='1000'; $('rec_connLimit').value=''; $('rec_budget').value='';
    $('zeroExport').value='${zero}'; $('rec_objective').value='${objective}';
    $('useStorageShabbat').checked=${extra && extra.backup ? 'true' : 'false'}; $('estShabbatLoad').value='${extra && extra.shabbat || 15}';
    findOptimalSystemSize();
    const r=lastRecommendation; if(!r) return JSON.stringify({err:$('recStatus').textContent});
    return JSON.stringify({ kw:r.bestPv.kw, maxKw:r.maxKw, pvNpv:Math.round(recScore(r.bestPv.result,'npv')), bat:r.bestBat&&Math.round(r.bestBat.kwh), batNotWorth:r.batteryNotWorth,
       batSweep:r.batSweep.length, pvSweep:r.pvSweep.length, selfCons: r.bestPv.sc && Math.round(r.bestPv.sc.selfConsumedKwh), curtailed: r.bestPv.sc && Math.round(r.bestPv.sc.curtailedKwh),
       annualValue: r.bestPv.sc && Math.round(r.bestPv.sc.annualValue) });
  })()`));

  // 1. עם הזרמה, גג גדול: IRR (הקודם) נעצר ב-15; NPV מגיע למגבלה
  const irr = run(1, 'false', 'irr'), npv = run(1, 'false', 'npv');
  console.log('עם הזרמה, IRR:', JSON.stringify(irr)); console.log('עם הזרמה, NPV:', JSON.stringify(npv));
  assert.strictEqual(irr.kw, 15, 'IRR: נעצר בתקרת המדרגה הראשונה (ההתנהגות הקודמת)');
  assert(npv.kw > 100 && npv.kw >= npv.maxKw - 1e-6, 'NPV עם גג גדול מגיע למגבלת הגג: ' + npv.kw);
  console.log('✅ עם הזרמה: IRR נעצר ב-15 (כפי שדווח); NPV מגיע ל-' + npv.kw.toFixed(0) + ' קוו"ט (מגבלת הגג)');

  // 2. ללא הזרמה: הגודל תלוי בצריכה. צריכה קטנה מול פי 10
  const z1 = run(1, 'true', 'npv'), z10 = run(10, 'true', 'npv');
  console.log('ללא הזרמה, צריכה x1 :', JSON.stringify(z1)); console.log('ללא הזרמה, צריכה x10:', JSON.stringify(z10));
  assert(z1.kw > 3, 'צריכה קטנה: יותר מ-3 קוו"ט (קודם תמיד 3): ' + z1.kw);
  assert(z10.kw > z1.kw * 3, 'פי 10 צריכה: המלצה גדולה בהרבה: ' + z1.kw + ' -> ' + z10.kw);
  assert(z1.kw < npv.kw, 'ללא הזרמה הגודל מוגבל בצריכה, לא בגג');
  assert(z1.annualValue > 0 && z1.selfCons > 0, 'יש חיסכון בצריכה עצמית');
  console.log('✅ ללא הזרמה: צריכה x1 → ' + z1.kw.toFixed(0) + ' קוו"ט, צריכה x10 → ' + z10.kw.toFixed(0) + ' קוו"ט (קודם תמיד 3)');

  // 3. אגירה: סימולציה על הצריכה בפועל, כולל "לא משתלמת", וגיבוי שבת מחייב אגירה
  const ex = run(1, 'false', 'npv'), bk = run(1, 'false', 'npv', { backup: true, shabbat: 40 });
  assert(ex.batSweep >= 2, 'נסרקו גדלי אגירה'); assert(ex.bat !== null || ex.batNotWorth === true, 'או המלצת אגירה או "לא משתלמת"');
  assert(bk.bat > 0 && bk.batNotWorth === false, 'עם גיבוי שבת האגירה נדרשת תמיד');
  console.log('✅ אגירה: ' + (ex.bat ? 'מומלצת ' + ex.bat + ' קוט"ש' : 'לא משתלמת בנתונים אלה') + ' (' + ex.batSweep + ' גדלים נבדקו בסימולציה); עם גיבוי שבת: ' + bk.bat + ' קוט"ש');
  const zb = run(10, 'true', 'npv'); console.log('   ללא הזרמה x10, אגירה:', zb.bat, zb.batNotWorth ? '(לא משתלמת)' : '');

  // 4. כפתור הסימולציה לא מבקש להזין גודל
  const sim = JSON.parse(w.eval(`(function(){
    const $=id=>document.getElementById(id);
    run = null;
    const s=[]; for(let d=0;d<365;d++) for(let h=0;h<24;h++) s.push({date:new Date(2025,0,1+d,h,0),kwh:(h>=8&&h<17?3:(h>=17&&h<22?2:0.7))});
    stage1ConsumptionSeries=s; globalRawSeries=s; lastRecommendation=null;
    $('rec_roofArea').value='100'; $('zeroExport').value='false'; $('rec_objective').value='npv'; $('useStorageShabbat').checked=true; $('estShabbatLoad').value='40'; $('actualBatteryKwh').value='0';
    $('runHourlySimBtn').disabled=false; $('runHourlySimBtn').click();
    return JSON.stringify({ filled: $('actualBatteryKwh').value, err: $('hourlySimError').style.display==='none' ? '' : $('hourlySimError').textContent });
  })()`));
  assert(Number(sim.filled) > 0 && sim.err === '', 'הסימולציה מילאה גודל מיטבי בעצמה: ' + JSON.stringify(sim));
  console.log('✅ כפתור הסימולציה: בלי גודל שהוזן, הופעל על הגודל המיטבי (' + sim.filled + ' קוט"ש), בלי הודעת שגיאה');
  assert.strictEqual(errs.length, 0, 'שגיאות ריצה: ' + errs.join('|'));
  console.log('runtime errors: none'); w.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
