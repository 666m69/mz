import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../site/_worker.js';

function env(){
 const hits=[];
 return {
  hits,
  ASSETS: {fetch: async req=>{
   const path=new URL(req.url).pathname;
   hits.push(path);
   if(path==='/maintenance.html'){
    return new Response('<html lang="ar" dir="rtl"><h1>نطوّر لك تجربة أفضل</h1></html>',{status:200,headers:{'content-type':'text/html'}});
   }
   if(path.startsWith('/assets/'))return new Response('<svg/>',{status:200,headers:{'content-type':'image/svg+xml'}});
   return new Response('ORIGINAL SITE',{status:200,headers:{'content-type':'text/plain'}});
  }}
 };
}
async function visit(path,{host='mzcodehub.com',method='GET'}={}){
 const e=env();
 const res=await worker.fetch(new Request('https://'+host+path,{method}),e);
 return {res,e,body:method==='HEAD'?'':await res.text()};
}
test('production homepage serves branded maintenance 503, not a dead website',async()=>{
 const {res,body,e}=await visit('/');
 assert.equal(res.status,503);
 assert.match(body,/MZcode|نطوّر لك تجربة أفضل/);
 assert.equal(res.headers.get('content-type'),'text/html; charset=utf-8');
 assert.equal(res.headers.get('cache-control'),'no-store, max-age=0');
 assert.equal(res.headers.get('retry-after'),'3600');
 assert.deepEqual(e.hits,['/maintenance.html']);
});
test('all public HTML and clean document paths serve maintenance',async()=>{
 for(const path of ['/idea','/projects/','/tools/quote/','/about.html','/privacy','/games/code/']){
  const {res,e}=await visit(path);
  assert.equal(res.status,503,path);
  assert.deepEqual(e.hits,['/maintenance.html'],path);
 }
});
test('HEAD returns correct headers with no body',async()=>{
 const {res,body}=await visit('/',{method:'HEAD'});
 assert.equal(res.status,503);assert.equal(body,'');
});
test('static assets remain available and bypass maintenance',async()=>{
 const {res,body,e}=await visit('/assets/images/mz-mark-gold.svg');
 assert.equal(res.status,200);assert.equal(body,'<svg/>');
 assert.deepEqual(e.hits,['/assets/images/mz-mark-gold.svg']);
});
test('unknown APIs remain JSON 404; no accidental maintenance HTML',async()=>{
 const {res,body,e}=await visit('/api/not-found');
 assert.equal(res.status,404);assert.match(res.headers.get('content-type'),/application\/json/);
 assert.match(body,/المسار غير موجود/);assert.equal(e.hits.length,0);
});
test('admin endpoints retain their access restriction',async()=>{
 const {res,body,e}=await visit('/admin/');
 assert.equal(res.status,403);assert.match(body,/الإدارة متاحة/);assert.equal(e.hits.length,0);
});
test('preview host demonstrates maintenance, unrelated preview stays unchanged',async()=>{
 const preview=await visit('/',{host:'feat-public-maintenance-mzco.mz702.pages.dev'});
 assert.equal(preview.res.status,503);
 const other=await visit('/',{host:'other-example.mz702.pages.dev'});
 assert.equal(other.res.status,200);
 assert.equal(other.body,'ORIGINAL SITE');
});
test('www domain retains canonical redirect',async()=>{
 const {res,e}=await visit('/',{host:'www.mzcodehub.com'});
 assert.equal(res.status,308);
 assert.equal(res.headers.get('location'),'https://mzcodehub.com/');
 assert.equal(e.hits.length,0);
});
test('only GET and HEAD public pages accepted',async()=>{
 const {res,e}=await visit('/',{method:'POST'});
 assert.equal(res.status,405);assert.equal(e.hits.length,0);
});
