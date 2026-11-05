import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import worker from '../../build/worker.mjs';

test('generated Cloudflare Worker genuinely routes /api/assistant and invokes bound AI',async()=>{
  const calls=[];
  const budgets=new Map();
  const env={
    MZ_CONTACT_SECRET:'test-signing-key',
    AI:{async run(model,options){calls.push({model,options});return {response:'حياك الله، هذا رد حقيقي من النموذج وليس تنفيذًا لأي أمر.'};}},
    DB:{prepare(){return {bind(bucket,limit){return {async first(){
      const count=budgets.get(bucket)||0;if(count>=limit)return null;
      budgets.set(bucket,count+1);return {hits:count+1};
    }}}}}}
  };
  const origin='https://mz702.pages.dev';
  const response=await worker.fetch(new Request(origin+'/api/assistant',{
    method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.11'},
    body:JSON.stringify({message:'وش عندك من أدوات للمعلم؟',history:[],consent:true})
  }),env);
  assert.equal(response.status,200,await response.clone().text());
  const payload=await response.json();
  assert.equal(payload.ok,true);
  assert.equal(payload.mode,'ai_live');
  assert.equal(payload.tools_executed,false);
  assert.equal(calls.length,1);
  assert.ok(calls[0].model.startsWith('@cf/meta/'));
});
test('the gateway explicitly permits POST /api/assistant but retains signed visitor forwarding and strict original routes',async()=>{
  const source=await readFile(new URL('../mzcodehub-public-entry-with-idea-cta.mjs',import.meta.url),'utf8');
  assert.match(source,/contact\|assistant\|menus/);
  assert.match(source,/signVisitor\(request, headers, env\.MZ_EDGE_SIGNING_KEY\)/);
  assert.match(source,/request\.headers\.get\('Origin'\) !== canonical/);
  assert.match(source,/headers\.set\('Origin', origin\)/);
  assert.match(source,/if \(!allowedHosts\.has\(url\.hostname\)\)/);
});
test('all generated public corner assistants have user-controlled AI consent and no hardcoded API key',async()=>{
  for(const path of ['/','/tools/','/tools/quote/']){
    const response=await worker.fetch(new Request('https://mz702.pages.dev'+path),{});
    assert.equal(response.status,200,path);
    const html=await response.text();
    assert.match(html,/id="mz-chat-ai-consent"/);
    assert.match(html,/يُرسل السؤال وسياق مختصر إلى Cloudflare AI/);
  }
  const script=await readFile(new URL('../../site/assets/js/mz-floating-assistant.mjs',import.meta.url),'utf8');
  assert.match(script,/fetch\('\/api\/assistant'/);
  assert.match(script,/aiConsent\?\.checked/);
  assert.match(script,/aiHistory\.slice\(-4\)/);
  assert.doesNotMatch(script,/AIza[a-zA-Z0-9_-]{20}/);
});
