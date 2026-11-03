const assets=/* LAB_ASSETS */ {};
const publicHeaders={"cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer","permissions-policy":"camera=(), microphone=(), geolocation=()","content-security-policy":"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname;
 const assetPath=path==="/idea/"||path==="/idea/demo/"?path.slice(0,-1):path;
 const asset=Object.hasOwn(assets,assetPath)?assets[assetPath]:null;
 if(asset&&["GET","HEAD"].includes(request.method)){
   const headers=new Headers(publicHeaders);
   headers.set("content-type",asset[1]+"; charset=utf-8");
   if(assetPath==="/idea/demo")headers.set("content-security-policy",publicHeaders["content-security-policy"].replace("connect-src 'self'","connect-src 'none'"));
   return new Response(request.method==="HEAD"?null:asset[0],{headers});
 }


 // Tracking IDs are unguessable UUIDv4 values. Return status only, never customer PII.
 if(path.startsWith("/api/ideas/")){
  if(request.method!=="GET")return json({error:"Method not allowed"},405);
  if(!env.DB)return json({error:"Service temporarily unavailable"},503);
  const id=path.slice("/api/ideas/".length);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
   return json({error:"Invalid tracking ID"},400);
  try {
   const entry=await env.DB.prepare("SELECT status FROM idea_requests WHERE id=?").bind(id).first();
   if(!entry)return json({error:"Request not found"},404);
   return json({ok:true,id,status:entry.status});
  }catch(e){console.error("idea tracking lookup failed");return json({error:"Service temporarily unavailable"},503)}
 }
 if(path!=="/api/ideas")return json({error:"Not found"},404);
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 if(!env.DB||!env.HASH_SALT)return json({error:"Service temporarily unavailable"},503);
 const origin=request.headers.get("origin"); if(origin!==url.origin)return json({error:"Invalid origin"},403);
 const type=request.headers.get("content-type")||"";if(type.split(";")[0].trim().toLowerCase()!=="application/json")return json({error:"JSON required"},415);
 const length=Number(request.headers.get("content-length")||0);if(length>32768)return json({error:"Too large"},413);
 let data;try{
  if(!request.body)return json({error:"Empty body"},400);
  const reader=request.body.getReader();let total=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>32768){await reader.cancel();return json({error:"Too large"},413)}chunks.push(value)}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  if(!data||typeof data!=="object"||Array.isArray(data))return json({error:"Invalid JSON"},400);
 }catch{return json({error:"Invalid JSON"},400)}
 const idea=typeof data.idea==="string"?data.idea.trim():"",email=typeof data.email==="string"?data.email.trim().toLowerCase():"",name=typeof data.name==="string"?data.name.trim():"";
 if(data.website)return json({error:"تعذر قبول الطلب"},400);
 if(data.consent!=="yes")return json({error:"يجب الموافقة على معالجة البيانات"},400);
 if(idea.length<20||idea.length>5000||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length>100)return json({error:"تحقق من الفكرة والبريد"},400);
 const key=request.headers.get("Idempotency-Key");
 if(key&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))return json({error:"معرف الطلب غير صالح"},400);
 const id=key||crypto.randomUUID(),ip=request.headers.get("CF-Connecting-IP")||"unknown",now=Date.now();
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip+":"+env.HASH_SALT));const ipHash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
 try{
  const saved=await env.DB.prepare(`INSERT INTO idea_requests(id,idea,email,name,ip_hash,created_ms,status)
    SELECT ?,?,?,?,?,?,'new' WHERE (SELECT count(*) FROM idea_requests WHERE ip_hash=? AND created_ms>?)<3
    ON CONFLICT(id) DO NOTHING`).bind(id,idea,email,name,ipHash,now,ipHash,now-3600000).run();
  if(!saved.success)throw Error("Write not confirmed");
  if(saved.meta?.changes!==1){
    const prior=await env.DB.prepare("SELECT idea,email,name FROM idea_requests WHERE id=?").bind(id).first();
    if(!prior)return json({error:"تجاوزت حد الطلبات لهذه الساعة"},429);
    if(prior.idea!==idea||prior.email!==email||prior.name!==name)return json({error:"تغيّر محتوى الطلب. ابدأ طلبًا جديدًا."},409);
    return json({ok:true,id});
  }
  // Email failure must never discard a saved lead. Status remains pending for later retry.
  if(env.NOTIFY&&env.NOTIFY_TO){
   try{
    await env.NOTIFY.send({from:"info@mzcodehub.com",to:env.NOTIFY_TO,subject:"[MZ Code Hub] New project idea — "+id.slice(0,8),
     text:"New idea received\nRequest: "+id+"\nName: "+name+"\nReply: "+email+"\n\n"+idea.slice(0,5000)});
    await env.DB.prepare("UPDATE idea_requests SET notification_status='sent' WHERE id=?").bind(id).run();
   }catch(e){console.error("idea email notification failed");try{await env.DB.prepare("UPDATE idea_requests SET notification_status='failed',notification_error=? WHERE id=?").bind("delivery_failed",id).run()}catch{}}
  }
  return json({ok:true,id},201)
 }catch(e){console.error("idea intake storage failure");return json({error:"تعذر حفظ الطلب الآن"},503)}
}};
