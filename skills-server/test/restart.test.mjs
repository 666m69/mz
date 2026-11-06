import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,rename,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {localState} from '../dev/local.mjs';
import worker from '../worker/index.mjs';
import {checks} from '../worker/catalog.mjs';
test('restart preserves registry, approval, scoped capability, encrypted idea and idempotent queued run',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'mz-keys-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  let c=await localState(dir);
  const call=async(token,path,body,k=randomUUID())=>{
    const res=await worker.fetch(new Request('https://skills.test/api/'+path,{method:body===undefined?'GET':'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':k},body:body===undefined?undefined:JSON.stringify(body)}),c.env);
    assert.equal(res.status,200,path+' '+res.status);return res.json();
  };
  await call(c.owner,'releases',{id:'local-counter',version:'1.0.0',name_ar:'عداد'});
  const testJob=(await call(c.runner,'runner/claim',{})).job;
  await call(c.runner,'runner/jobs/'+testJob.id+'/complete',{lease:testJob.lease,ok:true,checks});
  await call(c.owner,'skills/local-counter/activate',{revision:0,version:'1.0.0'});
  const idea='أريد عداد المحاولات المحلية للعمل بعد إعادة التشغيل';
  const r=await call(c.owner,'requests',{skill_id:'local-counter',input:{idea},private_prototype_consent:true});
  const k=randomUUID(),path='requests/'+r.request_id+'/runs';
  const j=await call(r.request_token,path,{},k),owner=c.owner;c.sqlite.close();
  c=await localState(dir);try {
    assert.equal(c.owner,owner);assert.equal((await call(owner,'skills')).skills[0].enabled,true);
    assert.equal((await call(r.request_token,path,{},k)).id,j.id);
    const job=(await call(c.runner,'runner/claim',{})).job;
    assert.equal(job.id,j.id);assert.equal(job.input.idea,idea);
  }finally{c.sqlite.close();}
  assert.equal((await stat(join(dir,'credentials.json'))).mode&0o077,0);
  assert.equal((await stat(join(dir,'skills.sqlite'))).mode&0o077,0);
  assert.ok(!(await readFile(join(dir,'skills.sqlite'))).includes(Buffer.from(idea)));
  await rename(join(dir,'credentials.json'),join(dir,'saved-keys'));
  await assert.rejects(localState(dir),/credentials/);
});
