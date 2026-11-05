import {guideRequest} from './mz-assistant-router.mjs';
import {executeInlineSkill} from './mz-inline-skills.mjs';

const panel=document.getElementById('mz-assistant');
if(panel){
  const form=document.getElementById('mz-bot-form');
  const field=document.getElementById('mz-bot-input');
  const stream=document.getElementById('mz-bot-messages');
  const requestDetails=document.getElementById('mz-request');
  const requestText=document.getElementById('mz-intake-idea');
  let interactionCount=0;

  function addMessage(role,title,detail=''){
    const item=document.createElement('div');
    item.className='mz-bot-bubble '+role;
    if(title){
      const heading=document.createElement('strong');
      heading.textContent=title;
      item.append(heading);
    }
    if(detail){
      const text=document.createElement('span');
      text.textContent=detail;
      item.append(text);
    }
    stream.append(item);
    while(stream.children.length>8)stream.firstElementChild.remove();
    stream.scrollTop=stream.scrollHeight;
    return item;
  }
  function openRequest(text){
    if(!requestDetails||!requestText)return;
    requestDetails.open=true;
    if(text.length>=20&&text.length<=1200){
      requestText.value=text;
      requestText.dispatchEvent(new Event('input',{bubbles:true}));
    }
    requestDetails.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
    requestText.focus({preventScroll:true});
  }
  function addField(form,labelText,name,max,element='input'){
    const label=document.createElement('label');
    label.textContent=labelText;
    const input=document.createElement(element);
    input.name=name;input.required=true;input.maxLength=max;
    if(element==='textarea')input.rows=3;
    label.append(input);form.append(label);
    return input;
  }
  function addSelect(form,labelText,name,options){
    const label=document.createElement('label');label.textContent=labelText;
    const select=document.createElement('select');select.name=name;
    for(const [value,text] of options){
      const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
    }
    label.append(select);form.append(label);
    return select;
  }
  function offerTeacherExecution(reply){
    const trigger=document.createElement('button');
    trigger.type='button';trigger.className='mz-inline-trigger';
    trigger.textContent='جهّز المسودة هنا ✦';
    const controls=reply.querySelector('.mz-bot-actions');
    if(!controls)return;
    controls.prepend(trigger);
    trigger.addEventListener('click',()=>{
      trigger.disabled=true;trigger.hidden=true;
      const box=document.createElement('section');box.className='mz-inline-workspace';
      box.setAttribute('aria-label','تنفيذ مهارة المعلم محليًا');
      const heading=document.createElement('strong');
      heading.textContent='مساعد المعلم — يعمل داخل هذه المحادثة';
      const privacy=document.createElement('p');
      privacy.textContent='المسودة تُنشأ على جهازك فقط. لا تدخل أسماء الطلاب أو معلوماتهم الشخصية. لا يتم إرسال أي رسالة.';
      const form=document.createElement('form');form.className='mz-inline-form';
      addSelect(form,'النوع','kind',[['notice','رسالة مدرسية'],['plan','خطة أسبوعية']]);
      addSelect(form,'الجهة','audience',[['parents','أولياء الأمور'],['school','إدارة المدرسة أو الزملاء']]);
      const grade=addField(form,'الصف أو المرحلة','grade',80);
      grade.placeholder='الرابع الابتدائي';
      const subject=addField(form,'موضوع المسودة','subject',120);
      subject.placeholder='متابعة القراءة';
      const details=addField(form,'التفاصيل أو الهدف','details',500,'textarea');
      details.placeholder='مثال: مراجعة القراءة اليومية';
      const period=addField(form,'الموعد (اختياري)','date',60);
      period.required=false;
      period.placeholder='الخميس';
      const submit=document.createElement('button');submit.type='submit';
      submit.textContent='أنشئ المسودة';
      const status=document.createElement('p');status.className='mz-inline-status';status.setAttribute('role','status');
      const output=document.createElement('pre');output.className='mz-inline-output';output.hidden=true;
      const actions=document.createElement('div');actions.className='mz-bot-actions';actions.hidden=true;
      const copy=document.createElement('button');copy.type='button';copy.textContent='انسخ المسودة';
      const download=document.createElement('button');download.type='button';download.textContent='تنزيل TXT';
      actions.append(copy,download);
      let generated=null;
      form.append(submit);
      box.append(heading,privacy,form,status,output,actions);reply.append(box);
      form.addEventListener('submit',event=>{
        event.preventDefault();
        try{
          generated=executeInlineSkill('teacher-draft-v1',Object.fromEntries(new FormData(form)));
          output.textContent=generated.text;output.hidden=false;actions.hidden=false;
          status.textContent=generated.warning;
          stream.scrollTop=stream.scrollHeight;
        }catch{
          generated=null;output.textContent='';output.hidden=true;actions.hidden=true;
          status.textContent='تأكد من المدخلات ثم حاول مرة ثانية.';
        }
      });
      copy.addEventListener('click',async()=>{
        if(!generated)return;
        try{await navigator.clipboard.writeText(generated.text);status.textContent='نُسخت المسودة. راجعها قبل الإرسال.';}
        catch{status.textContent='تعذّر النسخ المباشر؛ حدّد النص وانسخه يدويًا.';}
      });
      download.addEventListener('click',()=>{
        if(!generated)return;
        const file=new Blob([String.fromCharCode(0xFEFF),generated.text],{type:'text/plain;charset=utf-8'});
        const url=URL.createObjectURL(file),a=document.createElement('a');
        a.href=url;a.download=generated.filename;document.body.append(a);a.click();a.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),1200);
      });
      grade.focus();
    });
  }
  function handleRequest(text){
    if(typeof text!=='string'||!text.trim())return;
    const raw=text.trim().slice(0,1200);
    field.value='';
    addMessage('user','',raw);
    let result;
    try{result=guideRequest(raw);}
    catch{
      addMessage('assistant','راجع طلبك','اكتب وصفًا واضحًا لا يتجاوز 1200 حرف.');
      return;
    }
    const reply=addMessage('assistant',result.title,result.detail);
    if(result.url&&result.skill_name){
      const controls=document.createElement('div');
      controls.className='mz-bot-actions';
      const link=document.createElement('a');
      link.href=result.url;
      link.textContent='جرّب '+result.skill_name+' ←';
      controls.append(link);
      reply.append(controls);
      if(result.skill_id==='teacher')offerTeacherExecution(reply);
    }
    if(result.request_allowed){
      const controls=document.createElement('div');
      controls.className='mz-bot-actions';
      const button=document.createElement('button');
      button.type='button';
      button.textContent='أرسل طلبك للمراجعة ←';
      button.addEventListener('click',()=>openRequest(raw));
      controls.append(button);
      reply.append(controls);
    }
    interactionCount++;
    panel.dataset.requestsRouted=String(interactionCount);
    stream.scrollTop=stream.scrollHeight;
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    handleRequest(field.value);
  });
  field.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
      event.preventDefault();
      form.requestSubmit();
    }
  });
  for(const chip of panel.querySelectorAll('[data-mz-prompt]')){
    chip.addEventListener('click',()=>handleRequest(chip.dataset.mzPrompt));
  }
  panel.dataset.ready='true';
}
