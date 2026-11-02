import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import worker from '../build/worker.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../build/asset-manifest.json',import.meta.url),'utf8'));
test('every deployed asset matches the tested source bytes',async()=>{for(const [p,hash]of Object.entries(manifest)){const r=await worker.fetch(new Request('https://mz702.pages.dev'+p),{});assert.equal(r.status,200,p);assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),hash,p)}});
test('tools require own scripts and refuse framing',async()=>{const r=await worker.fetch(new Request('https://mz702.pages.dev/tools/quote/'),{});assert.match(r.headers.get('Content-Security-Policy'),/script-src 'self'/);assert.equal(r.headers.get('X-Frame-Options'),'DENY')});
test('unknown routes and private paths never return a success page',async()=>{for(const [p,s]of [['/missing-asset.png',404],['/api/unknown',404],['/admin',403],['/migration.sql',404]])assert.equal((await worker.fetch(new Request('https://mz702.pages.dev'+p),{})).status,s,p)});
test('tool trailing slash canonicalized and HEAD body empty',async()=>{assert.equal((await worker.fetch(new Request('https://mz702.pages.dev/tools/quote'),{})).status,308);assert.equal(await(await worker.fetch(new Request('https://mz702.pages.dev/tools/quote/',{method:'HEAD'}),{})).text(),'')});

test('home, catalog and gallery load the full studio theme in one stylesheet',async()=>{
 for(const path of ['/','/tools/','/projects/']){
  const response=await worker.fetch(new Request('https://mz702.pages.dev'+path),{});
  const html=await response.text();
  assert.equal((html.match(/rel="stylesheet"/g)||[]).length,1,path);
  assert.ok(html.includes('href="/assets/css/studio-site.css"'),path);
 }
 const response=await worker.fetch(new Request('https://mz702.pages.dev/assets/css/studio-site.css'),{});
 assert.equal(response.status,200);
 const css=await response.text();
 for(const selector of ['.studio-hero','.featured-showcase','.core-spot','.signup'])assert.ok(css.includes(selector));
});
