// Staging-only MZcode customer handoff. No production routing is enabled.
// A reference is PUBLIC status; only mailbox proof grants access to private ZIP.
// Uses an isolated gateway D1, existing read-only IDEAS_DB and private Worker
// service binding to Skills Server; never exposes its private request capability.
const encoder=new TextEncoder();
const MAX_BODY=4096, CODE_LIFETIME=600, SESSION_LIFETIME=1800;
const refPattern=/^MZ-[A-F0-9]{12}$/i;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{...safeHeaders,...extra}});
const fail=(status,code)=>json({error:code},status);
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const hash=async s=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))));
const to64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const from64=s=>{if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error('invalid_base64url');const value=s.replaceAll('-','+').replaceAll('_','/');return Uint8Array.from(atob(value.padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0))};
const randomToken=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return to64(b)};
const key=s=>{if(typeof s!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(s))throw Error('gateway_secret_not_configured');return from64(s)};
const mac=async(secret,message)=>hex(new Uint8Array(await crypto.subtle.sign('HMAC',
  await crypto.subtle.importKey('raw',key(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),
  encoder.encode(message))));
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&
  [...a].reduce((v,c,i)=>v|(c.charCodeAt(0)^b.charCodeAt(i)),0)===0;
const normEmail=e=>typeof e==='string'&&e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
  ?e.trim().toLowerCase():null;
const validRef=v=>typeof v==='string'&&refPattern.test(v)?v.toUpperCase():null;
const emailDigest=(env,email)=>mac(env.GATEWAY_HMAC_KEY,'email/v1/'+email);
const codeDigest=(env,id,nonce,code)=>mac(env.GATEWAY_HMAC_KEY,'otp/v1/'+id+'/'+nonce+'/'+code);
const sec=()=>Math.floor(Date.now()/1000);
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
async function parse(req){
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('Content-Type')||''))throw {status:415,error:'json_required'};
  if(Number(req.headers.get('Content-Length')||0)>MAX_BODY)throw {status:413,error:'body_too_large'};
  if(!req.body)throw {status:400,error:'invalid_json'};
  const r=req.body.getReader(),parts=[];let size=0;
  for(;;){const {done,value}=await r.read();if(done)break;size+=value.byteLength;
    if(size>MAX_BODY){await r.cancel();throw {status:413,error:'body_too_large'}}parts.push(value)}
  const buf=new Uint8Array(size);let at=0;for(const p of parts){buf.set(p,at);at+=p.length}
  try{const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buf));
    if(!data||typeof data!=='object'||Array.isArray(data))throw Error('object_required');
    return data;
  }catch{throw {status:400,error:'invalid_json'}}
}
const fields=(b,expected)=>b&&Object.keys(b).every(k=>expected.includes(k))&&
  expected.every(k=>Object.hasOwn(b,k));
const originOk=req=>{const u=new URL(req.url);return u.protocol==='https:'&&req.headers.get('Origin')===u.origin};
async function lookup(env,reference){
  if(!validRef(reference))return null;
  const suffix=reference.slice(3).toLowerCase();
  const rows=(await stmt(env.IDEAS_DB,
    "SELECT id,email,status FROM idea_requests WHERE (substr(id,1,8)||substr(id,-4))=? LIMIT 2",suffix).all()).results;
  return rows.length===1&&uuid.test(rows[0].id)?rows[0]:null;
}
async function limit(env,scope,subject,max){
  const subjectHash=await mac(env.GATEWAY_HMAC_KEY,'limit/v1/'+scope+'/'+subject);
  return !!await stmt(env.GATEWAY_DB,`
    INSERT INTO cv_limits(scope,subject_hash,hour_bucket,used) VALUES(?,?,?,1)
    ON CONFLICT(scope,subject_hash,hour_bucket)
    DO UPDATE SET used=cv_limits.used+1 WHERE cv_limits.used<?
    RETURNING used`,scope,subjectHash,Math.floor(sec()/3600),max).first();
}
function newCode(){
  // Avoid modulo bias: pick uniformly in the eight-digit space.
  const bound=100000000,upper=Math.floor(4294967296/bound)*bound,bytes=new Uint32Array(1);
  do{crypto.getRandomValues(bytes)}while(bytes[0]>=upper);
  return String(bytes[0]%bound).padStart(8,'0');
}
async function sendCode(env,to,reference,code){
  const payload={from:'MZcode Hub <info@mzcodehub.com>',to:[to],
    reply_to:'info@mzcodehub.com',subject:'رمز استلام طلبك | '+reference,
    text:'رمز التحقق الخاص باستلام مشروعك في MZcode: '+code+
      '\nرقم الطلب: '+reference+'\nتنتهي صلاحية الرمز خلال 10 دقائق.'+
      '\nإذا لم تطلب هذا الرمز، تجاهل الرسالة. لا تشارك الرمز مع أحد.'};
  if(env.TEST_MAILER?.send)return env.TEST_MAILER.send(payload);
  // Free Cloudflare Email Routing supports sending only to account-verified
  // destinations. QA binds QA_EMAIL to exactly one recipient, never arbitrary.
  if(env.QA_EMAIL?.send){
    if(typeof env.QA_VERIFIED_TO!=='string'||to.toLowerCase()!==env.QA_VERIFIED_TO.toLowerCase())
      return false;
    const receipt=await env.QA_EMAIL.send({
      from:'info@mzcodehub.com',to,subject:payload.subject,text:payload.text,
      replyTo:'info@mzcodehub.com'
    });
    return typeof receipt?.messageId==='string'&&receipt.messageId.length>0;
  }
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
  if(!response.ok)return false;
  const j=await response.json().catch(()=>null);
  return Boolean(j?.id);
}
function prepared(env){
  key(env.GATEWAY_HMAC_KEY);key(env.GATEWAY_DATA_KEY);
  if(env.GATEWAY_HMAC_KEY===env.GATEWAY_DATA_KEY||!env.GATEWAY_DB||!env.IDEAS_DB)throw Error('gateway_config_missing');
}
async function start(req,env){
  const body=await parse(req);
  if(!fields(body,['reference','email']))return fail(422,'invalid_fields');
  const reference=validRef(body.reference),email=normEmail(body.email);
  if(!reference||!email)return fail(422,'invalid_fields');
  const remote=req.headers.get('CF-Connecting-IP')||'unknown';
  if(!await limit(env,'start-ip',remote,8))return fail(429,'try_later');
  // Generic response for a nonexistent reference or wrong address; never enumerate.
  const ack=()=>json({ok:true,message:'if_matched_a_code_was_sent'},202);
  const idea=await lookup(env,reference);
  if(!idea||!idea.email||idea.email.toLowerCase()!==email)return ack();
  if(!env.RESEND_API_KEY&&!env.TEST_MAILER&&!env.QA_EMAIL)return fail(503,'verification_unavailable');
  if(!await limit(env,'start-idea',idea.id,3))return ack();
  const challengeId=crypto.randomUUID(),code=newCode(),digest=await codeDigest(env,idea.id,challengeId,code);
  await stmt(env.GATEWAY_DB,`INSERT INTO cv_challenges
    (idea_id,code_hash,email_hash,challenge_id,expires_at,attempts,consumed_at,created_at)
    VALUES(?,?,?,?,?,0,NULL,unixepoch())
    ON CONFLICT(idea_id) DO UPDATE SET
      code_hash=excluded.code_hash,email_hash=excluded.email_hash,
      challenge_id=excluded.challenge_id,expires_at=excluded.expires_at,
      attempts=0,consumed_at=NULL,created_at=unixepoch()`,
    idea.id,digest,await emailDigest(env,email),challengeId,sec()+CODE_LIFETIME).run();
  let accepted=false;
  try{accepted=await sendCode(env,email,reference,code)}catch{accepted=false}
  if(!accepted){
    await stmt(env.GATEWAY_DB,'DELETE FROM cv_challenges WHERE idea_id=? AND challenge_id=?',
      idea.id,challengeId).run();
  }
  return ack();
}
async function confirm(req,env){
  const b=await parse(req);
  if(!fields(b,['reference','email','code']))return fail(422,'invalid_fields');
  const ref=validRef(b.reference),email=normEmail(b.email);
  if(!ref||!email||typeof b.code!=='string'||!/^\d{8}$/.test(b.code))return fail(422,'invalid_fields');
  if(!await limit(env,'confirm-ip',req.headers.get('CF-Connecting-IP')||'unknown',20))
    return fail(429,'try_later');
  const invalid=()=>fail(401,'verification_failed');
  const idea=await lookup(env,ref);
  if(!idea||!idea.email||idea.email.toLowerCase()!==email)return invalid();
  const emailHash=await emailDigest(env,email);
  const candidate=await stmt(env.GATEWAY_DB,`UPDATE cv_challenges
    SET attempts=attempts+1 WHERE idea_id=? AND email_hash=?
    AND consumed_at IS NULL AND expires_at>unixepoch() AND attempts<5
    RETURNING code_hash,challenge_id`,idea.id,emailHash).first();
  if(!candidate)return invalid();
  const computed=await codeDigest(env,idea.id,candidate.challenge_id,b.code);
  if(!equal(computed,candidate.code_hash))return invalid();
  const used=await stmt(env.GATEWAY_DB,`UPDATE cv_challenges SET consumed_at=unixepoch()
    WHERE idea_id=? AND challenge_id=? AND consumed_at IS NULL
    RETURNING idea_id`,idea.id,candidate.challenge_id).first();
  if(!used)return invalid();
  const token=randomToken();
  await stmt(env.GATEWAY_DB,'INSERT INTO cv_sessions(token_hash,idea_id,expires_at) VALUES(?,?,?)',
    await hash(token),idea.id,sec()+SESSION_LIFETIME).run();
  return json({ok:true,reference:ref,expires_in:SESSION_LIFETIME},200,{
    'Set-Cookie':'mzcode_session='+token+
      '; Path=/api/customer; Max-Age='+SESSION_LIFETIME+'; HttpOnly; Secure; SameSite=Strict'});
}
async function authorized(req,env,ref){
  const matches=[...(req.headers.get('Cookie')||'').matchAll(/(?:^|;\s*)mzcode_session=([A-Za-z0-9_-]{43})(?=;|$)/g)];
  if(matches.length!==1)return null;
  const row=await stmt(env.GATEWAY_DB,'SELECT idea_id FROM cv_sessions WHERE token_hash=? AND expires_at>unixepoch()',
    await hash(matches[0][1])).first();
  if(!row)return null;
  const idea=await lookup(env,ref);
  if(!idea||row.idea_id!==idea.id)return null;
  return idea;
}
async function skillCall(env,requestId,runId,token,artifact=false){
  const path='/api/requests/'+requestId+'/runs/'+runId+(artifact?'/artifact':'');
  return env.SKILLS_SERVICE.fetch(new Request('https://skills.internal'+path,{
    headers:{Authorization:'Bearer '+token,'Cache-Control':'no-store'}}));
}
async function decryptToken(env,ideaId,value){
  const [iv,cipher]=value.split('.');
  const k=await crypto.subtle.importKey('raw',key(env.GATEWAY_DATA_KEY),'AES-GCM',false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(iv),
    additionalData:encoder.encode('delivery/v1/'+ideaId)},k,from64(cipher));
  return new TextDecoder().decode(plain);
}
async function encryptToken(env,ideaId,token){
  const iv=new Uint8Array(12);crypto.getRandomValues(iv);
  const k=await crypto.subtle.importKey('raw',key(env.GATEWAY_DATA_KEY),'AES-GCM',false,['encrypt']);
  const blob=await crypto.subtle.encrypt({name:'AES-GCM',iv,
    additionalData:encoder.encode('delivery/v1/'+ideaId)},k,encoder.encode(token));
  return to64(iv)+'.'+to64(new Uint8Array(blob));
}
async function customerStatus(req,env,ref,download=false){
  const idea=await authorized(req,env,ref);
  if(!idea)return fail(404,'not_found');
  const link=await stmt(env.GATEWAY_DB,'SELECT * FROM cv_deliveries WHERE idea_id=?',idea.id).first();
  if(!link||link.revoked_at!==null){
    return download?fail(404,'not_found'):json({ok:true,reference:ref,status:idea.status,delivery:'not_ready'});
  }
  if(!env.SKILLS_SERVICE)return fail(503,'delivery_unavailable');
  let token;
  try{token=await decryptToken(env,idea.id,link.request_token_cipher)}
  catch{return fail(503,'delivery_unavailable')}
  if(!/^r\.[0-9a-f-]{36}\.[0-9a-f]{64}$/.test(token))return fail(503,'delivery_unavailable');
  if(download){
    const upstream=await skillCall(env,link.skills_request_id,link.skills_run_id,token,true);
    if(upstream.status!==200||!/application\/zip/i.test(upstream.headers.get('Content-Type')||''))
      return fail(404,'not_found');
    const body=await upstream.arrayBuffer();
    if(body.byteLength<22||body.byteLength>65536||new DataView(body).getUint32(0,true)!==0x04034b50)
      return fail(502,'invalid_artifact');
    return new Response(body,{status:200,headers:{...safeHeaders,
      'Content-Type':'application/zip',
      'Content-Disposition':'attachment; filename="mzcode-'+ref+'.zip"'}});
  }
  const upstream=await skillCall(env,link.skills_request_id,link.skills_run_id,token);
  const info=upstream.status===200?await upstream.json().catch(()=>null):null;
  return json({ok:true,reference:ref,status:idea.status,
    delivery:info?.status==='succeeded'?'ready':'not_ready'});
}
async function admin(req,env,operation){
  if(env.GATEWAY_ADMIN_ENABLED!=='yes'||!env.GATEWAY_ADMIN_SECRET)return fail(404,'not_found');
  const token=req.headers.get('Authorization')||'';
  if(!equal(token,'Bearer '+env.GATEWAY_ADMIN_SECRET))return fail(403,'forbidden');
  key(env.GATEWAY_ADMIN_SECRET);
  const b=await parse(req),ref=validRef(b.reference);
  if(operation==='link'){
    if(!fields(b,['reference','skills_request_id','skills_run_id','request_token'])||
       !ref||!uuid.test(b.skills_request_id)||!uuid.test(b.skills_run_id)||
       b.request_token!=='r.'+b.skills_request_id+'.'+(b.request_token.split('.')[2]||'')||
       !/^r\.[0-9a-f-]{36}\.[0-9a-f]{64}$/.test(b.request_token))return fail(422,'invalid_fields');
    const idea=await lookup(env,ref);
    if(!idea||!idea.email||!['accepted','building','delivered'].includes(idea.status))return fail(409,'not_approved');
    if(!env.SKILLS_SERVICE)return fail(503,'delivery_unavailable');
    const identity=await env.SKILLS_SERVICE.fetch(new Request('https://skills.internal/api/requests/'+b.skills_request_id,{
      headers:{Authorization:'Bearer '+b.request_token}}));
    if(identity.status!==200)return fail(409,'skills_identity_not_verified');
    const data=await identity.json().catch(()=>null);
    if(data?.id!==b.skills_request_id||!data?.runs?.some(x=>x.id===b.skills_run_id&&x.status==='succeeded'))
      return fail(409,'skills_run_not_verified');
    const artifact=await skillCall(env,b.skills_request_id,b.skills_run_id,b.request_token,true);
    if(artifact.status!==200||!/application\/zip/i.test(artifact.headers.get('Content-Type')||''))
      return fail(409,'artifact_not_available');
    const cipher=await encryptToken(env,idea.id,b.request_token);
    const saved=await stmt(env.GATEWAY_DB,`INSERT INTO cv_deliveries
      (idea_id,skills_request_id,skills_run_id,request_token_cipher) VALUES(?,?,?,?)
      ON CONFLICT(idea_id) DO NOTHING`,idea.id,b.skills_request_id,b.skills_run_id,cipher).run();
    if(saved.meta?.changes!==1)return fail(409,'already_linked');
    return json({ok:true,reference:ref,delivery:'linked'});
  }
  if(operation==='revoke'){
    if(!fields(b,['reference'])||!ref)return fail(422,'invalid_fields');
    const idea=await lookup(env,ref);
    if(!idea)return fail(404,'not_found');
    const result=await stmt(env.GATEWAY_DB,
      'UPDATE cv_deliveries SET revoked_at=unixepoch() WHERE idea_id=? AND revoked_at IS NULL',
      idea.id).run();
    return json({ok:true,revoked:(result.meta?.changes||0)>0});
  }
  return fail(404,'not_found');
}
// Expired proofs, session credentials and rate buckets contain no customer ideas.
// Run through an explicitly configured Cron Trigger; no cron is enabled by source.
export async function purgeExpiredCustomerProofs(env){
  prepared(env);
  const challenges=await stmt(env.GATEWAY_DB,
    'DELETE FROM cv_challenges WHERE expires_at<=unixepoch() OR consumed_at<unixepoch()-3600').run();
  const sessions=await stmt(env.GATEWAY_DB,
    'DELETE FROM cv_sessions WHERE expires_at<=unixepoch()').run();
  const limits=await stmt(env.GATEWAY_DB,
    'DELETE FROM cv_limits WHERE hour_bucket<cast(unixepoch()/3600 as integer)-48').run();
  return {challenges:challenges.meta?.changes||0,sessions:sessions.meta?.changes||0,
    limits:limits.meta?.changes||0};
}
async function logout(req,env){
  const cookies=[...(req.headers.get('Cookie')||'').matchAll(/(?:^|;\\s*)mzcode_session=([A-Za-z0-9_-]{43})(?=;|$)/g)];
  if(cookies.length===1)await stmt(env.GATEWAY_DB,
    'DELETE FROM cv_sessions WHERE token_hash=?',await hash(cookies[0][1])).run();
  return json({ok:true},200,{'Set-Cookie':
    'mzcode_session=; Path=/api/customer; Max-Age=0; HttpOnly; Secure; SameSite=Strict'});
}
export default {
  async scheduled(_controller,env,ctx){
    const p=purgeExpiredCustomerProofs(env);
    if(ctx?.waitUntil){ctx.waitUntil(p);return}
    return p;
  },
  async fetch(req,env){
  try{
    prepared(env);
    const u=new URL(req.url),path=u.pathname,method=req.method;
    if(u.protocol!=='https:'||u.search)return fail(404,'not_found');
    if(method==='POST'){
      if(!originOk(req))return fail(403,'foreign_origin');
      if(path==='/api/customer/verification/start')return start(req,env);
      if(path==='/api/customer/verification/confirm')return confirm(req,env);
      if(path==='/api/customer/session/logout')return logout(req,env);
      if(path==='/api/customer/admin/link')return admin(req,env,'link');
      if(path==='/api/customer/admin/revoke')return admin(req,env,'revoke');
    }
    const route=/^\/api\/customer\/requests\/(MZ-[A-F0-9]{12})(\/artifact)?$/i.exec(path);
    if(method==='GET'&&route)return customerStatus(req,env,route[1].toUpperCase(),Boolean(route[2]));
    return fail(404,'not_found');
  }catch(e){
    if(e?.status)return fail(e.status,e.error);
    // Never expose customer addresses, OTPs, private capabilities or D1 internals.
    console.error('customer_gateway_unavailable');
    return fail(503,'temporarily_unavailable');
  }
}};
