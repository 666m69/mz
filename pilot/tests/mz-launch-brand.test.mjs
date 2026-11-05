import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../build/worker.mjs';

const host='https://mz702.pages.dev';
const logo='/assets/images/mz-mark.svg';
test('MZcode homepage, tools and projects advertise the same installed identity',async()=>{
 for(const route of ['/','/tools/','/projects/']){
   const response=await worker.fetch(new Request(host+route),{});
   assert.equal(response.status,200,route);
   const html=await response.text();
   assert.match(html,/<html lang="ar" dir="rtl">/i,route);
   assert.match(html,/<link rel="manifest" href="\/manifest\.webmanifest\?v=20261105">/i,route);
   assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="\/assets\/images\/mz-mark\.svg\?v=20261105">/i,route);
   assert.match(html,/<link rel="apple-touch-icon" sizes="192x192" href="\/assets\/images\/icon-192\.png\?v=20261105">/i,route);
   assert.match(html,/<a class="brand" href="\/"[^>]*><img src="\/assets\/images\/mz-mark\.svg"/i,route);
   assert.doesNotMatch(html,/mint-mz-logo|teal-mz-logo|old-shortcut-icon/i);
 }
});

test('Android launch manifest uses approved branded icon and dark splash instead of an outdated icon',async()=>{
 const response=await worker.fetch(new Request(host+'/manifest.webmanifest'),{});
 assert.equal(response.status,200);
 assert.match(response.headers.get('Content-Type'),/application\/manifest\+json/);
 assert.match(response.headers.get('Cache-Control')||'',/no-cache/);
 const manifest=await response.json();
 assert.equal(manifest.short_name,'MZcode');
 assert.equal(manifest.id,'/');
 assert.equal(manifest.start_url,'/');
 assert.equal(manifest.scope,'/');
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.background_color,'#0B0F1A');
 assert.equal(manifest.theme_color,'#006C35');
 assert.deepEqual(manifest.icons.map(x=>x.src),[
   '/assets/images/icon-192.png','/assets/images/icon-512.png']);
 assert.ok(manifest.icons.every(x=>x.purpose==='any'));
});

test('launcher icons are genuine 192px and 512px PNGs, current logo is an SVG',async()=>{
 for(const size of [192,512]){
   const r=await worker.fetch(new Request(host+'/assets/images/icon-'+size+'.png'),{});
   assert.equal(r.status,200);
   assert.equal(r.headers.get('Content-Type'),'image/png');
   assert.match(r.headers.get('Cache-Control')||'',/no-cache/);
   const bytes=new Uint8Array(await r.arrayBuffer());
   assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
   const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
   assert.equal(v.getUint32(16),size);
   assert.equal(v.getUint32(20),size);
 }
 const svg=await worker.fetch(new Request(host+logo),{});
 assert.equal(svg.status,200);
 assert.match(svg.headers.get('Cache-Control')||'',/no-cache/);
 const body=await svg.text();
 assert.match(body,/viewBox="0 0 256 256"/);
 assert.match(body,/aria-label="MZcode"/);
 assert.match(body,/#F9A825/);
 assert.match(body,/#F5F7FA/);
});
