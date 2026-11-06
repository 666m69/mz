import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import app from '../../build/mz-ideas.mjs';

const origin='https://mzcodehub.com';
function fixture(){
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  const DB={prepare(query){return {bind(...args){
    const stmt=sql.prepare(query);return {
      run:()=>({success:true,meta:stmt.run(...args)}),
      first:()=>stmt.get(...args),
      all:()=>({results:stmt.all(...args)})
    };
  }}}};
  const env={DB,HASH_SALT:'test-only'};
  const key='bd7b2e37-4533-493a-847f-1b2ae3cb2909';
  const body={idea:'أحتاج أداة سعودية تسهل تحويل ملفات العمل وتجهيز الخطابات للمعلمين.',email:'',name:'',website:'',consent:'yes'};
  const post=(data=body,id=key)=>app.fetch(new Request(origin+'/api/ideas',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.33','Idempotency-Key':id},
    body:JSON.stringify(data)
  }),env);
  return {sql,env,post,body,key};
}
test('reference-only homepage request saves in the real ideas table with no fake contact',async()=>{
  const {sql,post,body}=fixture();
  const result=await post();
  assert.equal(result.status,201);
  const receipt=await result.json();
  assert.equal(receipt.ok,true);
  assert.match(receipt.reference,/^MZ-[A-F0-9]{12}$/);
  assert.equal(receipt.receipt_email_status,'not_requested');
  assert.ok(Number.isFinite(receipt.created_ms));
  const saved=sql.prepare('SELECT email,name,idea,status FROM idea_requests').get();
  assert.equal(saved.email,'');assert.equal(saved.name,'');
  assert.equal(saved.idea,body.idea);assert.equal(saved.status,'new');
});
test('an anonymous retry returns exact original receipt and does not save twice',async()=>{
  const {sql,post}=fixture();
  const first=await post();
  const a=await first.json();
  const second=await post();
  const b=await second.json();
  assert.equal(second.status,200);
  assert.equal(b.reference,a.reference);
  assert.equal(b.created_ms,a.created_ms);
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM idea_requests').get().count,1);
});
test('no consent, invalid email or honeypot text cannot save anything',async()=>{
  const {sql,post,body}=fixture();
  for(const invalid of [
    {...body,consent:''},
    {...body,email:'not-an-email'},
    {...body,website:'bot-data'},
    {...body,idea:'قصير'}
  ]) {
    const response=await post(invalid);
    assert.equal(response.status,400);
  }
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM idea_requests').get().count,0);
});
test('mismatched payload on the same idempotency key is refused',async()=>{
  const {sql,post,body}=fixture();
  assert.equal((await post()).status,201);
  assert.equal((await post({...body,idea:body.idea+' بزيادة'})).status,409);
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM idea_requests').get().count,1);
});
test('rendered homepage keeps approved MZ logo and adds Saudi entry',()=>{
  const homepage=readFileSync(new URL('../../site/index.html',import.meta.url),'utf8');
  assert.match(homepage,/ارررحب/);
  assert.match(homepage,/خلّ التقنية علينا/);
  assert.match(homepage,/عندك فكرة؟ خلّها تشتغل/);
  assert.match(homepage,/mz-quick-idea/);
  assert.match(homepage,/mz-intake-reference/);
  assert.match(homepage,/\/assets\/images\/mz-mark\.svg/);
  assert.match(homepage,/\/assets\/css\/refined\.css/);
  const theme=readFileSync(new URL('../../site/assets/css/saudi-entry.css',import.meta.url),'utf8');
  assert.match(theme,/saudi-greeting/);
  assert.match(theme,/#18b76b/);
  assert.match(homepage,/\/assets\/js\/saudi-intake\.js/);
  assert.match(homepage,/data-panel="book"/);
  assert.match(homepage,/data-panel="game"/);
});
test('browser intake displays a reference only after the backend confirms storage',()=>{
  const js=readFileSync(new URL('../../site/assets/js/saudi-intake.js',import.meta.url),'utf8');
  assert.match(js,/fetch\('\/api\/ideas'/);
  assert.match(js,/data\?\.ok!==true/);
  assert.match(js,/idempotency|Idempotency-Key/i);
  assert.doesNotMatch(js,/innerHTML\s*=/);
});

test('full Pages preview receives anonymous idea and returns persisted tracking reference',async()=>{
  const worker=(await import('../../build/worker.mjs')).default;
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  const DB={prepare(query){return {bind(...args){const st=sql.prepare(query);return {
    run:()=>({success:true,meta:st.run(...args)}),
    first:()=>st.get(...args),
    all:()=>({results:st.all(...args)})
  };}}}};
  const host='https://feat-saudi-home-intake-20261.mz702.pages.dev';
  const body={idea:'أحتاج أداة لمساعدة المعلمين في ترتيب سجلات المتابعة الشهرية.',email:'',name:'',consent:'yes',website:''};
  const req=new Request(host+'/api/ideas',{method:'POST',headers:{Origin:host,
    'Content-Type':'application/json','Idempotency-Key':'3b71de2e-34d5-439b-a4c9-5282cd2f9bb8',
    'CF-Connecting-IP':'198.51.100.33'},body:JSON.stringify(body)});
  const res=await worker.fetch(req,{DB,MZ_CONTACT_SECRET:'qa-unit-test'});
  assert.equal(res.status,201);
  const received=await res.json();
  assert.match(received.reference,/^MZ-[0-9A-F]{12}$/);
  assert.equal(sql.prepare('SELECT COUNT(*) as n FROM idea_requests').get().n,1);
  const status=await worker.fetch(new Request(host+'/api/ideas/'+received.reference),{DB,MZ_CONTACT_SECRET:'qa-unit-test'});
  assert.equal(status.status,200);
  assert.equal((await status.json()).status,'new');
  const blocked=await worker.fetch(new Request('https://mzcodehub.com/api/ideas',{
    method:'POST',headers:{Origin:'https://mzcodehub.com','Content-Type':'application/json'},
    body:JSON.stringify(body)}),{DB,MZ_CONTACT_SECRET:'qa-unit-test'});
  assert.equal(blocked.status,404,'the Pages bundle must not intercept the real production ideas route');
});
