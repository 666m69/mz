"use strict";
const E=window.MZBuilderEngine;
const byId=id=>document.getElementById(id);
const clip=(value,n=38)=>String(value||'').replace(/[\x00-\x1F\x7F]/g,' ').trim().slice(0,n);
const ns="http://www.w3.org/2000/svg";
const el=(name,attrs={},text)=>{const e=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
let current=null,conceptKey=null,conceptSignature='',executionKey=null,executionSignature='';

function screenImage(spec,section,index){
  const svg=el('svg',{viewBox:'0 0 340 540',role:'img','aria-label':'تصور واجهة '+section,'focusable':'false'});
  svg.append(el('rect',{width:340,height:540,rx:26,fill:'#0b1724'}));
  svg.append(el('rect',{x:8,y:8,width:324,height:524,rx:22,fill:'#eaf2f7'}));
  svg.append(el('rect',{x:8,y:8,width:324,height:74,rx:22,fill:index===0?'#103c43':'#122a44'}));
  svg.append(el('text',{x:306,y:35,'text-anchor':'end','font-size':13,fill:'#86e8d0','font-weight':700},'MZ / CONCEPT'));
  svg.append(el('text',{x:306,y:62,'text-anchor':'end','font-size':19,fill:'#fff','font-weight':700},clip(section,25)));
  svg.append(el('rect',{x:27,y:100,width:286,height:74,rx:14,fill:'#fff'}));
  svg.append(el('text',{x:296,y:126,'text-anchor':'end','font-size':13,fill:'#425467'},'مشروع مقترح'));
  svg.append(el('text',{x:296,y:155,'text-anchor':'end','font-size':15,'font-weight':700,fill:'#0c3445'},clip(spec.title,28)));
  const features=spec.features.slice(Math.max(0,index-1),Math.max(0,index-1)+3);
  for(let i=0;i<3;i++){
    const y=194+i*77;
    svg.append(el('rect',{x:27,y,width:286,height:65,rx:11,fill:i===0?'#d4efe9':'#fff'}));
    svg.append(el('circle',{cx:56,cy:y+32,r:15,fill:i===0?'#148d79':'#d6e3ec'}));
    svg.append(el('text',{x:296,y:y+26,'text-anchor':'end','font-size':14,'font-weight':600,fill:'#253b4e'},clip(features[i]||spec.steps[i]||'خطوة الاستخدام',32)));
    svg.append(el('text',{x:296,y:y+46,'text-anchor':'end','font-size':11,fill:'#74899a'},'عنصر توضيحي — لا يعمل'));
  }
  svg.append(el('rect',{x:27,y:447,width:286,height:49,rx:11,fill:'#116c61'}));
  svg.append(el('text',{x:170,y:478,'text-anchor':'middle','font-size':15,fill:'#fff','font-weight':700},clip(['بداية الاستخدام','استعراض الخيارات','عرض النتيجة'][index],26)));
  const frame=document.createElement('figure');frame.className='concept-frame';
  frame.append(svg);
  const title=document.createElement('figcaption');title.textContent=(index+1)+'. '+section;frame.append(title);
  return frame;
}
function showState(id,text){byId(id).textContent=text;}
async function sendIdea(body,key){
  const response=await fetch('/api/ideas',{method:'POST',
    headers:{'Content-Type':'application/json','Idempotency-Key':key},
    body:JSON.stringify(body),credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(23000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.ok!==true||!/^[0-9a-f-]{36}$/i.test(data.id||'')||!/^MZ-[A-F0-9]{12}$/.test(data.reference||''))throw Error(data?.error||'لم يتم تأكيد حفظ الفكرة. يمكنك إعادة المحاولة دون تكرار السجل.');
  return data;
}
byId('design').addEventListener('submit',async event=>{
  event.preventDefault();
  const idea=byId('idea').value.trim(),email=byId('concept-email').value.trim().toLowerCase();
  if(idea.length<20||idea.length>3200){showState('concept-state','اكتب وصفًا بين 20 و3200 حرف.');return}
  if(email&&!byId('concept-email').checkValidity()){showState('concept-state','تحقق من البريد.');return}
  if(!byId('archive-consent').checked){showState('concept-state','الموافقة على حفظ الفكرة مطلوبة قبل إرسالها للأرشيف.');return}
  if(!crypto?.randomUUID){showState('concept-state','يتطلب الإرسال متصفحًا حديثًا.');return}
  const body={idea,name:'',email,website:byId('website').value,consent:'yes',idea_kind:'concept',reuse_permission:byId('reuse-consent').checked};
  const signature=JSON.stringify(body);
  if(signature!==conceptSignature){conceptSignature=signature;conceptKey=crypto.randomUUID();}
  const button=byId('show-concept');button.disabled=true;showState('concept-state','جارٍ حفظ فكرتك في الأرشيف الخاص…');
  try{
    const receipt=await sendIdea(body,conceptKey);
    current={spec:E.buildSpec(idea),reference:receipt.reference,idea};
    byId('concept-description').textContent=current.spec.title+' — '+idea;
    byId('concept-reference').textContent='حُفظت الفكرة برقم: '+receipt.reference+' · احتفظ به للمتابعة.';
    const views=current.spec.screens.slice(0,3);
    byId('concept-visuals').replaceChildren(...views.map((name,i)=>screenImage(current.spec,name,i)));
    byId('concept-steps').replaceChildren(...current.spec.steps.map(step=>{const li=document.createElement('li');li.textContent=step;return li;}));
    byId('workspace').hidden=false;
    byId('brief').value='رقم التصور: '+receipt.reference+'\n'+idea+'\nالوظائف المقترحة:\n'+current.spec.features.join('\n');
    if(email)byId('email').value=email;
    showState('concept-state','تم حفظ الفكرة وعرض تصور بصري غير تفاعلي. لا يوجد تطبيق للتنزيل.');
    byId('workspace').scrollIntoView({block:'start',behavior:'smooth'});
  }catch(err){showState('concept-state',err.name==='TimeoutError'?'انتهت مهلة الاتصال؛ أعد المحاولة بنفس الفكرة، دون تغيير البيانات.':err.message||'تعذر حفظ الفكرة حاليًا.')}
  finally{button.disabled=false}
});
byId('concept-new').addEventListener('click',()=>{
  byId('workspace').hidden=true;
  byId('design').reset();byId('idea').focus();current=null;
  conceptSignature='';conceptKey=null;showState('concept-state','');
  byId('design').scrollIntoView({block:'start'});
});
byId('intake').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=byId('send');
  const idea=byId('brief').value.trim(),email=byId('email').value.trim().toLowerCase(),name=byId('name').value.trim();
  if(!email||!byId('email').checkValidity()||!byId('consent').checked||idea.length<20||idea.length>5000){showState('receipt','أكمل وصف المشروع والبريد والموافقة على حفظ طلب التنفيذ.');return}
  const body={idea,email,name,website:'',consent:'yes',idea_kind:'execution',reuse_permission:false};
  const sig=JSON.stringify(body);
  if(sig!==executionSignature){executionKey=crypto.randomUUID();executionSignature=sig;}
  button.disabled=true;showState('receipt','جارٍ حفظ طلب دراسة التنفيذ…');
  try{
    const data=await sendIdea(body,executionKey);
    const emailInfo=data.receipt_email_status==='accepted'?'قبلت خدمة البريد رسالة التأكيد.':'احتفظ برقم المتابعة؛ قد لا تصل رسالة بريد.';
    showState('receipt','تم حفظ طلب دراسة التنفيذ برقم '+data.reference+'\n'+emailInfo+'\nلا يبدأ بناء أو تسليم أي منتج دون اتفاق.');
    byId('tracking-id').value=data.reference;
  }catch(err){showState('receipt',err.message||'تعذر تأكيد الحفظ. أعد المحاولة بنفس البيانات.')}
  finally{button.disabled=false}
});
byId('track-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const v=byId('tracking-id').value.trim().toUpperCase();
  if(!/^MZ-[A-F0-9]{12}$/.test(v)&&!/^[0-9a-f-]{36}$/i.test(v)){showState('tracking-result','رقم متابعة غير صالح.');return}
  showState('tracking-result','جارٍ التحقق…');
  try{
    const r=await fetch('/api/ideas/'+encodeURIComponent(v),{cache:'no-store',signal:AbortSignal.timeout(12000)});
    const d=await r.json();
    if(!r.ok||d.ok!==true)throw Error('تعذر العثور على الطلب.');
    const labels={new:'جديد',reviewing:'قيد المراجعة',quoted:'عُرض السعر',accepted:'تم القبول',building:'قيد التنفيذ',delivered:'تم التسليم',rejected:'مغلق'};
    showState('tracking-result','حالة الفكرة: '+(labels[d.status]||'قيد المراجعة'));
  }catch(e){showState('tracking-result',e.message||'تعذر التحقق حاليًا.')}
});