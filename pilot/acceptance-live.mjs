import assert from 'node:assert/strict';
const base = 'https://mzcodehub.com';
const ideaId = 'c27fb3ae-eaad-4bea-8eac-590ec8aa2026';
const contactId = '13df3b68-a9c9-4e36-bb28-7ab06fa62026';
const qaEmail = 'mzcode-acceptance-20261103@example.invalid';
const failures = [];
const steps = [];
async function check(name, fn) {
  try { await fn(); steps.push({name, status:'PASS'}); console.log('PASS', name); }
  catch(e) { failures.push({name, reason: e.message}); console.error('FAIL', name, e.message); }
}
async function req(path, init={}) {
  return fetch(base+path, {...init, redirect:'manual', signal:AbortSignal.timeout(20000)});
}
async function payload(path, obj, extra={}) {
  const r = await req(path, {method:'POST',headers:{Origin:base,'Content-Type':'application/json',...extra},body:JSON.stringify(obj)});
  return {status:r.status,data:await r.json()};
}
const idea={idea:'فحص قبول MZcode المؤقت بتاريخ ٣ نوفمبر ٢٠٢٦: تصميم تطبيق تجريبي لمراجعة التسجيل وحفظ الطلب مع إشعار إداري. هذه بيانات اختبار فقط.',email:qaEmail,name:'MZ QA Acceptance',consent:'yes',website:''};
const reply={mode:'quick',reply:qaEmail,message:'رسالة اختبار قبول آلية بتاريخ 2026-11-03 للتحقق من حفظ نموذج التواصل وعدم التكرار.',consent:true,requestId:contactId,website:''};
await check('public idea HTML + strict CSP',async()=>{
  const r=await req('/idea');assert.equal(r.status,200);const b=await r.text();assert.match(b,/id="live-preview"/);assert.match(r.headers.get('content-security-policy')||'',/script-src 'self'/);
});
await check('public quote route and Arabic UI',async()=>{const r=await req('/tools/quote/');assert.equal(r.status,200);const body=await r.text();assert.ok(body.includes('عرض سعر')||body.includes('عروض الأسعار'));});
await check('projects route',async()=>{const r=await req('/projects/');assert.equal(r.status,200)});
await check('idea GET disallowed',async()=>{const r=await req('/api/ideas');assert.equal(r.status,405)});
await check('idea cross-origin write rejected',async()=>{
  const r=await req('/api/ideas',{method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:'{}'});
  assert.equal(r.status,403);
});
await check('idea invalid consent rejected',async()=>{
  const v=await payload('/api/ideas',{...idea,consent:'no'},{'Idempotency-Key':ideaId});assert.equal(v.status,400);
});
await check('idea persisted and returned tracking ID',async()=>{
  const v=await payload('/api/ideas',idea,{'Idempotency-Key':ideaId});
  assert.ok([200,201].includes(v.status));assert.equal(v.data.ok,true);assert.equal(v.data.id,ideaId);
});
await check('idea same request idempotency',async()=>{
  const v=await payload('/api/ideas',idea,{'Idempotency-Key':ideaId});
  assert.equal(v.status,200);assert.equal(v.data.id,ideaId);
});
await check('idea same key conflicting payload rejected',async()=>{
  const v=await payload('/api/ideas',{...idea,idea:idea.idea+' مختلفة'},{'Idempotency-Key':ideaId});
  assert.equal(v.status,409);
});
let token='';
await check('contact form token',async()=>{
  const r=await req('/api/contact-token');assert.equal(r.status,200);
  const j=await r.json();assert.match(j.token,/^\d{13}\.[a-f0-9-]{36}\.[a-f0-9]{64}$/);token=j.token;
});
if(token){
 await check('contact message persisted with receipt',async()=>{
  const v=await payload('/api/contact',{...reply,token});assert.ok([200,201].includes(v.status));assert.equal(v.data.ok,true);assert.match(v.data.reference,/^MZ-/);
 });
 await check('contact replay gives same receipt',async()=>{
  const v=await payload('/api/contact',{...reply,token});assert.equal(v.status,200);assert.equal(v.data.ok,true);assert.match(v.data.reference,/^MZ-/);
 });
 await check('contact same request ID with changed content fails',async()=>{
  const v=await payload('/api/contact',{...reply,message:reply.message+' نسخة مختلفة',token});assert.equal(v.status,409);
 });
 await check('contact consent required',async()=>{
  const v=await payload('/api/contact',{...reply,requestId:'13df3b68-a9c9-4e36-bb28-7ab06fa62027',consent:false,token});assert.equal(v.status,400);
 });
}
await check('contact cross-origin denied',async()=>{
 const r=await req('/api/contact',{method:'POST',headers:{Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);
});
await check('admin JSON not accessible anonymously',async()=>{
 const r=await req('/api/admin/ideas');const ct=r.headers.get('content-type')||'';assert.ok(!(r.status===200&&ct.includes('application/json')),'Admin PII exposed');
});
console.log('QA_ACCEPTANCE_RESULT',JSON.stringify({date:'2026-11-03',ideaId,contactId,passed:steps.length,failed:failures.length,failures}));
if(failures.length)process.exitCode=1;
