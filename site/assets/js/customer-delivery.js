// Private delivery browser flow. No tokens in localStorage, query strings or DOM.
// The server holds the HttpOnly SameSite=Strict session cookie.
const $=id=>document.getElementById(id);
const start=$('start-form'),confirm=$('confirm-form'),codePanel=$('code-panel'),project=$('project-panel');
const feedback=$('feedback'),download=$('download');
let reference=null;
const refPattern=/^MZ-[A-F0-9]{12}$/;
function note(message,error=false){feedback.textContent=message;feedback.dataset.error=String(error)}
function busy(button,value){button.disabled=value}
async function request(path,body){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(path,{method:body===undefined?'GET':'POST',
   headers:body===undefined?{}:{'Content-Type':'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),
   cache:'no-store',credentials:'same-origin',signal:controller.signal});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.error==='try_later'?'وصلت للحد المؤقت. جرّب لاحقًا.':
   data?.error==='verification_failed'?'رمز غير صالح أو منتهي. اطلب رمزًا جديدًا عند الحاجة.':
   data?.error==='temporarily_unavailable'?'الخدمة غير متاحة حاليًا. جرّب لاحقًا.':
   'تعذر تأكيد الطلب. تأكد من البيانات وحاول مرة أخرى.');
  return data;
 }finally{clearTimeout(timeout)}
}
async function refresh(){
 if(!reference)return;
 busy($('refresh'),true);
 download.hidden=true;download.removeAttribute('href');
 $('project-state').textContent='نجري فحصًا لحالة طلبك…';
 try{
  const info=await request('/api/customer/requests/'+encodeURIComponent(reference));
  const states={new:'جديد — بانتظار المراجعة',reviewing:'قيد المراجعة',
   quoted:'تم إعداد عرض السعر',accepted:'تم قبول الطلب',building:'قيد التنفيذ',
   delivered:'تم التسليم',rejected:'الطلب مغلق'};
  $('project-state').textContent='حالة طلبك: '+(states[info.status]||'قيد المتابعة')+
    (info.delivery==='ready'?' — مشروعك جاهز للاستلام.':' — ملف التسليم لم يصبح جاهزًا بعد.');
  if(info.delivery==='ready'){
   download.href='/api/customer/requests/'+encodeURIComponent(reference)+'/artifact';
   download.hidden=false;
  }
 }catch(e){$('project-state').textContent='تعذّر تحديث الحالة. أعد التحقق من البريد إذا انتهت الجلسة.';note(e.message,true)}
 finally{busy($('refresh'),false)}
}
start.addEventListener('submit',async event=>{
 event.preventDefault();
 const r=$('reference').value.trim().toUpperCase(),email=$('email').value.trim().toLowerCase();
 if(!refPattern.test(r)||!$('email').checkValidity()){note('تحقق من رقم الطلب والبريد.',true);return}
 busy($('request-code'),true);note('نجري التحقق من بيانات الطلب…');
 try{
  const result=await request('/api/customer/verification/start',{reference:r,email});
  if(result.ok!==true)throw Error('لم يؤكد الخادم استقبال الطلب.');
  reference=r;codePanel.hidden=false;project.hidden=true;
  note('إذا تطابق البريد ورقم الطلب، سيصلك رمز من ٨ أرقام. افحص الرسائل غير الهامة.');
  $('code').focus();
 }catch(e){note(e.message||'تعذر طلب الرمز.',true)}
 finally{busy($('request-code'),false)}
});
confirm.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!reference||!refPattern.test(reference))return;
 const code=$('code').value.trim();
 if(!/^\d{8}$/.test(code)){note('أدخل الرمز المكوّن من ٨ أرقام.',true);return}
 busy($('confirm'),true);note('نتحقق من الرمز…');
 try{
  const r=await request('/api/customer/verification/confirm',{
    reference,email:$('email').value.trim().toLowerCase(),code});
  if(r.ok!==true)throw Error('لم يؤكد الخادم صلاحية الرمز.');
  $('code').value='';
  codePanel.hidden=true;project.hidden=false;note('تم التحقق من بريدك.');
  await refresh();
 }catch(e){note(e.message||'تعذر التحقق.',true)}
 finally{busy($('confirm'),false)}
});
$('refresh').addEventListener('click',refresh);
download.addEventListener('click',event=>{
 if(download.hidden||!reference||download.getAttribute('href')!==
   '/api/customer/requests/'+encodeURIComponent(reference)+'/artifact')event.preventDefault();
});
const prefill=new URL(location.href).searchParams.get('reference');
if(prefill&&refPattern.test(prefill.toUpperCase()))$('reference').value=prefill.toUpperCase();
