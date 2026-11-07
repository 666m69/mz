import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildWebApp} from '../../pilot/builder/engine.mjs';
import {verifyRuntime} from '../runner/smoke-v1.mjs';
import {localEnvironment} from '../dev/local.mjs';
import {checks,artifactNames} from '../worker/catalog.mjs';
import {canonical} from '../worker/security.mjs';
import {zipFiles} from '../worker/zip.mjs';
import worker from '../worker/index.mjs';

const A={idea:'أريد تطبيق قائمة مهام يومية شخصية مع إضافة المهام وإكمالها وحفظها محليًا',title:'مهام فريق ألف'};
const B={idea:'أريد قائمة مشتريات محلية للبقالة فيها إضافة وحذف العناصر وحفظها على الجهاز',title:'مشتريات فريق باء'};

async function accept(t){
  const context=await localEnvironment();
  const root=await mkdtemp(join(tmpdir(),'mz-real-builder-acceptance-'));
  t.after(async()=>{context.sqlite.close();await rm(root,{recursive:true,force:true})});
  async function call(token,path,body){
    const req=new Request('https://skills.acceptance.test/api/'+path,{
      method:body===undefined?'GET':'POST',
      headers:{Authorization:'Bearer '+token,
        'Idempotency-Key':randomUUID(),'Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    const response=await worker.fetch(req,context.env);
    return {response,
      async json(){return response.json()},
      async bytes(){return Buffer.from(await response.arrayBuffer())}};
  }
  const must=async(token,path,body,expected=200)=>{
    const result=await call(token,path,body);
    assert.equal(result.response.status,expected,path+' status');
    return result;
  };
  const rel=await (await must(context.owner,'releases',{
    id:'local-checklist',version:'1.0.0',name_ar:'قائمة مهام ومشتريات'
  })).json();
  assert.equal(rel.test_status,'pending');
  const testJob=(await (await must(context.runner,'runner/claim',{})).json()).job;
  assert.equal(testJob.id,rel.test_job);
  await must(context.runner,'runner/jobs/'+testJob.id+'/complete',
    {lease:testJob.lease,ok:true,checks});
  await must(context.owner,'skills/local-checklist/activate',{version:'1.0.0',revision:0});
  return {...context,root,call,must};
}
async function createAndBuild(ctx,input){
  const {owner,runner,root,must}=ctx;
  const created=await (await must(owner,'requests',{
    skill_id:'local-checklist',input,private_prototype_consent:true
  })).json();
  assert.match(created.request_token,/^r\.[0-9a-f-]{36}\.[0-9a-f]{64}$/);
  const route='requests/'+created.request_id+'/runs';
  const createdJob=await (await must(created.request_token,route,{})).json();
  const claimed=(await (await must(runner,'runner/claim',{})).json()).job;
  assert.equal(claimed.id,createdJob.id);
  assert.deepEqual(claimed.input,input);
  // This is the real pinned builder. The earlier synthetic acceptance passes
  // fixed files instead and therefore does NOT demonstrate generated content.
  const built=await buildWebApp(claimed.input,{outputRoot:root});
  assert.equal(built.blueprint.title,input.title);
  assert.equal(built.blueprint.automatedRelease,false);
  const files=Object.fromEntries(await Promise.all(artifactNames.map(async name=>
    [name,await readFile(join(built.directory,name),'utf8')])));
  verifyRuntime('local-checklist',files);
  assert.match(files['index.html'],/dir="rtl"/);
  assert.match(files['index.html'],/connect-src 'none'/);
  assert.deepEqual(JSON.parse(files['blueprint.json']).title,input.title);
  const completed=await (await must(runner,'runner/jobs/'+claimed.id+'/complete',
    {lease:claimed.lease,ok:true,files})).json();
  assert.equal(completed.status,'succeeded');
  assert.equal(completed.result.sha256,createHash('sha256').update(canonical(files)).digest('hex'));
  const bytes=await (await must(created.request_token,route+'/'+createdJob.id+'/artifact')).bytes();
  assert.deepEqual(bytes,Buffer.from(zipFiles(files)));
  assert.equal(bytes.readUInt32LE(0),0x04034b50);
  return {...created,jobId:createdJob.id,files,bytes};
}
test('real builder creates two distinct Arabic RTL apps, tests local persistence, encrypts and delivers private ZIPs',async t=>{
  const ctx=await accept(t);
  const a=await createAndBuild(ctx,A);
  const b=await createAndBuild(ctx,B);
  assert.equal(JSON.parse(a.files['blueprint.json']).category,'tasks');
  assert.equal(JSON.parse(b.files['blueprint.json']).category,'shopping');
  assert.notDeepEqual(a.bytes,b.bytes);
  assert.ok(a.files['index.html'].includes(A.title));
  assert.ok(b.files['index.html'].includes(B.title));
  for(const [intruder,target] of [[a,b],[b,a]]){
    const path='requests/'+target.request_id+'/runs/'+target.jobId+'/artifact';
    await ctx.must(intruder.request_token,path,undefined,404);
  }
  // An actual owner revokes A; B must still remain available.
  const aRoute='requests/'+a.request_id+'/runs/'+a.jobId;
  await ctx.must(ctx.owner,aRoute+'/revoke',{});
  await ctx.must(a.request_token,aRoute+'/artifact',undefined,404);
  const bRoute='requests/'+b.request_id+'/runs/'+b.jobId;
  const after=await (await ctx.must(b.request_token,bRoute+'/artifact')).bytes();
  assert.deepEqual(after,b.bytes);
  const saved=ctx.sqlite.prepare('SELECT count(*) n FROM ss_artifacts').get();
  assert.equal(saved.n,2);
  assert.equal(ctx.sqlite.prepare('SELECT revoked_at FROM ss_artifacts WHERE job_id=?').get(a.jobId).revoked_at>0,true);
});
