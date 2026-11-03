import assert from 'node:assert/strict';
const base='https://mzcodehub.com';
const timeout=()=>AbortSignal.timeout(15000);
function endpoint(path,opts={}){return fetch(base+path,{redirect:'follow',signal:timeout(),...opts});}
for(const [path,fragment] of [
  ['/community/','مختبر MZ'],
  ['/community/style.css','--mint:'],
  ['/community/app.js','/api/community/vote']
]){
  const res=await endpoint(path);
  assert.equal(res.status,200,path+' status');
  assert.ok((await res.text()).includes(fragment),path+' content');
  console.log('PASS live GET',path);
}
const start=await endpoint('/api/community');
assert.equal(start.status,200,'GET vote results');
const cookie=start.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie?.startsWith('mz_lab_id='),'signed cookie issued');
const summary=await start.json();
assert.equal(summary.ok,true);
assert.equal(typeof summary.counts.kafu,'number');
console.log('PASS signed cookie + real vote totals');
const invalid=await endpoint('/api/community/vote',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({project:'kafu'})});
assert.equal(invalid.status,403,'reject CSRF');
console.log('PASS cross-origin write blocked');
if(process.argv.includes('--write')){
  const headers={Origin:base,'Content-Type':'application/json',Cookie:cookie};
  const submit=(path,data)=>endpoint(path,{method:'POST',headers,body:JSON.stringify(data)});
  const vote=await submit('/api/community/vote',{project:'marib'});
  assert.equal(vote.status,200,'vote saved');
  assert.equal((await vote.json()).selected,'marib');
  const voteOther=await submit('/api/community/vote',{project:'kafu'});
  assert.equal(voteOther.status,409,'duplicate vote blocked');
  console.log('PASS vote inserted and duplicate blocked');
  const idea=await submit('/api/community/ideas',{idea:'اختبار معزول لمختبر MZ للتحقق من الحفظ الفعلي، سيُحذف بعد الفحص.',nickname:'QA CHECK',website:'',consent:true});
  assert.equal(idea.status,201,'idea inserted');
  const reference=(await idea.json()).reference;
  assert.match(reference,/^LAB-[A-Z0-9]{10}$/);
  console.log('PASS idea inserted',reference);
  const review=await submit('/api/community/reviews',{project:'marib',score:4,note:'QA smoke test - remove later'});
  assert.equal(review.status,200,'review stored');
  console.log('PASS review inserted');
}
console.log('PASS community end-to-end checks');
