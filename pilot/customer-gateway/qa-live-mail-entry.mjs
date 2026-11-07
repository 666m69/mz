// Disposable Queue-driven hosted QA: 17 real Skills D1 stages followed by
// verified mailbox proof, owner binding and ZIP delivery on THREE isolated D1s.
// Never deployed to production, no public HTTP; owner-approved real mailbox test only.
import skills from '../../skills-server/worker/index.mjs';
import {names as skillsPhases,runQaPhase} from '../../skills-server/qa/hosted-e2e-entry.mjs';
import {migrationStatements} from '../../skills-server/qa/migrations.mjs';
import customer,{purgeExpiredCustomerProofs} from './worker.mjs';
import {gatewaySchema} from './schema.mjs';
import {capability} from '../../skills-server/worker/security.mjs';

const portalPhases=[
 'portal-init','portal-link','portal-wrong-mail','portal-send','portal-confirm',
 'portal-status','portal-download','portal-cross','portal-revoke','portal-purge'];
const phases=[...skillsPhases,...portalPhases];
const fail=(ok,msg)=>{if(!ok)throw Error(msg)};
const qread=async(db,name)=>{const x=await db.prepare('SELECT value FROM qa_state WHERE key=?').bind(name).first();
  fail(!!x,'MISSING_QA_STATE_'+name);return x.value};
const qput=(db,name,v)=>db.prepare('INSERT INTO qa_state(key,value) VALUES(?,?)').bind(name,v).run();
const ref=id=>'MZ-'+id.slice(0,8).toUpperCase()+id.slice(-4).toUpperCase();
async function request(env,path,data,admin=false,cookie=null){
 const headers=new Headers();
 if(data!==undefined){headers.set('Origin','https://customer-qa.internal');headers.set('Content-Type','application/json')}
 if(admin)headers.set('Authorization','Bearer '+env.GATEWAY_ADMIN_SECRET);
 if(cookie)headers.set('Cookie',cookie);
 const e={GATEWAY_DB:env.GATEWAY_DB,IDEAS_DB:env.IDEAS_DB,
   GATEWAY_HMAC_KEY:env.GATEWAY_HMAC_KEY,GATEWAY_DATA_KEY:env.GATEWAY_DATA_KEY,
   GATEWAY_ADMIN_ENABLED:'yes',GATEWAY_ADMIN_SECRET:env.GATEWAY_ADMIN_SECRET,
   SKILLS_SERVICE:{fetch:req=>skills.fetch(req,env)},
   QA_EMAIL:env.QA_EMAIL,QA_VERIFIED_TO:'666m69@gmail.com'};
 return customer.fetch(new Request('https://customer-qa.internal'+path,
   {method:data===undefined?'GET':'POST',headers,
     ...(data===undefined?{}:{body:JSON.stringify(data)})}),e);
}
async function phaseRun(name,env,otp){
 const db=env.SKILLS_DB;
 if(skillsPhases.includes(name))return runQaPhase(name,env);
 if(name==='portal-init'){
  const tab=await env.GATEWAY_DB.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%'").first();
  fail(tab?.n===0,'NONEMPTY_GATEWAY_DB');
  for(const sql of migrationStatements(gatewaySchema))await env.GATEWAY_DB.prepare(sql).run();
  await env.IDEAS_DB.prepare('CREATE TABLE idea_requests(id TEXT PRIMARY KEY,email TEXT NOT NULL,status TEXT NOT NULL)').run();
  const id=crypto.randomUUID(),other=crypto.randomUUID();
  await env.IDEAS_DB.prepare("INSERT INTO idea_requests(id,email,status) VALUES(?,'666m69@gmail.com','building')").bind(id).run();
  await env.IDEAS_DB.prepare("INSERT INTO idea_requests(id,email,status) VALUES(?,'other@example.invalid','building')").bind(other).run();
  await qput(db,'customer_id',id);await qput(db,'customer_ref',ref(id));await qput(db,'other_ref',ref(other));
  return {gatewayD1Initialized:true,ideasD1Initialized:true,syntheticIdeaOnly:true,verifiedOwnerMailbox:true};
 }
 const idea=await qread(db,'customer_id'),reference=await qread(db,'customer_ref');
 if(name==='portal-link'){
  const requestId=await qread(db,'request_b'),runId=await qread(db,'run_b');
  const response=await request(env,'/api/customer/admin/link',{
    reference,skills_request_id:requestId,skills_run_id:runId,
    request_token:await capability(env,requestId)},true);
  fail(response.status===200,'BIND_HTTP_'+response.status);
  const row=await env.GATEWAY_DB.prepare('SELECT request_token_cipher FROM cv_deliveries WHERE idea_id=?').bind(idea).first();
  fail(row?.request_token_cipher?.includes('.')&&!row.request_token_cipher.includes(requestId),'PRIVATE_TOKEN_NOT_ENCRYPTED');
  return {approvedJobBound:true,capabilityEncrypted:true};
 }
 if(name==='portal-wrong-mail'){
  const response=await request(env,'/api/customer/verification/start',{reference,email:'stranger@example.invalid'});
  const challenge=await env.GATEWAY_DB.prepare('SELECT count(*) n FROM cv_challenges').first();
  fail(response.status===202&&challenge.n===0,'MAILBOX_ENUMERATION');
  const noCookie=await request(env,'/api/customer/requests/'+reference+'/artifact');
  fail(noCookie.status===404,'UNVERIFIED_DOWNLOAD');
  return {unknownEmailGeneric:true,unverifiedDownloadDenied:true};
 }
 if(name==='portal-send'){
  const response=await request(env,'/api/customer/verification/start',{reference,email:'666m69@gmail.com'});
  const c=await env.GATEWAY_DB.prepare('SELECT code_hash,expires_at FROM cv_challenges WHERE idea_id=?').bind(idea).first();
  fail(response.status===202&&/^[a-f0-9]{64}$/.test(c?.code_hash||'')&&c.expires_at>Math.floor(Date.now()/1000),'LIVE_EMAIL_SEND_NOT_ACCEPTED');
  return {registeredEmailOTPGenerated:true,providerAccepted:true,inboxReceiptPending:true};
 }
 if(name==='portal-confirm'){
  const code=otp;
  fail(typeof code==='string'&&/^\d{8}$/.test(code),'INVALID_EXTERNAL_MAILBOX_OTP');
  const wrong=await request(env,'/api/customer/verification/confirm',{
    reference,email:'666m69@gmail.com',code:code==='00000000'?'00000001':'00000000'});
  fail(wrong.status===401,'INCORRECT_OTP_ACCEPTED');
  const success=await request(env,'/api/customer/verification/confirm',{
    reference,email:'666m69@gmail.com',code});
  const cookie=success.headers.get('Set-Cookie');
  fail(success.status===200&&/HttpOnly; Secure; SameSite=Strict/.test(cookie||''),'VERIFIED_SESSION_NOT_ISSUED');
  const replay=await request(env,'/api/customer/verification/confirm',{
    reference,email:'666m69@gmail.com',code});
  fail(replay.status===401,'OTP_REPLAY_ALLOWED');
  await qput(db,'customer_cookie',cookie.split(';')[0]);
  return {verifiedSession:true,invalidOTPDenied:true,replayDenied:true};
 }
 const cookie=await qread(db,'customer_cookie');
 if(name==='portal-status'){
  const result=await request(env,'/api/customer/requests/'+reference,undefined,false,cookie);
  const j=await result.json();
  fail(result.status===200&&j.delivery==='ready'&&j.status==='building','PRIVATE_STATUS_WRONG');
  return {verifiedStatus:true,ready:true};
 }
 if(name==='portal-download'){
  const res=await request(env,'/api/customer/requests/'+reference+'/artifact',undefined,false,cookie);
  const bytes=new Uint8Array(await res.arrayBuffer());
  fail(res.status===200&&bytes.length>8000&&bytes.length<65536&&
    new DataView(bytes.buffer).getUint32(0,true)===0x04034b50,'PRIVATE_ZIP_NOT_DELIVERED');
  const source=new TextDecoder().decode(bytes);
  fail(source.includes('MZcode')&&source.includes('shopping')&&source.includes('مشترياتي'),'INCORRECT_DELIVERY_CONTENT');
  return {authenticatedZip:true,generatedFromUserIdea:true,zipBytes:bytes.length};
 }
 if(name==='portal-cross'){
  const other=await qread(db,'other_ref');
  const denied=await request(env,'/api/customer/requests/'+other+'/artifact',undefined,false,cookie);
  fail(denied.status===404,'CROSS_CUSTOMER_DOWNLOAD');
  return {crossCustomerDenied:true};
 }
 if(name==='portal-revoke'){
  const res=await request(env,'/api/customer/admin/revoke',{reference},true);
  fail(res.status===200,'OWNER_REVOKE_FAIL');
  const denied=await request(env,'/api/customer/requests/'+reference+'/artifact',undefined,false,cookie);
  fail(denied.status===404,'REVOKED_CUSTOMER_DOWNLOADED');
  return {adminRevoked:true,downloadDenied:true};
 }
 if(name==='portal-purge'){
  await env.GATEWAY_DB.prepare('UPDATE cv_challenges SET expires_at=0').run();
  await env.GATEWAY_DB.prepare('UPDATE cv_sessions SET expires_at=0').run();
  const report=await purgeExpiredCustomerProofs({
    GATEWAY_DB:env.GATEWAY_DB,IDEAS_DB:env.IDEAS_DB,
    GATEWAY_HMAC_KEY:env.GATEWAY_HMAC_KEY,GATEWAY_DATA_KEY:env.GATEWAY_DATA_KEY});
  const binding=await env.GATEWAY_DB.prepare('SELECT count(*) n FROM cv_deliveries').first();
  fail(report.challenges>=1&&report.sessions>=1&&binding.n===1,'QA_PURGE_INVALID');
  return {expiredOtpPurged:true,expiredSessionPurged:true,deliveryBindingKept:true};
 }
 throw Error('UNKNOWN_CUSTOMER_PHASE');
}
export default {
 async fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})},
 async queue(batch,env){
  if(!env.SKILLS_DB||!env.IDEAS_DB||!env.GATEWAY_DB||!env.QA_RESULTS||!env.QA_QUEUE||
    !env.QA_MESSAGE_NONCE||Date.now()>=Date.parse(env.QA_CLOSE_AT||''))return;
  for(const message of batch.messages){
   const {phase,nonce,code}=message.body||{};
   if(nonce!==env.QA_MESSAGE_NONCE||!phases.includes(phase))continue;
   try{
    const result=await phaseRun(phase,env,code);
    await env.QA_RESULTS.put('phase-'+phase,JSON.stringify({ok:true,phase,result}),{expirationTtl:3600});
    const next=phases[phases.indexOf(phase)+1];
    // Wait for independently confirmed Gmail message before sending the OTP in a second private Queue message.
    if(next&&phase!=='portal-send')await env.QA_QUEUE.send({phase:next,nonce:env.QA_MESSAGE_NONCE});
    else await env.QA_RESULTS.put('qa-complete',
      JSON.stringify({ok:true,executed:phases.length,lastPhase:phase}),{expirationTtl:3600});
   }catch(e){
    const err=String(e?.message||'failed').replace(/[0-9a-f]{24,}/gi,'[redacted]').slice(0,230);
    await env.QA_RESULTS.put('phase-'+phase,
      JSON.stringify({ok:false,phase,error:err}),{expirationTtl:3600});
   }
  }
 }
};

// Original synthetic QA remains at qa-entry.mjs; this one is for a single real mailbox with manual second-phase confirmation.
