/* בדיקת D5 (מילוי שבתות חסרות) על דף שלב 1 ב-jsdom, לפי דוגמת המשתמש: שעה 18: 100→115, שעה 19: 200→230 ב-15%.
 * הרצה: מתיקיית הריפו, python3 -m http.server 8767 &  ואז  node tools/tests/shabbat_fill_test.js   (דורש npm i jsdom@22) */
const {JSDOM,VirtualConsole}=require('jsdom');const assert=require('assert');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=String(e.message);if(!/Could not load|Not implemented/.test(m))errs.push(m.slice(0,160))});
 const dom=await JSDOM.fromURL((process.env.BASE||'http://localhost:8767')+'/consumption.html',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.fetch=(...a)=>fetch(...a);w.alert=()=>{};}});
 await new Promise(r=>setTimeout(r,2500)); const w=dom.window;
 // סדרה שעתית: 9 שבועות מ-2026-06-07 (ראשון). חול: שעה 18=100, שעה 19=200, אחרת 10. שבת קיימת=3.
 // שתי שבתות חסרות לגמרי (13/6 ... ) ושבת אחת חסרה חלקית.
 const out=w.eval(`(function(){
  const series=[]; const start=new Date(2026,5,7); const missingSat=new Set(['${new Date(2026,5,20).toDateString()}','${new Date(2026,6,4).toDateString()}']);
  const partialSat='${new Date(2026,5,27).toDateString()}';
  for(let d=0; d<63; d++){ for(let h=0; h<24; h++){
    const dt=new Date(2026,5,7+d,h,30); const inSh=isInHalachicShabbat(dt);
    const sat=getHalachicShabbatWindow(dt).saturday.toDateString();
    if(inSh && missingSat.has(sat)) continue;
    if(inSh && sat===partialSat && h>=18) continue;
    let v = inSh ? 3 : (h===18?100:(h===19?200:10));
    series.push({date:new Date(2026,5,7+d,h,0), kwh:v});
  }}
  window._unifiedResult={finalSeries:series,confidence:'high',sourcesUsed:['iec']};
  const res={};
  // 1. ברירת מחדל (תיבה לא מסומנת): בלי מילוי
  document.getElementById('ignoreMissingShabbat').checked=false;
  let p=computeShabbatFillPlan(); res.disabledStats=p.stats; res.zerosKept=p.grid.sums.filter((v,i)=>!p.grid.seen[i]).every(v=>v===0);
  // 2. מסומן, 15%
  document.getElementById('ignoreMissingShabbat').checked=true; document.getElementById('shabbatUpliftSlider').value='15';
  p=computeShabbatFillPlan(); res.stats={filled:p.stats.filledHours,shabbats:p.stats.shabbats,unfilled:p.stats.unfilledHours};
  const g=p.grid, wn=p.win;
  const idx=(y,m,d,h)=>Math.round((new Date(y,m,d)-wn.start)/86400000)*24+h;
  res.sat20_h18=g.sums[idx(2026,5,20,18)]; res.sat20_h19=g.sums[idx(2026,5,20,19)];
  res.sat20_h12=g.sums[idx(2026,5,20,12)];
  res.sat27_h12_existing=g.sums[idx(2026,5,27,12)];       // קיים (3), לא נדרס
  res.sat27_h18_filled=g.sums[idx(2026,5,27,18)];          // חסר, מולא
  res.sat13_h18_untouched=g.sums[idx(2026,5,13,18)];       // שבת שלמה, לא נדרסה
  res.rangesSample=p.stats.ranges.slice(0,2);
  // 3. 0%
  document.getElementById('shabbatUpliftSlider').value='0'; p=computeShabbatFillPlan(); res.sat20_h18_0pct=p.grid.sums[idx(2026,5,20,18)];
  // 4. תצוגה מקדימה
  document.getElementById('shabbatUpliftSlider').value='15'; onShabbatUpliftChange();
  res.preview=document.getElementById('shabbatFillNote').textContent.slice(0,140);
  return res;})()`);
 console.log(JSON.stringify(out,null,1));
 assert.strictEqual(out.disabledStats,null); assert(out.zerosKept);
 assert.strictEqual(Math.round(out.sat20_h18),115,'hour18 100->115'); assert.strictEqual(Math.round(out.sat20_h19),230,'hour19 200->230');
 assert.strictEqual(Math.round(out.sat20_h12),Math.round(10*1.15*100)/100===11.5?12:Math.round(out.sat20_h12));
 assert.strictEqual(out.sat27_h12_existing,3,'existing data not overwritten'); assert.strictEqual(Math.round(out.sat27_h18_filled),115);
 assert.strictEqual(out.sat13_h18_untouched,3); assert.strictEqual(Math.round(out.sat20_h18_0pct),100);
 console.log('✅ D5: 18→115, 19→230 ב-15% (דוגמת המשתמש); נתונים קיימים לא נדרסו; 0% מחזיר פרופיל חול נקי; ללא סימון אין מילוי');
 console.log('runtime errors:',errs.length?errs:'none'); process.exit(0);
})();
