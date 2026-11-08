// Ephemeral private hosted acceptance, synthetic data ONLY.
// Cloudflare Queue invokes this Worker. No public URL, email, billing change or production writes.
import ideas from '../mz-ideas-worker.js';
import admin from '../mz-ideas-admin-worker.js';
import gateway from '../customer-gateway/worker.mjs';

const base='https://mzcode-qa.internal', guestIP='198.51.100.47';
function check(ok,label){if(!ok)throw Error(label)}
const reference=id=>'MZ-'+id.slice(0,8).toUpperCase()+id.slice(-4).toUpperCase();
const query=(db,sql,...params)=>db.prepare(sql).bind(...params);
function request(url,method='GET',body=undefined,extraHeaders={}){
 const headers=new Headers(extraHeaders);
 if(body!==undefined){headers.set('Content-Type','application/json');headers.set('Origin',new URL(url).origin);}
 return new Request(url,{method,headers, ...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function archive(env){
 const result={steps:[]},ids=[];
 const clientEnv={DB:env.IDEAS_DB,HASH_SALT:env.QA_HASH_SALT};
 const idea='[QA SYNTHETIC] أريد أداة عربية لتنظيم مواعيد صيانة المركبات ومتابعة الحالة بشكل مصور دون تشغيل التطبيق.';
 async function submit(kind,consent,key,ip=guestIP){
  return ideas.fetch(request(base+'/api/ideas','POST',{
    idea,email:'',name:'',website:'',consent:'yes',idea_kind:kind,reuse_permission:consent
   },{'Idempotency-Key':key,'CF-Connecting-IP':ip}),clientEnv);
 }
 try{
  const k1=crypto.randomUUID(),a=await submit('concept',false,k1);
  check(a.status===201,'archive_first_save_'+a.status);
  const first=await a.json();ids.push(first.id);
  check(/^MZ-[A-F0-9]{12}$/.test(first.reference),'archive_reference');
  const row=await query(env.IDEAS_DB,
   'SELECT idea_kind,reuse_permission,concept_consent_version FROM idea_requests WHERE id=?',first.id).first();
  check(row.idea_kind==='concept'&&row.reuse_permission===0&&row.concept_consent_version==='visual-v1-2026-11-08','archive_permission_default');
  result.steps.push('persist_private_opt_out');
  const replay=await submit('concept',false,k1);
  check(replay.status===200&&(await replay.json()).reference===first.reference,'archive_retry_dedup');
  const changed=await submit('concept',true,k1);
  check(changed.status===409,'archive_permission_flip_allowed');
  result.steps.push('dedup_and_permission_immutability');
  const k2=crypto.randomUUID(),b=await submit('concept',true,k2,'198.51.100.48');
  check(b.status===201,'archive_opt_in_save_'+b.status);
  const second=await b.json();ids.push(second.id);
  const allowed=await query(env.IDEAS_DB,'SELECT reuse_permission FROM idea_requests WHERE id=?',second.id).first();
  check(allowed.reuse_permission===1,'archive_opt_in_not_saved');
  result.steps.push('explicit_product_reuse_opt_in');
  const noConsent=await ideas.fetch(request(base+'/api/ideas','POST',{
   idea,email:'',name:'',website:'',consent:'',idea_kind:'concept',reuse_permission:true
  },{'CF-Connecting-IP':guestIP}),clientEnv);
  check(noConsent.status===400,'archive_consent_required');
  const tracked=await ideas.fetch(request(base+'/api/ideas/'+first.reference),clientEnv);
  const tracking=await tracked.json();
  check(tracked.status===200&&tracking.status==='new'&&!('idea' in tracking)&&!('email' in tracking),'archive_public_tracking_leaks');
  result.steps.push('consent_required_and_tracking_redacted');
  const denied=await admin.fetch(request('https://mzcodehub.com/api/admin/archive'),{DB:env.IDEAS_DB});
  check(denied.status===403,'archive_unprotected');
  result.steps.push('admin_access_denied_without_jwt');
  result.pass=true;return result;
 }finally{
  for(const id of ids)await query(env.IDEAS_DB,'DELETE FROM idea_requests WHERE id=?',id).run();
 }
}
async function delivery(env){
 const results={steps:[]},ids=[];
 const clientEnv={DB:env.IDEAS_DB,HASH_SALT:env.QA_HASH_SALT};
 const idea='[QA SYNTHETIC] أحتاج إدارة مهام بسيطة لمشروع تجاري بشكل مبدئي ولا أوافق على تسليم الكود دون اتفاق مستقل.';
 const email='test-client@example.invalid';
 const requestId=crypto.randomUUID(),runId=crypto.randomUUID();
 const token='r.'+requestId+'.'+'a'.repeat(64);
 const zip=new Uint8Array(128);zip.set([80,75,3,4]);
 let code=null,skillsCalls=0,artifactCalls=0;
 const fakeService={async fetch(req){
  skillsCalls++;
  const p=new URL(req.url).pathname;
  if(p==='/api/requests/'+requestId)return Response.json({id:requestId,runs:[{id:runId,status:'succeeded'}]});
  if(p==='/api/requests/'+requestId+'/runs/'+runId+'/artifact'){artifactCalls++;return new Response(zip,{status:200,headers:{'Content-Type':'application/zip'}});}
  if(p==='/api/requests/'+requestId+'/runs/'+runId)return Response.json({status:'succeeded'});
  return new Response(null,{status:404});
 }};
 const gatEnv={
  GATEWAY_DB:env.GATEWAY_DB,IDEAS_DB:env.IDEAS_DB,
  GATEWAY_HMAC_KEY:env.GATEWAY_HMAC_KEY,GATEWAY_DATA_KEY:env.GATEWAY_DATA_KEY,
  GATEWAY_ADMIN_SECRET:env.GATEWAY_ADMIN_SECRET,GATEWAY_ADMIN_ENABLED:'yes',
  SKILLS_SERVICE:fakeService,
  TEST_MAILER:{async send(msg){
   code=/MZcode: (\d{8})/.exec(msg.text)?.[1]||null;
   check(msg.to.length===1&&msg.to[0]===email&&/^\d{8}$/.test(code||''),'qa_fake_mail_bad');
   return true;
  }}
 };
 const customer=(path,method='GET',body=undefined,extra={})=>
    gateway.fetch(request('https://customer-qa.internal'+path,method,body,extra),gatEnv);
 try{
  const uuid=crypto.randomUUID();
  const saved=await ideas.fetch(request(base+'/api/ideas','POST',{
   idea,name:'QA synthetic',email,website:'',consent:'yes',idea_kind:'execution',reuse_permission:false
  },{'Idempotency-Key':uuid,'CF-Connecting-IP':'198.51.100.49'}),clientEnv);
  check(saved.status===201,'delivery_idea_not_saved_'+saved.status);
  const entry=await saved.json();ids.push(entry.id);
  await query(env.IDEAS_DB,"UPDATE idea_requests SET status='building' WHERE id=?",entry.id).run();
  const payload={reference:entry.reference,skills_request_id:requestId,skills_run_id:runId,request_token:token};
  const auth={'Authorization':'Bearer '+env.GATEWAY_ADMIN_SECRET};
  const link=await customer('/api/customer/admin/link','POST',payload,auth);
  check(link.status===200,'delivery_owner_link_'+link.status);
  results.steps.push('owner_links_reviewed_job_synthetic_stub');
  const wrong=await customer('/api/customer/verification/start','POST',{reference:entry.reference,email:'outsider@example.invalid'});
  check(wrong.status===202&&code===null,'delivery_email_enumeration');
  const start=await customer('/api/customer/verification/start','POST',{reference:entry.reference,email});
  check(start.status===202&&/^\d{8}$/.test(code||''),'delivery_fake_mail_not_received');
  const invalid=await customer('/api/customer/verification/confirm','POST',{reference:entry.reference,email,code:code==='00000000'?'99999999':'00000000'});
  check(invalid.status===401,'delivery_bad_code_accepted');
  const valid=await customer('/api/customer/verification/confirm','POST',{reference:entry.reference,email,code});
  const cookie=valid.headers.get('Set-Cookie')||'';
  check(valid.status===200&&cookie.includes('HttpOnly; Secure; SameSite=Strict'),'delivery_cookie_missing');
  const replay=await customer('/api/customer/verification/confirm','POST',{reference:entry.reference,email,code});
  check(replay.status===401,'delivery_otp_replay');
  results.steps.push('otp_wrong_mail_replay_and_verified_cookie');
  const session={'Cookie':cookie.split(';')[0]};
  const pre=await customer('/api/customer/requests/'+entry.reference, 'GET',undefined,session);
  const preValue=await pre.json();
  check(pre.status===200&&preValue.delivery==='agreement_required','delivery_preagreement_status');
  const initialArtifacts=artifactCalls;
  const blocked=await customer('/api/customer/requests/'+entry.reference+'/artifact','GET',undefined,session);
  check(blocked.status===409&&artifactCalls===initialArtifacts,'delivery_without_contract_exposed_artifact');
  results.steps.push('server_side_no_zip_before_signed_agreement');
  const approved=await customer('/api/customer/admin/approve','POST',{
    reference:entry.reference,agreement_sha256:'b'.repeat(64)
  },auth);
  check(approved.status===200,'delivery_owner_agreement_'+approved.status);
  const duplicate=await customer('/api/customer/admin/approve','POST',{
    reference:entry.reference,agreement_sha256:'c'.repeat(64)
  },auth);
  check(duplicate.status===409,'delivery_contract_rewritten');
  const later=await customer('/api/customer/requests/'+entry.reference,'GET',undefined,session);
  check((await later.json()).delivery==='ready','delivery_after_contract_not_ready');
  const unlocked=await customer('/api/customer/requests/'+entry.reference+'/artifact','GET',undefined,session);
  check(unlocked.status===200&&unlocked.headers.get('Content-Type')==='application/zip','delivery_post_contract_denied');
  const bytes=await unlocked.arrayBuffer();
  check(bytes.byteLength===128&&new DataView(bytes).getUint32(0,true)===0x04034b50,'delivery_invalid_synthetic_zip');
  results.steps.push('owner_recorded_agreement_allows_private_stub_artifact');
  const other=reference(crypto.randomUUID());
  check((await customer('/api/customer/requests/'+other+'/artifact','GET',undefined,session)).status===404,'delivery_cross_reference_access');
  const rev=await customer('/api/customer/admin/revoke','POST',{reference:entry.reference},auth);
  check(rev.status===200,'delivery_revoke_failed');
  check((await customer('/api/customer/requests/'+entry.reference+'/artifact','GET',undefined,session)).status===404,'delivery_revoked_still_accessible');
  results.steps.push('cross_customer_denied_and_revoked');
  results.pass=true;results.testing='synthetic skills response, not a live real app build';
  return results;
 }finally{
  for(const id of ids)await query(env.IDEAS_DB,'DELETE FROM idea_requests WHERE id=?',id).run();
 }
}
export default {
 async fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})},
 async queue(batch,env){
  if(!env.IDEAS_DB||!env.GATEWAY_DB||!env.QA_HASH_SALT||!env.QA_MESSAGE_NONCE||
     Date.now()>=Date.parse(env.QA_CLOSE_AT||'')||!env.QA_CLOSE_AT)return;
  for(const message of batch.messages){
   const body=message.body||{};
   if(body.nonce!==env.QA_MESSAGE_NONCE||!['archive','delivery'].includes(body.phase))continue;
   try{
    const result=body.phase==='archive'?await archive(env):await delivery(env);
    await query(env.GATEWAY_DB,'INSERT INTO qa_results(phase,ok,result) VALUES(?,?,?) ON CONFLICT(phase) DO NOTHING',
     body.phase,result.pass?1:0,JSON.stringify(result)).run();
   }catch(e){
    await query(env.GATEWAY_DB,'INSERT INTO qa_results(phase,ok,result) VALUES(?,?,?) ON CONFLICT(phase) DO NOTHING',
     body.phase,0,JSON.stringify({pass:false,error:String(e?.message||'failed').slice(0,120)})).run();
   }
  }
 }
};
