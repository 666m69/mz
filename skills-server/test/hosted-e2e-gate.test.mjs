import test from 'node:test';
import assert from 'node:assert/strict';
import qa from '../qa/hosted-e2e-entry.mjs';

const host='mzcode-e2e-only.example.test';
const nonce='synthetic-test-only-1234567890123456789012345678901234567890';
const base='https://'+host+'/__private_mzcode_qa/'+nonce+'/';
const env=()=>({QA_HOST:host,QA_ROUTE_SECRET:nonce,QA_CLOSE_AT:new Date(Date.now()+60_000).toISOString()});
test('private hosted QA refuses any wrong host, secret, method and protocol',async()=>{
  for(const u of [
    'https://public.example.test/__private_mzcode_qa/'+nonce+'/run',
    'https://'+host+'/__private_mzcode_qa/wrongsecret/run',
    'https://'+host+'/api/skills',
    'http://'+host+'/__private_mzcode_qa/'+nonce+'/run',
    base+'run?token=x',
  ]){
    const r=await qa.fetch(new Request(u),env());
    assert.equal(r.status,404,u);
  }
  assert.equal((await qa.fetch(new Request(base+'run',{method:'POST'}),env())).status,404);
});
test('private hosted QA expires closed and requires all identity bindings',async()=>{
  const past={...env(),QA_CLOSE_AT:new Date(Date.now()-1000).toISOString()};
  assert.equal((await qa.fetch(new Request(base+'run'),past)).status,404);
  assert.equal((await qa.fetch(new Request(base+'run'),{...env(),QA_ROUTE_SECRET:null})).status,404);
  assert.equal((await qa.fetch(new Request(base+'run'),{...env(),QA_HOST:''})).status,404);
});
test('authenticated QA runner page contains no customer APIs or external scripts',async()=>{
  const res=await qa.fetch(new Request(base+'run'),env());
  assert.equal(res.status,200);
  assert.equal(res.headers.get('cache-control'),'no-store');
  assert.equal(res.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.match(res.headers.get('content-security-policy'),/connect-src 'self'/);
  const html=await res.text();
  assert.match(html,/Private MZcode E2E/);
  assert.match(html,/#?qa-done/);
  assert.doesNotMatch(html,/https:\/\/mzcodehub\.com/);
  assert.doesNotMatch(html,/https:\/\/mzcode-skills-qa-20261104/);
});
