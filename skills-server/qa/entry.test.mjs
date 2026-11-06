import test from 'node:test';
import assert from 'node:assert/strict';
import stage from './entry.mjs';
const host='qa.example.workers.dev',live={QA_HOST:host,QA_CLOSE_AT:new Date(Date.now()+60000).toISOString()};
test('a QA API on the exact TLS host still requires the core authentication',async()=>{
  const r=await stage.fetch(new Request('https://'+host+'/api/skills'),live);
  assert.equal(r.status,401);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('expired or missing gate, wrong host, plain HTTP and root have no entry point',async()=>{
  for(const [url,env] of [
    ['https://'+host+'/api/skills',{...live,QA_CLOSE_AT:'invalid'}],
    ['https://'+host+'/api/skills',{...live,QA_CLOSE_AT:'2000-01-01T00:00:00Z'}],
    ['https://wrong.example/api/skills',live],['http://'+host+'/api/skills',live],['https://'+host+'/',live]]){
    assert.equal((await stage.fetch(new Request(url),env)).status,404);
  }
});
