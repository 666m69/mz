// Protected read-only idea inbox. Requires verified Cloudflare Access JWT and official hostname.
const AUTH_DOMAIN="nameless-bonus-3327.cloudflareaccess.com";
const ISS="https://"+AUTH_DOMAIN;
const AUD="92323b54a2124456358a22cd875b15fc92c9f3b2374894f9dad1e0bf82c9a9df";
const PAGE="<!doctype html><html lang=\"ar\" dir=\"rtl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>طلبات الأفكار | إدارة MZ Code Hub</title><style>*{box-sizing:border-box}body{margin:0;background:#081520;color:#ecf6fa;font:16px system-ui}.wrap{max-width:1050px;margin:auto;padding:25px}a{color:#86e4cf}h1{margin:0 0 8px}p,small{color:#9eb6c2}.head{display:flex;align-items:center;justify-content:space-between;gap:16px}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:20px 0}input,select,button{font:inherit;border:1px solid #365669;border-radius:9px;background:#162c3a;color:#f5fcff;padding:11px}.controls input{min-width:210px;flex:1}.items{display:grid;gap:14px}article{border:1px solid #28475a;border-radius:15px;background:#102332;padding:18px}.row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.row strong{font-size:20px}.status{padding:4px 9px;border-radius:7px;background:#244b46;font-size:13px}.idea{white-space:pre-wrap;line-height:1.65;margin:14px 0;color:#e5f3fc}.meta{font-size:12px;color:#a5becb;direction:ltr;text-align:left;overflow-wrap:anywhere}.empty{padding:40px;text-align:center;border:1px dashed #3a6572;border-radius:12px}@media(max-width:550px){.wrap{padding:14px}.head{display:block}} </style>\n<div class=\"wrap\"><div class=\"head\"><div><h1>طلبات الأفكار</h1><p>أحدث 50 طلبًا محفوظًا، معزولة خلف تسجيل دخول الإدارة.</p></div><div><a href=\"/admin/archive\">أرشيف الأفكار</a><a href=\"/admin/executive\" style=\"margin-left:18px\">لوحة MZ Executive</a><a href=\"https://mzcodehub.com/\">الموقع الرئيسي</a></div></div><div class=\"controls\"><input id=\"search\" type=\"search\" placeholder=\"بحث في الفكرة أو الاسم أو البريد\" aria-label=\"بحث\"><select id=\"filter\" aria-label=\"تصفية حسب الحالة\"><option value=\"\">جميع الحالات</option><option value=\"new\">جديد</option><option value=\"reviewing\">تحت الدراسة</option><option value=\"quoted\">عرض سعر</option><option value=\"accepted\">مقبول</option><option value=\"building\">قيد التنفيذ</option><option value=\"delivered\">مسلم</option><option value=\"rejected\">مرفوض</option></select><button id=\"reload\">تحديث</button></div><p id=\"stats\"></p><div id=\"items\" class=\"items\" role=\"list\"><div class=\"empty\">جارٍ تحميل الطلبات...</div></div></div>\n<script>(function(){const $=x=>document.getElementById(x);let items=[];const labels={new:'جديد',reviewing:'تحت الدراسة',quoted:'عرض سعر',accepted:'مقبول',building:'قيد التنفيذ',delivered:'مسلّم',rejected:'مرفوض'};function render(){const q=$('search').value.trim().toLowerCase(),status=$('filter').value;const filtered=items.filter(x=>(!status||x.status===status)&&[x.name,x.email,x.idea].some(v=>String(v||'').toLowerCase().includes(q)));$('items').replaceChildren();$('stats').textContent='عدد الطلبات المعروضة: '+filtered.length+' من '+items.length;for(const x of filtered){const box=document.createElement('article');box.setAttribute('role','listitem');const row=document.createElement('div');row.className='row';const who=document.createElement('strong');who.textContent=x.name||'بدون اسم';const tag=document.createElement('span');tag.className='status';tag.textContent=labels[x.status]||x.status;row.append(who,tag);const stage=document.createElement('select');stage.setAttribute('aria-label','تحديث حالة الطلب');for(const [value,label] of Object.entries(labels)){const option=document.createElement('option');option.value=value;option.textContent=label;stage.append(option)}stage.value=x.status;stage.addEventListener('change',async()=>{const proposed=stage.value;stage.disabled=true;try{const response=await fetch('/api/admin/ideas/'+encodeURIComponent(x.id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:proposed})});const body=await response.json();if(!response.ok||!body.ok)throw Error(body.error||'فشل تحديث الحالة');x.status=proposed;tag.textContent=labels[proposed];$('stats').textContent='تم تحديث الحالة إلى: '+labels[proposed]}catch(e){stage.value=x.status;alert(e.message||'تعذر تحديث الحالة')}finally{stage.disabled=false}});row.append(stage);const email=document.createElement('a');email.href='mailto:'+encodeURIComponent(x.email);email.textContent=x.email;const description=document.createElement('p');description.className='idea';description.textContent=x.idea;const meta=document.createElement('p');meta.className='meta';meta.textContent=new Date(x.created_ms).toLocaleString('ar-SA')+' | '+x.id;box.append(row,email,description,meta);$('items').append(box)}if(!filtered.length){const no=document.createElement('div');no.className='empty';no.textContent='لا توجد طلبات مطابقة';$('items').append(no)}}async function load(){$('stats').textContent='جارٍ التحميل...';try{const r=await fetch('/api/admin/ideas',{cache:'no-store'});if(!r.ok)throw Error('تعذر عرض الطلبات ('+r.status+')');const data=await r.json();items=data.requests||[];render()}catch(e){$('items').textContent=e.message;$('stats').textContent='خطأ في تحميل البيانات'}}$('reload').addEventListener('click',load);$('filter').addEventListener('change',render);$('search').addEventListener('input',render);load()})();</script></html>";

const ARCHIVE_PAGE=`<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>أرشيف الأفكار | MZcode</title>
<style>*{box-sizing:border-box}body{margin:0;background:#08141d;color:#ebf5f9;font:16px/1.7 system-ui}main{max-width:960px;margin:auto;padding:20px}a{color:#75e7cc}h1{margin-bottom:4px}p,small{color:#bdcfd9}article{border:1px solid #315466;background:#122839;border-radius:15px;margin:13px 0;padding:17px}strong{display:block}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-height:300px;overflow:auto}button,select,input{font:inherit;padding:10px;background:#142b3b;border:1px solid #426479;color:#fff;border-radius:9px}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #7ddec8}.meta{color:#a7c1cc;font-size:.85rem}nav{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}#more{margin:18px 0;min-width:200px}</style></head>
<body><main><nav><a href="/">MZcode</a><a href="/admin/ideas">إدارة حالات الطلبات</a></nav>
<h1>أرشيف الأفكار الخاص</h1><p>فقط للمالك المخوّل. تُعرض أفكار الزوار بعد موافقتهم على حفظها. أي إذن لإعادة الاستخدام مستقل عن حفظ الفكرة.</p>
<div class="actions"><label>نوع الطلب <select id="kind"><option value="">الكل</option><option value="concept">تصورات فقط</option><option value="execution">طلبات تنفيذ</option></select></label>
<label>إذن تطوير منتج عام <select id="reuse"><option value="">الكل</option><option value="1">مسموح</option><option value="0">غير مسموح</option></select></label>
<label>بحث في المحمّل <input id="query" type="search" placeholder="بحث محلي في النتائج المحمّلة"></label></div>
<p id="status" role="status"></p><div id="items"></div><button id="more" type="button">عرض 50 فكرة أخرى</button>
<script>
(function(){
const get=id=>document.getElementById(id), items=[];let cursor=null,busy=false;
function render(){
 const kind=get('kind').value,reuse=get('reuse').value,q=get('query').value.trim().toLowerCase();
 const matches=items.filter(x=>(!kind||x.idea_kind===kind)&&(reuse===''||String(x.reuse_permission)===reuse)&&[x.idea,x.email,x.name].some(v=>String(v||'').toLowerCase().includes(q)));
 get('items').replaceChildren();
 for(const x of matches){
  const item=document.createElement('article');
  const heading=document.createElement('strong');heading.textContent=(x.idea_kind==='concept'?'تصور محفوظ':'طلب تنفيذ')+' · '+x.id;
  const meta=document.createElement('p');meta.className='meta';
  meta.textContent=new Date(x.created_ms).toLocaleString('ar-SA')+' · '+(x.reuse_permission===1?'إذن تطوير منتج عام: نعم':'إذن تطوير منتج عام: لا')+' · '+x.status;
  const body=document.createElement('pre');body.textContent=x.idea;
  const who=document.createElement('small');who.textContent=[x.name,x.email].filter(Boolean).join(' · ');
  item.append(heading,meta,body,who);get('items').append(item);
 }
 get('status').textContent='المحمّل: '+items.length+' · المطابق للفلاتر: '+matches.length+' (البحث لا يشمل الصفحات غير المحمّلة)';
 get('more').hidden=!cursor;
}
async function next(){
 if(busy)return;busy=true;get('more').disabled=true;
 try{
  const url='/api/admin/archive'+(cursor?'?before='+encodeURIComponent(cursor):'');
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw Error('تعذر تحميل الأرشيف: '+r.status);
  const d=await r.json();items.push(...(d.requests||[]));cursor=d.next_cursor||null;render();
 }catch(e){get('status').textContent=e.message||'فشل التحميل'}
 finally{busy=false;get('more').disabled=false}
}
get('more').addEventListener('click',next);
for(const id of ['kind','reuse','query'])get(id).addEventListener(id==='query'?'input':'change',render);
next();
})();
</script></main></body></html>`;

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
 if(!["GET","HEAD","PATCH"].includes(request.method))return j({error:"Method not allowed"},405);
 const isEdit=u.pathname.startsWith("/api/admin/ideas/")&&u.pathname.length>"/api/admin/ideas/".length;
 const archivePage=u.pathname==="/admin/archive",archiveApi=u.pathname==="/api/admin/archive";
 if(!["/admin/ideas","/admin/ideas/","/api/admin/ideas"].includes(u.pathname)&&!isEdit&&!archivePage&&!archiveApi)
   return j({error:"Not found"},404);
 const who=await verifyAccess(request);
 if(!who)return deny();
 if(archiveApi){
   if(request.method!=="GET")return j({error:"Method not allowed"},405);
   if(!env.DB)return j({error:"Unavailable"},503);
   const q=u.searchParams;
   if(q.size>1||[...q.keys()].some(k=>k!=="before"))return j({error:"Invalid cursor"},400);
   const before=q.get("before");
   if(before&&!/^\\d{13}:[0-9a-f-]{36}$/.test(before))return j({error:"Invalid cursor"},400);
   try{
     const [stamp,identifier]=before?before.split(":"):["",""];
     const sql="SELECT id,idea,email,name,created_ms,status,idea_kind,reuse_permission FROM idea_requests "+
       (before?"WHERE (created_ms<? OR (created_ms=? AND id<?)) ":"")+
       "ORDER BY created_ms DESC,id DESC LIMIT 51";
     const statement=env.DB.prepare(sql);
     const rows=(await (before?statement.bind(Number(stamp),Number(stamp),identifier):statement).all()).results||[];
     const records=rows.slice(0,50);
     const last=records[records.length-1];
     return j({requests:records,next_cursor:rows.length>50&&last?last.created_ms+":"+last.id:null});
   }catch(e){console.error("Archive query unavailable");return j({error:"Unavailable"},503)}
 }
 if(isEdit&&request.method==="PATCH"){
  if(!who.email||request.headers.get("Origin")!==u.origin)return deny();
  if(!env.DB)return j({error:"Unavailable"},503);
  if(!String(request.headers.get("content-type")||"").startsWith("application/json"))return j({error:"JSON required"},415);
  if(Number(request.headers.get("content-length")||0)>1000)return j({error:"Too large"},413);
  const id=u.pathname.slice("/api/admin/ideas/".length);
  if(!/^[a-f0-9-]{36}$/.test(id))return j({error:"Invalid id"},400);
  let next;try{const text=await request.text();if(text.length>1000)return j({error:"Too large"},413);const obj=JSON.parse(text);next=obj?.status}catch{return j({error:"Invalid JSON"},400)}
  const allowed=["new","reviewing","quoted","accepted","building","delivered","rejected"];
  if(!allowed.includes(next))return j({error:"Invalid status"},400);
  try{
   const before=await env.DB.prepare("SELECT status FROM idea_requests WHERE id=?").bind(id).first();
   if(!before)return j({error:"Not found"},404);
   if(before.status===next)return j({ok:true,status:next});
   const [,changed]=await env.DB.batch([
     env.DB.prepare("INSERT INTO idea_status_events(id,request_id,actor,from_status,to_status,created_ms) SELECT ?,id,?,status,?,? FROM idea_requests WHERE id=? AND status=?").bind(crypto.randomUUID(),who.email,next,Date.now(),id,before.status),
     env.DB.prepare("UPDATE idea_requests SET status=? WHERE id=? AND status=?").bind(next,id,before.status)
   ]);
   if(changed.meta?.changes!==1)return j({error:"Conflict, reload"},409);
   return j({ok:true,status:next});
  }catch(e){console.error("Admin status update failed");return j({error:"Unavailable"},503)}
 }
 if(request.method==="PATCH")return j({error:"Method not allowed"},405);
 if(u.pathname==="/api/admin/ideas"){
  if(!env.DB)return j({error:"Unavailable"},503);
  try{const res=await env.DB.prepare("SELECT id,name,email,idea,status,notification_status,created_ms FROM idea_requests ORDER BY created_ms DESC LIMIT 50").all();return j({requests:res.results||[]})}catch(e){console.error("D1 inbox error");return j({error:"Unavailable"},503)}
 }
 if(isEdit)return j({error:"Method not allowed"},405);
 if(archivePage)return new Response(request.method==="HEAD"?null:ARCHIVE_PAGE,{
   status:200,headers:{"content-type":"text/html; charset=utf-8",
   "content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",...hdr}});
 return new Response(request.method==="HEAD"?null:PAGE,{status:200,headers:{"content-type":"text/html; charset=utf-8","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",...hdr}})
}};
