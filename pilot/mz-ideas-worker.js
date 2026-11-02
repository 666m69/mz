// MZ Code Hub — isolated, deployable intake pilot. No payments or AI claims.
const headers={"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"strict-origin-when-cross-origin","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>احك لنا فكرتك | MZ Code Hub</title><style>body{background:#080f18;color:#f1f5f9;font:16px system-ui;margin:0}main{max-width:780px;margin:9vh auto;padding:24px}h1{font-size:clamp(28px,5vw,48px);line-height:1.25}p{color:#aabccb;line-height:1.8}textarea,input{box-sizing:border-box;width:100%;background:#142431;border:1px solid #345469;color:#fff;border-radius:12px;padding:14px;font:inherit;margin:8px 0 16px}textarea{min-height:170px;resize:vertical}label{font-weight:650}button{background:#25d09b;color:#031914;border:0;border-radius:12px;padding:16px 30px;font:inherit;font-weight:700;cursor:pointer}button:disabled{opacity:.55}a{color:#8cead5}small{color:#aabccb}#message{margin-top:18px;white-space:pre-wrap} .hp{position:absolute;left:-10000px}</style><main><a href="https://mzcodehub.com/">MZ Code Hub</a><h1>وش ودك نبني لك؟</h1><p>أي فكرة، أي مجال. صف المشكلة أو الشيء الذي تتمنى وجوده؛ نراجعها ونرسل لك تصورًا ونطاق تنفيذ وسعرًا تقديريًا قبل أي اتفاق.</p><form id="form"><label for="idea">فكرتك</label><textarea id="idea" name="idea" minlength="20" maxlength="5000" required placeholder="أريد موقعًا أو تطبيقًا أو لعبة أو خدمة أو أي فكرة أخرى..."></textarea><label for="email">بريد التواصل</label><input id="email" name="email" type="email" maxlength="254" required autocomplete="email" placeholder="name@example.com"><label for="name">الاسم (اختياري)</label><input id="name" name="name" maxlength="100" autocomplete="name"><div class="hp"><label>Leave empty<input name="website" tabindex="-1" autocomplete="off"></label></div><label style="display:block;font-weight:400;margin:8px 0 18px"><input type="checkbox" name="consent" value="yes" required style="width:auto;margin:0 0 0 8px">أوافق على معالجة بياناتي لغرض دراسة الفكرة والتواصل بشأنها.</label><button id="send" type="submit">أرسل فكرتي</button><p><small>لا يوجد دفع الآن. لا تضع بيانات حساسة في الوصف. لا ننشر تفاصيل فكرتك أو بياناتك دون موافقتك؛ وقد نطور بصورة مستقلة حلولًا عامة مشابهة. <a href="https://mzcodehub.com/privacy">سياسة الخصوصية</a>.</small></p><div id="message" role="status" aria-live="polite"></div></form></main><script>document.getElementById("form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=document.getElementById("send"),m=document.getElementById("message");b.disabled=true;m.textContent="جارٍ الإرسال...";try{const r=await fetch("/api/ideas",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(f)))});const j=await r.json();if(!r.ok)throw Error(j.error||"تعذر الإرسال");m.textContent="تم استلام فكرتك. رقم الطلب: "+j.id+" — سنتواصل معك على البريد.";f.reset()}catch(x){m.textContent=x.message||"تعذر الإرسال، حاول لاحقًا"}finally{b.disabled=false}})</script></html>`;
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(request.method==="GET"&&(path==="/idea"||path==="/idea/"))return new Response(html,{headers});
 if(path!=="/api/ideas")return json({error:"Not found"},404);
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!env.DB||!env.HASH_SALT)return json({error:"Service temporarily unavailable"},503);
 const origin=request.headers.get("origin"); if(origin&&origin!==url.origin)return json({error:"Invalid origin"},403);
 const type=request.headers.get("content-type")||"";if(!type.toLowerCase().startsWith("application/json"))return json({error:"JSON required"},415);
 const length=Number(request.headers.get("content-length")||0);if(length>10000)return json({error:"Too large"},413);
 let data;try{
  if(!request.body)return json({error:"Empty body"},400);
  const reader=request.body.getReader();let total=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>10000){await reader.cancel();return json({error:"Too large"},413)}chunks.push(value)}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  if(!data||typeof data!=="object"||Array.isArray(data))return json({error:"Invalid JSON"},400);
 }catch{return json({error:"Invalid JSON"},400)}
 const idea=typeof data.idea==="string"?data.idea.trim():"",email=typeof data.email==="string"?data.email.trim().toLowerCase():"",name=typeof data.name==="string"?data.name.trim():"";
 if(data.website)return json({ok:true,id:"received"});
 if(data.consent!=="yes")return json({error:"يجب الموافقة على معالجة البيانات"},400);
 if(idea.length<20||idea.length>5000||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length>100)return json({error:"تحقق من الفكرة والبريد"},400);
 const id=crypto.randomUUID(),ip=request.headers.get("CF-Connecting-IP")||"unknown",now=Date.now();
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip+":"+env.HASH_SALT));const ipHash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
 try{
  const n=await env.DB.prepare("SELECT count(*) AS n FROM idea_requests WHERE ip_hash=? AND created_ms>?").bind(ipHash,now-3600000).first();
  if((n?.n||0)>=3)return json({error:"تجاوزت حد الطلبات لهذه الساعة"},429);
  await env.DB.prepare("INSERT INTO idea_requests(id,idea,email,name,ip_hash,created_ms,status) VALUES(?,?,?,?,?,?,?)").bind(id,idea,email,name,ipHash,now,"new").run();
  // Email failure must never discard a saved lead. Status remains pending for later retry.
  if(env.NOTIFY){
   try{
    await env.NOTIFY.send({from:"info@mzcodehub.com",to:null,subject:"[MZ Code Hub] New project idea — "+id.slice(0,8),
     text:"New idea received\nRequest: "+id+"\nName: "+name+"\nReply: "+email+"\n\n"+idea.slice(0,5000)});
    await env.DB.prepare("UPDATE idea_requests SET notification_status='sent' WHERE id=?").bind(id).run();
   }catch(e){console.error("idea email notification failed",String(e).slice(0,300))}
  }
  return json({ok:true,id},201)
 }catch(e){console.error("idea intake storage failure");return json({error:"تعذر حفظ الطلب الآن"},503)}
}};
