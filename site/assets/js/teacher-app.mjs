import {prepareTeacherMessage,teacherFilename} from './teacher-core.mjs';
const form=document.getElementById('teacher-form');
const result=document.getElementById('result'),status=document.getElementById('status');
const copy=document.getElementById('copy'),download=document.getElementById('download');
let text='';
form.addEventListener('submit',event=>{
  event.preventDefault();
  try{
    const fields=Object.fromEntries(new FormData(form));
    text=prepareTeacherMessage(fields);
    result.textContent=text;
    copy.disabled=false;download.disabled=false;
    status.textContent='المسودة جاهزة. راجعها قبل إرسالها.';
  }catch{
    text='';copy.disabled=true;download.disabled=true;
    status.textContent='راجع البيانات المطلوبة وحاول مرة ثانية.';
  }
});
copy.addEventListener('click',async()=>{
  if(!text)return;
  try{await navigator.clipboard.writeText(text);status.textContent='تم نسخ المسودة.';}
  catch{status.textContent='تعذر النسخ الآلي. حدد النص وانسخه يدويًا.';}
});
download.addEventListener('click',()=>{
  if(!text)return;
  const blob=new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=teacherFilename(form.elements.kind.value);document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
});
