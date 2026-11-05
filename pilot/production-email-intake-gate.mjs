// Single synthetic production delivery gate using *existing* validated email-required endpoint.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const origin='https://mzcodehub.com';
const key=randomUUID();
const body={idea:'[QA اختبار آلي — 5 نوفمبر 2026] أتأكد من استلام فكرة بسيطة برقم متابعة. هذا سجل اختبار إداري ولا يحتاج تنفيذًا أو تواصلًا أو تسعيرًا.',email:'info@mzcodehub.com',name:'',consent:'yes',website:''};
async function query(path,init={}){
 const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(16000),...init});
 const raw=await r.text();let data=null;try{data=JSON.parse(raw);}catch{}
 return {status:r.status,location:r.headers.get('location'),data};
}
const headers={'Content-Type':'application/json','Origin':origin,'Idempotency-Key':key};
const first=await query('/api/ideas',{method:'POST',headers,body:JSON.stringify(body)});
console.log('EMAIL_REQUIRED_GATE',JSON.stringify({status:first.status,error:first.data?.error,location:first.location?.split('?')[0]}));
assert.equal(first.status,201,'Production idea worker must accept a synthetic request with a valid email before release');
const reference=first.data?.reference;assert.match(reference||'',/^MZ-[A-F0-9]{12}$/);
console.log('SYNTHETIC_QA_REFERENCE',reference);
const replay=await query('/api/ideas',{method:'POST',headers,body:JSON.stringify(body)});
assert.equal(replay.status,200);assert.equal(replay.data?.reference,reference);
const status=await query('/api/ideas/'+encodeURIComponent(reference));
assert.equal(status.status,200);
assert.equal(status.data?.status,'new');
console.log('LIVE_EXISTING_WORKER_EMAIL_AND_STATUS_PASS',JSON.stringify({reference,status:status.data.status,receipt:first.data.receipt_email_status}));
