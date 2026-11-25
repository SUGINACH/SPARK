/* בדיקת ממשק לוח ההגדרות ב-jsdom (npm i jsdom@22). הרצה: node tools/tests/settings_ui_test.js */
const {JSDOM}=require('jsdom');const fs=require('fs');const assert=require('assert');
const src=fs.readFileSync(require('path').resolve(__dirname,'..','..','settings.js'),'utf8');
const html=`<!doctype html><html><head></head><body><span id="r" data-bs-setting="roof.m2PerKwpNew">5.5</span> <span id="t" data-bs-setting="stats.trimFraction" data-bs-fmt="pct">15%</span><input id="ex" value="7.5" data-bs-default="roof.m2PerKwpExisting"></body></html>`;
const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/',pretendToBeVisual:true});
const w=dom.window; const calls=[]; let serverDoc='';
w.confirm=()=>true;
function makeRun(handler){ function chain(ok,fail){ return new Proxy({},{get:(_,n)=>{
  if(n==='withSuccessHandler')return f=>chain(f,fail); if(n==='withFailureHandler')return f=>chain(ok,f);
  return (...a)=>handler(n,a,ok,fail);}}); } return chain(null,null); }
w.google={script:{run:makeRun((n,a,ok)=>{calls.push([n,a]);if(n==='getAppSettings')ok&&ok(serverDoc);else if(n==='saveAppSettings'){serverDoc=a[0];ok&&ok({ok:true});}})}};
w.eval(src);
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
const doc=w.document, S=w.BS_SETTINGS;
assert(doc.getElementById('bsSetBtn'),'button exists');
assert.strictEqual(doc.getElementById('r').textContent,'5.5');
assert.strictEqual(doc.getElementById('t').textContent,'15%','pct label formatting');
assert.strictEqual(doc.getElementById('ex').value,'7.5','data-bs-default applied');
assert(calls.some(c=>c[0]==='getAppSettings'),'pulls from server on load');
console.log('✅ כפתור, תוויות דינמיות (5.5 / 15%), ערך ברירת מחדל בשדה, משיכה מהשרת');
doc.getElementById('bsSetBtn').click();
const panel=doc.getElementById('bsSetPanel'); assert(panel.classList.contains('open'));
const rows=panel.querySelectorAll('.bs-row'); assert.strictEqual(rows.length,S.fields.length);
console.log('✅ הלוח נפתח עם',rows.length,'שדות + טבלת נכסים + חגים');
// edit roof ratio to 6.2 and vat to 17 (pct)
function rowOf(label){return [...rows].find(r=>r.textContent.includes(label))}
const roof=rowOf('שטח גג לקוו"ט, פאנלים מודרניים').querySelector('input'); roof.value='6.2'; roof.dispatchEvent(new w.Event('input'));
const vat=rowOf('מע"מ').querySelector('input'); assert.strictEqual(vat.value,'18','pct shown as 18'); vat.value='17'; vat.dispatchEvent(new w.Event('input'));
assert(rowOf('שטח גג לקוו"ט, פאנלים מודרניים').classList.contains('changed'),'changed highlight');
// bad holiday blocks save
const ta=panel.querySelector('textarea'); const orig=ta.value; ta.value=orig+'\n2031-13-45'; ta.dispatchEvent(new w.Event('input'));
const save=[...panel.querySelectorAll('footer button')].find(b=>b.textContent==='שמור'); save.click();
assert(/תאריכים לא תקינים/.test(doc.getElementById('bsSetStatus').textContent)); assert.strictEqual(serverDoc,'','nothing saved on invalid date');
console.log('✅ תאריך לא תקין חוסם שמירה');
ta.value=orig+'\n2031-01-01'; ta.dispatchEvent(new w.Event('input')); save.click();
const saved=JSON.parse(w.localStorage.getItem('bs_settings_v1'));
assert.strictEqual(saved.values['roof.m2PerKwpNew'],6.2); assert.strictEqual(saved.values['vatRate'],0.17);
assert.strictEqual(Object.keys(saved.values).length,2,'only changed values stored'); assert(saved.tables.extraHolidays.includes('2031-01-01'));
assert(!saved.tables.propertyTypes,'unchanged table not stored');
assert.strictEqual(JSON.parse(serverDoc).values.vatRate,0.17,'pushed to server');
assert(/נשמר בדפדפן ובשרת/.test(doc.getElementById('bsSetStatus').textContent));
console.log('✅ שמירה: רק ערכים ששונו (6.2 ו-17% = 0.17), גם בדפדפן וגם בשרת');
// reload page simulation: new window reading same localStorage
const dom2=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}); 
dom2.window.localStorage.setItem('bs_settings_v1',w.localStorage.getItem('bs_settings_v1')); dom2.window.eval(src);
dom2.window.document.dispatchEvent(new dom2.window.Event('DOMContentLoaded'));
assert.strictEqual(dom2.window.BS_SETTINGS.get('roof.m2PerKwpNew'),6.2); assert.strictEqual(dom2.window.BS_SETTINGS.calcConstants().vatRate,0.17);
assert.strictEqual(dom2.window.document.getElementById('r').textContent,'6.2','label follows setting');
console.log('✅ אחרי רענון: הערכים והתוויות מתעדכנים');
// old server without support
const dom3=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/'}); const w3=dom3.window; w3.confirm=()=>true;
w3.google={script:{run:makeRun((n,a,ok,fail)=>{ if(fail) fail(new Error('unknown_action: פעולה לא מוכרת')); })}};
w3.eval(src); w3.document.dispatchEvent(new w3.Event('DOMContentLoaded')); w3.document.getElementById('bsSetBtn').click();
const p3=w3.document.getElementById('bsSetPanel'); [...p3.querySelectorAll('footer button')].find(b=>b.textContent==='שמור').click();
console.log('ℹ️ שרת ישן:',w3.document.getElementById('bsSetStatus').textContent);
assert(/אינה תומכת/.test(w3.document.getElementById('bsSetStatus').textContent));
// reset all
[...panel.querySelectorAll('footer button')].find(b=>b.textContent==='אפס הכול לברירת מחדל').click();
const after=JSON.parse(w.localStorage.getItem('bs_settings_v1')); assert.deepStrictEqual(after.values,{}); assert.deepStrictEqual(after.tables,{});
console.log('✅ שרת ישן: הודעה ברורה ושמירה מקומית; איפוס מחזיר לברירות מחדל');
