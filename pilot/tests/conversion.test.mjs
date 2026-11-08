import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const html=read('pilot/lab/index.html');
const script=read('pilot/lab/lab.js');
const styles=read('pilot/lab/lab.css');
const worker=read('pilot/mz-ideas-worker.js');

test('visitor journey is archive consent → three illustrated screens → optional agreement inquiry',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const id of ['design','idea','archive-consent','reuse-consent','concept-email',
   'show-concept','concept-state','workspace','concept-visuals','concept-steps',
   'concept-reference','execution','intake','brief','email','consent','send','receipt',
   'track-form','tracking-id','tracking-result']){
   assert.ok(ids.has(id),'Missing element '+id);
 }
 assert.match(html,/id="workspace" hidden/);
 assert.match(script,/const receipt=await sendIdea\(body,conceptKey\)/);
 assert.match(script,/byId\('workspace'\)\.hidden=false/);
 assert.match(script,/views\.map\(\(name,i\)=>screenImage/);
 assert.match(html,/href="#execution"/);
});

test('non-executable illustrated screens render hostile customer text without markup injection',()=>{
 assert.match(script,/document\.createElementNS/);
 assert.match(script,/e\.textContent=text/);
 assert.doesNotMatch(script,/\.innerHTML\s*=/);
 assert.doesNotMatch(script,/URL\.createObjectURL|MZPrototype|downloadFile\(/);
 assert.doesNotMatch(html,/id="prototype"|download="|نزّل نموذجًا تفاعليًا/);
 assert.match(styles,/\.concept-visuals\{display:grid/);
 assert.match(styles,/@media\(max-width:650px\)/);
});

test('visual estimation does not falsely quote a binding amount or delivery time',()=>{
 assert.match(html,/تصور أولي قابل للمراجعة/);
 assert.match(html,/لا يوجد تشغيل حقيقي/);
 assert.doesNotMatch(html,/دفع الآن|ابدأ تنفيذ التطبيق/);
 const sandbox={};
 runInNewContext(read('pilot/lab/engine.js'),sandbox,{timeout:1000});
 const spec=sandbox.MZBuilderEngine.buildSpec(
  'أريد خدمة جديدة تساعد أصحاب المبادرات على متابعة كل أفكارهم بمرونة.',
  {title:'تصور جديد',features:['ميزة مبتكرة مختلفة تمامًا']});
 assert.equal(spec.features[0],'ميزة مبتكرة مختلفة تمامًا');
 assert.equal(spec.screens.length>=3,true);
 assert.equal(spec.steps.length,3);
});

test('consented intake stores idea and distinct optional reuse right, no fabricated receipt',()=>{
 assert.match(html,/type="checkbox" id="archive-consent" required/);
 assert.match(html,/type="checkbox" id="reuse-consent"/);
 assert.doesNotMatch(html,/id="reuse-consent"[^>]*checked/);
 assert.match(script,/sendIdea\(body,conceptKey\)/);
 assert.match(script,/reuse_permission:byId\('reuse-consent'\)\.checked/);
 assert.match(script,/data\?\.ok!==true/);
 assert.match(script,/conceptSignature/);
 assert.match(worker,/if\(data\.consent!=="yes"\)/);
 assert.match(worker,/INSERT INTO idea_requests/);
 assert.match(worker,/ON CONFLICT\(id\) DO NOTHING/);
 assert.match(worker,/origin!==url\.origin/);
});

test('tracking shows status only, never leaks private description',async()=>{
 for(const id of ['track','track-form','tracking-id','tracking-result']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(script,/\/api\/ideas\/\x27\+encodeURIComponent\(v\)/);
 assert.match(html,/id="tracking-result"[^>]*role="status"/);
 assert.doesNotMatch(script,/\.innerHTML\s*=/);
 const code=worker.replace('export default','const exported =')+'\nexport {exported};';
 const mod=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));
 const id='12345678-1234-4234-8234-123456789abc';
 let queried=null;
 const env={DB:{prepare(sql){queried=sql;return {bind(value){assert.equal(value,id);return {async first(){return {status:'reviewing',email:'private@example.invalid',idea:'private'};}}}}}}};
 const ok=await mod.exported.fetch(new Request('https://mzcodehub.com/api/ideas/'+id),env);
 assert.equal(ok.status,200);
 assert.deepEqual(await ok.json(),{ok:true,id,reference:'MZ-123456789ABC',status:'reviewing'});
 assert.equal(queried,'SELECT status FROM idea_requests WHERE id=?');
 const invalid=await mod.exported.fetch(new Request('https://mzcodehub.com/api/ideas/not-a-uuid'),env);
 assert.equal(invalid.status,400);
});
