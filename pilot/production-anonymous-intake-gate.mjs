// One explicitly synthetic production intake gate. No customer/private data.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const origin='https://mzcodehub.com';
const id=randomUUID();
const body={
  idea:'[QA — اختبار تقني 2026-11-05] أتأكد من استقبال طلبات الزوار بدون بريد إلكتروني في MZcode. هذا السجل اختبار ولا يحتاج تنفيذًا أو ردًا.',
  email:'',name:'',website:'',consent:'yes'
};
async function query(path,init={}){
  const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(18000),...init});
  const content=await r.text();
  let json;try{json=JSON.parse(content);}catch{}
  return {code:r.status,status:r.status,redirect:r.headers.get('location'),json};
}
const headers={'Content-Type':'application/json','Origin':origin,'Idempotency-Key':id};
const first=await query('/api/ideas',{method:'POST',headers,body:JSON.stringify(body)});
console.log('PRODUCTION_INTAKE_GATE',JSON.stringify({status:first.code,error:first.json?.error,redirect:first.redirect?.split('?')[0]}));
assert.equal(first.status,201,'Anonymous request acceptance is not live; do not publish the new form');
const ref=first.json?.reference;
assert.match(ref||'',/^MZ-[A-F0-9]{12}$/);
assert.equal(first.json?.receipt_email_status,'not_requested');
const repeated=await query('/api/ideas',{method:'POST',headers,body:JSON.stringify(body)});
assert.equal(repeated.code,200);assert.equal(repeated.json?.reference,ref);
const tracked=await query('/api/ideas/'+encodeURIComponent(ref));
assert.equal(tracked.status,200);
assert.equal(tracked.json?.status,'new');
console.log('PRODUCTION_ANONYMOUS_INTAKE_PASS',JSON.stringify({ref,tracking:tracked.json.status}));
