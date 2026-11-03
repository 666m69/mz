import assert from 'node:assert/strict';

const site='https://mzcodehub.com';
const checks=[
 {path:'/',status:200,contains:'MZcode'},
 {path:'/idea',status:200,contains:'id="track-form"'},
 {path:'/idea/lab.js',status:200,contains:'trackingLabels'},
 {path:'/idea/engine.js',status:200,contains:'MZBuilderEngine'},
 {path:'/tools/quote/',status:200},
 {path:'/projects/',status:200},
 {path:'/privacy',status:200},
 {path:'/api/ideas',status:405,type:'application/json'},
 {path:'/api/ideas/not-a-uuid',status:400,type:'application/json'},
 {path:'/api/ideas/11111111-1111-4111-8111-111111111111',status:404,type:'application/json'}
];
let passed=0;
for(const item of checks){
 const r=await fetch(site+item.path,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'Accept':'text/html,application/json,*/*'}});
 const body=await r.text();
 assert.equal(r.status,item.status,item.path+' returned '+r.status+' '+body.slice(0,160));
 if(item.contains)assert.ok(body.includes(item.contains),item.path+' missing '+item.contains);
 if(item.type)assert.ok((r.headers.get('content-type')||'').includes(item.type),item.path+' wrong content-type');
 if(item.path==='/idea')assert.ok((r.headers.get('content-security-policy')||'').includes("default-src 'none'"),'CSP missing');
 console.log('PASS',item.path,r.status);
 passed++;
}
for(const path of ['/admin/ideas','/api/admin/ideas']){
 const r=await fetch(site+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.ok([302,401,403].includes(r.status),path+' must reject anonymous access but returned '+r.status);
 console.log('PASS anonymous protected',path,r.status);
 passed++;
}
console.log('PASS read-only production smoke:',passed,'checks. No POST, PATCH or writes made.');
