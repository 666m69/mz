import { interpret, teacherDraft, propertyDraft, AssistantInputError } from './core.mjs';
const $ = (s, parent = document) => parent.querySelector(s);
const messages = $('#messages');
const workspace = $('#workspace');
const input = $('#question');
const checklistKey = 'mzcode:saudi-assistant:checklist:v1';
const newId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');

function message(role, value) {
  const node = document.createElement('div');
  node.className = 'bubble ' + role;
  node.textContent = value;
  messages.append(node);
  node.scrollIntoView({ block:'nearest', behavior:'smooth' });
}
function createTool(title, hint) {
  workspace.replaceChildren();
  const tool = document.createElement('section');
  tool.className = 'tool';
  const head = document.createElement('div');
  head.className = 'tool-head';
  const heading = document.createElement('h4'); heading.textContent = title;
  head.append(heading);tool.append(head);
  const p = document.createElement('p');p.className='hint';p.textContent=hint;tool.append(p);
  workspace.append(tool);
  return tool;
}
function field(label, name, type='text', options=null) {
  const wrap = document.createElement('div');wrap.className='field';
  const id = 'mz-'+name;
  const lab = document.createElement('label');lab.htmlFor=id;lab.textContent=label;
  const element = options ? document.createElement('select') : document.createElement('input');
  element.id=id;element.name=name;element.required = name !== 'license';
  if (!options) {element.type=type;element.maxLength=280;}
  else for (const option of options) {const o=document.createElement('option');o.value=option;o.textContent=option;element.append(o);}
  wrap.append(lab,element);
  return {wrap,element};
}
function resultBlock(tool, value, warning=null) {
  $('.result',tool)?.remove();$('.tool-actions',tool)?.remove();$('.warning',tool)?.remove();
  const result=document.createElement('div');result.className='result';result.textContent=value;tool.append(result);
  if (warning) {const notice=document.createElement('div');notice.className='warning';notice.textContent=warning;tool.append(notice);}
  const buttons=document.createElement('div');buttons.className='tool-actions';
  const copy=document.createElement('button');copy.type='button';copy.className='secondary';copy.textContent='نسخ النص';
  copy.addEventListener('click',async()=>{
    try {await navigator.clipboard.writeText(value);copy.textContent='تم النسخ';}
    catch {copy.textContent='تعذر النسخ؛ حدّد النص وانسخه يدويًا';}
  });
  const download=document.createElement('button');download.type='button';download.className='secondary';download.textContent='تنزيل نص TXT';
  download.addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([value],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='mzcode-draft.txt';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  buttons.append(copy,download);tool.append(buttons);
}
function makeTeacher() {
  const tool=createTool('صياغة رسالة مدرسية','المساعد يجهز مسودة قابلة للمراجعة. لا يرسلها إلى واتساب. تجنب إدخال أسماء الطلاب أو بياناتهم.');
  const form=document.createElement('form');form.noValidate=false;
  const grade=field('الصف / المرحلة','level');
  const topic=field('موضوع الرسالة','topic');
  topic.element.placeholder='مثال: تسليم الواجب يوم الخميس';
  form.append(grade.wrap,topic.wrap);
  const audience=field('المرسل إليهم','audience','text',['أولياء الأمور','الزملاء والزميلات']);
  form.append(audience.wrap);
  const submit=document.createElement('button');submit.type='submit';submit.className='primary';submit.textContent='إنشاء الرسالة';form.append(submit);
  form.addEventListener('submit',e=>{e.preventDefault();try{resultBlock(tool,teacherDraft({level:grade.element.value,topic:topic.element.value,audience:audience.element.value==='الزملاء والزميلات'?'school':'parents'}));}catch{message('assistant','أكمل الصف وموضوع الرسالة بمعلومات صحيحة.');}});
  tool.append(form);
}
function makeProperty() {
  const tool=createTool('مسودة إعلان عقاري','املأ البيانات بنفسك. لا يوجد اتصال بجهات التراخيص أو تحقق من صحة البيانات، ولا نشر تلقائي.');
  const form=document.createElement('form');
  const grid=document.createElement('div');grid.className='field-grid';
  const defs=[['نوع العقار','type'],['المدينة','city'],['الحي','district'],['المساحة بالمتر','area'],['السعر بالريال','price'],['رقم ترخيص الإعلان (إن توفر)','license']];
  const fields={};
  for(const [label,name] of defs){const f=field(label,name);f.element.maxLength=name==='license'?80:80;fields[name]=f.element;grid.append(f.wrap);}
  form.append(grid);
  const submit=document.createElement('button');submit.type='submit';submit.className='primary';submit.textContent='إنشاء مسودة الإعلان';form.append(submit);
  form.addEventListener('submit',e=>{e.preventDefault();try{const data=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value]));const out=propertyDraft(data);resultBlock(tool,out.text,out.warning+(out.missing.length?' البيانات الناقصة: '+out.missing.join('، '):''));}catch{message('assistant','تحقق من البيانات المطلوبة. لا يمكن إنشاء مسودة من حقول فارغة أو غير صالحة.');}});
  tool.append(form);
}
function readItems() {
  try {const raw=JSON.parse(localStorage.getItem(checklistKey)||'[]');
    return Array.isArray(raw)?raw.filter(x=>x&&typeof x.id==='string'&&typeof x.text==='string'&&typeof x.done==='boolean').slice(0,150):[];
  }catch{return [];}
}
function makeChecklist() {
  const tool=createTool('قائمتي على هذا الجهاز','تطبيق فعلي لإضافة العناصر وإكمالها وحذفها. يتم الحفظ على جهازك فقط ويمكنك مسحه في أي وقت.');
  let items=readItems();let canStore=true;
  const bar=document.createElement('form');bar.className='list-entry';
  const entry=document.createElement('input');entry.type='text';entry.maxLength=120;entry.required=true;entry.placeholder='اكتب مهمة أو مشتريات...';entry.setAttribute('aria-label','عنصر جديد');
  const add=document.createElement('button');add.type='submit';add.className='primary';add.textContent='إضافة';bar.append(entry,add);tool.append(bar);
  const summary=document.createElement('p');summary.className='hint';tool.append(summary);
  const list=document.createElement('ul');list.className='checklist';tool.append(list);
  const save=()=>{if(!canStore)return;try{localStorage.setItem(checklistKey,JSON.stringify(items));}catch{canStore=false;message('assistant','التخزين المحلي غير متاح؛ العناصر ستبقى مؤقتًا حتى تغادر الصفحة.');}};
  const render=()=>{
    list.replaceChildren();
    for(const item of items){
      const li=document.createElement('li');if(item.done)li.classList.add('done');
      const cb=document.createElement('input');cb.type='checkbox';cb.checked=item.done;cb.setAttribute('aria-label','إكمال '+item.text);
      cb.addEventListener('change',()=>{item.done=cb.checked;save();render();});
      const text=document.createElement('span');text.textContent=item.text;
      const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='حذف';del.setAttribute('aria-label','حذف '+item.text);
      del.addEventListener('click',()=>{items=items.filter(x=>x.id!==item.id);save();render();});
      li.append(cb,text,del);list.append(li);
    }
    summary.textContent=items.length+' عنصر · '+items.filter(x=>!x.done).length+' متبقي';
  };
  bar.addEventListener('submit',e=>{
    e.preventDefault();const text=entry.value.trim();if(!text||text.length>120)return;
    if(items.length>=150){message('assistant','القائمة وصلت للحد الأقصى لهذه النسخة (150 عنصر).');return;}
    items.unshift({id:newId(),text,done:false});entry.value='';save();render();entry.focus();
  });
  render();
}
function submit(text) {
  const value=text.trim();if(!value)return;
  message('user',value);input.value='';
  try {
    const out=interpret(value);message('assistant',out.reply);
    if(out.action==='teacher_draft')makeTeacher();
    else if(out.action==='property_draft')makeProperty();
    else if(out.action==='checklist')makeChecklist();
    else workspace.replaceChildren();
  } catch(error) {
    message('assistant',error instanceof AssistantInputError?'اكتب طلبًا مختصرًا وواضحًا لا يتجاوز 1200 حرف.':'حدث خطأ غير متوقع. حاول مرة أخرى.');
  }
}
$('#chat-form').addEventListener('submit',e=>{e.preventDefault();submit(input.value);});
for(const suggestion of document.querySelectorAll('[data-prompt]')){
  suggestion.addEventListener('click',()=>submit(suggestion.dataset.prompt));
}
$('#reset-chat').addEventListener('click',()=>{messages.replaceChildren();workspace.replaceChildren();input.value='';input.focus();});
$('#delete-local').addEventListener('click',()=>{
  try {localStorage.removeItem(checklistKey);message('assistant','تم مسح قائمة المهام المحفوظة على هذا الجهاز.');}
  catch {message('assistant','تعذر مسح البيانات من إعدادات المتصفح.');}
  if($('.checklist',workspace))makeChecklist();
});
message('assistant','حياك الله في MZcode. اكتب طلبك بأي صيغة، وأنا أوضح لك وش أقدر أنجزه فعليًا في هذه النسخة.');
