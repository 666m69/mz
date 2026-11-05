/* Homepage request intake. Never invent a ticket: display reference only after API confirms storage. */
const form = document.getElementById('mz-quick-idea');
const status = document.getElementById('mz-intake-state');
const receipt = document.getElementById('mz-intake-success');
const send = document.getElementById('mz-intake-send');
const idea = document.getElementById('mz-intake-idea');
const email = document.getElementById('mz-intake-email');
const consent = document.getElementById('mz-intake-consent');
let lastSignature = '';
let requestKey = null;

function show(message) { status.textContent = message; }
function rememberReceipt(reference, date, emailMessage) {
  form.hidden = true;
  receipt.hidden = false;
  document.getElementById('mz-intake-reference').textContent = reference;
  document.getElementById('mz-intake-date').textContent = date;
  document.getElementById('mz-intake-mail').textContent = emailMessage;
  receipt.scrollIntoView({block:'nearest',behavior:'smooth'});
}
async function submitIdea(event) {
  event.preventDefault();
  if (send.disabled) return;
  const text = idea.value.trim(), address = email.value.trim().toLowerCase();
  if(text.length < 20 || text.length > 1600) {
    show('اكتب وصفًا واضحًا لا يقل عن 20 حرفًا، عشان نقدر نفهم طلبك.');
    idea.focus(); return;
  }
  if(!address || !email.checkValidity()) {
    show('أدخل بريد تواصل صحيحًا. خدمة استقبال الطلبات الحالية ما تقبل الإرسال بدون بريد؛ التسجيل المجاني لا يحتاج دفع.');
    email.focus(); return;
  }
  if(!consent.checked) { show('قبل الإرسال، وافق على حفظ الطلب ومراجعته.'); consent.focus(); return; }
  const body = {
    idea:text, name:'', email:address,
    consent:'yes', website:document.getElementById('mz-intake-website').value
  };
  const signature = JSON.stringify(body);
  if(signature!==lastSignature){
    if(typeof crypto.randomUUID !== 'function'){
      show('متصفحك لا يدعم إرسال الطلب الآمن. افتح الموقع من متصفح حديث.');
      return;
    }
    requestKey=crypto.randomUUID();
    lastSignature=signature;
  }
  send.disabled = true;
  show('لحظة، نحفظ طلبك ونتأكد من رقم المتابعة…');
  try {
    const response=await fetch('/api/ideas',{
      method:'POST',
      headers:{'Content-Type':'application/json','Idempotency-Key':requestKey},
      body:signature,credentials:'same-origin',cache:'no-store',
      signal:AbortSignal.timeout(23000)
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok || data?.ok!==true
       || !/^[0-9a-f-]{36}$/i.test(data.id||'')
       || !/^MZ-[A-F0-9]{12}$/.test(data.reference||'')){
      throw new Error(data?.error || 'ما وصلنا تأكيد الحفظ. حاول مرة ثانية؛ الطلب لن يتكرر إذا حفظ بالفعل.');
    }
    const date=Number.isFinite(data.created_ms)
      ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'}).format(new Date(data.created_ms))
      : '';
    const emailMessage = data.receipt_email_status==='accepted'
        ? 'قبلت خدمة البريد رسالة التأكيد. راجع بريدك والوارد غير الهام.'
        : data.receipt_email_status==='failed'
          ? 'طلبك محفوظ لكن تعذّر إرسال التأكيد للبريد. احتفظ بالرقم.'
          : 'طلبك محفوظ، وخدمة إرسال التأكيد للبريد لم تتفعّل بعد. احتفظ بالرقم.';
    show('');
    rememberReceipt(data.reference,date,emailMessage);
  } catch(error) {
    show(error.name==='TimeoutError'?'انتهت مهلة الرد. أعد المحاولة بنفس البيانات للتحقق دون تكرار الطلب.':error.message||'تعذّر الحفظ حاليًا. حاول مرة ثانية.');
    status.focus?.();
  } finally {
    send.disabled=false;
  }
}
if(form){
  form.addEventListener('submit',submitIdea);
  document.getElementById('mz-intake-track').addEventListener('click',async()=>{
    const reference=document.getElementById('mz-intake-reference').textContent;
    const track=document.getElementById('mz-intake-track-state');
    if(!/^MZ-[A-F0-9]{12}$/.test(reference))return;
    track.textContent='نتحقق من حالة الطلب…';
    try{
      const res=await fetch('/api/ideas/'+encodeURIComponent(reference),{cache:'no-store',
        credentials:'same-origin',signal:AbortSignal.timeout(12000)});
      const info=await res.json();
      if(!res.ok||info.ok!==true){track.textContent='تعذّر العثور على الطلب الآن. احتفظ برقمك وجرّب لاحقًا.';return;}
      const statusLabels={new:'جديد — بانتظار المراجعة',reviewing:'قيد المراجعة',quoted:'تم إعداد عرض السعر',accepted:'مقبول',building:'قيد التنفيذ',delivered:'تم التسليم',rejected:'مغلق'};
      track.textContent='حالة طلبك: '+(statusLabels[info.status]||'قيد المتابعة');
    }catch{track.textContent='تعذّر الاتصال للتحقق من الحالة. حاول لاحقًا.';}
  });
  document.getElementById('mz-intake-copy').addEventListener('click',async()=>{
    const reference=document.getElementById('mz-intake-reference').textContent;
    if(!reference)return;
    const button=document.getElementById('mz-intake-copy');
    try{await navigator.clipboard.writeText(reference);button.textContent='نُسخ الرقم ✓';}
    catch{button.textContent='حدّد الرقم وانسخه يدويًا';}
  });
}
