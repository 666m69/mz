// MZ Community Lab — independent edge service; no customer lead data touched.
// Static assets are embedded at build time from pilot/community/*.
const HTML = __MZ_HTML__;
const CSS = __MZ_CSS__;
const APP_JS = __MZ_JS__;
const MARK_SVG = __MZ_MARK__;
const TEXT = new TextEncoder();
const PROJECTS = new Set(['kafu','formah','marib']);
const REVIEW_PROJECTS = new Set(['kafu','formah','marib','code']);
const STATIC_HEADERS = {
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Resource-Policy':'same-origin'
};
function respond(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{...STATIC_HEADERS,...extra,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}
function fail(message,status=400){return respond({ok:false,message},status);}
function showAsset(body,type,req){
  return new Response(req.method==='HEAD'?null:body,{status:200,headers:{
    ...STATIC_HEADERS,
    'Content-Type':type,
    'Cache-Control':'no-cache',
    'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  }});
}
async function mac(secret,plain){
  const key=await crypto.subtle.importKey('raw',TEXT.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,TEXT.encode(plain)));
  return Array.from(signature,n=>n.toString(16).padStart(2,'0')).join('');
}
function equal(a,b) {
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let difference=0;
  for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
  return difference===0;
}
async function visitor(req,env,allowCreate){
  const cookie=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('mz_lab_id='));
  const raw=cookie?.slice('mz_lab_id='.length)||'';
  const parts=raw.split('.');
  let id=parts[0];
  let created=false;
  if(!/^[0-9a-f-]{36}$/.test(id||'')||!/^[0-9a-f]{64}$/.test(parts[1]||'')||
     !equal(parts[1],await mac(env.MZ_LAB_SECRET,'cookie:'+id))) {
    if(!allowCreate)return null;
    id=crypto.randomUUID();
    created=true;
  }
  const hash=await mac(env.MZ_LAB_SECRET,'voter:'+id);
  return {hash,cookie:created?'mz_lab_id='+id+'.'+await mac(env.MZ_LAB_SECRET,'cookie:'+id)+'; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax':null};
}
async function readJSON(req,limit=4096){
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw {status:415};
  const advertised=Number(req.headers.get('content-length')||0);
  if(advertised>limit)throw {status:413};
  if(!req.body)throw {status:400};
  let length=0;
  const buffers=[],reader=req.body.getReader();
  for(;;){
    const {done,value}=await reader.read();if(done)break;
    length+=value.length;if(length>limit){await reader.cancel();throw {status:413};}
    buffers.push(value);
  }
  const bytes=new Uint8Array(length);
  let offset=0;for(const part of buffers){bytes.set(part,offset);offset+=part.length;}
  try {
    const parsed=JSON.parse(new TextDecoder().decode(bytes));
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();
    return parsed;
  }catch{throw {status:400};}
}
async function limit(req,env,scope,max){
  const ip=req.headers.get('CF-Connecting-IP');
  if(!ip||ip.length>60)throw {status:403,message:'تعذر التحقق من الاتصال.'};
  const period=Math.floor(Date.now()/3600000);
  const bucket=await mac(env.MZ_LAB_SECRET,'rate:'+scope+':'+period+':'+ip);
  const result=await env.DB.prepare(
    'INSERT INTO mz_lab_rate(scope,bucket,period,hits) VALUES(?,?,?,1) ON CONFLICT(scope,bucket,period) DO UPDATE SET hits=hits+1 RETURNING hits'
  ).bind(scope,bucket,period).first();
  if(!result||Number(result.hits)>max)throw {status:429,message:'وصلت للحد المؤقت. جرّب بعد ساعة.'};
}
async function voteSummary(env,voterHash){
  const result=await env.DB.prepare('SELECT project,COUNT(*) AS total FROM mz_lab_votes GROUP BY project').all();
  const counts={kafu:0,formah:0,marib:0};
  for(const row of result.results||[])if(PROJECTS.has(row.project))counts[row.project]=Number(row.total)||0;
  const previous=await env.DB.prepare('SELECT project FROM mz_lab_votes WHERE voter_hash=?').bind(voterHash).first();
  return {ok:true,counts,selected:previous?.project||null};
}
async function handle(req,env){
  const url=new URL(req.url);
  const p=url.pathname;
  if(p==='/community')return Response.redirect(url.origin+'/community/'+url.search,308);
  if((p==='/community/'||p==='/community/index.html')&&['GET','HEAD'].includes(req.method))return showAsset(HTML,'text/html; charset=utf-8',req);
  if(p==='/community/style.css'&&['GET','HEAD'].includes(req.method))return showAsset(CSS,'text/css; charset=utf-8',req);
  if(p==='/community/mark.svg'&&['GET','HEAD'].includes(req.method))return showAsset(MARK_SVG,'image/svg+xml; charset=utf-8',req);
  if(p==='/community/app.js'&&['GET','HEAD'].includes(req.method))return showAsset(APP_JS,'text/javascript; charset=utf-8',req);
  if(!['/api/community','/api/community/vote','/api/community/ideas','/api/community/reviews'].includes(p))return fail('المسار غير موجود.',404);
  if(!env.DB||!env.MZ_LAB_SECRET)return fail('المختبر لا يستقبل مشاركات حاليًا.',503);
  if(p==='/api/community'&&req.method==='GET'){
    const v=await visitor(req,env,true);
    return respond(await voteSummary(env,v.hash),200,v.cookie?{'Set-Cookie':v.cookie}:{});
  }
  if(req.method!=='POST')return fail('طريقة غير مسموحة.',405);
  if(req.headers.get('Origin')!==url.origin)return fail('مصدر الطلب غير مسموح.',403);
  const v=await visitor(req,env,false);
  if(!v)return fail('جدّد الصفحة لتفعيل مشاركتك.',409);
  let data;
  try {data=await readJSON(req);}catch(e){
    return fail(e.status===413?'الطلب أكبر من الحجم المسموح.':e.status===415?'صيغة الطلب غير مدعومة.':'البيانات غير صحيحة.',e.status||400);
  }
  if(p==='/api/community/vote'){
    if(!PROJECTS.has(data.project)||typeof data.project!=='string')return fail('اختر مشروعًا من القائمة.');
    await limit(req,env,'vote',8);
    await env.DB.prepare('INSERT INTO mz_lab_votes(voter_hash,project) VALUES(?,?) ON CONFLICT(voter_hash) DO NOTHING').bind(v.hash,data.project).run();
    const summary=await voteSummary(env,v.hash);
    if(summary.selected!==data.project)return fail('سبق أن صوّت هذا المتصفح لمشروع آخر.',409);
    return respond(summary);
  }
  if(p==='/api/community/ideas'){
    if(data.consent!==true||data.website!==''||typeof data.idea!=='string'||typeof data.nickname!=='string')
      return fail('راجع موافقتك وبيانات الفكرة.');
    const idea=data.idea.trim().replace(/\s+/g,' ');
    const nickname=data.nickname.trim().replace(/\s+/g,' ');
    if(idea.length<12||idea.length>800||nickname.length>40)return fail('الفكرة من 12 إلى 800 حرف، والاسم المستعار حتى 40 حرفًا.');
    await limit(req,env,'idea',5);
    const digest=await mac(env.MZ_LAB_SECRET,'idea:'+idea+'|'+nickname);
    const reference='LAB-'+crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase();
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO mz_lab_ideas(id,reference,voter_hash,content_hash,idea,nickname) VALUES(?,?,?,?,?,?) ON CONFLICT(voter_hash,content_hash) DO NOTHING').bind(id,reference,v.hash,digest,idea,nickname).run();
    const saved=await env.DB.prepare('SELECT reference FROM mz_lab_ideas WHERE voter_hash=? AND content_hash=?').bind(v.hash,digest).first();
    if(!saved)return fail('تعذر تأكيد حفظ الفكرة.',503);
    return respond({ok:true,reference:saved.reference,published:false},saved.reference===reference?201:200);
  }
  if(p==='/api/community/reviews'){
    if(!REVIEW_PROJECTS.has(data.project)||!Number.isInteger(data.score)||data.score<1||data.score>5||typeof data.note!=='string')
      return fail('راجع التجربة والتقييم من 1 إلى 5.');
    const note=data.note.trim();
    if(note.length>600)return fail('الملاحظة يجب ألا تتجاوز 600 حرف.');
    await limit(req,env,'review',10);
    await env.DB.prepare('INSERT INTO mz_lab_reviews(voter_hash,project,score,note) VALUES(?,?,?,?) ON CONFLICT(voter_hash,project) DO UPDATE SET score=excluded.score,note=excluded.note,updated_at=CURRENT_TIMESTAMP')
      .bind(v.hash,data.project,data.score,note).run();
    return respond({ok:true});
  }
  return fail('المسار غير موجود.',404);
}
export default {async fetch(req,env){
  try{return await handle(req,env);}
  catch(error){
    if(error?.status===429)return fail(error.message,429);
    if(error?.status===403)return fail(error.message,403);
    console.error('MZ community unavailable',String(error?.message||'unknown'));
    return fail('تعذر تنفيذ العملية حاليًا. حاول مجددًا.',503);
  }
}};