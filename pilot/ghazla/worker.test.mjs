import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
const base='https://example.test',secret='test-only-not-production-0123456789abcdef';
const env={GHAZLA_OWNER_SECRET:secret};
const auth='Basic '+btoa('owner:'+secret);
function req(path='/ghazla',opts={}){return new Request(base+path,opts);}
test('missing secret denies access',async()=>assert.equal((await worker.fetch(req(),{})).status,503));
test('anonymous page and API denied',async()=>{for(const path of ['/ghazla','/ghazla/api'])assert.equal((await worker.fetch(req(path),env)).status,401);});
test('wrong secret denied',async()=>assert.equal((await worker.fetch(req('/ghazla',{headers:{Authorization:'Basic '+btoa('owner:wrong')}}),env)).status,401));
test('owner page no-store',async()=>{const r=await worker.fetch(req('/ghazla',{headers:{Authorization:auth}}),env);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.match(await r.text(),/غزلة/);});
const post=(origin=base,body={message:'اختبار الموقع'})=>req('/ghazla/api',{method:'POST',headers:{Authorization:auth,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('cross origin rejected',async()=>assert.equal((await worker.fetch(post('https://evil.test'),env)).status,403));
test('invalid payload rejected',async()=>assert.equal((await worker.fetch(post(base,{message:''}),env)).status,400));
test('local engine does not call AI',async()=>{const r=await worker.fetch(post(),{...env,AI:{run(){throw Error('must not run')}}});assert.equal(r.status,200);const b=await r.json();assert.equal(b.mode,'local');assert.equal(b.executed,false);});
test('AI enabled without bindings fails closed',async()=>assert.equal((await worker.fetch(post(),{...env,GHAZLA_AI_ENABLED:'1'})).status,503));
