/* בדיקת D20 (פסיק עשרוני בקובץ חח"י): 1,5→1.5 ; 1,234.5→1234.5 ; 1,234→1234, וספירת ערכים עם פסיק עשרוני.
 * הרצה: python3 -m http.server 8770 &  ואז  node tools/tests/decimal_comma_test.js   (דורש npm i jsdom@22) */
const {JSDOM,VirtualConsole}=require('jsdom');const assert=require('assert');
(async()=>{
 const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=String(e.message);if(!/Could not load|Not implemented/.test(m))errs.push(m.slice(0,160))});
 const dom=await JSDOM.fromURL((process.env.BASE||'http://localhost:8770')+'/consumption.html',{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.fetch=(...a)=>fetch(...a);w.alert=()=>{};}});
 await new Promise(r=>setTimeout(r,2500)); const w=dom.window;
 const r=w.eval(`(function(){
  const cases=['1,5','1,234.5','1,234','0,25','0.25','12,345,678','1,23','-1,5','"2,5"',' 3,5 ','','abc','7'];
  const out={}; cases.forEach(c=>{const n={decimalComma:0}; out[c]=[parseKwhNumber(c,n),n.decimalComma];});
  // שורות קובץ חח"י: [?, סוג מונה, תאריך, שעה, ערך, הזנה]
  const rows=[['','צריכה','01/06/2025','00:15','1,5',''],['','צריכה','01/06/2025','00:30','0.5',''],['','צריכה','01/06/2025','00:45','1,234.5','']];
  const p=parseMultimeterRows(rows,0);
  out.__rows={kwh:p.points.map(x=>x.kwh),decimalCommaCount:p.decimalCommaCount};
  return out;})()`);
 const R=JSON.parse(JSON.stringify(r)); console.log(JSON.stringify(R));
 assert.deepStrictEqual(R['1,5'],[1.5,1]); assert.deepStrictEqual(R['1,234.5'],[1234.5,0]); assert.deepStrictEqual(R['1,234'],[1234,0]);
 assert.deepStrictEqual(R['0,25'],[0.25,1]); assert.deepStrictEqual(R['0.25'],[0.25,0]); assert.deepStrictEqual(R['12,345,678'],[12345678,0]);
 assert.deepStrictEqual(R['-1,5'],[-1.5,1]); assert.deepStrictEqual(R['"2,5"'],[2.5,1]); assert.deepStrictEqual(R[' 3,5 '],[3.5,1]);
 assert.strictEqual(R[''][0],null); assert.strictEqual(R['abc'][0],null); assert.deepStrictEqual(R['7'],[7,0]);   // NaN מסתדר ל-null ב-JSON
 assert.deepStrictEqual(R.__rows.kwh,[1.5,0.5,1234.5]); assert.strictEqual(R.__rows.decimalCommaCount,1);
 console.log('✅ D20: 1,5→1.5; 1,234.5→1234.5; 1,234→1234; נספר פסיק עשרוני אחד בשורות הדוגמה');
 console.log('runtime errors:',errs.length?errs:'none'); process.exit(0);
})();
