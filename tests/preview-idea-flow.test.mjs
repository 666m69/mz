import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../build/worker.mjs';

const origin='https://feat-services-guide-isolated.mz702.pages.dev';
const paths=['/idea/','/idea/lab.js','/idea/lab.css','/idea/engine.js','/idea/prototype.js','/idea/demo/'];
function previewEnv(enabled=true){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../pilot/schema.sql',import.meta.url),'utf8'));
 const env={
  MZ_QA_INTAKE_ENABLED:enabled?'yes':undefined,
  MZ_CONTACT_SECRET:'M07-local-synthetic-salt',
  DB:{prepare(sql){return {bind(...args){const stmt=db.prepare(sql);return {
   run(){return {success:true,meta:{changes:stmt.run(...args).changes}}},
   first(){return stmt.get(...args)||null},
   all(){return {results:stmt.all(...args)}}
  }}}}}
 };
 return {db,env};
}
test('preview main page links to the services guide; /idea never leaves QA origin',async()=>{
 const res=await worker.fetch(new Request(origin+'/'),{});
 assert.equal(res.status,200);
 assert.match(await res.text(),/href="\/services\/"/);
 const page=await worker.fetch(new Request(origin+'/services/'),{});
 assert.equal(page.status,200);assert.match(await page.text(),/service=social/);
 const redirect=await worker.fetch(new Request(origin+'/idea?service=teachers'),{});
 assert.equal(redirect.status,308);
 assert.equal(redirect.headers.get('location'),origin+'/idea/?service=teachers');
});
test('all preview request form assets load from bundled QA site',async()=>{
 for(const p of paths){
  const res=await worker.fetch(new Request(origin+p),{});
  assert.equal(res.status,200,p);
  assert.ok((await res.text()).length>200,p);
 }
 const form=await (await worker.fetch(new Request(origin+'/idea/'),{})).text();
 assert.match(form,/id="intake"/);
 const script=await (await worker.fetch(new Request(origin+'/idea/lab.js'),{})).text();
 assert.match(script,/selectedService/);
});
test('preview intake is disabled without explicit QA flag and never enabled in production',async()=>{
 const {env}=previewEnv(false);
 const res=await worker.fetch(new Request(origin+'/api/ideas',{method:'POST'}),env);
 assert.equal(res.status,404);
 const prod=await worker.fetch(new Request('https://mzcodehub.com/api/ideas',{method:'POST'}),{...env,MZ_QA_INTAKE_ENABLED:'yes'});
 assert.equal(prod.status,404);
 const old=await worker.fetch(new Request('https://mz702.pages.dev/idea'),env);
 assert.equal(old.status,302);
});
test('real preview worker stores category, echoes reference and blocks tampered replay',async()=>{
 const {db,env}=previewEnv();
 const id='89aba6cf-1788-4b15-af33-2d131be0a9b1';
 const idea='[نوع الخدمة: التعليم]\nأريد ورقة عمل تجريبية لدرس العلوم للصف الخامس ضمن اختبار محلي';
 const headers={'Content-Type':'application/json','Origin':origin,'Idempotency-Key':id};
 const payload={idea,email:'',name:'QA M07',consent:'yes',website:''};
 const req=(obj=payload)=>new Request(origin+'/api/ideas',{method:'POST',headers,body:JSON.stringify(obj)});
 const a=await worker.fetch(req(),env);assert.equal(a.status,201);const first=await a.json();
 assert.match(first.reference,/^MZ-[A-F0-9]{12}$/);
 const row=db.prepare('SELECT idea, status FROM idea_requests WHERE id=?').get(id);
 assert.equal(row.idea,idea);assert.equal(row.status,'new');
 const replay=await worker.fetch(req(),env);assert.equal(replay.status,200);
 assert.equal((await replay.json()).reference,first.reference);
 const track=await worker.fetch(new Request(origin+'/api/ideas/'+first.reference),env);
 assert.equal(track.status,200);assert.equal((await track.json()).status,'new');
 const bad=await worker.fetch(req({...payload,idea:idea+' tamper'}),env);
 assert.equal(bad.status,409);
 db.close();
});
