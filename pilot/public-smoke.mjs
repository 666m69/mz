import assert from 'node:assert/strict';

const origin = 'https://mzcodehub.com';
const checks = [
  {path:'/', status:200, type:'text/html'},
  {path:'/idea', status:200, type:'text/html', contains:'id="live-preview"'},
  {path:'/idea/lab.js', status:200, type:'javascript', contains:'function renderPreview()'},
  {path:'/idea/engine.js', status:200, type:'javascript', contains:'MZBuilderEngine'},
  {path:'/tools/quote/', status:200, type:'text/html'},
  {path:'/projects/', status:200, type:'text/html'},
  {path:'/privacy', status:200, type:'text/html'},
  {path:'/api/ideas', status:405, type:'application/json'},
];
let failures=0;
for(const c of checks){
  try{
    const response=await fetch(origin+c.path,{redirect:'follow',signal:AbortSignal.timeout(15000)});
    const body=await response.text();
    assert.equal(response.status,c.status,c.path+' unexpected status');
    assert.ok((response.headers.get('content-type')||'').includes(c.type),c.path+' unexpected content type');
    if(c.contains)assert.ok(body.includes(c.contains),c.path+' missing deployed feature');
    if(c.path==='/idea'){
      const policy=response.headers.get('content-security-policy')||'';
      assert.ok(policy.includes("script-src 'self'"),'Idea page missing strict script policy');
    }
    console.log('PASS',c.path,response.status);
  } catch(error){failures++;console.error('FAIL',c.path,error.message);}
}
try{
  const response=await fetch(origin+'/api/ideas',{method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,403,'Cross-origin idea submission must be denied');
  console.log('PASS cross-origin POST rejected');
}catch(error){failures++;console.error('FAIL cross-origin POST',error.message);}
try{
  const response=await fetch(origin+'/api/admin/ideas',{redirect:'manual',signal:AbortSignal.timeout(15000)});
  const type=response.headers.get('content-type')||'';
  if(response.status===200&&type.includes('application/json'))throw Error('Unauthenticated admin returned JSON with HTTP 200');
  console.log('PASS admin endpoint not publicly readable',response.status);
}catch(error){failures++;console.error('FAIL admin guard',error.message);}
if(failures){console.error(failures+' public smoke check(s) failed');process.exitCode=1;}
