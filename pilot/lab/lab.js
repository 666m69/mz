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
    field("scope-state").textContent="اكتب اسمًا ووظيفة واحدة إلى ثمانٍ، دون تكرار أو تجاوز ١٢٥ حرفًا للوظيفة.";return false;
  }
  spec=E.buildSpec(field("idea").value,{title,features});
  if(signature()!==activeSignature) {history=new Map();quantities=new Map();activeSignature=signature();}
  const options=spec.features.map((f,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=f;return o;});
  field("case").replaceChildren(...options);field("trial").hidden=false;
  field("scope-state").textContent="النطاق المعتمد يشمل "+spec.features.length+" وظائف.";
  field("estimate").textContent="نطاق استرشادي أولي "+spec.quote.low.toLocaleString("ar-SA")+"–"+spec.quote.high.toLocaleString("ar-SA")+" ر.س. يحدد الفريق السعر والمدة بعد مراجعة المتطلبات.";
  field("outcome").textContent="";renderHistory();renderRule();return true;
}
function renderRule() {
  const i=Number(field("case").value), [resource,action]=scenario(spec.features[i]);
  field("rule").textContent="الإجراء: "+action+" · "+resource+": "+(quantities.get(i)??1);
}
function renderHistory() {
  field("history").replaceChildren(...Array.from(history.values(),v=>{const li=document.createElement("li");li.textContent=v;return li;}));
}
function run(mode) {
  const i=Number(field("case").value), f=spec.features[i], [resource,action,failure]=scenario(f);
  const before=mode==="available"?1:mode==="empty"?0:(quantities.get(i)??1);
  const result=simulate(before,action,failure);quantities.set(i,result.left);
  const line=f+" — "+(result.ok?"نُفّذ: ":"مُنع: ")+result.detail+" ("+resource+" "+before+" ← "+result.left+").";
  history.set(i+":"+result.ok,line);field("outcome").textContent=line;renderRule();renderHistory();
}
function results() {return [...history.values()].join("\n")||"لم تُجرَ اختبارات بعد.";}
field("design").addEventListener("submit",event=>{
  event.preventDefault();const raw=field("idea").value.trim();
  if(raw.length<20){field("idea").setCustomValidity("اكتب وصفًا من ٢٠ حرفًا على الأقل.");field("idea").reportValidity();return;}
  const base=E.buildSpec(raw);field("project-title").value=base.title;field("features").value=base.features.slice(0,8).map(s=>s.slice(0,125)).join("\n");
  field("scope-state").textContent="";field("trial").hidden=true;field("workspace").hidden=false;field("scope-title").focus();
});
field("example").onclick=()=>{field("idea").value="أريد أن يحجز الزائر موعدًا متاحًا لجولة في المدينة، ويتلقى تنبيهًا إذا امتلأت المواعيد.";field("idea").dispatchEvent(new Event("input"));field("idea").focus();};
field("idea").oninput=()=>{field("idea").setCustomValidity("");field("workspace").hidden=true;};
for (const id of ["project-title","features"]) field(id).oninput=()=>{field("trial").hidden=true;field("scope-state").textContent="اعتمد التعديلات لتحديث التجربة.";};
field("apply").onclick=updateSpec;field("case").onchange=()=>{field("outcome").textContent="";renderRule();};
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
  field("brief").focus();
};
field("intake").addEventListener("submit",async event=>{
  event.preventDefault();const button=field("send"),receipt=field("receipt");if(button.disabled)return;
  const body={idea:field("brief").value.trim(),email:field("email").value.trim(),name:field("name").value.trim(),consent:field("consent").checked?"yes":"",website:field("website").value};
  const signature=JSON.stringify(body);
  if(signature!==lastPayload){requestKey=crypto.randomUUID();lastPayload=signature;}
  button.disabled=true;receipt.textContent="جارٍ حفظ الطلب…";
  try {
    const res=await fetch("/api/ideas",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":requestKey},body:signature,signal:AbortSignal.timeout(25000)});
    const data=await res.json();
    if(!res.ok||data.ok!==true||!/^[a-f0-9-]{36}$/.test(data.id))throw Error(data.error||"لم نتلقَّ تأكيد حفظ. أعد المحاولة.");
    receipt.textContent="تم حفظ طلبك. رقم المتابعة "+data.id+". احتفظ بالرقم للمراجعة.";event.target.reset();lastPayload=null;
  } catch (e) {receipt.textContent=e.name==="TypeError"||e.name==="TimeoutError"?"لم يصلنا تأكيد. أعد الإرسال بنفس البيانات لاسترجاع رقم الطلب.":e.message;}
  finally{button.disabled=false;}
});
