/* בדיקת D3 (גדילת צריכה בשלב 2): גורם (1+g)^(H/2) על הסדרה ועל צריכת השבת, והשפעתו על הסוללה המומלצת כשגיבוי שבת קובע את הרצפה.
 * הערה: בלי גיבוי שבת/חג, גודל הסוללה נקבע מרצפה רגולטורית התלויה רק בגודל הפאנלים, ולכן הגדילה לא משנה אותו.
 * הרצה: python3 -m http.server 8771 &  ואז  node tools/tests/growth_test.js   (דורש npm i jsdom@22) */
const {JSDOM,VirtualConsole}=require('jsdom');const assert=require('assert');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=String(e.message);if(!/Could not load|Not implemented/.test(m))errs.push(m.slice(0,200))});
 const dom=await JSDOM.fromURL((process.env.BASE||'http://localhost:8771')+'/sizing.html',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.fetch=(...a)=>fetch(...a);w.alert=()=>{};}});
 await new Promise(r=>setTimeout(r,2500)); const w=dom.window;
 const out=w.eval(`(function(){
  const $=id=>document.getElementById(id), r={};
  const base=[]; for(let d=0;d<365;d++) for(let h=0;h<24;h++) base.push({date:new Date(2025,0,1+d,h,0),kwh:(h>=8&&h<=17?3:0.7)});
  stage1ConsumptionSeries=base; globalRawSeries=base;
  const total=a=>a.reduce((s,p)=>s+p.kwh,0);
  r.base=total(base);
  $('futureGrowthSlider').value='0'; onFutureGrowthChange(); r.f0=getGrowthFactor(); r.same=(globalRawSeries===stage1ConsumptionSeries);
  $('futureGrowthSlider').value='5'; onFutureGrowthChange(); r.f5=getGrowthFactor(); r.ratio5=total(globalRawSeries)/r.base; r.baseUntouched=total(stage1ConsumptionSeries)===r.base;
  r.text=$('futureGrowthResult').textContent.replace(/\\s+/g,' ').slice(0,170);
  $('futureGrowthSlider').value='10'; onFutureGrowthChange(); r.f10=getGrowthFactor();
  $('futureGrowthSlider').value='0'; onFutureGrowthChange(); r.back=(globalRawSeries===stage1ConsumptionSeries);
  return r;})()`);
 console.log(JSON.stringify(out));
 assert.strictEqual(out.f0,1); assert(out.same); assert(Math.abs(out.f5-Math.pow(1.05,5))<1e-12); assert(Math.abs(out.ratio5-out.f5)<1e-9); assert(out.baseUntouched);
 assert(Math.abs(out.f10-Math.pow(1.10,5))<1e-12); assert(out.back); assert(/פי 1\.276/.test(out.text),'text shows factor 1.276');
 console.log('✅ D3: גורם (1+g)^5 מוחל על הסדרה (5%→1.276, 10%→1.611); סדרת הבסיס לא משתנה; 0% מחזיר את המקור');
 // השפעה על ההמלצה עצמה
 const rec=w.eval(`(function(){
  const $=id=>document.getElementById(id);
  $('rec_roofArea').value='400'; $('rec_connLimit').value=''; $('useStorageShabbat').checked=true; $('estShabbatLoad').value='100';
  const res={};
  for (const g of ['0','8']) { lastRecommendation=null; $('futureGrowthSlider').value=g; onFutureGrowthChange(); try{ findOptimalSystemSize(); }catch(e){ res['err'+g]=String(e.message).slice(0,100);} 
    const lr = (typeof lastRecommendation!=='undefined')?lastRecommendation:null; res['g'+g]= lr? JSON.parse(JSON.stringify(lr,(k,v)=>typeof v==='object'&&v&&!Array.isArray(v)&&Object.keys(v).length>14?undefined:v)) : null; res['status'+g]=$('recStatus').textContent.slice(0,80);}
  return res;})()`);
 console.log('errs:',rec.err0,'|',rec.err8,'| status:',rec.status0,'|',rec.status8);
 const pick=g=>rec['g'+g]&&{pvKw:rec['g'+g].bestPv.kw,batKwh:Math.round(rec['g'+g].bestBat.kwh*10)/10,pvNpv:Math.round(rec['g'+g].bestPv.result.npv)};
 console.log('g=0%',JSON.stringify(pick('0')),' g=8%',JSON.stringify(pick('8')));
 assert(rec.g0&&rec.g8,'both runs produced a recommendation');
 assert(pick('8').batKwh>pick('0').batKwh*1.3,'with Shabbat backup binding, growth 8%/yr must raise the battery by about x1.47');
 console.log('✅ D3: עם גיבוי שבת שקובע את הרצפה, גדילה של 8%/שנה מגדילה את הסוללה המומלצת בכ-47%');
 console.log('runtime errors:',errs.length?errs.slice(0,3):'none'); process.exit(0);
})();
