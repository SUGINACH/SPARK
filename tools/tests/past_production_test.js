/* בדיקת D6 (הערכת ייצור עבר) על דף שלב 1 ב-jsdom: שטח→הספק, סכום שנתי, אפס בלילה, עונתיות, וללא הערכה כשיש מונה אמיתי.
 * הרצה: מתיקיית הריפו, python3 -m http.server 8768 &  ואז  node tools/tests/past_production_test.js   (דורש npm i jsdom@22) */
const {JSDOM,VirtualConsole}=require('jsdom');const assert=require('assert');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=String(e.message);if(!/Could not load|Not implemented/.test(m))errs.push(m.slice(0,160))});
 const dom=await JSDOM.fromURL((process.env.BASE||'http://localhost:8768')+'/consumption.html',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.fetch=(...a)=>fetch(...a);w.alert=()=>{};}});
 await new Promise(r=>setTimeout(r,2500)); const w=dom.window;
 const res=w.eval(`(function(){
  const $=id=>document.getElementById(id), r={};
  $('productionModeSelect').value='existing'; onProductionModeChange();
  r.noteEmpty=$('pastProductionNote').textContent;
  $('existingRoofArea').value='75'; onExistingRoofAreaChange();          // 75 / 7.5 = 10 קוו"ט
  r.kwFromArea=$('existingProductionKw').value; r.p0=$('p0')&&$('p0').value;
  r.note=$('pastProductionNote').textContent.replace(/\\s+/g,' ').slice(0,150);
  const win={start:new Date(2025,5,1),nDays:365};
  const pay=buildEstimatedProductionPayload(win);
  r.flags={estimated:pay.estimated,hours:pay.hoursCount,scale:pay.scale,params:pay.params};
  const series=unpackB64ToHourlySeries(pay.valuesB64,String(pay.refYear),pay.startISO,pay.scale);
  r.n=series.length; r.annual=series.reduce((s,p)=>s+p.kwh,0);
  const day=(y,m,d)=>series.filter(p=>p.date.getFullYear()===y&&p.date.getMonth()===m&&p.date.getDate()===d);
  const jun=day(2025,5,21), dec=day(2025,11,21);
  r.junHours=jun.map(p=>+p.kwh.toFixed(2)); r.junTotal=jun.reduce((s,p)=>s+p.kwh,0); r.decTotal=dec.reduce((s,p)=>s+p.kwh,0);
  r.junNight=[0,1,2,3,4].map(h=>jun[h].kwh); r.junPeakHour=jun.indexOf(jun.reduce((a,b)=>b.kwh>a.kwh?b:a));
  // אזימוט מזרח/מערב והצללה
  $('existingAzimuth').value='0.85'; $('existingShading').value='0.9';
  r.annualEW=buildEstimatedProductionPayload(win).params.annualKwh;
  // עם מונה ייצור אמיתי: אין הערכה
  window._productionSeries=[{date:new Date(2025,5,1,12),kwh:1}]; updatePastProductionNote();
  r.withReal=buildEstimatedProductionPayload(win); r.realNote=$('pastProductionNote').textContent.slice(0,60);
  window._productionSeries=[];
  // מצב "אין מערכת קיימת"
  $('productionModeSelect').value='none'; onProductionModeChange(); r.noneMode=buildEstimatedProductionPayload(win);
  return r;})()`);
 console.log(JSON.stringify(res,null,0).slice(0,1800));
 assert.strictEqual(res.kwFromArea,'10');
 assert(/מוערך/.test(res.note)&&/15,200/.test(res.note),'note shows 15,200'); 
 assert(res.flags.estimated&&res.flags.hours===365*24&&res.n===365*24);
 assert(Math.abs(res.annual-15200)/15200<0.006,'annual within 0.6% got '+res.annual);
 assert(res.junNight.every(v=>v===0),'night zero'); assert(res.junHours[12]>0&&res.junHours[5]>0&&res.junHours[19]>0&&res.junHours[20]===0,'daylight window');
 assert(res.junPeakHour>=11&&res.junPeakHour<=12,'peak midday');
 const ratio=res.junTotal/res.decTotal; assert(ratio>1.8&&ratio<2.2,'summer/winter ratio '+ratio);
 assert(Math.abs(res.annualEW-10*1600*0.85*0.9)/ (10*1600*0.85*0.9)<0.006,'EW/shading '+res.annualEW);
 assert.strictEqual(res.withReal,null); assert(/מונה ייצור אמיתי/.test(res.realNote)); assert.strictEqual(res.noneMode,null);
 console.log('\n✅ D6: 75 מ"ר ÷ 7.5 = 10 קוו"ט; סכום שנתי',Math.round(res.annual),'(צפוי 15,200); אפס בלילה; שיא בצהריים; קיץ/חורף',ratio.toFixed(2),'; כיוון/הצללה מוחלים; עם מונה אמיתי או בלי מערכת קיימת אין הערכה');
 console.log('runtime errors:',errs.length?errs:'none'); process.exit(0);
})();
