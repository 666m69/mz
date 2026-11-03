import assert from 'node:assert/strict';

const origin='https://mzcodehub.com';
let passed=0;
async function probe(path, expected=200){
 const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,expected,path+' returned '+response.status);
 console.log('PASS',path,response.status);
 passed++;
 return response.text();
}
const home=await probe('/');
for(const phrase of ['id="mz-community-invite"','ما عندك فكرة؟ ولا ودّك تشارك؟','خذ لك فَرّة بالموقع','href="/projects/"','href="/community/"'])
 assert.ok(home.includes(phrase),'Homepage missing '+phrase);
assert.match(home,/<meta name="viewport"/);
await probe('/projects/');
await probe('/community/');
await probe('/tools/');
await probe('/games/code/');
await probe('/privacy');
await probe('/api/ideas',405);
const admin=await fetch(origin+'/admin/ideas',{redirect:'manual',signal:AbortSignal.timeout(15000)});
assert.ok([302,401,403].includes(admin.status),'Admin exposed to public: '+admin.status);
console.log('PASS admin private',admin.status);passed++;
console.log('PASS share-invitation live production',passed,'checks, read only');
