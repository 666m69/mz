// Protected read-only idea inbox. Requires verified Cloudflare Access JWT and official hostname.
const AUTH_DOMAIN="nameless-bonus-3327.cloudflareaccess.com";
const ISS="https://"+AUTH_DOMAIN;
const AUD="92323b54a2124456358a22cd875b15fc92c9a9df";
const PAGE="<!doctype html><html lang=\"ar\" dir=\"rtl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>طلبات الأفكار | إدارة MZ Code Hub</title><style>*{box-sizing:border-box}body{margin:0;background:#081520;color:#ecf6fa;font:16px system-ui}.wrap{max-width:1050px;margin:auto;padding:25px}a{color:#86e4cf}h1{margin:0 0 8px}p,small{color:#9eb6c2}.head{display:flex;align-items:center;justify-content:space-between;gap:16px}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:20px 0}input,select,button{font:inherit;border:1px solid #365669;border-radius:9px;background:#162c3a;color:#f5fcff;padding:11px}.controls input{min-width:210px;flex:1}.items{display:grid;gap:14px}article{border:1px solid #28475a;border-radius:15px;background:#102332;padding:18px}.row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.row strong{font-size:20px}.status{padding:4px 9px;border-radius:7px;background:#244b46;font-size:13px}.idea{white-space:pre-wrap;line-height:1.65;margin:14px 0;color:#e5f3fc}.meta{font-size:12px;color:#a5becb;direction:ltr;text-align:left;overflow-wrap:anywhere}.empty{padding:40px;text-align:center;border:1px dashed #3a6572;border-radius:12px}@media(max-width:550px){.wrap{padding:14px}.head{display:block}} </style>\n<div class=\"wrap\"><div class=\"head\"><div><h1>طلبات الأفكار</h1><p>أحدث 50 طلبًا محفوظًا، معزولة خلف تسجيل دخول الإدارة.</p></div><a href=\"https://mzcodehub.com/\">الموقع الرئيسي</a></div><div class=\"controls\"><input id=\"search\" type=\"search\" placeholder=\"بحث في الفكرة أو الاسم أو البريد\" aria-label=\"بحث\"><select id=\"filter\" aria-label=\"تصفية حسب الحالة\"><option value=\"\">جميع الحالات</option><option value=\"new\">جديد</option><option value=\"reviewing\">تحت الدراسة</option><option value=\"quoted\">عرض سعر</option><option value=\"accepted\">مقبول</option><option value=\"building\">قيد التنفيذ</option><option value=\"delivered\">مسلم</option><option value=\"rejected\">مرفوض</option></select><button id=\"reload\">تحديث</button></div><p id=\"stats\"></p><div id=\"items\" class=\"items\" role=\"list\"><div class=\"empty\">جارٍ تحميل الطلبات...</div></div></div>\n<script>(function(){const $=x=>document.getElementById(x);let items=[];const labels={new:'جديد',reviewing:'تحت الدراسة',quoted:'عرض سعر',accepted:'مقبول',building:'قيد التنفيذ',delivered:'مسلّم',rejected:'مرفوض'};function render(){const q=$('search').value.trim().toLowerCase(),status=$('filter').value;const filtered=items.filter(x=>(!status||x.status===status)&&[x.name,x.email,x.idea].some(v=>String(v||'').toLowerCase().includes(q)));$('items').replaceChildren();$('stats').textContent='عدد الطلبات المعروضة: '+filtered.length+' من '+items.length;for(const x of filtered){const box=document.createElement('article');box.setAttribute('role','listitem');const row=document.createElement('div');row.className='row';const who=document.createElement('strong');who.textContent=x.name||'بدون اسم';const tag=document.createElement('span');tag.className='status';tag.textContent=labels[x.status]||x.status;row.append(who,tag);const email=document.createElement('a');email.href='mailto:'+encodeURIComponent(x.email);email.textContent=x.email;const description=document.createElement('p');description.className='idea';description.textContent=x.idea;const meta=document.createElement('p');meta.className='meta';meta.textContent=new Date(x.created_ms).toLocaleString('ar-SA')+' | '+x.id;box.append(row,email,description,meta);$('items').append(box)}if(!filtered.length){const no=document.createElement('div');no.className='empty';no.textContent='لا توجد طلبات مطابقة';$('items').append(no)}}async function load(){$('stats').textContent='جارٍ التحميل...';try{const r=await fetch('/api/admin/ideas',{cache:'no-store'});if(!r.ok)throw Error('تعذر عرض الطلبات ('+r.status+')');const data=await r.json();items=data.requests||[];render()}catch(e){$('items').textContent=e.message;$('stats').textContent='خطأ في تحميل البيانات'}}$('reload').addEventListener('click',load);$('filter').addEventListener('change',render);$('search').addEventListener('input',render);load()})();</script></html>";
const hdr={"cache-control":"no-store, private","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer"};
const j=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{"content-type":"application/json; charset=utf-8",...hdr}});
const deny=()=>j({error:"Unauthorized"},403);
const decoded=s=>{const t=s.replace(/-/g,"+").replace(/_/g,"/");const raw=atob(t+"=".repeat((4-t.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
let jwks, jwksAt=0;
async function verifyAccess(request){
 const token=request.headers.get("Cf-Access-Jwt-Assertion") || (request.headers.get("cookie")||"").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
 if(!token)return null;
 try{
  const parts=token.split(".");if(parts.length!==3)return null;
  const header=JSON.parse(new TextDecoder().decode(decoded(parts[0])));
  const payload=JSON.parse(new TextDecoder().decode(decoded(parts[1])));
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=="RS256"||!header.kid||payload.iss!==ISS||!payload.exp||payload.exp<=now||payload.nbf>now||!([].concat(payload.aud||[]).includes(AUD)))return null;
  if(!jwks||Date.now()-jwksAt>3600000){const res=await fetch(ISS+"/cdn-cgi/access/certs");if(!res.ok)return null;const v=await res.json();jwks=v.keys;jwksAt=Date.now()}
  const key=jwks?.find(k=>k.kid===header.kid&&k.kty==="RSA");if(!key)return null;
  const publicKey=await crypto.subtle.importKey("jwk",key,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",publicKey,decoded(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  return valid?payload:null;
 }catch(e){console.error("Access token validation error");return null}
}
export default {async fetch(request,env){
 const u=new URL(request.url), host=u.hostname.toLowerCase();
 if(host!=="mzcodehub.com"&&host!=="www.mzcodehub.com")return deny();
 if(!["GET","HEAD"].includes(request.method))return j({error:"Method not allowed"},405);
 if(!["/admin/ideas","/admin/ideas/","/api/admin/ideas"].includes(u.pathname))return j({error:"Not found"},404);
 const who=await verifyAccess(request);
 if(!who)return deny();
 if(u.pathname==="/api/admin/ideas"){
  if(!env.DB)return j({error:"Unavailable"},503);
  try{const res=await env.DB.prepare("SELECT id,name,email,idea,status,created_ms FROM idea_requests ORDER BY created_ms DESC LIMIT 50").all();return j({requests:res.results||[]})}catch(e){console.error("D1 inbox error");return j({error:"Unavailable"},503)}
 }
 return new Response(request.method==="HEAD"?null:PAGE,{status:200,headers:{"content-type":"text/html; charset=utf-8","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",...hdr}})
}};
