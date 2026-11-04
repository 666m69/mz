import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantHandle} from '../../site/assistant-api.js';

function mockHarness(){
  let invocations=0;
  const buckets=new Map();
  const env={
    MZ_CONTACT_SECRET:'preview-test-secret',
    AI:{async run(){invocations++;return {response:'حياك الله، أبشر وش تحتاج؟'};}},
    DB:{prepare(){return {bind(bucket,limit){return {async first(){
      const count=buckets.get(bucket)||0;
      if(count>=limit)return null;
      buckets.set(bucket,count+1);return {hits:count+1};
    }};}};}}
  };
  const deps={rateAddress:async()=> '203.0.113.20',sign:async()=> 'hashed-test-client'};
  const send=async(host,message='أحتاج مساعدة في تنظيم الدروس',history=[])=>{
    const req=new Request('https://'+host+'/api/assistant',{method:'POST',
      headers:{Origin:'https://'+host,'Content-Type':'application/json'},
      body:JSON.stringify({message,history,consent:true})});
    const res=await assistantHandle(req,env,deps);
    return {status:res.status,body:await res.json()};
  };
  return {env,send,buckets,get invocations(){return invocations;}};
}
const preview='feat-saudi-assistant-workers.mz702.pages.dev';
test('live preview alias is allowlisted without changing production settings',async()=>{
  const h=mockHarness();
  assert.equal((await h.send(preview)).status,200);
  assert.equal((await h.send('mzcodehub.com')).body.error,'ai_disabled');
  assert.equal((await h.send('random-branch.mz702.pages.dev')).body.error,'ai_disabled');
  assert.equal(h.invocations,1);
});
test('preview is capped at two model calls per client per UTC day',async()=>{
  const h=mockHarness();
  assert.equal((await h.send(preview)).status,200);
  assert.equal((await h.send(preview)).status,200);
  assert.equal((await h.send(preview)).body.error,'daily_user_limit');
  assert.equal(h.invocations,2);
});
test('previous conversation history is also checked for sensitive data',async()=>{
  const h=mockHarness();
  const result=await h.send(preview,'أحتاج صياغة رسالة مدرسية',[{role:'user',content:'بريدي هو private@example.com'}]);
  assert.equal(result.status,422);
  assert.equal(result.body.error,'sensitive_input');
  assert.equal(h.invocations,0);
});
