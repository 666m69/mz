import {MARKETS,STAGES,publicHolidaysFromApi,makeAgency,makeEvent,upcoming,draftMessage,agenciesCsv} from './core.mjs';

const $=(id)=>document.getElementById(id);
const LOCAL_KEY='mzcode:tourism-agencies-pilot:v1';
const maxRows=150;
let agencies=[],customEvents=[],holidays=[];
let storageOk=true;
function safelyGet(){
  try{
    const saved=JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}');
    agencies=Array.isArray(saved.agencies)?saved.agencies.filter(x=>MARKETS.some(m=>m.code===x?.country)&&typeof x?.name==='string').slice(0,maxRows):[];
    customEvents=Array.isArray(saved.customEvents)?saved.customEvents.filter(x=>MARKETS.some(m=>m.code===x?.country)&&typeof x?.title==='string').slice(0,maxRows):[];
  }catch{
    storageOk=false;
    $('agency-state').textContent='تعذّر قراءة بيانات المتصفح؛ ستعمل النسخة مؤقتًا دون حفظ.';
  }
}
function persist(){
  if(!storageOk)return;
  try{localStorage.setItem(LOCAL_KEY,JSON.stringify({agencies,customEvents}));}
  catch{storageOk=false;$('agency-state').textContent='تعذّر الحفظ في المتصفح، لا تعتمد على هذه النسخة لتخزين بيانات العمل.';}
}
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});
const eventCollection=()=>[...new Map([...holidays,...customEvents].map(e=>[e.id,e])).values()];
function selectOptions(select,values,withAll=false){
  select.replaceChildren();
  if(withAll){const option=document.createElement('option');option.value='all';option.textContent='كل الدول';select.append(option);}
  for(const item of values){
    const option=document.createElement('option');
    option.value=item.code;option.textContent=item.name+' — '+item.group;
    select.append(option);
  }
}
function makeEl(tag,txt,cls=''){
  const x=document.createElement(tag);
  if(txt!==undefined)x.textContent=String(txt);
  if(cls)x.className=cls;
  return x;
}
function agencyOptions(){
  const select=$('draft-agency');const previous=select.value;
  select.replaceChildren();
  if(!agencies.length){
    const empty=makeEl('option','أضف شركة أولًا');empty.value='';select.append(empty);
  }
  for(const agency of agencies){
    const option=makeEl('option',agency.name+' — '+MARKETS.find(m=>m.code===agency.country)?.name);
    option.value=agency.id;select.append(option);
  }
  if(agencies.some(a=>a.id===previous))select.value=previous;
  eventOptions();
}
function eventOptions(){
  const select=$('draft-event');const selected=$('draft-agency').value;
  const agency=agencies.find(a=>a.id===selected);
  const old=select.value;
  select.replaceChildren();
  if(!agency){
    const op=makeEl('option','اختر شركة أولًا');op.value='';select.append(op);
    return;
  }
  const events=eventCollection().filter(e=>e.country===agency.country).sort((a,b)=>a.date.localeCompare(b.date));
  if(!events.length){const op=makeEl('option','اجلب عطلة أو أضف مناسبة لنفس البلد');op.value='';select.append(op);}
  for(const event of events){
    const op=makeEl('option',event.date+' — '+event.title);op.value=event.id;select.append(op);
  }
  if(events.some(e=>e.id===old))select.value=old;
}
function createEventRow(e,days=null){
  const li=makeEl('li');
  li.append(makeEl('span',e.date,'when'));
  const box=makeEl('div',undefined,'body');
  box.append(makeEl('strong',e.title));
  const country=MARKETS.find(m=>m.code===e.country)?.name||e.country;
  const label=e.source+' · '+country+(days!==null?' · بعد '+days+' يوم':'');
  box.append(makeEl('small',label));
  li.append(box);
  if(e.sourceUrl){
    const link=makeEl('a','المصدر');link.href=e.sourceUrl;
    link.target='_blank';link.rel='noreferrer noopener';li.append(link);
  }
  if(e.kind==='manual'){
    const del=makeEl('button','حذف','danger');
    del.type='button';del.addEventListener('click',()=>{
      customEvents=customEvents.filter(item=>item.id!==e.id);persist();renderEvents();
    });li.append(del);
  }
  return li;
}
function renderEvents(){
  const list=$('holiday-list');list.replaceChildren();
  const selected=$('holiday-country').value;
  const year=$('holiday-year').value;
  const selectedHolidays=holidays.filter(h=>h.country===selected&&h.date.startsWith(year)).sort((a,b)=>a.date.localeCompare(b.date));
  if(!selectedHolidays.length)list.append(makeEl('li','لا توجد بيانات عطل محمّلة لهذا الاختيار.','empty'));
  else for(const h of selectedHolidays)list.append(createEventRow(h));
  const opportunities=$('opportunities');opportunities.replaceChildren();
  const next=upcoming(eventCollection(),{today:today(),days:120});
  if(!next.length)opportunities.append(makeEl('li','لا توجد مناسبات في الـ120 يومًا القادمة ضمن البيانات المتاحة.','empty'));
  else for(const ev of next.slice(0,35))opportunities.append(createEventRow(ev,Math.max(0,Math.round((new Date(ev.date+'T00:00:00Z')-new Date(today()+'T00:00:00Z'))/86400000))));
  eventOptions();
}
function renderAgencies(){
  const tbody=$('agency-rows');tbody.replaceChildren();
  if(!agencies.length){const tr=makeEl('tr');const td=makeEl('td','لا توجد شركات بعد.');td.colSpan=5;tr.append(td);tbody.append(tr);}
  for(const company of agencies){
    const tr=makeEl('tr');
    tr.append(makeEl('td',company.name),makeEl('td',MARKETS.find(m=>m.code===company.country)?.name||company.country),makeEl('td',company.followup||'—'));
    const td=document.createElement('td');
    const select=makeEl('select');select.setAttribute('aria-label','حالة '+company.name);
    for(const [stage,label] of Object.entries(STAGES)){
      const opt=makeEl('option',label);opt.value=stage;select.append(opt);
    }
    select.value=company.stage;
    select.addEventListener('change',()=>{
      company.stage=select.value;persist();
    });
    td.append(select);tr.append(td);
    const cell=makeEl('td'),button=makeEl('button','حذف','danger');button.type='button';
    button.addEventListener('click',()=>{agencies=agencies.filter(a=>a.id!==company.id);persist();renderAgencies();});
    cell.append(button);tr.append(cell);tbody.append(tr);
  }
  agencyOptions();
}
function downloadFile(contents,name,type){
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function reportError(error){
  const code=String(error?.message||'error');
  const map={
    invalid_text:'أكمل البيانات المطلوبة دون معلومات شخصية.',
    invalid_country:'اختر دولة مدعومة.',
    invalid_stage:'اختر حالة صالحة.',
    invalid_source_url:'رابط المصدر يجب أن يبدأ بـhttps:// ودون بيانات دخول.',
    country_mismatch:'اختر شركة ومناسبة من الدولة نفسها.',
    invalid_event:'راجع الدولة وتاريخ المناسبة.'
  };
  return map[code]||'تعذّر إكمال الطلب؛ تحقق من الحقول وحاول مرة أخرى.';
}

function init(){
  safelyGet();
  for(const id of ['holiday-country','event-country','agency-country'])selectOptions($(id),MARKETS);
  const year=new Date().getFullYear();
  for(const y of [year,year+1]){
    const opt=makeEl('option',String(y));opt.value=String(y);$('holiday-year').append(opt);
  }
  for(const [key,label] of Object.entries(STAGES)){
    const option=makeEl('option',label);option.value=key;$('agency-stage').append(option);
  }
  $('holiday-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const code=$('holiday-country').value,selectedYear=Number($('holiday-year').value);
    const state=$('holiday-state');
    const button=$('load-holidays');
    state.textContent='نجلب العطل العامة الآن…';button.disabled=true;
    try{
      const endpoint=`https://nagerholidays.com/api/v4/Holidays/${code}/${selectedYear}`;
      const response=await fetch(endpoint,{signal:AbortSignal.timeout(14000),credentials:'omit',cache:'no-store'});
      if(!response.ok)throw new Error('http_'+response.status);
      const data=await response.json();
      // V4 emits countryCode/date/name; extra fields are ignored.
      const latest=publicHolidaysFromApi(data,code,selectedYear);
      holidays=holidays.filter(x=>!(x.country===code&&x.date.startsWith(String(selectedYear)))).concat(latest);
      const loadedAt=new Date().toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'});
      state.textContent=`تم تحميل ${latest.length} عطلة عامة من Nager.Date في ${loadedAt}. التواريخ تحتاج مراجعة حسب الدولة.`;
      renderEvents();
    }catch{
      state.textContent='تعذّر الحصول على بيانات من المصدر الآن. لم نعرض تواريخ مخمّنة. جرّب لاحقًا أو أضف مناسبة موثّقة يدويًا.';
    }finally{button.disabled=false;}
  });
  $('event-form').addEventListener('submit',e=>{
    e.preventDefault();if(customEvents.length>=maxRows){$('holiday-state').textContent='وصلت المناسبات اليدوية للحد التجريبي.';return;}
    const fields=Object.fromEntries(new FormData(e.currentTarget));
    try{customEvents.unshift(makeEvent(fields));persist();e.currentTarget.reset();renderEvents();}
    catch(error){$('holiday-state').textContent=reportError(error);}
  });
  $('agency-form').addEventListener('submit',e=>{
    e.preventDefault();if(agencies.length>=maxRows){$('agency-state').textContent='الحد الأقصى 150 شركة تجريبية.';return;}
    const fields=Object.fromEntries(new FormData(e.currentTarget));
    try{agencies.unshift(makeAgency(fields));persist();e.currentTarget.reset();renderAgencies();$('agency-state').textContent='أُضيفت الشركة محليًا إلى نموذج المتابعة.';}
    catch(error){$('agency-state').textContent=reportError(error);}
  });
  $('draft-agency').addEventListener('change',eventOptions);
  $('draft-form').addEventListener('submit',e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(e.currentTarget));
    const agency=agencies.find(a=>a.id===data.agency),event=eventCollection().find(x=>x.id===data.event);
    try{
      const draft=draftMessage({agency,event,hotelLabel:data.hotelLabel,language:data.language});
      $('draft-output').textContent=draft;$('draft-output').hidden=false;$('copy-draft').hidden=false;
    }catch(error){$('draft-output').textContent=reportError(error);$('draft-output').hidden=false;$('copy-draft').hidden=true;}
  });
  $('copy-draft').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('draft-output').textContent);$('copy-draft').textContent='تم النسخ';}
    catch{$('copy-draft').textContent='حدد النص ثم انسخه يدويًا';}
  });
  $('export').addEventListener('click',()=>{
    if(!agencies.length){$('agency-state').textContent='أضف شركة واحدة على الأقل قبل التصدير.';return;}
    downloadFile(agenciesCsv(agencies),'mzcode-tourism-agencies.csv','text/csv;charset=utf-8');
  });
  $('clear').addEventListener('click',()=>{
    if(!window.confirm('مسح كل بيانات الشركات والمناسبات اليدوية على هذا الجهاز؟'))return;
    agencies=[];customEvents=[];holidays=[];
    try{localStorage.removeItem(LOCAL_KEY);}catch{storageOk=false;}
    $('holiday-state').textContent='تم مسح البيانات المحلية. لم يتم حذف بيانات خادم أو عملاء.';
    $('agency-state').textContent='تم مسح البيانات المحفوظة.';
    renderAgencies();renderEvents();$('draft-output').hidden=true;$('copy-draft').hidden=true;
  });
  renderAgencies();renderEvents();
}
init();