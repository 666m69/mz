import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../../build/worker.mjs';
import {iconPosition,storedIconPoint,floatingWindowPoint} from '../../site/assets/js/mz-assistant-position.mjs';
import {professionDiscovery} from '../../site/assets/js/mz-profession-guide.mjs';

const url='https://mz702.pages.dev';
test('draggable icon clamps to screen and respects bottom mobile dock',()=>{
 const view={width:390,height:844,iconWidth:74,iconHeight:74,margin:10,dock:76};
 assert.deepEqual(iconPosition(-400,-50,view),{x:10,y:10});
 assert.deepEqual(iconPosition(900,900,view),{x:306,y:684});
 assert.deepEqual(storedIconPoint({x:1,y:1},view),{x:306,y:684});
 assert.equal(storedIconPoint({x:-1,y:10},view),null);
 assert.equal(storedIconPoint({x:NaN,y:.5},view),null);
 assert.equal(iconPosition(10,10,{width:50,height:50,iconWidth:74,iconHeight:74}),null);
});
test('the chat window stays inside screen whether icon is at top, bottom or left',()=>{
 const viewport={width:390,height:844},panel={width:358,height:490};
 for(const icon of [
   {top:10,bottom:84,left:10,right:84},
   {top:684,bottom:758,left:306,right:380},
   {top:300,bottom:374,left:155,right:229}
 ]){
   const point=floatingWindowPoint(icon,panel,viewport);
   assert.ok(point.x>=10&&point.y>=10,JSON.stringify(point));
   assert.ok(point.x+panel.width<=viewport.width-10,JSON.stringify(point));
   assert.ok(point.y+panel.height<=viewport.height-10,JSON.stringify(point));
 }
});
test('profession-first discovery uses only existing capability links and never invents integrations',()=>{
 for(const [query,role,links] of [
   ['أنا مدرس في ابتدائي','التعليم',['teacher']],
   ['أنا منسق تسويق في فندق','الفنادق والسياحة',['images','quote','clients']],
   ['أشتغل في مكتب عقاري','القطاع العقاري',['property','images','clients']],
   ['أنا صاحب كافيه','المطاعم والمقاهي',['menu','recipe','quote']],
   ['أنا متقاعد وأزرع في البيت','الهوايات والفرص',['hydro','opportunities']],
   ['أنا ممرض في مستشفى','القطاع الصحي الإداري',[]]
 ]){
   const plan=professionDiscovery(query);
   assert.equal(plan.role,role,query);
   assert.deepEqual(plan.links,links,query);
   assert.match(plan.intro,/مجرد أمثلة قابلة للتعديل/);
   assert.ok(plan.question);
 }
 assert.equal(professionDiscovery('أنا معلم وأحتاج رسالة لأولياء الأمور'),null);
 assert.equal(professionDiscovery('أبغى أداة جديدة غير موجودة'),null);
});
test('homepage has a single floating chat and keeps the independent free application intake',async()=>{
 const response=await worker.fetch(new Request(url+'/'),{});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.equal((html.match(/id="mz-assistant-root"/g)||[]).length,1);
 assert.doesNotMatch(html,/id="mz-assistant"/);
 assert.doesNotMatch(html,/id="mz-bot-form"/);
 assert.doesNotMatch(html,/src="\/assets\/js\/mz-assistant-ui\.mjs"/);
 assert.match(html,/data-mz-open-assistant/);
 assert.match(html,/id="mz-request"/);
 assert.match(html,/id="mz-quick-idea"/);
 assert.match(html,/id="mz-intake-consent"/);
 assert.match(html,/المراجعة الأولية مجانا|المراجعة الأولية مجانًا/);
 assert.match(html,/بدون بطاقة/);
});
test('widget opens by hero button, saves icon coordinates only, and keeps AI behind consent',async()=>{
 const script=(await readFile(new URL('../../site/assets/js/mz-floating-assistant.mjs',import.meta.url),'utf8'));
 const css=(await readFile(new URL('../../site/assets/css/mz-floating-assistant.css',import.meta.url),'utf8'));
 assert.match(script,/pointerdown/);
 assert.match(script,/pointermove/);
 assert.match(script,/pointerup/);
 assert.match(script,/setPointerCapture/);
 assert.match(script,/storedIconPoint/);
 assert.match(script,/floatingWindowPoint/);
 assert.match(script,/localStorage\.setItem\(positionKey/);
 assert.match(script,/document\.querySelectorAll\('\[data-mz-open-assistant\]'\)/);
 assert.match(script,/recentNeeds/);
 assert.match(script,/sendToReview/);
 assert.match(script,/aiConsent\?\.checked/);
 assert.match(script,/fetch\('\/api\/assistant'/);
 assert.doesNotMatch(script,/innerHTML\s*=|eval\s*\(|new Function\s*\(/);
 assert.match(css,/touch-action:none/);
 assert.match(css,/#mz-chat-window\{\s*position:fixed/);
 const response=await worker.fetch(new Request(url+'/assets/js/mz-assistant-position.mjs'),{});
 assert.equal(response.status,200);
 assert.match(response.headers.get('Content-Type')||'',/javascript/);
});
