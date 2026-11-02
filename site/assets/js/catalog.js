const email='info@mzcodehub.com',copy=document.querySelector('#copy-email');
if(copy){copy.hidden=false;copy.addEventListener('click',async()=>{const status=document.querySelector('#copy-status');try{await navigator.clipboard.writeText(email);status.textContent='تم نسخ البريد.'}catch{status.textContent='تعذّر النسخ؛ يمكنك تحديد عنوان البريد ونسخه.'}})}
const form=document.querySelector('#quick-contact');
if(form){
 form.hidden=false;
 const status=document.querySelector('#contact-status'),button=document.querySelector('#send-message'),reply=form.elements.reply,message=form.elements.message;
 let receipt=null,lastPayload='',requestId='',sending=false;
 const normalize=value=>value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[\s()-]/g,'');
 const validReply=value=>{if(value.includes('@'))return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);let p=normalize(value);if(/^05\d{8}$/.test(p))p='+966'+p.slice(1);if(/^9665\d{8}$/.test(p))p='+'+p;return /^\+[1-9]\d{7,14}$/.test(p)&&(!p.startsWith('+966')||/^\+9665\d{8}$/.test(p))};
 reply.addEventListener('input',()=>reply.setCustomValidity(''));
 message.addEventListener('input',()=>message.setCustomValidity(''));
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(sending)return;
  if(!validReply(reply.value.trim())){reply.setCustomValidity('أدخل بريداً صحيحاً، أو رقم جوال سعودي، أو رقماً دولياً يبدأ بـ +.');reply.reportValidity();return}
  if(message.value.trim().length<10){message.setCustomValidity('اكتب رسالتك في 10 أحرف على الأقل.');message.reportValidity();return}
  const payload={mode:'quick',reply:reply.value.trim(),message:message.value.trim(),consent:true,website:form.elements.website.value};
  const fingerprint=JSON.stringify(payload);
  if(fingerprint===lastPayload&&receipt){status.textContent='رسالتك محفوظة بالفعل. رقم المتابعة: '+receipt;status.focus();return}
  if(fingerprint!==lastPayload){requestId=crypto.randomUUID();lastPayload=fingerprint;receipt=null}
  sending=true;button.disabled=true;button.textContent='جارٍ الإرسال…';status.classList.remove('error');status.textContent='';
  try{
   const tokenResponse=await fetch('/api/contact-token',{cache:'no-store',signal:AbortSignal.timeout(15000)}),tokenData=await tokenResponse.json();
   if(!tokenResponse.ok)throw Error(tokenData.message||'تعذّر تجهيز الإرسال. حاول مجدداً.');
   const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,token:tokenData.token,requestId}),signal:AbortSignal.timeout(20000)}),data=await response.json();
   if(!response.ok||!data.ok)throw Error(data.message||'تعذّر حفظ الرسالة. حاول مجدداً.');
   receipt=data.reference;status.textContent='تم حفظ رسالتك. رقم المتابعة: '+receipt+'. للمتابعة يمكنك مراسلتنا بالبريد.';
  }catch(error){status.classList.add('error');status.textContent=error.name==='TimeoutError'||error.name==='TypeError'?'تعذّر الاتصال. رسالتك باقية؛ حاول مجدداً أو استخدم البريد المباشر.':error.message}
  finally{sending=false;button.disabled=false;button.textContent='إرسال الرسالة ←';status.focus()}
 });
}
