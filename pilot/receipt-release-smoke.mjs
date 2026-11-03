import assert from 'node:assert/strict';
const origin='https://mzcodehub.com';
const checks=[
 {path:'/idea',status:200,contains:['id="receipt-card"','id="receipt-code"','id="copy-reference"','id="tracking-id"','minlength="15"']},
 {path:'/idea/lab.js',status:200,contains:['receipt_email_status','pending_setup','navigator.clipboard','"MZ-"']},
 {path:'/idea/lab.css',status:200,contains:['.receipt-card','.receipt-code']},
 {path:'/api/ideas',status:405,contentType:'application/json'},
 {path:'/api/ideas/MZ-000000000000',status:404,contentType:'application/json'},
 {path:'/api/ideas/not-valid',status:400,contentType:'application/json'},
 {path:'/tools/quote/',status:200},
 {path:'/privacy',status:200},
];
let count=0;
for(const check of checks){
 const res=await fetch(origin+check.path,{redirect:'manual',signal:AbortSignal.timeout(18000)});
 assert.equal(res.status,check.status,check.path+' HTTP '+res.status);
 const body=await res.text();
 for(const text of check.contains||[])assert.ok(body.includes(text),check.path+' missing '+text);
 if(check.contentType)assert.ok((res.headers.get('content-type')||'').includes(check.contentType));
 console.log('PASS',check.path,res.status);
 count++;
}
for(const path of ['/admin/ideas','/api/admin/ideas']){
 const res=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(18000)});
 assert.ok([302,401,403].includes(res.status),path+' publicly accessible: '+res.status);
 console.log('PASS admin guard',path,res.status);
 count++;
}
console.log('PASS',count,'read-only checks, with no POST, PATCH, stored ideas or outgoing emails');
