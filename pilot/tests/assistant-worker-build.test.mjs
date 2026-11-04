import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

test('generated Pages Worker is valid JavaScript',()=>{
  execFileSync(process.execPath,['--check',new URL('../../build/worker.mjs',import.meta.url).pathname],{stdio:'pipe',timeout:15000});
});
test('static assistant is bundled for /assistant/ and its ESM source has correct MIME',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../../build/asset-manifest.json',import.meta.url),'utf8'));
  for(const key of ['/assistant/index.html','/assistant/app.mjs','/assistant/core.mjs','/assistant/styles.css'])
    assert.match(manifest[key],/^[a-f0-9]{64}$/);
});
test('built Cloudflare Worker serves page and invokes mocked AI at same-origin endpoint',async()=>{
  const {default:worker}=await import('../../build/worker.mjs');
  const page=await worker.fetch(new Request('https://demo.invalid/assistant/'),{});
  assert.equal(page.status,200);
  assert.match(await page.text(),/MZcode/);
  const hits=new Map();
  const env={
    MZ_ASSISTANT_AI_ENABLED:'true',
    MZ_CONTACT_SECRET:'sample-protected-token',
    DB:{prepare(){return {bind(bucket,limit){return {async first(){
      const old=hits.get(bucket)||0;if(old>=limit)return null;hits.set(bucket,old+1);return {hits:old+1};
    }};}};}},
    AI:{async run(_model,args){assert.equal(args.messages[0].role,'system');return {response:'أهلاً بك في MZcode، وش تحتاج اليوم؟'};}}
  };
  const r=await worker.fetch(new Request('https://demo.invalid/api/assistant',{
    method:'POST',
    headers:{Origin:'https://demo.invalid','Content-Type':'application/json','CF-Connecting-IP':'198.51.100.1'},
    body:JSON.stringify({message:'أحتاج أداة تساعدني بتنظيم شغل المدرسة',history:[],consent:true})
  }),env);
  assert.equal(r.status,200);
  const result=await r.json();
  assert.equal(result.ok,true);assert.match(result.reply,/MZcode/);
  assert.equal(result.mode,'ai_live');
});
