/**
 * MZcode Living Portal — browser-only floating assistant.
 * Uses the SAME reviewed router/teacher skill as the existing homepage assistant.
 * No mock replies, network calls, automated external messages or client data storage.
 */
import {guideRequest} from './mz-assistant-router.mjs';
import {executeInlineSkill} from './mz-inline-skills.mjs';

const root=document.getElementById('mz-assistant-root');
if(root && root.dataset.initialized!=='true'){
  root.dataset.initialized='true';
  const windowEl=root.querySelector('#mz-chat-window');
  const trigger=root.querySelector('#mz-bot-trigger');
  const closeButton=root.querySelector('#mz-chat-close');
  const field=root.querySelector('#mz-chat-input');
  const form=root.querySelector('#mz-chat-form');
  const aiConsent=root.querySelector('#mz-chat-ai-consent');
  const aiStatus=root.querySelector('#mz-chat-ai-status');
  const messages=root.querySelector('#mz-chat-messages');
  const canvas=root.querySelector('#mz-portal-canvas');
  const context=canvas?.getContext('2d');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const transferKey='mzcode:floating-assistant-intake:v1';
  let state='idle',raf=0,elapsed=0,spread=32,lastReply=0;
  let requestsRouted=0;
  let aiHistory=[];
  let aiBusy=false;

  function node(tag,text,cls){
    const element=document.createElement(tag);
    if(text!==undefined)element.textContent=text;
    if(cls)element.className=cls;
    return element;
  }
  function setOpen(open,returnFocus=false){
    windowEl.hidden=!open;
    trigger.setAttribute('aria-expanded',String(open));
    trigger.setAttribute('aria-label',open?'أغلق مساعد MZcode':'افتح مساعد MZcode');
    root.dataset.open=String(open);
    if(open)field.focus({preventScroll:true});
    else if(returnFocus)trigger.focus({preventScroll:true});
  }
  trigger.addEventListener('click',()=>setOpen(windowEl.hidden));
  closeButton.addEventListener('click',()=>setOpen(false,true));
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!windowEl.hidden){
      event.preventDefault();setOpen(false,true);
    }
  });

  function message(kind,headline,body=''){
    const bubble=node('div',undefined,'mz-floating-msg mz-floating-'+kind);
    if(headline)bubble.append(node('strong',headline));
    if(body)bubble.append(node('span',body));
    messages.append(bubble);
    while(messages.childElementCount>16)messages.firstElementChild.remove();
    messages.scrollTop=messages.scrollHeight;
    return bubble;
  }
  function actions(bubble){
    const row=node('div',undefined,'mz-floating-actions');bubble.append(row);return row;
  }
  function addLink(where,href,text){
    const a=node('a',text);a.href=href;where.append(a);return a;
  }
  function addButton(where,text,onClick){
    const button=node('button',text);
    button.type='button';
    button.addEventListener('click',onClick);
    where.append(button);return button;
  }
  function intakeOnHome(value){
    const details=document.getElementById('mz-request');
    const text=document.getElementById('mz-intake-idea');
    if(!details||!text)return false;
    details.open=true;
    if(value.length>=20 && value.length<=1200){
      text.value=value;
      text.dispatchEvent(new Event('input',{bubbles:true}));
    }
    setOpen(false);
    details.scrollIntoView({
      behavior:reducedMotion.matches?'auto':'smooth',
      block:'start'
    });
    text.focus({preventScroll:true});
    return true;
  }
  function sendToReview(value){
    if(intakeOnHome(value))return;
    // Session-scoped local handoff avoids placing visitor ideas in URLs or server logs.
    try{sessionStorage.setItem(transferKey,value);}catch{}
    window.location.assign('/#mz-request');
  }
  if(location.pathname==='/' && document.getElementById('mz-request')){
    let transfer='';
    try{
      transfer=sessionStorage.getItem(transferKey)||'';
      if(transfer)sessionStorage.removeItem(transferKey);
    }catch{}
    if(transfer.length>=20&&transfer.length<=1200){
      window.setTimeout(()=>intakeOnHome(transfer),140);
    }
  }
  function teacherForm(bubble){
    const container=node('section',undefined,'mz-floating-teacher');
    container.setAttribute('aria-label','تنفيذ مهارة المعلم داخل المحادثة');
    container.append(node('p','مسودة مدرسية تُنشأ على جهازك. لا تدخل أسماء الطلاب أو بياناتهم الشخصية.'));
    const tform=node('form',undefined,'mz-floating-teacher-form');

    function select(labelText,name,values){
      const label=node('label',labelText);
      const selectNode=node('select');selectNode.name=name;selectNode.required=true;
      for(const [key,text] of values){
        const opt=node('option',text);opt.value=key;selectNode.append(opt);
      }
      label.append(selectNode);tform.append(label);
    }
    function input(labelText,name,max,kind='input',required=true){
      const label=node('label',labelText);
      const control=node(kind);control.name=name;control.maxLength=max;control.required=required;
      if(kind==='textarea')control.rows=3;
      label.append(control);tform.append(label);
      return control;
    }
    select('نوع المسودة','kind',[['notice','رسالة مدرسية'],['plan','خطة أسبوعية']]);
    select('إلى من؟','audience',[['parents','أولياء الأمور'],['school','إدارة المدرسة / الزملاء']]);
    const grade=input('الصف / المرحلة','grade',80);
    grade.placeholder='الخامس الابتدائي';
    input('الموضوع','subject',120).placeholder='متابعة القراءة';
    input('التفاصيل أو الهدف','details',500,'textarea').placeholder='مراجعة القراءة عشر دقائق يوميًا';
    input('الموعد (اختياري)','date',60,'input',false).placeholder='الأسبوع القادم';

    const submit=node('button','أنشئ المسودة');
    submit.type='submit';tform.append(submit);
    const status=node('p','', 'mz-floating-status');
    status.setAttribute('role','status');
    const output=node('pre',undefined,'mz-floating-output');output.hidden=true;
    const outputActions=node('div',undefined,'mz-floating-actions');outputActions.hidden=true;
    let result=null;

    addButton(outputActions,'نسخ المسودة',async()=>{
      if(!result)return;
      try{
        await navigator.clipboard.writeText(result.text);
        status.textContent='نُسخت المسودة. راجعها قبل الإرسال.';
      }catch{status.textContent='حدد النص وانسخه يدويًا.';}
    });
    addButton(outputActions,'تنزيل TXT',()=>{
      if(!result)return;
      const blob=new Blob([String.fromCharCode(0xFEFF),result.text],{type:'text/plain;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=node('a');a.href=url;a.download=result.filename;
      document.body.append(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1500);
    });

    tform.addEventListener('submit',event=>{
      event.preventDefault();
      try{
        result=executeInlineSkill('teacher-draft-v1',Object.fromEntries(new FormData(tform)));
        output.textContent=result.text;
        output.hidden=false;outputActions.hidden=false;
        status.textContent=result.warning;
        pulse();
      }catch{
        result=null;output.textContent='';output.hidden=true;outputActions.hidden=true;
        status.textContent='تأكد من تعبئة الحقول المطلوبة، بدون بيانات شخصية.';
      }
      messages.scrollTop=messages.scrollHeight;
    });
    container.append(tform,status,output,outputActions);bubble.append(container);
    grade.focus({preventScroll:true});
  }
  function pulse(){
    state='replying';lastReply=performance.now();
  }

  function routeLinks(bubble,raw){
    // All actions below originate from the reviewed local router, never from generated text.
    const result=guideRequest(raw);
    const row=actions(bubble);
    if(result.url&&result.skill_name){
      addLink(row,result.url,'افتح '+result.skill_name);
      if(result.skill_id==='teacher'){
        const button=addButton(row,'جهز مسودة هنا',()=>{
          button.disabled=true;button.hidden=true;
          teacherForm(bubble);
        });
      }
    }
    if(result.request_allowed)addButton(row,'أرسل فكرتك للمراجعة',()=>sendToReview(raw));
    if(!row.childElementCount)row.remove();
  }
  async function sendAI(raw){
    if(aiBusy)return;
    const prompt=raw.trim().slice(0,1200);
    if(!prompt)return;
    aiBusy=true;
    field.disabled=true;
    const submit=form.querySelector('button[type="submit"]');
    if(submit)submit.disabled=true;
    field.value='';
    message('user','',prompt);
    const bubble=message('bot','جاري التواصل مع نموذج الذكاء الاصطناعي','لا توجد عمليات تنفيذ أو نشر تجري الآن.');
    aiStatus.textContent='جاري معالجة الرسالة...';
    state='thinking';
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),22000);
    try{
      const response=await fetch('/api/assistant',{
        method:'POST',headers:{'Content-Type':'application/json'},
        credentials:'same-origin',cache:'no-store',
        body:JSON.stringify({message:prompt,history:aiHistory.slice(-4),consent:true}),
        signal:controller.signal
      });
      let payload;
      try{payload=await response.json()}catch{payload=null}
      if(!response.ok||payload?.ok!==true||typeof payload.reply!=='string'||!payload.reply.trim())
        throw Object.assign(new Error('unavailable'),{status:response.status,code:payload?.error});
      bubble.replaceChildren(
        node('strong','ردّ النموذج الذكي'),
        node('span',payload.reply.trim()),
        node('small','الرد مولّد بالذكاء الاصطناعي؛ راجعه قبل الاعتماد. لم تُنفّذ أي مهارة تلقائيًا.')
      );
      routeLinks(bubble,prompt);
      aiHistory.push({role:'user',content:prompt.slice(0,450)},{role:'assistant',content:payload.reply.slice(0,450)});
      aiHistory=aiHistory.slice(-4);
      root.dataset.aiLive='true';
      aiStatus.textContent='متصل بنموذج '+(payload.model?.split('/').at(-1)||'Cloudflare AI');
      requestsRouted++;
      root.dataset.requestsRouted=String(requestsRouted);
      pulse();
    }catch(error){
      const messageText=error.name==='AbortError'?'انتهت مهلة الرد. جرّب مرة أخرى أو استخدم الأدوات المتاحة.':
        error.status===429?'وصلت إلى الحد المجاني المؤقت للمساعد. الأدوات ما زالت متاحة.':
        error.code==='sensitive_input'?'لا ترسل أرقام الجوال أو البريد أو بيانات الأشخاص إلى النموذج. احذفها ثم أعد المحاولة.':
        error.status===422?'راجع نص الطلب وموافقتك على الإرسال.':
        'النموذج غير متاح الآن. تقدر تستخدم أدوات MZcode دون انتظار.';
      bubble.replaceChildren(node('strong','تعذر الحصول على رد AI'),node('span',messageText));
      try{routeLinks(bubble,prompt)}catch{}
      aiStatus.textContent='لم تُنفذ عملية AI بنجاح';
      state='idle';
    }finally{
      window.clearTimeout(timeout);
      aiBusy=false;
      field.disabled=false;
      if(submit)submit.disabled=false;
      messages.scrollTop=messages.scrollHeight;
    }
  }
  aiConsent?.addEventListener('change',()=>{
    if(!aiConsent.checked){
      aiHistory=[];
      aiStatus.textContent='وضع الأدوات المحلي · لا إرسال إلى AI';
      root.dataset.aiLive='false';
    }else{
      aiStatus.textContent='AI مفعّل بموافقتك · الحد اليومي محدود';
    }
  });
  function send(raw){
    if(typeof raw!=='string'||!raw.trim())return;
    const text=raw.trim().slice(0,1200);
    field.value='';
    message('user','',text);
    let result;
    try{result=guideRequest(text);}
    catch{
      message('bot','راجع طلبك','اكتب وصفًا واضحًا بحد أقصى 1200 حرف.');
      return;
    }
    const bubble=message('bot',result.title,result.detail);
    const row=actions(bubble);
    if(result.url && result.skill_name){
      addLink(row,result.url,'افتح '+result.skill_name);
      if(result.skill_id==='teacher'){
        const button=addButton(row,'جهز مسودة هنا',()=>{
          button.disabled=true;button.hidden=true;
          teacherForm(bubble);
        });
      }
    }
    if(result.request_allowed){
      addButton(row,'أرسل فكرتك للمراجعة',()=>sendToReview(text));
    }
    if(!row.childElementCount)row.remove();
    requestsRouted++;
    root.dataset.requestsRouted=String(requestsRouted);
    messages.scrollTop=messages.scrollHeight;
    pulse();
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(aiConsent?.checked){void sendAI(field.value);return;}
    send(field.value);
  });
  field.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
      event.preventDefault();
      form.requestSubmit();
    }
  });
  for(const chip of root.querySelectorAll('[data-mz-quick]')){
    chip.addEventListener('click',()=>{if(aiConsent?.checked){void sendAI(chip.dataset.mzQuick)}else send(chip.dataset.mzQuick)});
  }

  // Supplied visual concept: luminous code portal. The actual MZ logo is the
  // unchanged approved SVG layered above the canvas, never redrawn as text.
  function bracket(x,y,mirror,color){
    context.save();
    context.translate(x,y);
    context.scale(mirror? -1.1:1.1,1.1);
    context.strokeStyle=color;context.lineWidth=5;
    context.lineCap='round';context.lineJoin='round';
    context.shadowColor=color;context.shadowBlur=state==='replying'?23:14;
    context.beginPath();
    context.moveTo(10,-18);context.lineTo(-8,0);context.lineTo(10,18);context.stroke();
    context.restore();
  }
  function draw(){
    if(!context)return;
    if(state==='replying'&&performance.now()-lastReply>650)state='idle';
    if(!reducedMotion.matches)elapsed+=0.033;
    spread+=(state==='replying'?45-spread:32-spread)*0.1;
    context.clearRect(0,0,160,160);
    const y=80+(reducedMotion.matches?0:Math.sin(elapsed*2)*3);
    context.save();context.translate(80,y);
    const grad=context.createRadialGradient(0,0,2,0,0,33);
    grad.addColorStop(0,'rgba(255,255,255,.88)');
    grad.addColorStop(.35,'rgba(249,168,37,.57)');
    grad.addColorStop(.70,'rgba(138,43,226,.35)');
    grad.addColorStop(1,'rgba(11,15,26,0)');
    context.beginPath();context.fillStyle=grad;
    context.arc(0,0,24+(reducedMotion.matches?0:2*Math.sin(elapsed*3)),0,Math.PI*2);context.fill();
    bracket(-spread,0,false,'#F9A825');
    bracket(spread,0,true,'#8A2BE2');
    context.restore();
  }
  function frame(){
    raf=0;
    if(document.hidden || reducedMotion.matches)return;
    draw();
    raf=requestAnimationFrame(frame);
  }
  function resume(){
    if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;return;}
    draw();
    if(!reducedMotion.matches && !raf)raf=requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',resume);
  if(reducedMotion.addEventListener)reducedMotion.addEventListener('change',resume);
  resume();
  root.dataset.aiLive='false';
  root.dataset.ready='true';
}
