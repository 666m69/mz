import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../mz-ideas-worker.js',import.meta.url),'utf8');
const moduleCode=source.replace('export default','const worker =')+'\nexport {worker};';
const {worker}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(moduleCode));
const origin='https://mzcodehub.com';
const key='12345678-1234-4234-8234-123456789abc';
const reference='MZ-123456789ABC';

function mockDb(){
 let saved=null,events=[];
 return {
  events,
  get saved(){return saved},
  prepare(sql){
   return {
    bind(...params){
     return {
      async run(){
       events.push({sql,params});
       if(sql.includes('INSERT INTO idea_requests')){
        if(saved)return {success:true,meta:{changes:0}};
        saved={id:params[0],idea:params[1],email:params[2],name:params[3],created_ms:params[5],idea_kind:params[6],reuse_permission:params[7],receipt_email_status:'pending_setup',status:'new'};
        return {success:true,meta:{changes:1}};
       }
       if(sql.includes('receipt_email_status=?'))saved.receipt_email_status=params[0];
       return {success:true,meta:{changes:1}};
      },
      async first(){
       if(sql.includes('SELECT idea,email,name'))return saved;
       if(sql.includes('SELECT status FROM idea_requests WHERE id='))return saved?{status:saved.status}:null;
       throw Error('Unexpected first '+sql);
      },
      async all(){
       if(sql.includes('substr(id,1,8)'))return {results:saved?[{status:saved.status}]:[]};
       throw Error('Unexpected all '+sql);
      }
     };
    }
   };
  }
 };
}

function request(){
 return new Request(origin+'/api/ideas',{
  method:'POST',
  headers:{'Origin':origin,'Content-Type':'application/json','Idempotency-Key':key,'CF-Connecting-IP':'198.51.100.12'},
  body:JSON.stringify({idea:'أرغب في منصة مبتكرة لإدارة الحجوزات الخاصة بالأعمال الصغيرة.',name:'عميل تجريبي',email:'client@example.invalid',consent:'yes'})
 });
}

test('customer receives friendly reference; provider-accepted Arabic receipt is not duplicated on replay',async()=>{
 const db=mockDb(),admin=[],outgoing=[];
 const old=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  outgoing.push({url,options});
  return new Response(JSON.stringify({id:'receipt-provider-123'}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const env={DB:db,HASH_SALT:'testing-only',NOTIFY_TO:'owner@example.invalid',
   NOTIFY:{send:async msg=>admin.push(msg)},RESEND_API_KEY:'test-key'};
  const first=await worker.fetch(request(),env);
  assert.equal(first.status,201);
  const data=await first.json();
  assert.equal(data.reference,reference);
  assert.equal(data.receipt_email_status,'accepted');
  assert.ok(Number.isFinite(data.created_ms));
  assert.equal(admin.length,1);
  assert.equal(outgoing.length,1);
  const payload=JSON.parse(outgoing[0].options.body);
  assert.equal(payload.from,'MZcode Hub <info@mzcodehub.com>');
  assert.deepEqual(payload.to,['client@example.invalid']);
  assert.match(payload.text,/رقم الطلب: MZ-123456789ABC/);
  assert.match(payload.text,/تاريخ الاستلام:/);
  assert.match(payload.text,/تفاصيل الطلب:/);
  assert.equal(outgoing[0].options.headers['Idempotency-Key'],'mzcode-receipt-'+key);
  assert.equal(db.saved.receipt_email_status,'accepted');
  const replay=await worker.fetch(request(),env);
  assert.equal(replay.status,200);
  assert.equal((await replay.json()).reference,reference);
  assert.equal(outgoing.length,1,'No duplicate customer email');
  assert.equal(admin.length,1,'No duplicate owner email');
  const found=await worker.fetch(new Request(origin+'/api/ideas/'+reference),env);
  assert.equal(found.status,200);
  assert.deepEqual(await found.json(),{ok:true,reference,status:'new'});
  assert.equal((await worker.fetch(new Request(origin+'/api/ideas/nope'),env)).status,400);
 }finally{globalThis.fetch=old}
});

test('missing customer-mail provider fails open for lead saving but never misrepresents email delivery',async()=>{
 const db=mockDb();
 const result=await worker.fetch(request(),{DB:db,HASH_SALT:'test-only'});
 assert.equal(result.status,201);
 const data=await result.json();
 assert.equal(data.receipt_email_status,'pending_setup');
 assert.equal(data.reference,reference);
 assert.equal(db.saved.receipt_email_status,'pending_setup');
});

test('provider refusal records failure independently from admin notifications and still saves the lead',async()=>{
 const db=mockDb(),old=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({message:'Invalid domain'}),{status:403});
 try{
  const r=await worker.fetch(request(),{DB:db,HASH_SALT:'test-only',RESEND_API_KEY:'wrong-key'});
  assert.equal(r.status,201);
  assert.equal((await r.json()).receipt_email_status,'failed');
  assert.equal(db.saved.receipt_email_status,'failed');
 }finally{globalThis.fetch=old}
});
