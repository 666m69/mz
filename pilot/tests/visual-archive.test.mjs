import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ideas from '../../build/mz-ideas.mjs';

const origin='https://mzcodehub.com';
const idea='أريد منصة سعودية لتنسيق حجز الشاحنات والقلابات والمعدات مع تحديث حالة الطلب.';
const nonce='64e1984a-e451-4a4b-a30e-f6ce75cfbb01';
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const DB={prepare(query){const st=sql.prepare(query);return {
   bind(...args){return {run:()=>({success:true,meta:st.run(...args)}),
     first:()=>st.get(...args),all:()=>({results:st.all(...args)})}},
   all:()=>({results:st.all()}),
   first:()=>st.get()
 }}};
 const env={DB,HASH_SALT:'qa-only-hash-salt'};
 const base={idea,name:'',email:'',website:'',consent:'yes',idea_kind:'concept',reuse_permission:false};
 const post=(data=base,key=nonce)=>ideas.fetch(new Request(origin+'/api/ideas',{method:'POST',headers:{
   Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.22',
   'Idempotency-Key':key},body:JSON.stringify(data)}),env);
 return {sql,post,base,env};
}
test('consented visual concept is archived, private, and not licensed for product reuse by default',async()=>{
 const ctx=fixture();
 try{
   const res=await ctx.post();assert.equal(res.status,201);
   const saved=ctx.sql.prepare('SELECT idea,idea_kind,reuse_permission,email,concept_consent_version FROM idea_requests').get();
   assert.equal(saved.idea,idea);assert.equal(saved.idea_kind,'concept');assert.equal(saved.reuse_permission,0);
   assert.equal(saved.email,'');assert.equal(saved.concept_consent_version,'visual-v1-2026-11-08');
   const receipt=await res.json();assert.match(receipt.reference,/^MZ-[A-F0-9]{12}$/);
   const status=await ideas.fetch(new Request(origin+'/api/ideas/'+receipt.reference),ctx.env);
   const publicValue=await status.json();
   assert.deepEqual(publicValue,{ok:true,reference:receipt.reference,status:'new'});
   assert.equal(JSON.stringify(publicValue).includes(idea),false);
 }finally{ctx.sql.close()}
});
test('optional reuse consent is persisted explicitly and cannot be flipped by replay',async()=>{
 const ctx=fixture();
 try{
   const first=await ctx.post({...ctx.base,reuse_permission:true});
   assert.equal(first.status,201);
   assert.equal(ctx.sql.prepare('SELECT reuse_permission FROM idea_requests').get().reuse_permission,1);
   const replay=await ctx.post({...ctx.base,reuse_permission:true});
   assert.equal(replay.status,200);
   const changed=await ctx.post(ctx.base);
   assert.equal(changed.status,409);
   assert.equal(ctx.sql.prepare('SELECT COUNT(*) count FROM idea_requests').get().count,1);
 }finally{ctx.sql.close()}
});
test('saving idea without consent or with invalid kind is denied',async()=>{
 const ctx=fixture();
 try{
   for(const changes of [{consent:''},{reuse_permission:'yes'},{idea_kind:'hidden'},{idea_kind:'execution',reuse_permission:true}]){
     const r=await ctx.post({...ctx.base,...changes});
     assert.equal(r.status,400);
   }
   assert.equal(ctx.sql.prepare('SELECT COUNT(*) count FROM idea_requests').get().count,0);
 }finally{ctx.sql.close()}
});
test('legacy homepage intake remains a private execution request without implicit reuse rights',async()=>{
 const ctx=fixture();
 try{
   const {idea_kind,reuse_permission,...legacy}=ctx.base;
   const response=await ctx.post(legacy);
   assert.equal(response.status,201);
   const row=ctx.sql.prepare('SELECT idea_kind,reuse_permission FROM idea_requests').get();
   assert.equal(row.idea_kind,'execution');assert.equal(row.reuse_permission,0);
 }finally{ctx.sql.close()}
});
test('visitor flow is illustrated, saved first, and never exports a working app or ZIP',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../lab/lab.js',import.meta.url),'utf8');
 assert.match(html,/concept-visuals/);assert.match(html,/reuse-consent/);
 assert.match(js,/sendIdea\(body,conceptKey\)/);
 assert.match(js,/document\.createElementNS/);
 assert.doesNotMatch(html,/id="prototype"|MZPrototype|MZcode-prototype\.html|نزّل نموذجًا تفاعليًا/);
 assert.doesNotMatch(js,/URL\.createObjectURL|\.zip|\.download=/);
 const admin=readFileSync(new URL('../mz-ideas-admin-worker.js',import.meta.url),'utf8');
 assert.match(admin,/verifyAccess\(request\)/);
 assert.match(admin,/\/api\/admin\/archive/);
 assert.match(admin,/next_cursor/);
 const gateway=readFileSync(new URL('../customer-gateway/worker.mjs',import.meta.url),'utf8');
 assert.match(gateway,/agreement_required/);
 assert.match(gateway,/cv_delivery_agreements/);
});