import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const workerCode=readFileSync(new URL('../mz-ideas-admin-worker.js',import.meta.url),'utf8');
const audience='92323b54a2124456358a22cd875b15fc92c9f3b2374894f9dad1e0bf82c9a9df';
const origin='https://mzcodehub.com';
const b64=object=>Buffer.from(JSON.stringify(object)).toString('base64url');
const buildJWT=async key=>{
 const now=Math.floor(Date.now()/1000);
 const base=b64({alg:'RS256',kid:'temporary-test-key'})+'.'+b64({iss:'https://nameless-bonus-3327.cloudflareaccess.com',aud:audience,email:'admin@example.invalid',nbf:now-30,exp:now+300});
 const signature=await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(base));
 return base+'.'+Buffer.from(signature).toString('base64url');
};

test('verified Cloudflare Access JWT protects admin read and status updates',async()=>{
 const {privateKey,publicKey}=await webcrypto.subtle.generateKey(
  {name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pub=await webcrypto.subtle.exportKey('jwk',publicKey);
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  assert.equal(String(url),'https://nameless-bonus-3327.cloudflareaccess.com/cdn-cgi/access/certs');
  return new Response(JSON.stringify({keys:[{...pub,kid:'temporary-test-key'}]}),{status:200});
 };
 try{
  const code=workerCode.replace('export default','const exported =')+'\nexport {exported};';
  const {exported}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));
  const id='12345678-1234-4234-8234-123456789abc';
  const customer={id,name:'QA',email:'qa@example.invalid',idea:'Test only',status:'new',notification_status:'sent',created_ms:Date.now()};
  const events=[];
  const env={DB:{
   prepare(sql){return {
    bind(...args){return {
     async first(){assert.match(sql,/SELECT status FROM/);assert.equal(args[0],id);return {status:customer.status}},
     async run(){return {success:true,meta:{changes:1}}}
    }},
    async all(){assert.match(sql,/SELECT id,name,email,idea,status/);return {results:[customer]}}
   }},
   async batch(jobs){assert.equal(jobs.length,2);events.push({from:customer.status,to:'reviewing'});customer.status='reviewing';return [{success:true,meta:{changes:1}},{success:true,meta:{changes:1}}]}
  }};
  const denied=await exported.fetch(new Request(origin+'/api/admin/ideas'),env);
  assert.equal(denied.status,403);
  const token=await buildJWT(privateKey);
  const headers={'Cf-Access-Jwt-Assertion':token};
  const allowed=await exported.fetch(new Request(origin+'/api/admin/ideas',{headers}),env);
  assert.equal(allowed.status,200);
  assert.equal((await allowed.json()).requests[0].status,'new');
  const wrongOrigin=await exported.fetch(new Request(origin+'/api/admin/ideas/'+id,{
   method:'PATCH',headers:{...headers,'Origin':'https://not-our-site.invalid','content-type':'application/json'},
   body:JSON.stringify({status:'reviewing'})}),env);
  assert.equal(wrongOrigin.status,403);
  const updated=await exported.fetch(new Request(origin+'/api/admin/ideas/'+id,{
   method:'PATCH',headers:{...headers,'Origin':origin,'content-type':'application/json'},
   body:JSON.stringify({status:'reviewing'})}),env);
  assert.equal(updated.status,200);
  assert.deepEqual(await updated.json(),{ok:true,status:'reviewing'});
  assert.deepEqual(events,[{from:'new',to:'reviewing'}]);
  const illegal=await exported.fetch(new Request(origin+'/api/admin/ideas/'+id,{
   method:'PATCH',headers:{...headers,'Origin':origin,'content-type':'application/json'},
   body:JSON.stringify({status:'unapproved'})}),env);
  assert.equal(illegal.status,400);
 }finally{globalThis.fetch=originalFetch}
});
