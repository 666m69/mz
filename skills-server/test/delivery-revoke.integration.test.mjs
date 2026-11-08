import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localEnvironment} from '../dev/local.mjs';
import worker from '../worker/index.mjs';
import {checks,artifactNames} from '../worker/catalog.mjs';
import {buildWebApp} from '../../pilot/builder/engine.mjs';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const idea='أريد قائمة مهام محلية تجريبية على هذا الجهاز فقط';

async function harness(t){
 const env=await localEnvironment();t.after(()=>env.sqlite.close());
 const send=async(token,path,body,verb,extra={})=>{
  const method=verb||(body===undefined?'GET':'POST');
  const req=new Request('https://skills.test/api/'+path,{method,
   headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json',
    'Idempotency-Key':randomUUID(),...extra},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const r=await worker.fetch(req,env.env);
  return {status:r.status,headers:r.headers,
    contentType:r.headers.get('content-type'),bytes:await r.arrayBuffer()};
 };
 const json=async(...args)=>{const r=await send(...args);
   return {...r,body:JSON.parse(new TextDecoder().decode(r.bytes))};};
 await json(env.owner,'releases',{id:'local-checklist',version:'1.0.0',name_ar:'منظم القوائم'});
 const approval=(await json(env.runner,'runner/claim',{})).body.job;
 assert.ok(approval);
 assert.equal((await json(env.runner,'runner/jobs/'+approval.id+'/complete',
  {lease:approval.lease,ok:true,checks})).status,200);
 assert.equal((await json(env.owner,'skills/local-checklist/activate',
  {version:'1.0.0',revision:0})).status,200);
 const newClient=async()=>json(env.owner,'requests',
  {skill_id:'local-checklist',input:{idea},private_prototype_consent:true});
 const a=(await newClient()).body,b=(await newClient()).body;
 assert.notEqual(a.request_id,b.request_id);
 const submit=async client=>{
   const create=await json(client.request_token,'requests/'+client.request_id+'/runs',{});
   assert.equal(create.status,200);return create.body.id;
 };
 const runA=await submit(a);
 const job=(await json(env.runner,'runner/claim',{})).body.job;
 assert.equal(job.id,runA);
 const out=await mkdtemp(join(tmpdir(),'mz-delivery-real-'));
 t.after(()=>rm(out,{recursive:true,force:true}));
 const built=await buildWebApp({idea},{outputRoot:out});
 const files=Object.fromEntries(await Promise.all(artifactNames.map(async name=>
  [name,await readFile(join(built.directory,name),'utf8')])));
 assert.equal((await json(env.runner,'runner/jobs/'+job.id+'/complete',
  {lease:job.lease,ok:true,files})).status,200);
 return {env,json,send,a,b,runA,submit};
}
test('independent request identities: real encrypted ZIP download then owner revocation blocks access',async t=>{
 const {env,json,send,a,b,runA}=await harness(t);
 const path='requests/'+a.request_id+'/runs/'+runA+'/artifact';
 const own=await send(a.request_token,path);
 assert.equal(own.status,200);
 assert.match(own.contentType,/application\/zip/);
 assert.equal(Buffer.from(own.bytes).readUInt32LE(0),0x04034b50);
 assert.equal((await send(b.request_token,path)).status,404);
 assert.equal((await send(env.runner,path)).status,403);
 const revokePath='requests/'+a.request_id+'/runs/'+runA+'/revoke';
 assert.equal((await json(a.request_token,revokePath,{})).status,403);
 const revoked=await json(env.owner,revokePath,{});
 assert.equal(revoked.status,200);
 assert.equal(revoked.body.revoked,true);
 assert.equal((await send(a.request_token,path)).status,404);
 assert.equal((await send(b.request_token,path)).status,404);
 const stored=env.sqlite.prepare('SELECT revoked_at,download_expires_at,purge_after,cipher FROM ss_artifacts WHERE job_id=?').get(runA);
 assert.ok(stored.revoked_at>0);
 assert.ok(stored.download_expires_at>Math.floor(Date.now()/1000));
 assert.ok(stored.purge_after>stored.download_expires_at);
 assert.ok(!stored.cipher.includes(idea));
});
