import {guideRequest} from './mz-assistant-router.mjs';

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
