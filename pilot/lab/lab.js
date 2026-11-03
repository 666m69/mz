"use strict";
const E = window.MZBuilderEngine;
const field = id => document.getElementById(id);
const rules = [
  [/حجز|موعد|مواعيد|booking/i, "عدد المواعيد المتاحة", "حجز موعد", "نفدت المواعيد"],
  [/منتج|مخزون|طلب شراء|متجر|shop/i, "عدد القطع المتاحة", "تأكيد طلب قطعة واحدة", "نفد المخزون"],
  [/دفع|فاتور|مدفوع|payment/i, "الرصيد التجريبي بالريال", "تسجيل دفعة تجريبية بقيمة ريال", "الرصيد غير كافٍ"],
  [/تسجيل|عضوية|صلاحيات|حساب المستخدم/i, "عدد أذونات الدخول المتاحة", "قبول دخول تجريبي لمرة واحدة", "يلزم إذن دخول"],
  [/رفع|ملفات|صور|تحميل/i, "المساحة المتاحة بالميغابايت", "قبول ملف تجريبي حجمه ١ ميغابايت", "لا تتسع المساحة للملف"],
];
function scenario(feature) {
  return rules.find(([match]) => match.test(feature))?.slice(1) ||
    ["عدد فرص تنفيذ الخطوة", "إتمام خطوة «" + feature + "»", "شرط التنفيذ غير متاح"];
}
function simulate(available, action, failure) {
  return available > 0 ? {ok:true, left:available-1, detail:action} : {ok:false, left:available, detail:failure};
}
let spec, history, quantities, activeSignature, requestKey, lastPayload;
const nonblankLines = value => value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const signature = () => JSON.stringify([field("idea").value.trim(),field("project-title").value.trim(),nonblankLines(field("features").value)]);
function updateSpec() {
  const title=field("project-title").value.trim(), features=nonblankLines(field("features").value);
  if(!title || !features.length || features.length>8 || features.some(s=>s.length>125) || new Set(features).size!==features.length){
    field("live-preview").hidden=true;field("scope-state").textContent="اكتب اسمًا ووظيفة واحدة إلى ثمانٍ، دون تكرار أو تجاوز ١٢٥ حرفًا للوظيفة.";return false;
  }
  spec=E.buildSpec(field("idea").value,{title,features});
  if(signature()!==activeSignature) {history=new Map();quantities=new Map();activeSignature=signature();}
  const options=spec.features.map((f,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=f;return o;});
  field("case").replaceChildren(...options);field("trial").hidden=false;
  field("scope-state").textContent="النطاق المعتمد يشمل "+spec.features.length+" وظائف.";
  field("estimate").textContent="تقدير آلي غير ملزم: "+spec.quote.low.toLocaleString("ar-SA")+"–"+spec.quote.high.toLocaleString("ar-SA")+" ر.س. · مدة استرشادية "+spec.quote.weeks+". هذه محاكاة لقواعد عامة وليست عرض سعر معتمدًا؛ يراجع الفريق الوظائف والتكلفة والمدة قبل الاتفاق.";
  field("outcome").textContent="";renderHistory();renderRule();renderPreview();return true;
}
function renderRule() {
  const i=Number(field("case").value), [resource,action]=scenario(spec.features[i]);
  field("rule").textContent="الإجراء: "+action+" · "+resource+": "+(quantities.get(i)??1);
}
function renderHistory() {
  field("history").replaceChildren(...Array.from(history.values(),v=>{const li=document.createElement("li");li.textContent=v;return li;}));
}
function renderPreview() {
  // Render customer input with textContent only; no user-controlled HTML is executed.
  field("preview-heading").textContent=spec.title;
  field("preview-subtitle").textContent=spec.idea;
  const cards=spec.features.map((feature,i)=>{
    const card=document.createElement("article");card.className="preview-card";
    const number=document.createElement("span");number.className="preview-number";number.textContent=String(i+1).padStart(2,"0");
    const heading=document.createElement("strong");heading.textContent=feature;
    const button=document.createElement("button");button.type="button";button.className="preview-action";
    button.textContent="جرّب الوظيفة";
    button.addEventListener("click",()=>{field("case").value=String(i);run("current");});
    card.append(number,heading,button);
    return card;
  });
  field("preview-actions").replaceChildren(...cards);
  field("preview-status").textContent="اختر وظيفة؛ المحاولة الأولى تنجح، والثانية تختبر نفاد الشرط.";
  field("live-preview").hidden=false;
}
function run(mode) {
  const i=Number(field("case").value), f=spec.features[i], [resource,action,failure]=scenario(f);
  const before=mode==="available"?1:mode==="empty"?0:(quantities.get(i)??1);
  const result=simulate(before,action,failure);quantities.set(i,result.left);
  const line=f+" — "+(result.ok?"نُفّذ: ":"مُنع: ")+result.detail+" ("+resource+" "+before+" ← "+result.left+").";
  history.set(i+":"+result.ok,line);field("outcome").textContent=line;field("preview-status").textContent=line;renderRule();renderHistory();
}
function results() {return [...history.values()].join("\n")||"لم تُجرَ اختبارات بعد.";}
field("design").addEventListener("submit",event=>{
  event.preventDefault();const raw=field("idea").value.trim();
  if(raw.length<20){field("idea").setCustomValidity("اكتب وصفًا من ٢٠ حرفًا على الأقل.");field("idea").reportValidity();return;}
  const base=E.buildSpec(raw);field("project-title").value=base.title;field("features").value=base.features.slice(0,8).map(s=>s.slice(0,125)).join("\n");
  field("scope-state").textContent="";field("trial").hidden=true;field("workspace").hidden=false;field("scope-title").focus();
});
let copiedIdea;
field("direct-request").onclick=event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;
  event.preventDefault();
  const brief=field("brief");
  if(!brief.value.trim()||brief.value===copiedIdea){
    copiedIdea=field("idea").value.trim();
    brief.value=copiedIdea;
  }
  brief.focus();
};
field("idea").oninput=()=>{field("idea").setCustomValidity("");field("workspace").hidden=true;field("live-preview").hidden=true;};
for (const id of ["project-title","features"]) field(id).oninput=()=>{field("trial").hidden=true;field("live-preview").hidden=true;field("scope-state").textContent="اعتمد التعديلات لتحديث التجربة.";};
field("apply").onclick=updateSpec;field("case").onchange=()=>{field("outcome").textContent="";renderRule();};
field("preview-request").onclick=()=>field("handoff").click();
field("preview-reset").onclick=()=>{
  if(!spec)return;
  quantities=new Map();history=new Map();
  field("preview-status").textContent="أُعيدت التجربة؛ يمكنك البدء من جديد.";
  field("outcome").textContent="";renderRule();renderHistory();
};
field("pass").onclick=()=>run("available");field("fail").onclick=()=>run("empty");field("again").onclick=()=>run("current");
function downloadFile(body,type,name) {
  const url=URL.createObjectURL(new Blob([body],{type}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
field("download").onclick=()=>{
  downloadFile(E.briefMarkdown(spec)+"\n\n## نتائج محاكاة النطاق\n"+results()+"\n","text/markdown;charset=utf-8","MZcode-project-brief.md");
};
field("prototype").onclick=async()=>{
  try {
    const html=await window.MZPrototype.documentFor(spec,scenario);
    downloadFile(html,"text/html;charset=utf-8","MZcode-prototype.html");
    field("export-state").textContent="افتح ملف MZcode-prototype.html في متصفحك لتجربة النموذج دون إنترنت.";
  } catch {field("export-state").textContent="تعذر إنشاء النموذج. أعد المحاولة أو نزّل الموجز.";}
};
field("handoff").onclick=()=>{
  const base=spec.title+"\n"+spec.idea+"\n\nالوظائف المعتمدة\n"+spec.features.join("\n");
  const counts="\n\nنتائج التجربة: "+history.size+" حالات من "+spec.features.length*2+" ممكنة.";
  const full=base+counts+"\n"+results();
  field("brief").value=full.length<=5000?full:base+counts;
  field("receipt").textContent=full.length<=5000?"راجع النص قبل إرساله.":"يتضمن الطلب ملخص الاختبارات. تتوفر التفاصيل في ملف الموجز.";
  field("request").scrollIntoView({block:"start"});field("brief").focus();
};
field("intake").addEventListener("submit",async event=>{
  event.preventDefault();const button=field("send"),receipt=field("receipt");if(button.disabled)return;
  const body={idea:field("brief").value.trim(),email:field("email").value.trim(),name:field("name").value.trim(),consent:field("consent").checked?"yes":"",website:field("website").value};
  const signature=JSON.stringify(body);
  if(signature!==lastPayload){requestKey=crypto.randomUUID();lastPayload=signature;}
  button.disabled=true;receipt.textContent="جارٍ حفظ الطلب…";field("receipt-card").hidden=true;
  try {
    const res=await fetch("/api/ideas",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":requestKey},body:signature,signal:AbortSignal.timeout(25000)});
    const data=await res.json();
    if(!res.ok||data.ok!==true||!/^[a-f0-9-]{36}$/.test(data.id))throw Error(data.error||"لم نتلقَّ تأكيد حفظ. أعد المحاولة.");
    const reference=data.reference||"MZ-"+data.id.slice(0,8).toUpperCase()+data.id.slice(-4).toUpperCase();
    field("receipt-code").textContent=reference;
    const date=Number.isFinite(data.created_ms)?new Intl.DateTimeFormat("ar-SA-u-ca-gregory",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Riyadh"}).format(new Date(data.created_ms)):"وقت استلام الطلب";
    field("receipt-date").textContent="تاريخ الاستلام: "+date+" (بتوقيت السعودية)";
    const mail={
     accepted:"قبلت خدمة البريد إرسال رسالة التأكيد إلى "+body.email+". راجع الوارد والبريد غير الهام.",
     pending_setup:"لم تُرسل رسالة بريد للعميل بعد، لأن خدمة إرسال البريد الخارجي لم تُفعّل. طلبك محفوظ بأمان ويمكن متابعته بهذا الرقم.",
     failed:"تم حفظ طلبك، لكن تعذر إرسال رسالة التأكيد إلى بريدك. احتفظ بالرقم وتواصل معنا عند الحاجة."
    };
    field("receipt-mail-status").textContent=mail[data.receipt_email_status]||"تم حفظ الطلب؛ احتفظ برقم المتابعة.";
    field("tracking-id").value=reference;
    field("receipt-card").hidden=false;
    receipt.textContent="تم حفظ طلبك بنجاح. هذا رقمك المختصر وإيصال الاستلام:";
    event.target.reset();lastPayload=null;
  } catch (e) {receipt.textContent=e.name==="TypeError"||e.name==="TimeoutError"?"لم يصلنا تأكيد. أعد الإرسال بنفس البيانات لاسترجاع رقم الطلب.":e.message;}
  finally{button.disabled=false;}
});


field("copy-reference").addEventListener("click",async()=>{
 const code=field("receipt-code").textContent;
 try{await navigator.clipboard.writeText(code);field("copy-reference").textContent="تم نسخ الرقم";}
 catch{field("copy-reference").textContent="حدّد الرقم أعلاه لنسخه";}
});
field("receipt-track").addEventListener("click",()=>field("tracking-id").value=field("receipt-code").textContent);

// Request tracking displays only a status. The tracking key must be treated as private.
const trackingLabels={
 "new":"تم استلام طلبك، وهو في قائمة المراجعة.",
 "reviewing":"الطلب قيد المراجعة.",
 "in_review":"الطلب قيد المراجعة.",
 "contacted":"تواصل الفريق بخصوص طلبك.",
 "quoted":"تم إعداد عرض السعر؛ راجع بريدك للتفاصيل.",
 "accepted":"تم قبول المشروع للبدء بعد الاتفاق.",
 "building":"المشروع قيد التنفيذ.",
 "rejected":"تعذّر قبول المشروع؛ يمكن التواصل لمعرفة التفاصيل.",
 "approved":"تم اعتماد تنفيذ المشروع.",
 "in_progress":"التنفيذ جارٍ.",
 "delivered":"تم تسليم المشروع.",
 "closed":"أُغلق الطلب.",
 "cancelled":"أُغلق الطلب دون تنفيذ."
};
field("track-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const id=field("tracking-id").value.trim();
 const result=field("tracking-result"),button=field("track-submit");
 if(!/^MZ-[0-9a-f]{12}$/i.test(id)&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
  result.textContent="رقم المتابعة غير صحيح. انسخه كاملاً من إيصال الطلب.";return;
 }
 if(button.disabled)return;
 button.disabled=true;result.textContent="جارٍ التحقق من حالة الطلب…";
 try{
  const response=await fetch("/api/ideas/"+encodeURIComponent(id),{method:"GET",cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(response.status===404){result.textContent="لم نجد طلباً بهذا الرقم. تأكد من نسخه بصورة صحيحة.";return;}
  if(!response.ok)throw Error("تعذر الاستعلام حالياً. أعد المحاولة لاحقاً.");
  const data=await response.json();
  if(data.ok!==true||typeof data.status!=="string"||(data.reference?.toLowerCase()!==id.toLowerCase()&&data.id?.toLowerCase()!==id.toLowerCase()))throw Error("تعذر قراءة حالة الطلب حالياً.");
  result.textContent=trackingLabels[data.status]||"تم العثور على الطلب. للحصول على آخر التفاصيل تواصل مع info@mzcodehub.com.";
 }catch(e){result.textContent=e.name==="TimeoutError"?"انتهت مهلة الاستعلام. حاول مجدداً.":e.message||"تعذر الاستعلام حالياً."}
 finally{button.disabled=false;}
});
