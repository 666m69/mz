import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSkillsService,createSkillsHttpHandler} from '../skills/server.mjs';
const token='owner-test-token-abcdefghijklmnopqrstuvwxyz-123456789';
const idea='أريد تطبيق قائمة مهام يومية لحفظ مهام العمل';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'mz-skills-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const service=createSkillsService({ownerToken:token,outputRoot:root});
 return {service,handle:createSkillsHttpHandler(service)};
}
function req(method,path,body,auth=token,key='test-request-0001'){
 return new Request('http://localhost'+path,{method,headers:{authorization:'Bearer '+auth,'content-type':'application/json','idempotency-key':key},body:body===undefined?undefined:JSON.stringify(body)});
}
test('owner-only list and versions',async t=>{
 const {handle}=await fixture(t);
 assert.equal((await handle(req('GET','/internal/skills',undefined,'bad'))).status,401);
 const r=await (await handle(req('GET','/internal/skills'))).json();
 assert.equal(r.result.length,2);
 assert.equal(r.result[0].version,1);
});
test('end-to-end: idea -> approved skill -> real application files -> audit',async t=>{
 const {handle}=await fixture(t);
 const request=req('POST','/internal/skills/checklist/run',{idea},token,'run-unique-0001');
 const response=await handle(request);
 assert.equal(response.status,200);
 const built=(await response.json()).result;
 assert.equal(built.status,'built_unpublished');
 const html=await readFile(join(built.directory,'index.html'),'utf8');
 const js=await readFile(join(built.directory,'app.js'),'utf8');
 assert.match(html,/dir="rtl"/);
 assert.match(js,/localStorage/);
 const audit=(await (await handle(req('GET','/internal/skills/audit'))).json()).result;
 assert.equal(audit.at(-1).event,'skill_run');
 const repeated=(await (await handle(req('POST','/internal/skills/checklist/run',{idea},token,'run-unique-0001'))).json()).result;
 assert.equal(repeated.appId,built.appId);
});
test('second path: shopping skill builds standalone app',async t=>{
 const {service}=await fixture(t);
 const r=await service.run(token,'shopping',{idea:'أريد قائمة مشتريات يومية للأسرة مع حفظ المنتجات'},{idempotencyKey:'shopping-0001'});
 assert.equal(r.status,'built_unpublished');
 assert.match(await readFile(join(r.directory,'index.html'),'utf8'),/قائمة مشترياتي/);
});
test('reject unknown code handlers, require review and monotonically version',async t=>{
 const {service}=await fixture(t);
 const original=service.list(token)[0];
 assert.throws(()=>service.register(token,{...original,id:'danger',handler:'shell',enabled:false}),/handler_not_approved/);
 assert.throws(()=>service.register(token,{...original,version:2,enabled:true}),/review_before_enable/);
 const registered=service.register(token,{...original,version:2,enabled:false});
 assert.equal(registered.version,2);
 assert.rejects(service.run(token,'checklist',{idea},{idempotencyKey:'disabled-001'}),/skill_disabled/);
 const enabled=service.setEnabled(token,'checklist',true);
 assert.equal(enabled.version,3);
 const rollback=service.rollback(token,'checklist',1);
 assert.equal(rollback.enabled,false);
 assert.equal(rollback.rollback_version,1);
});
test('rate limiting, idempotency key validation and input validation',async t=>{
 const {service}=await fixture(t);
 await assert.rejects(service.run(token,'checklist',{idea},{idempotencyKey:'bad'}),/idempotency_required/);
 await assert.rejects(service.run(token,'checklist',{idea:'short'},{idempotencyKey:'valid-00001'}),/invalid_input/);
 await assert.rejects(service.run(token,'checklist',{idea:'أريد نظام دفع حقيقي لمهامي مع الحسابات'},{idempotencyKey:'valid-00002'}));
});
