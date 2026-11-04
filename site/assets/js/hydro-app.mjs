import {calculateReservoir,safeObservation,observationsCsv} from './hydro-core.mjs';
const $=id=>document.getElementById(id),key='mzcode:hydro-notes:v1';
let records=[];
try{
  const data=JSON.parse(localStorage.getItem(key)||'[]');
  if(Array.isArray(data))records=data.filter(x=>x&&typeof x.id==='string'&&typeof x.date==='string').slice(0,80);
}catch{$('status').textContent='تعذر قراءة الحفظ المحلي؛ السجل مؤقت.';}
function persist(){try{localStorage.setItem(key,JSON.stringify(records));}catch{$('status').textContent='تعذر الحفظ في هذا المتصفح. صدّر سجلًا للاحتفاظ به.';}}
function render(){
  const rows=$('rows');rows.replaceChildren();
  if(!records.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='لا توجد قراءات بعد.';tr.append(td);rows.append(tr);return;}
  for(const item of records){
    const tr=document.createElement('tr');
    for(const val of [item.date,item.waterLiters,item.ph??'—',item.ec??'—',item.note||'—']){
      const td=document.createElement('td');td.textContent=String(val);tr.append(td);
    }
    const td=document.createElement('td'),del=document.createElement('button');
    del.type='button';del.className='danger';del.textContent='حذف';del.setAttribute('aria-label','حذف قراءة '+item.date);
    del.addEventListener('click',()=>{records=records.filter(x=>x.id!==item.id);persist();render();});td.append(del);tr.append(td);rows.append(tr);
  }
}
const now=new Date();$('observation-date').value=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Riyadh'}).format(now);
$('calculate').addEventListener('submit',event=>{
  event.preventDefault();
  try{
    const result=calculateReservoir(Object.fromEntries(new FormData(event.currentTarget)));
    $('estimate').textContent='الاستهلاك الافتراضي اليومي: '+result.dailyLiters+' لتر\nمدة الخزان التقديرية: '+result.estimatedDays+' يوم\n\n'+result.caution;
  }catch{$('estimate').textContent='تحقق من القيم والأعداد المدخلة.';}
});
$('observation').addEventListener('submit',event=>{
  event.preventDefault();if(records.length>=80){$('status').textContent='وصلت إلى 80 قراءة؛ صدّر واحذف بعض السجلات قبل إضافة المزيد.';return;}
  try{
    records.unshift(safeObservation(Object.fromEntries(new FormData(event.currentTarget))));
    persist();render();$('status').textContent='حُفظت القراءة في هذا المتصفح.';event.currentTarget.elements.note.value='';
  }catch{$('status').textContent='تحقق من التاريخ والقياسات.';}
});
$('export').addEventListener('click',()=>{
  if(!records.length){$('status').textContent='لا توجد قراءات لتصديرها.';return;}
  const url=URL.createObjectURL(new Blob([observationsCsv(records)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='mzcode-hydroponics-log.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
});
$('reset').addEventListener('click',()=>{
  if(!window.confirm('مسح كل قراءات الزراعة المحفوظة على هذا الجهاز؟'))return;
  records=[];try{localStorage.removeItem(key);}catch{};render();$('status').textContent='تم مسح السجل المحلي.';
});
render();
