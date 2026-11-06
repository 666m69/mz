import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PrivateDeliveryVault} from '../private-vault.mjs';

// A minimal ZIP-signature fixture; actual ZIP structure must be verified
// by the reviewed builder before calling vault.store().
const sample=Buffer.from('504b0304000000000000','hex');
const clientId='client-test-a',orderId='MZ-ORD-QA-1234';
async function fixture(fn){
  const root=await mkdtemp(join(tmpdir(),'mzcode-vault-test-'));
  const secretKey=randomBytes(32);
  let now=Date.UTC(2026,10,7);
  const clock=()=>now;
  const vault=()=>new PrivateDeliveryVault({root,secretKey,now:clock});
  try{return await fn({vault,advance:ms=>{now+=ms},root,secretKey})}
  finally{await rm(root,{recursive:true,force:true})}
}
test('secret required; cannot silently fall back to a hardcoded key',async()=>{
  assert.throws(()=>new PrivateDeliveryVault({root:'/tmp/demo'}),/VAULT_SECRET_REQUIRED/);
  assert.throws(()=>new PrivateDeliveryVault({root:'/tmp/demo',secretKey:'short'}),/VAULT_SECRET_REQUIRED/);
});
test('authenticated owner can download and verify the exact saved ZIP after restart',async()=>fixture(async({vault})=>{
  const first=vault(),stored=await first.store({clientId,orderId,zip:sample});
  assert.equal(stored.bytes,sample.length);
  const second=vault();
  const result=await second.download({clientId,orderId,token:stored.token});
  assert.deepEqual(result.zip,sample);
  assert.equal(result.sha256,stored.sha256);
}));
test('missing caller identity and cross-client token reuse fail closed',async()=>fixture(async({vault})=>{
  const a=vault(),stored=await a.store({clientId,orderId,zip:sample});
  await assert.rejects(a.download({orderId,token:stored.token}),/INVALID_ID/);
  await assert.rejects(a.download({clientId:'client-test-b',orderId,token:stored.token}),/ACCESS_DENIED/);
  await assert.rejects(a.download({clientId,orderId,token:stored.token+'X'}),/INVALID_TOKEN/);
}));
test('expired tokens, revoked requests and repeated writes are rejected',async()=>fixture(async({vault,advance})=>{
  const a=vault(),stored=await a.store({clientId,orderId,zip:sample,downloadDays:1});
  await assert.rejects(a.store({clientId,orderId,zip:sample}),/EEXIST/);
  advance(24*60*60*1000);
  await assert.rejects(a.download({clientId,orderId,token:stored.token}),/TOKEN_EXPIRED/);
  const order2='MZ-ORD-QA-2345';
  const next=await a.store({clientId,orderId:order2,zip:sample});
  await a.revoke({clientId,orderId:order2});
  await assert.rejects(a.download({clientId,orderId:order2,token:next.token}),/ACCESS_DENIED/);
}));
test('path traversal, invalid artifacts and oversized retention fail closed',async()=>fixture(async({vault})=>{
  const a=vault();
  await assert.rejects(a.store({clientId,orderId:'../escape',zip:sample}),/INVALID_ID/);
  await assert.rejects(a.store({clientId,orderId,zip:Buffer.from('not zip')}),/INVALID_ARTIFACT/);
  await assert.rejects(a.store({clientId,orderId,zip:sample,retentionDays:31}),/INVALID_RETENTION/);
}));
test('retention purge is explicit and removes artifacts after 30 days',async()=>fixture(async({vault,advance})=>{
  const a=vault(),stored=await a.store({clientId,orderId,zip:sample});
  assert.equal(await a.purgeExpired(),0);
  advance(30*24*60*60*1000);
  assert.equal(await a.purgeExpired(),1);
  await assert.rejects(a.download({clientId,orderId,token:stored.token}),/TOKEN_EXPIRED/);
}));
