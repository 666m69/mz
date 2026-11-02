import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const worker=existsSync(new URL('../site/_worker.js',import.meta.url))?(await import('../site/_worker.js')).default:{fetch:async()=>new Response('<html>Home</html>')};
const origin='https://mz702.pages.dev';
function setup(){
 const db=new DatabaseSync(':memory:');
 if(existsSync(new URL('../migration.sql',import.meta.url)))db.exec(readFileSync(new URL('../migration.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../interest-migration.sql',import.meta.url),'utf8'));
 const env={MZ_CONTACT_SECRET:'unit-test-secret-long-enough-12345',DB:{prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args),run:async()=>({success:true,meta:db.prepare(sql).run(...args)})}}}}},ASSETS:{fetch:async()=>new Response('asset')}};
 const call=(path,method='GET',body,headers={})=>worker.fetch(new Request(origin+path,{method,headers:{origin,'content-type':'application/json','CF-Connecting-IP':'192.0.2.1',...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),env);
 return {db,env,call};
}
async function valid(s){const r=await s.call('/api/contact-token');assert.equal(r.status,200);const {token}=await r.json();return {token,requestId:crypto.randomUUID(),name:'اختبار الموقع',phone:'0501234567',email:'',service:'استشارة أخرى',message:'هذا اختبار داخلي لمسار طلب المشروع.',consent:true,website:''};}
test('public administration is denied',async()=>{for(const p of ['/admin','/admin.html','/admin/','/assets/js/admin.js','/api/admin'])assert.equal((await setup().call(p)).status,403,p)});
test('unknown API is not a successful homepage',async()=>assert.equal((await setup().call('/api/unknown')).status,404));
test('missing server configuration fails closed',async()=>{const s=setup();delete s.env.MZ_CONTACT_SECRET;assert.equal((await s.call('/api/contact-token')).status,503)});
test('successful response corresponds to a durable stored request',async()=>{const s=setup(),b=await valid(s),r=await s.call('/api/contact','POST',b);assert.equal(r.status,201);const j=await r.json();assert.match(j.reference,/^MZ-/);const row=s.db.prepare('SELECT * FROM mz_contact_requests').get();assert.equal(row.reference,j.reference);assert.equal(row.phone,'+966501234567');assert.equal(row.message,b.message);assert.equal(row.status,'new');});
test('repeat submission stores only one row and same receipt',async()=>{const s=setup(),b=await valid(s);const a=await(await s.call('/api/contact','POST',b)).json(),r=await s.call('/api/contact','POST',b);assert.equal(r.status,200);assert.equal((await r.json()).reference,a.reference);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM mz_contact_requests').get().n,1)});
test('reusing request ID with changed content is rejected',async()=>{const s=setup(),b=await valid(s);await s.call('/api/contact','POST',b);b.message='different request content';assert.equal((await s.call('/api/contact','POST',b)).status,409)});
for(const [name,patch]of [['missing consent',{consent:false}],['invalid phone',{phone:'abc'}],['blank name',{name:' '}],['oversized message',{message:'a'.repeat(4001)}],['invalid email',{email:'not-mail'}],['honeypot',{website:'spam'}],['unknown service',{service:'arbitrary'}]])test('rejects '+name,async()=>{const s=setup(),b=await valid(s);assert.equal((await s.call('/api/contact','POST',{...b,...patch})).status,400);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM mz_contact_requests').get().n,0)});
test('cross-origin requests are blocked',async()=>{const s=setup(),b=await valid(s);assert.equal((await s.call('/api/contact','POST',b,{origin:'https://evil.example'})).status,403)});
test('forged form token cannot submit',async()=>{const s=setup(),b=await valid(s);b.token+='x';assert.equal((await s.call('/api/contact','POST',b)).status,403)});
test('malformed JSON and oversized bodies fail cleanly',async()=>{const s=setup();assert.equal((await s.call('/api/contact','POST','{')).status,400);assert.equal((await s.call('/api/contact','POST','x'.repeat(17000))).status,413)});
test('GET cannot expose submissions',async()=>assert.equal((await setup().call('/api/contact')).status,405));
test('rate limit prevents a sixth distinct request',async()=>{const s=setup(),b=await valid(s);for(let i=0;i<5;i++)assert.equal((await s.call('/api/contact','POST',{...b,requestId:crypto.randomUUID()})).status,201);assert.equal((await s.call('/api/contact','POST',{...b,requestId:crypto.randomUUID()})).status,429)});
test('database failure is not reported as success',async()=>{const s=setup(),b=await valid(s);s.env.DB={prepare(){throw Error('private db error')}};const r=await s.call('/api/contact','POST',b);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private db error/)});
test('Arabic phone digits are normalized',async()=>{const s=setup(),b=await valid(s);b.phone='٠٥٠١٢٣٤٥٦٧';assert.equal((await s.call('/api/contact','POST',b)).status,201);assert.equal(s.db.prepare('SELECT phone FROM mz_contact_requests').get().phone,'+966501234567')});
test('extensionless policy URL does not loop through asset canonical redirect',async()=>{const s=setup();s.env.ASSETS={fetch:async req=>new URL(req.url).pathname.endsWith('.html')?Response.redirect(origin+'/privacy',308):new Response('سياسة الخصوصية')};const r=await s.call('/privacy');assert.equal(r.status,200);assert.equal(await r.text(),'سياسة الخصوصية')});

async function quick(s,reply='visitor@example.com'){const b=await valid(s);return {mode:'quick',token:b.token,requestId:b.requestId,message:b.message,reply,consent:true,website:''}}
test('two-field contact persists email without requiring name or phone',async()=>{const s=setup(),b=await quick(s);assert.equal((await s.call('/api/contact','POST',b)).status,201);const row=s.db.prepare('SELECT * FROM mz_contact_requests').get();assert.equal(row.email,b.reply);assert.equal(row.phone,'');assert.equal(row.name,'زائر الموقع');assert.equal(row.consent_version,'2026-10-31-quick')});
test('two-field contact accepts Arabic Saudi mobile without email',async()=>{const s=setup();assert.equal((await s.call('/api/contact','POST',await quick(s,'٠٥٠١٢٣٤٥٦٧'))).status,201);const row=s.db.prepare('SELECT * FROM mz_contact_requests').get();assert.equal(row.phone,'+966501234567');assert.equal(row.email,'')});
test('two-field contact rejects unusable replies and malicious shapes',async()=>{for(const reply of ['',null,{},'abc','a@b','+966123456789','1234','a'.repeat(255)]){const s=setup();assert.equal((await s.call('/api/contact','POST',await quick(s,reply))).status,400,String(reply));assert.equal(s.db.prepare('SELECT COUNT(*) n FROM mz_contact_requests').get().n,0)}});
test('two-field contact retains duplicate protection and changed-content conflict',async()=>{const s=setup(),b=await quick(s);const first=await(await s.call('/api/contact','POST',b)).json();const retry=await s.call('/api/contact','POST',b);assert.equal(retry.status,200);assert.equal((await retry.json()).reference,first.reference);assert.equal((await s.call('/api/contact','POST',{...b,reply:'other@example.com'})).status,409);assert.equal(s.db.prepare('SELECT COUNT(*) n FROM mz_contact_requests').get().n,1)});
test('two-field contact keeps consent spam origin and token checks',async()=>{const s=setup(),b=await quick(s);for(const patch of [{consent:false},{website:'bot'},{message:'short'},{mode:'unknown'}])assert.equal((await s.call('/api/contact','POST',{...b,...patch})).status,400);assert.equal((await s.call('/api/contact','POST',{...b,token:'forged'})).status,403);assert.equal((await s.call('/api/contact','POST',b,{origin:'https://evil.example'})).status,403)});
test('two-field contact rate limit still stops sixth message',async()=>{const s=setup(),b=await quick(s);for(let i=0;i<5;i++)assert.equal((await s.call('/api/contact','POST',{...b,requestId:crypto.randomUUID()})).status,201);assert.equal((await s.call('/api/contact','POST',{...b,requestId:crypto.randomUUID()})).status,429)});

test('edge signatures isolate visitor quotas and reject forged forwarding headers', async () => {
 const gateway = (await import('../pilot/mzcodehub-public-entry-with-idea-cta.mjs')).default;
 const keys = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'}, true, ['sign','verify']);
 const base64 = buffer => Buffer.from(buffer).toString('base64');
 const s = setup();
 s.env.MZ_EDGE_PUBLIC_KEY = base64(await crypto.subtle.exportKey('spki',keys.publicKey));
 const env = {MZ_EDGE_SIGNING_KEY:base64(await crypto.subtle.exportKey('pkcs8',keys.privateKey))};
 const body = await quick(s);
 const spoof = {'X-MZ-Visitor':'192.0.2.20','X-MZ-Time':String(Date.now()),'X-MZ-Proof':Buffer.alloc(64).toString('base64')};
 assert.equal((await s.call('/api/contact','POST',body,spoof)).status,403);
 const edgeOrigin = 'https://mzcodehub.com';
 const previousFetch = globalThis.fetch;
 try {
  globalThis.fetch = (url, init) => {
   assert.equal(url.origin, origin);
   const headers = new Headers(init.headers);
   headers.set('CF-Connecting-IP','2a06:98c0:3600::103');
   return worker.fetch(new Request(url,{...init,headers,duplex:'half'}),s.env);
  };
  const submit = (ip, originHeader = edgeOrigin) => gateway.fetch(new Request(edgeOrigin+'/api/contact',{
   method:'POST',headers:{...spoof,origin:originHeader,'content-type':'application/json','CF-Connecting-IP':ip},
   body:JSON.stringify({...body,requestId:crypto.randomUUID()})
  }),env);
  assert.equal((await submit('192.0.2.1','https://example.org')).status,403);
  for (let i=0;i<5;i++) assert.equal((await submit('192.0.2.1')).status,201);
  assert.equal((await submit('192.0.2.1')).status,429);
  assert.equal((await submit('192.0.2.2')).status,201);
 } finally {
  globalThis.fetch = previousFetch;
 }
});

test('legacy pages lead to existing visitor sections', async () => {
 const s = setup();
 for(const [path,target] of [['/about.html','/about/'],['/projects','/projects/'],['/services.html','/#pricing'],['/contact','/#contact']]) {
  assert.equal((await s.call(path)).headers.get('Location'),origin+target);
 }
});
test('contact cleanup preserves the active hourly menu quota', async t => {
 t.mock.timers.enable({apis:['Date'], now:Date.UTC(2026,10,1,10,45)});
 const s = setup();
 const start = Date.UTC(2026,10,1,10);
 s.db.prepare('INSERT INTO mz_contact_rate VALUES(?,?,?)').run('menu-limit',start,3);
 assert.equal((await s.call('/api/contact','POST',await quick(s))).status,201);
 assert.equal(s.db.prepare('SELECT count FROM mz_contact_rate WHERE ip_hash=?').get('menu-limit').count,3);
});

test('CoreResto confirms durable consent and deduplicates normalized phones',async()=>{
 const s=setup(), {token}=await valid(s), body={mode:'coreresto',token,name:'اسم تجريبي',phone:'٠٥٠١٢٣٤٥٦٧',activity:'كافيه',branches:'٢',consent:true};
 for(const phone of [body.phone,'+966501234567']){
  const response=await s.call('/api/contact','POST',{...body,phone});
  assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
 }
 const rows=s.db.prepare('SELECT * FROM mz_coreresto_waitlist').all();
 assert.equal(rows.length,1);assert.equal(rows[0].phone,'+966501234567');assert.equal(rows[0].branches,2);
 assert.equal(rows[0].consent_version,'2026-11-02');
 for(const patch of [{activity:'آخر'},{branches:0},{branches:'1.5'},{phone:'05xx'},{name:' '},{consent:false},{website:'bot'}]){
  assert.equal((await s.call('/api/contact','POST',{...body,...patch})).status,400);
 }
 assert.equal((await s.call('/api/contact','POST',body,{origin:'https://example.org'})).status,403);
 assert.equal((await s.call('/api/contact','POST',{...body,token:'no'})).status,403);
});
test('interest list uses one row per address and tool, separately from CoreResto',async()=>{
 const s=setup(), {token}=await valid(s), body={mode:'tools',token,email:'Sample@Example.org',tool:'quote',consent:true};
 for(const tool of ['quote','quote','menu'])assert.equal((await s.call('/api/contact','POST',{...body,tool})).status,200);
 assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM mz_tool_interest WHERE email=?').get('sample@example.org').n,2);
 assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM mz_coreresto_waitlist').get().n,0);
 for(const patch of [{email:'bad'},{tool:'games'},{consent:false}])assert.equal((await s.call('/api/contact','POST',{...body,...patch})).status,400);
 s.db.exec('DROP TABLE mz_tool_interest');
 assert.equal((await s.call('/api/contact','POST',body)).status,503);
});
test('the interest form is rate limited without creating excess rows',async()=>{
 const s=setup(),{token}=await valid(s);
 for(let i=0;i<6;i++){
  const r=await s.call('/api/contact','POST',{mode:'tools',token,tool:'quote',email:'test'+i+'@example.org',consent:true});
  assert.equal(r.status,i===5?429:200);
 }
 assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM mz_tool_interest').get().n,5);
});
