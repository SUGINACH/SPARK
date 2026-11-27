/* בדיקת הגרף "כל אפשרויות גודל האגירה: חיסכון, רווח ושימוש" בתוצאות הסימולציה (jsdom): קוביות, שלושה גרפי SVG, סימון מיטבי,
 * מצב עם הזרמה וללא הזרמה, וייצוא CSV. הרצה: python3 -m http.server 8780 &  ואז  node tools/tests/size_sweep_test.js   (דורש npm i jsdom@22) */
const { JSDOM, VirtualConsole } = require('jsdom'); const assert = require('assert');
const BASE = process.env.BASE || 'http://localhost:8780';
(async () => {
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', (e) => { const m = String(e.message); if (!/Could not load|Not implemented/.test(m)) errs.push(m.slice(0, 200)); });
  vc.on('error', (e) => errs.push(String(e).slice(0, 200)));
  const dom = await JSDOM.fromURL(BASE + '/sizing.html', { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.fetch = (...a) => fetch(...a); w.alert = () => {}; w.Element.prototype.scrollIntoView = () => {}; w.URL.createObjectURL = () => 'blob:x'; } });
  await new Promise((r) => setTimeout(r, 2500)); const w = dom.window;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function scenario(mult, zeroStr, backup) {
    const zero = zeroStr === 'true';
    w.eval(`(function(){
      const $=id=>document.getElementById(id);
      const s=[]; for(let d=0;d<365;d++) for(let h=0;h<24;h++) s.push({date:new Date(2025,0,1+d,h,0),kwh:${mult}*(h>=8&&h<17?3:(h>=17&&h<22?2:0.7))});
      stage1ConsumptionSeries=s; globalRawSeries=s; lastRecommendation=null; lastSizeSweep=null;
      $('rec_roofArea').value='${zero ? 1000 : 100}'; $('rec_connLimit').value='${zero ? '' : 15}'; $('zeroExport').value='${zeroStr}'; $('rec_objective').value='npv';
      $('useStorageShabbat').checked=${backup}; $('estShabbatLoad').value='40'; $('actualBatteryKwh').value='0'; $('calc_targetKw').value='0';
      $('sizeSweepSection').style.display='none';
      findOptimalSystemSize();
      $('runHourlySimBtn').disabled=false; $('runHourlySimBtn').click();
    })()`);
    await wait(2500);
    return JSON.parse(w.eval(`JSON.stringify((function(){
      const $=id=>document.getElementById(id);
      const sw=lastSizeSweep; if(!sw) return {err:$('hourlySimError').textContent};
      const svgs=['sizeSweepChartCombo','sizeSweepChartProfit','sizeSweepChartRatio'].map(id=>({id, polylines:($(id).innerHTML.match(/<polyline/g)||[]).length, rects:($(id).innerHTML.match(/<rect/g)||[]).length, circles:($(id).innerHTML.match(/<circle/g)||[]).length}));
      return { shown:$('sizeSweepSection').style.display, cubes:$('sizeSweepCubes').children.length, svgs, n:sw.rows.length, best:sw.best.kwh, bestScore:Math.round(sw.best.score),
        rec: lastRecommendation && lastRecommendation.bestBat ? lastRecommendation.bestBat.kwh : null, pvKw:sw.pvKw, zero:sw.zeroExport, floor:Math.round(sw.floorKwh),
        first:{k:sw.rows[0].kwh,a:Math.round(sw.rows[0].annualValue),c:Math.round(sw.rows[0].cycles)}, last:{k:sw.rows[sw.rows.length-1].kwh,a:Math.round(sw.rows[sw.rows.length-1].annualValue),c:Math.round(sw.rows[sw.rows.length-1].cycles)},
        hasNpv:sw.rows.every(r=>r.npv!==null), npvs:sw.rows.map(r=>Math.round(r.npv)), marginals:sw.rows.slice(0,4).map(r=>Math.round(r.marginal)), belowFloor:sw.rows.filter(r=>r.belowFloor).length,
        note:$('sizeSweepNote').textContent.slice(0,160), errText:$('hourlySimError').style.display==='none'?'':$('hourlySimError').textContent };
    })())`));
  }
  // עם הזרמה + גיבוי שבת (אגירה מחויבת)
  const a = await scenario(1, 'false', 'true'); console.log('עם הזרמה:', JSON.stringify(a).slice(0, 700));
  assert(!a.err && a.shown === 'block', 'הסעיף מוצג: ' + JSON.stringify(a));
  assert(a.n >= 20 && a.cubes === a.n, 'קוביות לכל גודל: ' + a.cubes + '/' + a.n);
  a.svgs.forEach((s) => { assert(s.polylines >= 1 && s.circles >= 20, s.id + ' ללא קווים/נקודות'); });
  assert.strictEqual(a.svgs[1].polylines, 1, 'גרף הרווח: קו NPV אחד (החיסכון כבר בגרף הראשון)');
  assert(a.svgs[0].rects >= 20 && a.svgs[1].rects >= 20, 'עמודות בגרפים: תוספת שולית ומחזורי טעינה');
  assert(a.hasNpv && a.pvKw > 0, 'יש NPV (מערכת פאנלים ידועה)');
  assert(a.last.c > 0 && a.first.a >= 0, 'שימוש ומחזורים');
  assert(a.belowFloor >= 1 && a.floor > 0, 'גדלים מתחת לרצפה הרגולטורית מסומנים');
  assert(a.errText === '', 'ללא הודעת שגיאה');
  assert(a.rec !== null && Math.abs(a.best - a.rec) < 0.2, 'הגודל המיטבי בגרף זהה להמלצה: ' + a.best + ' מול ' + a.rec);
  console.log('✅ עם הזרמה: ' + a.n + ' גדלים, 3 גרפים (קווים, עמודות, נקודות), NPV לכל גודל, מיטבי ' + a.best + ' קוט"ש, ' + a.belowFloor + ' גדלים מתחת לרצפה');

  // ללא הזרמה, צריכה פי 10: יש חיסכון לאגירה וסימון מיטבי
  const z = await scenario(10, 'true', 'false'); console.log('ללא הזרמה:', JSON.stringify(z).slice(0, 700));
  assert(!z.err && z.shown === 'block' && z.zero === true, 'סעיף ללא הזרמה מוצג: ' + JSON.stringify(z).slice(0, 300));
  assert(z.hasNpv && z.n >= 20 && z.marginals[0] > 0, 'חיסכון שולי חיובי לגדלים קטנים');
  assert(/אינה משתלמת/.test(z.note) || z.note.length > 0, 'הערת הסריקה קיימת');
  assert(z.last.a > z.first.a, 'חיסכון האגירה עולה עם הגודל');
  assert(Math.max(...z.npvs) === z.bestScore || z.bestScore >= Math.max(...z.npvs) - 1, 'המיטבי הוא אכן הגבוה ב-NPV');
  console.log('✅ ללא הזרמה: ' + z.n + ' גדלים, חיסכון אגירה ' + z.first.a + ' → ' + z.last.a + ' ₪/שנה, מיטבי ' + z.best + ' קוט"ש');

  // CSV
  const csv = w.eval(`(function(){ let captured=''; const OrigBlob=Blob; window.Blob=function(parts,opt){ captured=parts.join(''); return new OrigBlob(parts,opt); }; exportSizeSweepCsv(); window.Blob=OrigBlob; return captured; })()`);
  const rowsCsv = csv.split('\n'); assert(rowsCsv.length === z.n + 1 && /גודל אגירה/.test(rowsCsv[0]), 'CSV: כותרת ושורה לכל גודל');
  console.log('✅ ייצוא CSV: ' + (rowsCsv.length - 1) + ' שורות');
  assert.strictEqual(errs.length, 0, 'שגיאות ריצה: ' + errs.join('|'));
  console.log('runtime errors: none'); w.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
