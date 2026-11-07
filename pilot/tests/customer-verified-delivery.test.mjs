import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {localBinding,localEnvironment} from '../../skills-server/dev/local.mjs';
import skills from '../../skills-server/worker/index.mjs';
import {checks} from '../../skills-server/worker/catalog.mjs';
import {buildReviewedEdgeApp} from '../../skills-server/qa/reviewed-edge-builder.mjs';
import gateway from '../customer-gateway/worker.mjs';

const origin='https://mzcodehub.com', b64=()=>randomBytes(32).toString('base64url');
const sha=s=>createHash('sha256').update(s).digest('hex');
const sample=[
 {idea:'أريد قائمة مهام يومية على هذا الجهاز تحفظ مهامي وأتمكن من إضافتها وتعديلها',title:'مهام العميل الأول'},
 {idea:'أريد قائمة مشتريات للبقالة مع إضافة المنتجات وحفظها في المتصفح المحلي',title:'مشتريات العميل الثاني'}
];
async function setup(t){
 const sql=new DatabaseSync(':memory:'),ideas=new DatabaseSync(':memory:');
 sql.exec(await readFile(new URL('../customer-gateway/schema.sql',import.meta.url),'utf8'));
 ideas.exec("CREATE TABLE idea_requests (id TEXT PRIMARY KEY,email TEXT NOT NULL,status TEXT NOT NULL);");
 const skillsDb=await localEnvironment();
 t.after(()=>{sql.close();ideas.close();skillsDb.sqlite.close()});
 const mail=[];
 const env={GATEWAY_DB:localBinding(sql),IDEAS_DB:localBinding(ideas),
  GATEWAY_HMAC_KEY:b64(),GATEWAY_DATA_KEY:b64(),
  GATEWAY_ADMIN_SECRET:b64(),GATEWAY_ADMIN_ENABLED:'yes',
  TEST_MAILER:{async send(msg){mail.push(msg);return true}},
  SKILLS_SERVICE:{fetch:req=>skills.fetch(req,skillsDb.env)}};
 const call=async(path,body,extra={})=>{
  const req=new Request(origin+path,{
   method:body===undefined?'GET':'POST',
   headers:{...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'}),
     'CF-Connecting-IP':'192.0.2.11',...extra},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return gateway.fetch(req,env);
 };
 const owner=async(path,body)=>call('/api/customer/admin/'+path,body,{
  Authorization:'Bearer '+env.GATEWAY_ADMIN_SECRET});
 const skillCall=async(token,path,body)=>{
  const req=new Request('https://skills.internal/api/'+path,{
   method:body===undefined?'GET':'POST',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
    'Idempotency-Key':randomUUID()},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const resp=await skills.fetch(req,skillsDb.env);
  const value=await resp.json().catch(()=>({}));
  return {status:resp.status,value};
 };
 const created=await skillCall(skillsDb.owner,'releases',{
  id:'local-checklist',version:'1.0.0',name_ar:'منظم القوائم'});
 assert.equal(created.status,200);
 const review=(await skillCall(skillsDb.runner,'runner/claim',{})).value.job;
 assert.ok(review);
 assert.equal((await skillCall(skillsDb.runner,'runner/jobs/'+review.id+'/complete',{
  lease:review.lease,ok:true,checks})).status,200);
 assert.equal((await skillCall(skillsDb.owner,'skills/local-checklist/activate',{
  version:'1.0.0',revision:0})).status,200);
 async function addClient(index){
  const ideaId=randomUUID(),reference='MZ-'+ideaId.slice(0,8).toUpperCase()+ideaId.slice(-4).toUpperCase();
  const email='owner'+index+'@example.invalid';
  ideas.prepare('INSERT INTO idea_requests(id,email,status) VALUES(?,?,?)').run(ideaId,email,'building');
  const request=(await skillCall(skillsDb.owner,'requests',{
    skill_id:'local-checklist',input:sample[index],private_prototype_consent:true})).value;
  assert.ok(request.request_id);
  const build=await skillCall(request.request_token,'requests/'+request.request_id+'/runs',{});
  assert.equal(build.status,200);
  const job=(await skillCall(skillsDb.runner,'runner/claim',{})).value.job;
  assert.equal(job.id,build.value.id);
  const files=buildReviewedEdgeApp('local-checklist',sample[index]).files;
  assert.equal((await skillCall(skillsDb.runner,'runner/jobs/'+job.id+'/complete',
    {lease:job.lease,ok:true,files})).status,200);
  return {ideaId,reference,email,skillsId:request.request_id,
    runId:job.id,requestToken:request.request_token,files};
 }
 return {sql,ideas,skillsDb,env,mail,call,owner,addClient};
}
const link=c=>({reference:c.reference,skills_request_id:c.skillsId,skills_run_id:c.runId,request_token:c.requestToken});
async function prove(ctx,c){
 assert.equal((await ctx.call('/api/customer/verification/start',
  {reference:c.reference,email:c.email})).status,202);
 const msg=ctx.mail.at(-1);
 assert.deepEqual(msg.to,[c.email]);
 const code=msg.text.match(/MZcode: (\d{8})/)?.[1];
 assert.match(code||'',/^\d{8}$/);
 const response=await ctx.call('/api/customer/verification/confirm',
  {reference:c.reference,email:c.email,code});
 assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie');
 assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 assert.match(cookie,/Max-Age=1800/);
 assert.doesNotMatch(JSON.stringify(await response.json()),/\d{8}/);
 return cookie.split(';')[0];
}
test('verified recipient gets distinct encrypted ZIP from two real generated apps; cross-client access denied',async t=>{
 const ctx=await setup(t),a=await ctx.addClient(0),b=await ctx.addClient(1);
 assert.equal((await ctx.owner('link',link(a))).status,200);
 assert.equal((await ctx.owner('link',link(b))).status,200);
 assert.equal((await ctx.owner('link',link(a))).status,409);
 const row=ctx.sql.prepare('SELECT * FROM cv_deliveries WHERE idea_id=?').get(a.ideaId);
 assert.ok(row.request_token_cipher.includes('.'));
 assert.ok(!row.request_token_cipher.includes(a.requestToken));
 assert.throws(()=>ctx.sql.prepare("UPDATE cv_deliveries SET skills_run_id=? WHERE idea_id=?")
  .run(b.runId,a.ideaId),/delivery_binding_immutable/);
 const unverified=await ctx.call('/api/customer/requests/'+a.reference+'/artifact');
 assert.equal(unverified.status,404);
 const cookieA=await prove(ctx,a),cookieB=await prove(ctx,b);
 const aStatus=await ctx.call('/api/customer/requests/'+a.reference,undefined,{Cookie:cookieA});
 assert.deepEqual(await aStatus.json(),{ok:true,reference:a.reference,status:'building',delivery:'ready'});
 const ar=await ctx.call('/api/customer/requests/'+a.reference+'/artifact',undefined,{Cookie:cookieA});
 assert.equal(ar.status,200);
 assert.match(ar.headers.get('content-disposition'),/\.zip/);
 assert.match(ar.headers.get('cache-control'),/no-store/);
 const bytesA=Buffer.from(await ar.arrayBuffer());
 assert.equal(bytesA.readUInt32LE(0),0x04034b50);
 const br=await ctx.call('/api/customer/requests/'+b.reference+'/artifact',undefined,{Cookie:cookieB});
 assert.equal(br.status,200);
 const bytesB=Buffer.from(await br.arrayBuffer());
 assert.equal(bytesB.readUInt32LE(0),0x04034b50);
 assert.notDeepEqual(bytesA,bytesB);
 assert.equal((await ctx.call('/api/customer/requests/'+b.reference+'/artifact',undefined,
   {Cookie:cookieA})).status,404);
 assert.equal((await ctx.call('/api/customer/requests/'+a.reference+'/artifact',undefined,
   {Cookie:cookieB})).status,404);
 assert.equal((await ctx.owner('revoke',{reference:a.reference})).status,200);
 assert.equal((await ctx.call('/api/customer/requests/'+a.reference+'/artifact',undefined,
   {Cookie:cookieA})).status,404);
 assert.equal((await ctx.call('/api/customer/requests/'+b.reference+'/artifact',undefined,
   {Cookie:cookieB})).status,200);
 assert.throws(()=>ctx.sql.prepare("UPDATE cv_deliveries SET revoked_at=NULL WHERE idea_id=?").run(a.ideaId),
  /delivery_revocation_immutable/);
});
test('reference alone or unrelated mailbox cannot obtain OTP or private artifact',async t=>{
 const ctx=await setup(t),a=await ctx.addClient(0);
 const invalid=await ctx.call('/api/customer/verification/start',{
  reference:a.reference,email:'stranger@example.invalid'});
 assert.equal(invalid.status,202);
 assert.equal(ctx.mail.length,0);
 assert.equal((await ctx.call('/api/customer/verification/confirm',{
  reference:a.reference,email:'stranger@example.invalid',code:'12345678'})).status,401);
 const missing=await ctx.call('/api/customer/verification/start',{
  reference:'MZ-000000000000',email:a.email});
 assert.equal(missing.status,202);
 assert.equal(ctx.mail.length,0);
 assert.equal((await ctx.call('/api/customer/requests/'+a.reference)).status,404);
 assert.equal((await ctx.call('/api/customer/requests/'+a.reference+'/artifact')).status,404);
 assert.equal((await ctx.call('/api/customer/admin/link',link(a))).status,403);
 assert.equal((await ctx.owner('link',{...link(a),request_token:'r.'+b64()})).status,422);
});
test('one-time OTP has five-attempt limit; expired session cannot be reused',async t=>{
 const ctx=await setup(t),a=await ctx.addClient(0);
 assert.equal((await ctx.call('/api/customer/verification/start',
   {reference:a.reference,email:a.email})).status,202);
 const code=ctx.mail[0].text.match(/MZcode: (\d{8})/)[1];
 const row=ctx.sql.prepare('SELECT * FROM cv_challenges WHERE idea_id=?').get(a.ideaId);
 assert.match(row.code_hash,/^[0-9a-f]{64}$/);
 assert.ok(!JSON.stringify(row).includes(code));
 for(let i=0;i<5;i++)assert.equal((await ctx.call('/api/customer/verification/confirm',{
    reference:a.reference,email:a.email,code:'00000000'})).status,401);
 assert.equal((await ctx.call('/api/customer/verification/confirm',{
   reference:a.reference,email:a.email,code})).status,401);
 // Rotate the synthetic hour window to exercise a fresh challenge without a clock mock.
 ctx.sql.prepare("DELETE FROM cv_limits WHERE scope='start-idea'").run();
 assert.equal((await ctx.call('/api/customer/verification/start',
   {reference:a.reference,email:a.email})).status,202);
 const latest=ctx.mail.at(-1).text.match(/MZcode: (\d{8})/)[1];
 const confirmation=await ctx.call('/api/customer/verification/confirm',{
   reference:a.reference,email:a.email,code:latest});
 assert.equal(confirmation.status,200);
 const cookie=confirmation.headers.get('set-cookie').split(';')[0];
 assert.equal((await ctx.call('/api/customer/verification/confirm',{
   reference:a.reference,email:a.email,code:latest})).status,401);
 ctx.sql.prepare('UPDATE cv_sessions SET expires_at=0').run();
 assert.equal((await ctx.call('/api/customer/requests/'+a.reference,undefined,{Cookie:cookie})).status,404);
});
test('customer gateway rejects foreign origins, unapproved delivery links and absent service',async t=>{
 const ctx=await setup(t),a=await ctx.addClient(0);
 ctx.ideas.prepare("UPDATE idea_requests SET status='new' WHERE id=?").run(a.ideaId);
 assert.equal((await ctx.owner('link',link(a))).status,409);
 ctx.ideas.prepare("UPDATE idea_requests SET status='accepted' WHERE id=?").run(a.ideaId);
 const spoof=await ctx.call('/api/customer/verification/start',{reference:a.reference,email:a.email},
  {Origin:'https://attacker.invalid'});
 assert.equal(spoof.status,403);
 assert.equal(ctx.mail.length,0);
 ctx.env.SKILLS_SERVICE=null;
 assert.equal((await ctx.owner('link',link(a))).status,503);
 ctx.env.GATEWAY_HMAC_KEY='';
 assert.equal((await ctx.call('/api/customer/verification/start',
   {reference:a.reference,email:a.email})).status,503);
});
