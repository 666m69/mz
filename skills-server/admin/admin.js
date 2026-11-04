'use strict';
const $=id=>document.getElementById(id);
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const text=(id,s)=>{$(id).textContent=s;};
let token='', catalog={}, generation=0, busy=false;
const pendingKeys=new Map();
const words={queued:'بانتظار الاختبار',running:'قيد التشغيل',succeeded:'اجتاز الاختبار',failed:'فشل الاختبار',
  schema:'بنية المدخلات',negative_input:'رفض طلب خارج النطاق',standalone_files:'ملفات المشروع',runtime_mutation:'تغيير حالة التطبيق',runtime_persistence:'الحفظ بعد إعادة التحميل',
  inactive_release:'الإصدار معطل.',review_required:'يلزم نجاح الاختبار قبل التفعيل.',already_exists:'رقم الإصدار مستخدم. اختر رقمًا جديدًا.',
  stale_revision:'غيّر مالك آخر الحالة. حدّث الصفحة الداخلية وأعد المحاولة.',invalid_release:'تحقق من الاسم ورقم الإصدار والتنفيذ.',
  unauthorized:'رمز الدخول غير صالح.',rate_limit:'بلغت الحد المؤقت. حاول بعد دقيقة.',daily_limit:'اكتملت حصة اليوم.',
  capacity_limit:'بلغ السجل سقف هذه التجربة.',queue_full:'قائمة التشغيل ممتلئة.',lease_exhausted:'انتهت مهلة المشغّل.',
  release_withdrawn:'سُحب الإصدار.',digest_mismatch:'تغيرت بصمة التنفيذ.',sandbox_unavailable:'عزل المشغّل غير متاح.',
  technical_review:'تحتاج الفكرة مراجعة تقنية.',unsupported_idea:'الفكرة خارج نطاق المهارة.',contract_failed:'فشلت فحوص المهارة.',
  'owner.review':'طلب مراجعة','owner.intake':'استقبال خاص','owner.activate':'تفعيل','owner.disable':'تعطيل','owner.rollback':'تراجع',
  'test.queued':'جدولة اختبار','test.running':'بدأ الاختبار','test.succeeded':'نجاح الاختبار','test.failed':'فشل الاختبار',
  'build.queued':'جدولة بناء','build.running':'بدأ البناء','build.succeeded':'نجاح البناء','build.failed':'فشل البناء'};
const label=s=>words[s]||s;
function message(s,error=false){text('status',s);$('status').classList.toggle('error',error);}
async function api(path,body) {
  const h={Authorization:'Bearer '+token};const signature=path+JSON.stringify(body??null);
  if(body!==undefined){h['Content-Type']='application/json';if(!pendingKeys.has(signature))pendingKeys.set(signature,crypto.randomUUID());
    h['Idempotency-Key']=pendingKeys.get(signature);}
  const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:h,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'error'});
  const value=await r.json();if(!r.ok){if(r.status<500)pendingKeys.delete(signature);throw new Error(label(value.error));}
  pendingKeys.delete(signature);return value;
}
function reset(){
  assistantJob=null;$('assistant').reset();$('assistant-result').hidden=true;text('assistant-status','');generation++;token='';catalog={};pendingKeys.clear();$('token').value='';$('registry').replaceChildren();$('audit').replaceChildren();
  $('faults').replaceChildren();$('console').hidden=true;$('login').hidden=false;$('draft').reset();message('');
}
function button(label,act,quiet=false){const b=node('button',label);b.type='button';if(quiet)b.className='quiet';b.onclick=()=>perform(act);return b;}
async function perform(fn){
  if(busy)return;busy=true;
  const buttons=[...document.querySelectorAll('button')];for(const b of buttons)b.disabled=true;
  try{await fn();}catch(e){message(e.message==='Failed to fetch'?'تعذر الاتصال. يمكنك إعادة المحاولة.':e.message,true);}
  finally{busy=false;for(const b of buttons)b.disabled=false;}
}
function options(select,list){const current=select.value;select.replaceChildren(...list.map(([key,display])=>{const o=node('option',display);o.value=key;return o;}));
  if(list.some(([k])=>k===current))select.value=current;}
function adapters(){const def=catalog[$('skill').value];if(def)options($('adapter'),Object.keys(def.adapters).map(k=>[k,k]));}
async function refresh(){
  const epoch=generation;
  const [registry,monitor]=await Promise.all([api('skills'),api('monitor')]);if(epoch!==generation)return;
  catalog=registry.catalog;options($('skill'),Object.entries(catalog).map(([k,x])=>[k,x.name_ar]));adapters();
  const cards=registry.skills.map(s=>{
    const el=node('article');el.className='card';el.append(node('h3',catalog[s.id]?.name_ar||s.id));
    const state=node('strong',s.enabled?'مفعلة':'معطلة');state.className='tag';el.append(state,node('small','الإصدار الحالي '+(s.active_version||'—')+' · إصدار التراجع '+(s.rollback_version||'—')));
    const decide=async(action,version)=>{
      await api('skills/'+s.id+'/'+action,{revision:s.revision,...(version?{version}:{})});await refresh();message('حُفظ قرار المالك.');
    };
    for(const v of s.versions){
      const row=node('div');row.className='entry';row.append(node('b',v.name_ar+' · '+v.version),node('small',label(v.test.status)));
      const details=node('details');details.append(node('summary','تفاصيل الإصدار والاختبارات'),node('p','التنفيذ '+v.adapter_ref),node('p','البصمة '+v.adapter_digest));
      details.append(node('p',v.test.checks.map(label).join('، ')||'لم تكتمل الفحوص بعد.'));
      if(v.test.error)details.append(node('p',label(v.test.error)));row.append(details);
      if(v.test_status==='passed'&&(!s.enabled||v.version!==s.active_version))row.append(button('تفعيل '+v.version,()=>decide('activate',v.version)));
      el.append(row);
    }
    const actions=node('div');actions.className='actions';
    if(s.enabled)actions.append(button('تعطيل المهارة',()=>decide('disable'),true));
    if(s.rollback_version)actions.append(button('تراجع إلى '+s.rollback_version,()=>decide('rollback',s.rollback_version),true));
    el.append(actions);return el;
  });
  $('registry').replaceChildren(...(cards.length?cards:[node('p','السجل فارغ. أرسل أول إصدار للمراجعة.')]));
  $('improvements').replaceChildren(...(monitor.improvements.length?monitor.improvements.map(x=>
    node('li','راجع '+(catalog[x.skill_id]?.name_ar||x.skill_id)+' '+x.version+' — '+label(x.error_code)+' ('+x.occurrences+'). اختبر الإصلاح كإصدار جديد.')):[node('li','لا توجد أعطال متكررة تستدعي اقتراح إصدار.')]));
  const counts=Object.fromEntries(monitor.counts.map(x=>[x.status,x.total]));
  text('queue','انتظار '+(counts.queued||0)+' · تشغيل '+(counts.running||0)+' · نجاح '+(counts.succeeded||0)+' · فشل '+(counts.failed||0)+' · مهل منتهية '+monitor.expired_leases
    +(monitor.oldest_pending?.at?' · أقدم انتظار '+new Date(monitor.oldest_pending.at*1000).toLocaleString('ar-SA'):''));
  $('faults').replaceChildren(...monitor.faults.map(f=>node('p',f.skill_id+' · '+label(f.error_code))));
  $('audit').replaceChildren(...monitor.audit.map(a=>node('li',new Date(a.at*1000).toLocaleString('ar-SA')+' · '+label(a.event)+' · '+a.target)));
}
$('login').onsubmit=e=>{e.preventDefault();perform(async()=>{token=$('token').value.trim();$('token').value='';
  try{await refresh();}catch(err){reset();throw err;}$('login').hidden=true;$('console').hidden=false;message('تم الدخول.');});};
$('skill').onchange=adapters;
$('draft').onsubmit=e=>{e.preventDefault();perform(async()=>{
  await api('releases',{id:$('skill').value,adapter_ref:$('adapter').value,version:$('version').value.trim(),name_ar:$('arabic').value.trim()});
  await refresh();message('سُجّل الإصدار وأُضيف إلى قائمة الاختبار.');});};
$('refresh').onclick=()=>perform(async()=>{await refresh();message('الحالة محدثة.');});
$('logout').onclick=reset;window.addEventListener('pagehide',reset);

let assistantJob=null;
$('assistant').onsubmit=e=>{e.preventDefault();perform(async()=>{
  const job=await api('assistant/runs',{idea:$('idea').value,private_prototype_consent:$('private-consent').checked});
  assistantJob=job;$('assistant-result').hidden=false;$('assistant').reset();
  text('assistant-status','اختيرت '+catalog[job.skill_id].name_ar+'، الإصدار '+job.version+'، وأُرسل طلب البناء.');
});};
$('assistant-fetch').onclick=()=>perform(async()=>{
  const job=assistantJob;if(!job)return;
  const path='requests/'+job.request_id+'/runs/'+job.job_id;
  const r=await api(path);
  if(r.status!=='succeeded'){text('assistant-status',r.status==='failed'?label(r.error_code):'بانتظار اكتمال البناء.');return;}
  const file=await fetch('/api/'+path+'/artifact',{headers:{Authorization:'Bearer '+job.request_token},redirect:'error',cache:'no-store'});
  if(!file.ok)throw Error('تعذر تنزيل المشروع.');
  const url=URL.createObjectURL(await file.blob()),a=document.createElement('a');a.href=url;a.download=job.skill_id+'.zip';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);text('assistant-status','اكتمل البناء ونُزّل المشروع.');
});
