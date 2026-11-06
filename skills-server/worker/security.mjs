export class ApiError extends Error {
  constructor(status, code) { super(code); this.status=status; this.code=code; }
}
export function requireThat(condition,status,code) { if(!condition) throw new ApiError(status,code); }
const enc=new TextEncoder(), dec=new TextDecoder();
export const size=s=>enc.encode(s).length;
export const id=()=>crypto.randomUUID();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export const hash=async value=>hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));
const b64=bytes=>btoa(Array.from(new Uint8Array(bytes),c=>String.fromCharCode(c)).join(''));
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function fixed(a,b) {
  if(a.length!==b.length)return false;
  let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;
}
function secret(s) {
  requireThat(typeof s==='string' && /^[A-Za-z0-9_-]{43}$/.test(s),503,'secret_unavailable');
  return from64(s.replaceAll('-','+').replaceAll('_','/')+'=');
}
export async function mac(env,message) {
  const key=await crypto.subtle.importKey('raw',secret(env.CAPABILITY_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',key,enc.encode(message)));
}
export async function capability(env,requestId) {
  return 'r.'+requestId+'.'+await mac(env,'private-request-v1/'+requestId);
}
export async function authenticate(req,env) {
  const m=/^Bearer ([A-Za-z0-9_.-]{43,160})$/.exec(req.headers.get('Authorization')||'');
  requireThat(m,401,'unauthorized');
  const tok=m[1];
  if(tok.startsWith('r.')) {
    const parts=tok.split('.');
    requireThat(parts.length===3 && /^[0-9a-f-]{36}$/.test(parts[1]) && fixed(tok,await capability(env,parts[1])),401,'unauthorized');
    return {role:'request',subject:parts[1]};
  }
  const h=await hash(tok);
  requireThat(env.OWNER_TOKEN_SHA256!==env.RUNNER_TOKEN_SHA256 && /^[0-9a-f]{64}$/.test(env.OWNER_TOKEN_SHA256||'')
    && /^[0-9a-f]{64}$/.test(env.RUNNER_TOKEN_SHA256||''),503,'secret_unavailable');
  if(fixed(h,env.OWNER_TOKEN_SHA256))return {role:'owner',subject:'owner'};
  if(fixed(h,env.RUNNER_TOKEN_SHA256))return {role:'runner',subject:'runner'};
  throw new ApiError(401,'unauthorized');
}
async function dataKey(env) {
  requireThat(env.DATA_KEY!==env.CAPABILITY_KEY,503,'secret_unavailable');
  return crypto.subtle.importKey('raw',secret(env.DATA_KEY),'AES-GCM',false,['encrypt','decrypt']);
}
export async function seal(env,context,data) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(context)},await dataKey(env),enc.encode(JSON.stringify(data)));
  return b64(iv)+'.'+b64(cipher);
}
export async function unseal(env,context,value) {
  const [iv,cipher]=value.split('.');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(iv),additionalData:enc.encode(context)},await dataKey(env),from64(cipher));
  return JSON.parse(dec.decode(plain));
}
export function fields(obj,allowed,required=allowed) {
  requireThat(obj && typeof obj==='object' && !Array.isArray(obj) && required.every(k=>Object.hasOwn(obj,k))
    && Object.keys(obj).every(k=>allowed.includes(k)),422,'invalid_fields');
}
export async function readJson(req, max=8192) {
  requireThat(/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??''),415,'json_required');
  requireThat(Number(req.headers.get('content-length')??0)<=max,413,'body_too_large');
  const reader=req.body?.getReader();requireThat(reader,400,'invalid_json');
  const chunks=[];let total=0;
  for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;
    if(total>max){await reader.cancel();throw new ApiError(413,'body_too_large');}chunks.push(value);}
  const bytes=new Uint8Array(total);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
  try{return JSON.parse(dec.decode(bytes));}catch{throw new ApiError(400,'invalid_json');}
}
export function canonical(o) {
  if(Array.isArray(o))return '['+o.map(canonical).join(',')+']';
  if(o && typeof o==='object')return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';
  return JSON.stringify(o);
}
