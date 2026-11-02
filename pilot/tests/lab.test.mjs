import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import app from '../../build/mz-ideas.mjs';
import admin from '../mz-ideas-admin-worker.js';

const origin='https://mzcodehub.com';
function fixture(){
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  const DB={prepare(q){return {bind(...args){let st=sql.prepare(q);return {run(){return {success:true,meta:st.run(...args)}},first(){return st.get(...args)}}}}}};
  const env={DB,HASH_SALT:'local-test-only'};
  const body={idea:'أريد تطبيقًا لحجز موعد محلي مع اختبار الامتلاء.',email:'qa@example.invalid',consent:'yes',name:'QA'};
  function post(payload=body,headers={}){return app.fetch(new Request(origin+'/api/ideas',{method:'POST',headers:{origin,'content-type':'application/json','CF-Connecting-IP':'192.0.2.5',...headers},body:JSON.stringify(payload)}),env)}
  return {sql,env,post,body};
}
test('lab and each first-party asset support GET and HEAD with a restrictive policy',async()=>{
  for(const url of ['/idea','/idea/','/idea/engine.js','/idea/lab.js','/idea/lab.css']){
    const res=await app.fetch(new Request(origin+url),{});
    assert.equal(res.status,200);assert.match(res.headers.get('content-security-policy'),/script-src 'self'/);
    assert.doesNotMatch(res.headers.get('content-security-policy'),/unsafe-inline/);
    if(/\.js$/.test(url))new vm.Script(await res.text());
    assert.equal(await(await app.fetch(new Request(origin+url,{method:'HEAD'}),{})).text(),'');
  }
});
test('consent, content type, origin and maximum payload are enforced',async()=>{
  const s=fixture();
  for(const [body,h,status] of [[{...s.body,consent:''},{},400],[s.body,{origin:'https://other.test'},403],[s.body,{origin:''},403],[s.body,{'content-type':'application/jsonp'},415],[{...s.body,website:'bot'},{},400],[{...s.body,idea:'z'.repeat(40000)},{},413]])
    assert.equal((await s.post(body,h)).status,status);
  assert.equal(s.sql.prepare('SELECT COUNT(*) AS n FROM idea_requests').get().n,0);
});
test('retry and concurrent cap never create a fourth row or duplicate a request',async()=>{
  const s=fixture(),key=crypto.randomUUID(),headers={'idempotency-key':key};
  const res=await s.post(s.body,headers);assert.equal(res.status,201);assert.equal((await res.json()).id,key);
  assert.equal((await s.post(s.body,headers)).status,200);
  assert.equal((await s.post({...s.body,name:'different'},headers)).status,409);
  const results=await Promise.all(Array.from({length:5},()=>s.post()));
  assert.equal(results.filter(r=>r.status===201).length,2);assert.equal(results.filter(r=>r.status===429).length,3);
  assert.equal(s.sql.prepare('SELECT COUNT(*) AS n FROM idea_requests').get().n,3);
});
test('database failure gives no receipt and anonymous visitors cannot list customer data',async()=>{
  const s=fixture();s.env.DB=undefined;assert.equal((await s.post()).status,503);
  assert.equal((await app.fetch(new Request(origin+'/api/ideas'),{})).status,405);
  for(const hdr of [{},{'Cf-Access-Jwt-Assertion':'forged.token.contents'}])
    assert.equal((await admin.fetch(new Request(origin+'/api/admin/ideas',{headers:hdr}),{})).status,403);
});
test('literal HTML input is data and does not appear in the served shell',async()=>{
  const s=fixture(),idea='اختبار إدخال حرفي <img src=x onerror=alert(1)> في النص';
  const r=await s.post({...s.body,idea});assert.equal(r.status,201);
  const row=s.sql.prepare('SELECT idea FROM idea_requests').get();assert.equal(row.idea,idea);
  assert.ok(!(await(await app.fetch(new Request(origin+'/idea'),{})).text()).includes(idea));
});
test('signed admin can update a case; a failed audit insert leaves the prior state intact',async()=>{
  const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  const id=crypto.randomUUID();sql.prepare("INSERT INTO idea_requests(id,idea,email,ip_hash,created_ms) VALUES(?,?,?,?,?)").run(id,'فكرة تجريبية صالحة لتدقيق رحلة الطلب','qa@example.invalid','qa',Date.now());
  const DB={prepare(query){return {bind(...args){return {query,args,first(){return sql.prepare(query).get(...args)}}}}},batch(stmts){sql.exec("BEGIN");try{const rs=stmts.map(s=>({meta:sql.prepare(s.query).run(...s.args)}));sql.exec("COMMIT");return rs;}catch(e){sql.exec("ROLLBACK");throw e;}}};
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='qa';
  const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const msg=encode({alg:'RS256',kid:'qa'})+'.'+encode({iss:'https://nameless-bonus-3327.cloudflareaccess.com',aud:'92323b54a2124456358a22cd875b15fc92c9f3b2374894f9dad1e0bf82c9a9df',exp:Math.floor(Date.now()/1000)+180,email:'qa@example.invalid'});
  const token=msg+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,Buffer.from(msg))).toString('base64url');
  const nativeFetch=globalThis.fetch;
  globalThis.fetch=async url=>{assert.equal(url,'https://nameless-bonus-3327.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[jwk]})};
  const edit=(status,from=origin)=>admin.fetch(new Request(origin+'/api/admin/ideas/'+id,{method:'PATCH',headers:{'cf-access-jwt-assertion':token,Origin:from,'content-type':'application/json'},body:JSON.stringify({status})}),{DB});
  try{
    assert.equal((await edit('reviewing','https://other.test')).status,403);
    assert.equal((await edit('reviewing')).status,200);
    assert.equal(sql.prepare("SELECT status FROM idea_requests").get().status,'reviewing');
    assert.equal(sql.prepare("SELECT count(*) n FROM idea_status_events").get().n,1);
    sql.exec("CREATE TRIGGER audit_failure BEFORE INSERT ON idea_status_events BEGIN SELECT RAISE(ABORT,'test'); END;");
    assert.equal((await edit('quoted')).status,503);
    assert.equal(sql.prepare("SELECT status FROM idea_requests").get().status,'reviewing');
  }finally{globalThis.fetch=nativeFetch;}
});
