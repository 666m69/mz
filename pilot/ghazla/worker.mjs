// Ghazla: independent, owner-only Worker. Never mount in production until authenticated smoke tests pass.
const HEADERS = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-ghazla-ui'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
const enc = new TextEncoder();
function reply(body,status=200,extra={}) {return new Response(body,{status,headers:{...HEADERS,...extra}});}
function json(data,status=200) {return reply(JSON.stringify(data),status,{'Content-Type':'application/json; charset=utf-8'});}
async function authorized(req,env) {
  if(typeof env.GHAZLA_OWNER_SECRET!=='string'||env.GHAZLA_OWNER_SECRET.length<32) return false;
  const header=req.headers.get('Authorization')||'';
  if(!header.startsWith('Basic ')||header.length>1024) return false;
  let actual; try{actual=atob(header.slice(6));}catch{return false;}
  const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)));
  const [a,b]=await Promise.all([digest(actual),digest('owner:'+env.GHAZLA_OWNER_SECRET)]);
  let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];return mismatch===0;
}
const PAGE = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>غزلة | المكتب الخاص</title><style>body{margin:0;background:#101820;color:#f3eee4;font:17px system-ui;line-height:1.7}main{max-width:650px;margin:8vh auto;padding:24px}small{color:#dac8a6}h1{color:#dfb876}textarea,button{font:inherit;padding:12px;border-radius:10px;border:1px solid #58616a}textarea{box-sizing:border-box;width:100%;background:#1c2630;color:white}button{background:#dfb876;color:#101820;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:#1c2630;padding:16px;border-radius:10px}</style><main><small>MZcode · مساحة المالك</small><h1>غزلة</h1><p>مساعدك الخاص. اكتب المهمة أو اطلب خطة تنفيذ. لا ترسل أسرار الحسابات.</p><textarea id="message" maxlength="1200" rows="4" aria-label="رسالتك"></textarea><p><button id="send">إرسال</button></p><pre id="result" role="status">جاهزة لاستقبال المهمة.</pre><small>النواة المعزولة · لا تنفيذ خارجي أو حفظ للمحادثة.</small></main><script nonce="ghazla-ui">const b=document.getElementById('send'),m=document.getElementById('message'),r=document.getElementById('result');b.onclick=async()=>{if(!m.value.trim())return;b.disabled=true;r.textContent='جارٍ معالجة المهمة…';try{const res=await fetch('/ghazla/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:m.value.trim()})});const data=await res.json();r.textContent=data.reply||data.error||'تعذر الرد.';}catch{r.textContent='تعذر الاتصال.';}finally{b.disabled=false;}};</script></html>`;
export function localPlan(message) {
  const action=/اختبار|فحص|راجع/.test(message)?'تحديد معيار النجاح، ثم إجراء اختبار معزول وتوثيق النتيجة.':/تطوير|برمج|أنشئ|بناء/.test(message)?'تحديد أصغر ميزة قابلة للاختبار، ثم بناء نموذج معزول ومراجعته.':'تحديد المطلوب والأولوية، ثم تقسيم المهمة إلى خطوة تنفيذ واختبار وتسليم.';
  return 'المهمة: '+message+'\nالخطوة المقترحة: '+action+'\nلا يوجد تنفيذ خارجي تلقائي في الوضع المحلي.';
}
async function readMessage(req) {
  if(!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||''))return null;
  const reader=req.body?.getReader();if(!reader)return null;
  let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5000){await reader.cancel();return null;}chunks.push(value);}const raw=new Uint8Array(size);let off=0;for(const c of chunks){raw.set(c,off);off+=c.length;}const b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));if(!b||Object.keys(b).length!==1||typeof b.message!=='string'||!b.message.trim()||b.message.length>1200)return null;return b.message.trim();}catch{return null;}
}
export default {async fetch(req,env) {
  const url=new URL(req.url);
  if(url.protocol!=='https:'||!['/ghazla','/ghazla/','/ghazla/api'].includes(url.pathname))return reply('Not found',404);
  if(typeof env.GHAZLA_OWNER_SECRET!=='string'||env.GHAZLA_OWNER_SECRET.length<32)return reply('Not configured',503);
  if(!await authorized(req,env))return reply('Authentication required',401,{'WWW-Authenticate':'Basic realm="Ghazla", charset="UTF-8"'});
  if(url.pathname!=='/ghazla/api')return ['GET','HEAD'].includes(req.method)?reply(req.method==='HEAD'?null:PAGE,200,{'Content-Type':'text/html; charset=utf-8'}):reply('Method not allowed',405);
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(req.headers.get('Origin')!==url.origin)return json({error:'Forbidden origin'},403);
  const message=await readMessage(req);if(!message)return json({error:'رسالة غير صالحة'},400);
  // Optional AI is deliberately disabled by default; no quota or provider calls in local mode.
  if(env.GHAZLA_AI_ENABLED!=='1')return json({reply:localPlan(message),mode:'local',executed:false});
  if(!env.AI?.run||!env.GHAZLA_DB)return json({error:'محرك الذكاء غير مهيأ'},503);
  try{
    const day=new Date().toISOString().slice(0,10);
    const quota=await env.GHAZLA_DB.prepare('INSERT INTO ghazla_daily(day,hits) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET hits=hits+1 WHERE hits<10 RETURNING hits').bind(day).first();
    if(!quota)return json({error:'بلغت الحد اليومي'},429);
    const out=await env.AI.run('@cf/meta/llama-3.2-3b-instruct',{messages:[{role:'system',content:'أنت غزلة، مساعدة خاصة لمالك MZcode. اختصري وكوني عملية. لا تدّعي تنفيذ أعمال أو وصولًا إلى الحسابات أو حفظًا للذاكرة. لا تطلبي أسرارًا. أجيبي بالعربية.'},{role:'user',content:message}],max_tokens:350});
    if(typeof out?.response!=='string'||!out.response.trim())return json({error:'تعذر توليد الرد'},502);
    return json({reply:out.response.trim(),mode:'ai',executed:false});
  }catch{return json({error:'محرك الذكاء غير متاح'},503);}
}};
