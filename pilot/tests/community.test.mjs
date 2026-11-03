import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const repo=new URL('../../',import.meta.url);
execFileSync(process.execPath,['pilot/community/build.mjs'],{cwd:repo.pathname,stdio:'pipe'});
const source=readFileSync(new URL('../../build/mz-community.mjs',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const HOST='https://example.test';
const secret='test-only-community-cookie-signing-key-long-enough';
class D1 {
  constructor(){this.votes=new Map();this.ideas=[];this.reviews=new Map();this.limits=new Map();}
  prepare(sql){
    const db=this;
    return {bind(...params){
      return {
        async all(){
          if(sql.startsWith('SELECT project,COUNT(*)')){
            return {results:['kafu','formah','marib'].map(project=>({project,total:[...db.votes.values()].filter(x=>x===project).length}))};
          }
          throw Error('Unexpected all: '+sql);
        },
        async first(){
          if(sql.startsWith('SELECT project FROM mz_lab_votes'))return db.votes.has(params[0])?{project:db.votes.get(params[0])}:null;
          if(sql.startsWith('INSERT INTO mz_lab_rate')){
            const key=params.join(':');const n=(db.limits.get(key)||0)+1;db.limits.set(key,n);return {hits:n};
          }
          if(sql.startsWith('SELECT reference FROM mz_lab_ideas'))return db.ideas.find(x=>x.voter_hash===params[0]&&x.content_hash===params[1])||null;
          throw Error('Unexpected first: '+sql);
        },
        async run(){
          if(sql.startsWith('INSERT INTO mz_lab_votes')){if(!db.votes.has(params[0]))db.votes.set(params[0],params[1]);return {success:true};}
          if(sql.startsWith('INSERT INTO mz_lab_ideas')){
            const [id,reference,voter_hash,content_hash,idea,nickname]=params;
            if(!db.ideas.some(x=>x.voter_hash===voter_hash&&x.content_hash===content_hash))
              db.ideas.push({id,reference,voter_hash,content_hash,idea,nickname,status:'pending'});
            return {success:true};
          }
          if(sql.startsWith('INSERT INTO mz_lab_reviews')){
            const [voter,project,score,note]=params;
            db.reviews.set(voter+':'+project,{score,note});
            return {success:true};
          }
          throw Error('Unexpected run: '+sql);
        }
      };
    }};
  }
}
function request(path,{method='GET',cookie='',origin=HOST,payload,ip='203.0.113.20'}={}){
  const headers={'CF-Connecting-IP':ip};
  if(cookie)headers.Cookie=cookie;
  if(method==='POST'){headers.Origin=origin;headers['Content-Type']='application/json';}
  return new Request(HOST+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
}
const env=()=>({DB:new D1(),MZ_LAB_SECRET:secret});
async function setup(e){
  const r=await worker.fetch(request('/api/community'),e);
  assert.equal(r.status,200);
  const cookie=r.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('mz_lab_id='));
  return cookie;
}
test('RTL page, scripts and CSP are served independently',async()=>{
  const page=await worker.fetch(request('/community/'),{});
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/<html lang="ar" dir="rtl">/);
  assert.match(html,/data-tab="idea"/);
  assert.match(html,/data-vote="kafu"/);
  assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
  const js=await worker.fetch(request('/community/app.js'),{});
  assert.equal(js.status,200);
  assert.match(await js.text(),/\/api\/community\/vote/);
  const css=await worker.fetch(request('/community/style.css'),{});
  assert.equal(css.status,200);
  assert.match(css.headers.get('content-type'),/css/);
});
test('API has no access when DB/secret unavailable',async()=>{
  assert.equal((await worker.fetch(request('/api/community'),{})).status,503);
});
test('one browser votes once; total reflects saved database rows',async()=>{
  const e=env();
  const cookie=await setup(e);
  const first=await worker.fetch(request('/api/community/vote',{method:'POST',cookie,payload:{project:'kafu'}}),e);
  assert.equal(first.status,200);
  assert.deepEqual((await first.json()).counts,{kafu:1,formah:0,marib:0});
  const again=await worker.fetch(request('/api/community/vote',{method:'POST',cookie,payload:{project:'formah'}}),e);
  assert.equal(again.status,409);
  assert.equal(e.DB.votes.size,1);
  const get=await worker.fetch(request('/api/community',{cookie}),e);
  assert.equal((await get.json()).selected,'kafu');
});
test('POST rejects wrong origin and unsigned cookie',async()=>{
  const e=env(),cookie=await setup(e);
  const payload={project:'marib'};
  assert.equal((await worker.fetch(request('/api/community/vote',{method:'POST',cookie,origin:'https://evil.test',payload}),e)).status,403);
  assert.equal((await worker.fetch(request('/api/community/vote',{method:'POST',cookie:'mz_lab_id=bad.bad',payload}),e)).status,409);
  assert.equal(e.DB.votes.size,0);
});
test('anonymous ideas remain pending and exact repeats are deduplicated',async()=>{
  const e=env(),cookie=await setup(e);
  const payload={idea:'أحتاج لعبة فيها تحديات عائلية وجولات ممتعة.',nickname:'مشارك',website:'',consent:true};
  const first=await worker.fetch(request('/api/community/ideas',{method:'POST',cookie,payload}),e);
  assert.equal(first.status,201);
  const ref=(await first.json()).reference;
  assert.match(ref,/^LAB-[A-F0-9]{10}$/);
  const same=await worker.fetch(request('/api/community/ideas',{method:'POST',cookie,payload}),e);
  assert.equal(same.status,200);
  assert.equal((await same.json()).reference,ref);
  assert.equal(e.DB.ideas[0].status,'pending');
  assert.equal(e.DB.ideas.length,1);
  assert.equal((await worker.fetch(request('/api/community/ideas',{method:'POST',cookie,payload:{...payload,consent:false}}),e)).status,400);
});
test('review is written and can be updated but not duplicated',async()=>{
  const e=env(),cookie=await setup(e);
  for(const score of [2,5]){
    const r=await worker.fetch(request('/api/community/reviews',{method:'POST',cookie,payload:{project:'marib',score,note:'اختبار'}}),e);
    assert.equal(r.status,200);
  }
  assert.equal(e.DB.reviews.size,1);
  assert.equal([...e.DB.reviews.values()][0].score,5);
  const invalid=await worker.fetch(request('/api/community/reviews',{method:'POST',cookie,payload:{project:'notreal',score:5,note:''}}),e);
  assert.equal(invalid.status,400);
});
test('too large body is rejected',async()=>{
  const e=env(),cookie=await setup(e);
  const result=await worker.fetch(request('/api/community/ideas',{method:'POST',cookie,payload:{idea:'x'.repeat(5000),nickname:'',consent:true,website:''}}),e);
  assert.equal(result.status,413);
});
