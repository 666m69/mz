// Customer identity and private delivery gate for staging.
// Do not expose an endpoint that mints verification proofs to visitors.
// Only a trusted, separately authenticated email-verification service may
// call issueProof AFTER confirming mailbox ownership.
const enc=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function normalizeEmail(input){
 if(typeof input!=='string'||input.length>254)throw Error('invalid_email');
 const email=input.trim().toLowerCase();
 if(email.length>254||!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/.test(email)||/[\x00-\x1f\x7f]/.test(email))throw Error('invalid_email');
 return email;
}
async function digest(value){return hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));}
async function mac(secret,payload){
 if(typeof secret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(secret))throw Error('verification_secret_missing');
 const bytes=Uint8Array.from(atob(secret.replace(/-/g,'+').replace(/_/g,'/')+'='),x=>x.charCodeAt(0));
 const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,enc.encode(payload)));
}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
export async function issueProof({secret,requestId,email,now=Date.now(),ttlMs=600000}){
 if(!validId(requestId)||!Number.isSafeInteger(now)||ttlMs>600000||ttlMs<60000)throw Error('invalid_proof_parameters');
 const recipient=normalizeEmail(email),expires=Math.floor((now+ttlMs)/1000);
 const nonce=crypto.randomUUID();
 const emailHash=await digest(recipient);
 const payload=['mz-customer-proof-v1',requestId,emailHash,expires,nonce].join('.');
 return {proof:expires+'.'+nonce+'.'+await mac(secret,payload),emailHash,expires};
}
export async function verifyProof({secret,requestId,email,proof,now=Date.now()}){
 if(!validId(requestId)||typeof proof!=='string'||proof.length>160||!Number.isSafeInteger(now))return false;
 const m=/^(\d{10})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(proof);
 if(!m||!validId(m[2])||Number(m[1])*1000<=now||Number(m[1])*1000>now+600000)return false;
 let recipient;try{recipient=normalizeEmail(email)}catch{return false}
 const payload=['mz-customer-proof-v1',requestId,await digest(recipient),m[1],m[2]].join('.');
 return equal(m[3],await mac(secret,payload));
}
// The proof must be bound to the actual persisted customer/order mapping.
// No client-supplied request_id, email or artifact ID can override the row.
export async function authorizeCustomerDownload({db,secret,reference,email,proof,runId,now=Date.now()}){
 if(!db||typeof reference!=='string'||!/^[A-Z0-9-]{6,40}$/.test(reference)||!validId(runId))return {ok:false,code:'not_found'};
 const row=await db.prepare('SELECT request_id,email,verified_at,revoked_at FROM mz_customer_delivery WHERE reference=?').bind(reference).first();
 if(!row||row.revoked_at!==null||row.verified_at===null)return {ok:false,code:'not_found'};
 if(normalizeEmail(row.email)!==normalizeEmail(email)||!await verifyProof({secret,requestId:row.request_id,email:row.email,proof,now}))return {ok:false,code:'not_found'};
 const artifact=await db.prepare('SELECT job_id,download_expires_at,revoked_at FROM ss_artifacts WHERE job_id=? AND job_id IN (SELECT id FROM ss_jobs WHERE request_id=?)').bind(runId,row.request_id).first();
 if(!artifact||artifact.revoked_at!==null||!Number.isSafeInteger(artifact.download_expires_at)||artifact.download_expires_at<=Math.floor(now/1000))return {ok:false,code:'not_found'};
 return {ok:true,requestId:row.request_id,runId};
}
