import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PrivateDeliveryVault} from '../private-vault.mjs';
import {stageIdeaDelivery} from '../private-delivery-bridge.mjs';

const idea='أريد تطبيق ويب بسيط لقائمة مهام يومية يحتفظ بما أضيفه على جهازي';
const orderId='MZ-ORD-TEST-1107';
const title='MZcode synthetic local app';
async function fixture(action){
  const root=await mkdtemp(join(tmpdir(),'mz-stage-test-'));
  try{return await action(new PrivateDeliveryVault({root,secretKey:randomBytes(32)}))}
  finally{await rm(root,{recursive:true,force:true})}
}
test('synthetic idea produces a real checked ZIP stored for authenticated private retrieval',async()=>fixture(async vault=>{
  const principal='client-qa-one';
  const result=await stageIdeaDelivery({idea,title,orderId},
    {vault,resolveClientIdentity:async()=>principal});
  assert.equal(result.ok,true);
  assert.equal(result.state,'staged_for_private_delivery');
  assert.match(result.artifact_sha256,/^[a-f0-9]{64}$/);
  assert.equal(result.customer_deployed,false);
  assert.equal(result.automatic_customer_delivery,false);
  const d=await vault.download({orderId,clientId:principal,token:result.downloadToken});
  assert.equal(d.sha256,result.artifact_sha256);
  assert.ok(d.zip.length>1000);
  await assert.rejects(vault.download({orderId,clientId:'client-qa-other',token:result.downloadToken}),/ACCESS_DENIED/);
}));
test('bridge refuses missing authenticated identity resolver',async()=>fixture(async vault=>{
  await assert.rejects(stageIdeaDelivery({idea,title,orderId},{vault}),/AUTHENTICATED_RESOLVER_REQUIRED/);
  await assert.rejects(stageIdeaDelivery({idea,title,orderId},
    {vault,resolveClientIdentity:async()=>null}),/INVALID_ID/);
}));
test('commercial and unsupported requests never enter the ZIP delivery vault',async()=>fixture(async vault=>{
  const result=await stageIdeaDelivery(
    {idea:'أريد نظام نقاط بيع للمقاهي والفواتير الضريبية والمدفوعات المتكاملة',title,orderId},
    {vault,resolveClientIdentity:async()=> 'client-qa-one'});
  assert.equal(result.ok,false);
  assert.equal(result.automatic_delivery,false);
  await assert.rejects(vault.download({clientId:'client-qa-one',orderId,token:'invalid'}),/INVALID_TOKEN/);
}));
test('same owner cannot silently overwrite a previously stored delivery',async()=>fixture(async vault=>{
  const args={vault,resolveClientIdentity:async()=> 'client-qa-one'};
  await stageIdeaDelivery({idea,title,orderId},args);
  await assert.rejects(stageIdeaDelivery({idea,title,orderId},args),/EEXIST/);
}));
