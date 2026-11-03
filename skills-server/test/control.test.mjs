import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localEnvironment} from '../dev/local.mjs';
import worker from '../worker/index.mjs';
import {checks} from '../worker/catalog.mjs';
const key=()=>randomUUID();
const release={id:'local-checklist',version:'1.0.0',name_ar:'منظم القوائم'};
const input={skill_id:'local-checklist',input:{idea:'أريد قائمة مهام يومية للاستخدام على جهازي فقط'},private_prototype_consent:true};
async function setup(t){
  const c=await localEnvironment();t.after(()=>c.sqlite.close());
  const call=async(token,path,body,k=key(),extra={})=>{
    const h={'Authorization':'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':k,...extra};
    const req=new Request('https://skills.test/api/'+path,{method:body===undefined?'GET':'POST',headers:h,
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    const r=await worker.fetch(req,c.env);return {s:r.status,b:await r.json()};
  };
  const add=async(v='1.0.0')=>(await call(c.owner,'releases',{...release,version:v})).b;
  const testRelease=async(v='1.0.0')=>{
    await add(v);const {job}=(await call(c.runner,'runner/claim',{})).b;
    assert.ok(job);return call(c.runner,'runner/jobs/'+job.id+'/complete',{lease:job.lease,ok:true,checks});
  };
  const enable=async()=>{await testRelease();assert.equal((await call(c.owner,'skills/local-checklist/activate',{version:'1.0.0',revision:0})).s,200);};
  return {...c,call,add,testRelease,enable};
}
test('unknown adapters, executable manifests and self-asserted test status are rejected',async t=>{
  const {owner,call}=await setup(t);
  for(const b of [{...release,id:'__proto__'},{...release,script:'alert(1)'},{...release,test_status:'passed'},{...release,version:'latest'}])
    assert.equal((await call(owner,'releases',b)).s,422);
});
test('review, activation, stale administrator decisions, disable and tested rollback',async t=>{
  const {owner,runner,call,add,testRelease}=await setup(t);
  const r=await add();assert.equal((await call(owner,'skills/local-checklist/activate',{version:'1.0.0',revision:0})).s,409);
  assert.equal((await call(runner,'skills/local-checklist/activate',{version:'1.0.0',revision:0})).s,403);
  const {job}=(await call(runner,'runner/claim',{})).b;assert.equal(job.id,r.test_job);
  assert.equal((await call(runner,'runner/jobs/'+job.id+'/complete',{lease:job.lease,ok:true,checks:[]})).s,422);
  await call(runner,'runner/jobs/'+job.id+'/complete',{lease:job.lease,ok:true,checks});
  const cmd=(op,b)=>call(owner,'skills/local-checklist/'+op,b);
  assert.equal((await cmd('activate',{version:'1.0.0',revision:0})).s,200);
  await testRelease('1.1.0');
  assert.equal((await cmd('activate',{version:'1.1.0',revision:0})).s,409);
  await cmd('activate',{version:'1.1.0',revision:1}); await cmd('disable',{revision:2});
  assert.equal((await cmd('rollback',{version:'1.1.0',revision:3})).s,409);
  await cmd('rollback',{version:'1.0.0',revision:3});
  const s=(await call(owner,'skills')).b.skills[0];assert.equal(s.active_version,'1.0.0');assert.equal(s.enabled,true);
  assert.equal(s.rollback_version,'1.1.0');assert.equal(s.versions.length,2);
});
test('cross-request reads and writes are concealed, actor cannot administer, secret input encrypted',async t=>{
  const {owner,runner,sqlite,call,enable}=await setup(t);await enable();
  const a=(await call(owner,'requests',input)).b,b=(await call(owner,'requests',input)).b;
  assert.equal((await call(a.request_token,'requests/'+b.request_id)).s,404);
  assert.equal((await call(a.request_token,'requests/'+b.request_id+'/runs',{})).s,404);
  assert.equal((await call(a.request_token,'skills')).s,403);
  assert.equal((await call(a.request_token,'runner/claim',{})).s,403);
  assert.equal((await call(runner,'requests/'+a.request_id)).s,403);
  const j=(await call(a.request_token,'requests/'+a.request_id+'/runs',{})).b;
  assert.equal((await call(b.request_token,'requests/'+b.request_id+'/runs/'+j.id)).s,404);
  assert.equal((await call(b.request_token,'requests/'+a.request_id+'/runs/'+j.id+'/artifact')).s,404);
  assert.equal((await call(owner,'requests',{...input,private_prototype_consent:false})).s,422);
  assert.equal((await call(owner,'requests',{...input,price:250})).s,422);
  assert.ok(!sqlite.prepare('SELECT input_cipher FROM ss_requests LIMIT 1').get().input_cipher.includes('مهام'));
  assert.ok(!JSON.stringify(sqlite.prepare('SELECT * FROM ss_audit').all()).includes(input.input.idea));
});
test('idempotent intake and concurrent build retries preserve one operation; payload substitution rejected',async t=>{
  const {owner,sqlite,call,enable}=await setup(t);await enable();const k=key();
  const [a,b]=await Promise.all([call(owner,'requests',input,k),call(owner,'requests',input,k)]);
  assert.deepEqual(a.b,b.b);assert.equal(a.s,200);
  assert.equal((await call(owner,'requests',{...input,input:{idea:'أريد مهمة مختلفة تماما للاختبار اليوم'}},k)).s,409);
  const path='requests/'+a.b.request_id+'/runs',rkey=key();
  const runs=await Promise.all(Array.from({length:4},()=>call(a.b.request_token,path,{},rkey)));
  assert.ok(runs.every(r=>r.s===200&&r.b.id===runs[0].b.id));
  assert.equal(sqlite.prepare("SELECT count(*) n FROM ss_jobs WHERE kind='build'").get().n,1);
});
test('transport rejects foreign origins, oversized JSON and unsupported operations',async t=>{
  const {owner,call,sqlite}=await setup(t);
  assert.equal((await call(owner,'skills',undefined,key(),{Origin:'https://other.test'})).s,403);
  assert.equal((await call(owner,'requests',{x:'x'.repeat(9000)})).s,413);
  assert.equal((await call(owner,'releases',release,'bad')).s,400);
  assert.equal((await call(owner,'publish',{})).s,404);
  assert.equal((await call('z'.repeat(50),'skills')).s,401);
  assert.equal((await call(owner,'requests',{...input,input:{idea:input.input.idea,shell:'echo fake'}})).s,422);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM ss_requests').get().n,0);
});
test('rate ceiling enforced without a new row per rejected unauthenticated caller',async t=>{
  const {owner,call,sqlite}=await setup(t);
  await call(owner,'skills');sqlite.exec("UPDATE ss_rates SET used=90 WHERE actor='owner'");
  assert.equal((await call(owner,'skills')).s,429);
  await call('x'.repeat(50),'skills');assert.equal(sqlite.prepare('SELECT count(*) n FROM ss_rates').get().n,1);
});
test('withdrawal revokes queued and running work, stale completion cannot create an artifact',async t=>{
  const {owner,runner,call,enable,sqlite}=await setup(t);await enable();
  const a=(await call(owner,'requests',input)).b, path='requests/'+a.request_id+'/runs';
  const j=(await call(owner,path,{})).b;await call(owner,path,{});
  const {job}=(await call(runner,'runner/claim',{})).b;assert.equal(job.id,j.id);
  await call(owner,'skills/local-checklist/disable',{revision:1});
  assert.equal((await call(runner,'runner/jobs/'+job.id+'/complete',{lease:job.lease,ok:false,error:'build_failed'})).s,409);
  assert.equal((await call(owner,path,{})).s,409);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM ss_jobs WHERE error_code='release_withdrawn'").get().n,2);
  assert.throws(()=>sqlite.exec("UPDATE ss_audit SET event='x'"));
});
test('one lease at once, expired lease fenced, bounded retries and failure visible to owner',async t=>{
  const {owner,runner,call,add,sqlite}=await setup(t);await add();
  const pulls=await Promise.all([call(runner,'runner/claim',{}),call(runner,'runner/claim',{})]);
  const jobs=pulls.map(p=>p.b.job).filter(Boolean);assert.equal(jobs.length,1);const j=jobs[0];
  sqlite.exec("UPDATE ss_jobs SET lease_until=unixepoch()-1");
  const second=(await call(runner,'runner/claim',{})).b.job;
  assert.notEqual(second.lease,j.lease);
  assert.equal((await call(runner,'runner/jobs/'+j.id+'/complete',{lease:j.lease,ok:true,checks})).s,409);
  sqlite.exec("UPDATE ss_jobs SET lease_until=unixepoch()-1");await call(runner,'runner/claim',{});
  const view=(await call(owner,'monitor')).b;assert.equal(view.faults[0].error_code,'lease_exhausted');
  assert.equal((await call(owner,'skills')).b.skills[0].versions[0].test_status,'failed');
});
test('hard caps limit per-request, per-skill, global daily queue and total retained work',async t=>{
  const {owner,call,enable,sqlite}=await setup(t);await enable();
  const a=(await call(owner,'requests',input)).b;
  const path='requests/'+a.request_id+'/runs';
  for(let i=0;i<3;i++)assert.equal((await call(owner,path,{})).s,200);
  assert.equal((await call(owner,path,{})).b.error,'request_limit');
  // Two more customer requests reach the eight-build cap for this skill today.
  for(let n=0;n<2;n++){
    const b=(await call(owner,'requests',input)).b;
    for(let i=0;i<(n?2:3);i++)assert.equal((await call(owner,'requests/'+b.request_id+'/runs',{})).s,200);
  }
  const other=(await call(owner,'requests',input)).b;
  assert.equal((await call(owner,'requests/'+other.request_id+'/runs',{})).b.error,'queue_full');
  sqlite.exec("UPDATE ss_jobs SET status='failed',error_code='timeout' WHERE kind='build' AND status='queued'");
  assert.equal((await call(owner,'requests/'+other.request_id+'/runs',{})).b.error,'daily_limit');
  while(sqlite.prepare('SELECT count(*) AS n FROM ss_requests').get().n<24)
    assert.equal((await call(owner,'requests',input)).s,200);
  assert.equal((await call(owner,'requests',input)).b.error,'daily_limit');
  // Simulate retained historical metadata without touching other databases.
  sqlite.exec("UPDATE ss_requests SET created_at=0");
  const fill=sqlite.prepare("INSERT INTO ss_requests(id,skill_id,input_cipher,private_consent,created_at) VALUES(?,'local-checklist','historical-fixture',1,0)");
  for(let n=24;n<400;n++)fill.run('historical-'+n);
  assert.equal((await call(owner,'requests',input)).b.error,'capacity_limit');
});
test('untrusted output paths, anomalous artifacts and missing encryption keys fail closed',async t=>{
  const {owner,runner,env,call,enable,sqlite}=await setup(t);await enable();
  const dataKey=env.DATA_KEY;env.DATA_KEY='invalid';assert.equal((await call(owner,'requests',input)).s,503);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM ss_requests').get().n,0);
  env.DATA_KEY=dataKey;const a=(await call(owner,'requests',input)).b;
  await call(owner,'requests/'+a.request_id+'/runs',{});const {job}=(await call(runner,'runner/claim',{})).b;
  const files={'app.js':'a','index.html':'b','styles.css':'c','blueprint.json':'{}'};
  const finish=f=>call(runner,'runner/jobs/'+job.id+'/complete',{lease:job.lease,ok:true,files:f});
  assert.equal((await finish({...files,'../extra':'bad'})).s,422);
  assert.equal((await finish({...files,'app.js':'a'.repeat(49153)})).s,422);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM ss_artifacts').get().n,0);
  const k=key(),payload={lease:job.lease,ok:true,files};
  const first=await call(runner,'runner/jobs/'+job.id+'/complete',payload,k);
  assert.equal(first.s,200);assert.deepEqual(first.b,(await call(runner,'runner/jobs/'+job.id+'/complete',payload,k)).b);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM ss_artifacts').get().n,1);
});
test('expired lease rejected even before any subsequent runner claims; monitor exposes the stall',async t=>{
  const {owner,runner,sqlite,call,add}=await setup(t);await add();const {job}=(await call(runner,'runner/claim',{})).b;
  sqlite.exec("UPDATE ss_jobs SET lease_until=unixepoch()-1");
  assert.equal((await call(owner,'monitor')).b.expired_leases,1);
  assert.equal((await call(runner,'runner/jobs/'+job.id+'/complete',{lease:job.lease,ok:true,checks})).s,409);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM ss_finishes').get().n,0);
});
