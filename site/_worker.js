import {menuHandle} from './menu-server.js';
const SERVICES=['متجر إلكتروني','صفحة هبوط تسويقية','موقع شركة أو مؤسسة','تطبيق ويب / لوحة تحكم','تحسين سرعة وسيو','استشارة أخرى'];
const enc=new TextEncoder();
const security={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...security,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function error(message,status){return json({ok:false,message},status)}
async function sign(secret,text){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(text))),x=>x.toString(16).padStart(2,'0')).join('')}
async function verified(secret,token,origin){if(typeof token!=='string'||token.length>200)return false;const [stamp,nonce,sig]=token.split('.');if(!/^\d{13}$/.test(stamp)||!/^[-a-f0-9]{36}$/.test(nonce||'')||!/^[a-f0-9]{64}$/.test(sig||''))return false;const age=Date.now()-Number(stamp);if(age<0||age>3600000)return false;const want=await sign(secret,`${stamp}.${nonce}.${origin}`);let diff=0;for(let i=0;i<64;i++)diff|=want.charCodeAt(i)^sig.charCodeAt(i);return diff===0}
async function readBody(req,limit=16384){if(Number(req.headers.get('content-length'))>limit)throw 413;const reader=req.body?.getReader();if(!reader)throw 400;let size=0,parts=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw 413}parts.push(value)}const all=new Uint8Array(size);let offset=0;for(const p of parts){all.set(p,offset);offset+=p.length}try{return JSON.parse(new TextDecoder().decode(all))}catch{throw 400}}
// Cloudflare replaces CF-Connecting-IP on a cross-zone Worker subrequest.
const edgePublicKey = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEka6e1vjpgX4gN4ZLoQEbdmpmo4UjTYZz/fD3Yjc4D6v30MI50OgZGmr0L3Fd5EJGrqCBxCCK5Yw1ZhS5n650yw==';
async function rateAddress(req, env) {
 const ip = req.headers.get('X-MZ-Visitor');
 if (ip === null) return req.headers.get('CF-Connecting-IP');
 const stamp = req.headers.get('X-MZ-Time') || '';
 const proof = req.headers.get('X-MZ-Proof') || '';
 if (!/^[a-fA-F0-9:.]{2,45}$/.test(ip) || !/^\d{13}$/.test(stamp) ||
     Math.abs(Date.now() - Number(stamp)) > 90000 || !/^[a-zA-Z0-9+/]{86}==$/.test(proof)) return null;
 const decode = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
 const key = await crypto.subtle.importKey('spki', decode(env.MZ_EDGE_PUBLIC_KEY || edgePublicKey),
     {name:'ECDSA', namedCurve:'P-256'}, false, ['verify']);
 const message = [stamp, req.method, new URL(req.url).pathname, ip].join('\n');
 return await crypto.subtle.verify({name:'ECDSA', hash:'SHA-256'}, key, decode(proof), enc.encode(message)) ? ip : null;
}
function normalizePhone(s){let p=s.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[\s()-]/g,'');if(/^05\d{8}$/.test(p))p='+966'+p.slice(1);if(/^9665\d{8}$/.test(p))p='+'+p;return p}
async function checkRate(req,env) {
 const ip=await rateAddress(req,env);
 if(!ip)return error('تعذر التحقق من الاتصال.',403);
 const windowStart=Math.floor(Date.now()/900000)*900000;
 const ipHash=await sign(env.MZ_CONTACT_SECRET,ip+'.'+windowStart);
 const rate=await env.DB.prepare('INSERT INTO mz_contact_rate(ip_hash,window_start,count) VALUES(?,?,1) ON CONFLICT(ip_hash,window_start) DO UPDATE SET count=count+1 RETURNING count').bind(ipHash,windowStart).first();
 if(rate.count>5)return error('وصلت للحد المؤقت. حاول بعد 15 دقيقة أو راسلنا بالبريد.',429);
 await env.DB.prepare('DELETE FROM mz_contact_rate WHERE window_start < ?').bind(windowStart-3600000).run();
}
async function saveInterest(req,env,b) {
 if(b.consent!==true || b.website) return error('راجع الموافقة على حفظ بيانات الطلب.',400);
 let statement;
 if(b.mode==='coreresto'){
  const name=typeof b.name==='string'?b.name.trim():'';
  const phone=typeof b.phone==='string' && b.phone.length<=25?normalizePhone(b.phone):'';
  const digits=String(b.branches??'').replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632).replace(/[۰-۹]/g,c=>c.charCodeAt(0)-1776);
  if(name.length<2 || name.length>100 || !/^\+9665\d{8}$/.test(phone) || !['كافيه','مطعم','فود ترك','بوفيه'].includes(b.activity) || !/^[1-9]\d{0,3}$/.test(digits))return error('راجع الاسم والجوال السعودي ونوع النشاط وعدد الفروع (١ إلى ٩٩٩٩).',400);
  statement=env.DB.prepare('INSERT INTO mz_coreresto_waitlist(phone,name,activity,branches,consent_version) VALUES(?,?,?,?,?) ON CONFLICT(phone) DO NOTHING').bind(phone,name,b.activity,Number(digits),'2026-11-02');
 } else {
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['quote','menu','property'].includes(b.tool))return error('اختر الأداة وأدخل بريدًا صحيحًا.',400);
  statement=env.DB.prepare('INSERT INTO mz_tool_interest(email,tool,consent_version) VALUES(?,?,?) ON CONFLICT(email,tool) DO NOTHING').bind(email,b.tool,'2026-11-02');
 }
 const limited=await checkRate(req,env);
 if(limited)return limited;
 const saved=await statement.run();
 if(!saved.success)throw Error('Interest insert failed');
 return json({ok:true});
}
async function handle(req,env){
 const url=new URL(req.url),path=url.pathname;
 if(url.hostname.endsWith('.mz702.pages.dev')||url.hostname==='mz702.pages.dev'){
  if(['GET','HEAD'].includes(req.method)&&['/idea','/idea/','/idea/demo','/idea/demo/'].includes(path))
   return Response.redirect('https://mzcodehub.com'+path+url.search,302);
 }
 if(url.hostname==='www.mzcodehub.com'){
  url.hostname='mzcodehub.com';
  url.protocol='https:';
  return Response.redirect(url.href,308);
 }
 // This preview-only route never serves production or default Pages addresses.
 if((path==='/api/ideas'||path.startsWith('/api/ideas/')) &&
    url.hostname==='feat-saudi-home-intake-20261.mz702.pages.dev'){
   if(!env.DB||!env.MZ_CONTACT_SECRET)return error('خدمة حفظ الطلبات غير متاحة في المعاينة حاليًا.',503);
   return previewIdeasModule.fetch(req,{DB:env.DB,HASH_SALT:env.MZ_CONTACT_SECRET});
 }
 if(path==='/api/menus'||path.startsWith('/api/menus/'))return menuHandle(req,env,{json,error,sign,verified,readBody,rateAddress});
 if(/^\/(admin(?:\.html)?(?:\/|$)|assets\/js\/admin\.js$|api\/admin(?:\/|$))/i.test(path))return error('الإدارة متاحة للمالك عبر حساب الاستضافة فقط.',403);
 if(path==='/api/contact-token'){
  if(req.method!=='GET')return error('طريقة غير مسموحة.',405);
  if(!env.DB||!env.MZ_CONTACT_SECRET)return error('استقبال الطلبات غير متاح حالياً. راسلنا بالبريد.',503);
  const raw=`${Date.now()}.${crypto.randomUUID()}`;
  return json({token:raw+'.'+await sign(env.MZ_CONTACT_SECRET,raw+'.'+url.origin)});
 }
 if(path==='/api/contact'){
  if(req.method!=='POST')return error('طريقة غير مسموحة.',405);
  if(req.headers.get('origin')!==url.origin)return error('مصدر الطلب غير مسموح.',403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return error('صيغة غير مدعومة.',415);
  if(!env.DB||!env.MZ_CONTACT_SECRET)return error('استقبال الطلبات غير متاح حالياً. راسلنا بالبريد.',503);
  let b;try{b=await readBody(req)}catch(code){return error('تعذر قراءة الطلب أو تجاوز الحجم المسموح.',code===413?413:400)}
  if(!b||typeof b!=='object'||Array.isArray(b))return error('بيانات غير صالحة.',400);
  if(!await verified(env.MZ_CONTACT_SECRET,b.token,url.origin))return error('انتهت صلاحية النموذج. أعد المحاولة لتجديده.',403);
  if(b.mode==='coreresto'||b.mode==='tools')return saveInterest(req,env,b);
  const quick=b.mode==='quick';
  if(b.mode!==undefined&&!quick)return error('صيغة نموذج غير مدعومة.',400);
  if(quick){
   if(typeof b.reply!=='string'||b.reply.trim().length>254)return error('أدخل بريدك أو رقم جوالك للرد.',400);
   const reply=b.reply.trim();
   b={...b,name:'زائر الموقع',phone:reply.includes('@')?'':reply,email:reply.includes('@')?reply:'',service:'استشارة أخرى'};
  }
  for(const field of ['name','phone','email','service','message'])if(typeof b[field]!=='string')return error('أكمل البيانات المطلوبة.',400);
  const name=b.name.trim(),phone=normalizePhone(b.phone),email=b.email.trim(),service=b.service,message=b.message.trim();
  if(name.length<2||name.length>100||!(quick&&email&&!phone)&&!/^\+[1-9]\d{7,14}$/.test(phone)||/^\+966/.test(phone)&&!/^\+9665\d{8}$/.test(phone)||email.length>254||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!SERVICES.includes(service)||message.length<10||message.length>4000||b.consent!==true||b.website||!/^[-a-f0-9]{36}$/.test(b.requestId||''))return error('راجع بيانات التواصل والرسالة والموافقة على الخصوصية.',400);
  const payloadHash=await sign(env.MZ_CONTACT_SECRET,JSON.stringify({name,phone,email,service,message}));
  const prior=await env.DB.prepare('SELECT reference,payload_hash FROM mz_contact_requests WHERE request_id=?').bind(b.requestId).first();
  if(prior)return prior.payload_hash===payloadHash?json({ok:true,reference:prior.reference}):error('تغير الطلب أثناء إعادة الإرسال. أرسل طلباً جديداً.',409);
  const limited=await checkRate(req,env);if(limited)return limited;
  const reference='MZ-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
  await env.DB.prepare('INSERT INTO mz_contact_requests(request_id,reference,name,phone,email,service,message,payload_hash,consent_version) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING').bind(b.requestId,reference,name,phone,email,service,message,payloadHash,quick?'2026-10-31-quick':'2026-10-29').run();
  const saved=await env.DB.prepare('SELECT reference,payload_hash FROM mz_contact_requests WHERE request_id=?').bind(b.requestId).first();
  if(!saved)throw Error('Storage did not confirm');
  if(saved.payload_hash!==payloadHash)return error('تغير الطلب أثناء الإرسال.',409);
  return json({ok:true,reference:saved.reference},saved.reference===reference?201:200);
 }
 if(path.startsWith('/api/'))return error('المسار غير موجود.',404);
 if(!['GET','HEAD'].includes(req.method))return error('طريقة غير مسموحة.',405);
 const redirects={'/about':'/about/','/about.html':'/about/','/services':'/#pricing','/services.html':'/#pricing','/projects':'/projects/','/projects.html':'/projects/','/contact':'/#contact','/contact.html':'/#contact'};
 if(redirects[path])return Response.redirect(url.origin+redirects[path],302);
 if(/\.(md|sql|json)$/i.test(path))return error('المسار غير موجود.',404);
 if(['/privacy/','/terms/'].includes(path))return Response.redirect(url.origin+path.slice(0,-1),302);
 const assetPath=path;
 const asset=await env.ASSETS.fetch(new Request(new URL(assetPath,url),req));
 const res=new Response(asset.body,asset);for(const [k,v]of Object.entries(security))res.headers.set(k,v);
 if(!path.startsWith('/assets/'))res.headers.set('Cache-Control','no-cache');
 if(url.hostname!=='mzcodehub.com')res.headers.set('X-Robots-Tag','noindex, nofollow');
 return res;
}
export default {async fetch(req,env){try{return await handle(req,env)}catch{return error('تعذر حفظ الطلب الآن. بياناتك باقية في النموذج؛ أعد المحاولة أو راسلنا بالبريد.',503)}}};
