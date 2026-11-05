import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';

const {default:builtWorker}=await import('../build/worker.mjs');
// Serve exactly the Cloudflare Pages Worker bundle, not source HTML/CSS. 
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'https://mz702.pages.dev');
    const upstream=await builtWorker.fetch(new Request(url,{method:req.method}),{});
    const headers=Object.fromEntries(upstream.headers);
    const body=Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status,headers).end(body);
  }catch(error){res.writeHead(500).end('Built Worker asset error');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=9500+(process.pid%900);
const chrome=spawn(process.env.CHROME_PATH||'google-chrome',[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-debugging-port='+port,'--remote-allow-origins=*',
  '--user-data-dir=/tmp/mz-discovery-cdp-'+process.pid,'about:blank'
],{stdio:['ignore','ignore','pipe']});
let ws,seq=0,stderr='',exceptions=[];
chrome.stderr?.on('data',c=>{stderr=(stderr+c.toString()).slice(-1600)});
const pending=new Map();
async function send(method,params={}){
  const id=++seq;
  const result=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},15000);
    pending.set(id,{resolve(v){clearTimeout(timer);resolve(v)},reject(e){clearTimeout(timer);reject(e)}});
  });
  ws.send(JSON.stringify({id,method,params}));
  return result;
}
async function connect(){
  let target;
  for(let i=0;i<90;i++){
    try{
      const r=await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'});
      if(r.ok){target=await r.json();break;}
    }catch{}
    await delay(150);
  }
  if(!target)throw Error('Unable to start Chrome '+stderr);
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',e=>{
    const x=JSON.parse(e.data);
    if(x.method==='Runtime.exceptionThrown')exceptions.push(JSON.stringify({text:x.params.exceptionDetails?.text,description:x.params.exceptionDetails?.exception?.description,url:x.params.exceptionDetails?.url,line:x.params.exceptionDetails?.lineNumber,column:x.params.exceptionDetails?.columnNumber}).slice(0,1300));
    if(!x.id)return;
    const p=pending.get(x.id);if(!p)return;
    pending.delete(x.id);x.error?p.reject(Error(x.error.message)):p.resolve(x.result);
  });
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
}
const base='http://127.0.0.1:'+server.address().port;
async function navigate(path){
  exceptions=[];
  await send('Page.navigate',{url:base+path});await delay(1000);
}
async function evalJS(expression){
  const out=await send('Runtime.evaluate',{expression:'(()=>{'+expression+'})()',returnByValue:true,awaitPromise:true});
  if(out.exceptionDetails)throw Error('JS error '+JSON.stringify(out.exceptionDetails));
  return out.result.value;
}
async function ensureMobile(path){
  const layout=await evalJS("return {width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,title:document.title};");
  assert.ok(layout.width>300,JSON.stringify({path,layout}));
  assert.ok(layout.scroll<=layout.width+2,JSON.stringify({path,layout}));
  assert.deepEqual(exceptions,[],JSON.stringify({path,exceptions}));
  console.log('MOBILE_TOOL',path,layout.width,layout.scroll);
}

async function screenshot(name){
  const p=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
  const {mkdirSync,writeFileSync}=await import('node:fs');
  mkdirSync(new URL('../audit-output/',import.meta.url),{recursive:true});
  writeFileSync(new URL('../audit-output/'+name,import.meta.url),Buffer.from(p.data,'base64'));
}
try{
  await connect();
  await navigate('/');
  const loaded=await evalJS(`return {ready:document.getElementById('mz-assistant')?.dataset.ready,
   heading:document.getElementById('studio-title')?.textContent,
   assistant:!!document.getElementById('mz-bot-form'),
   request:!!document.getElementById('mz-quick-idea'),
   brand:document.querySelector('.site-header .brand img')?.getAttribute('src'),
   demo:!!document.getElementById('slot-book'),
   scripts:[...document.scripts].map(s=>s.src).filter(x=>x.includes('mz-assistant-ui'))};`);
  assert.equal(loaded.ready,'true',JSON.stringify(loaded));
  assert.match(loaded.heading,/قول وش الوضع/);
  assert.ok(loaded.request&&loaded.demo&&loaded.assistant);
  assert.equal(loaded.brand,'/assets/images/mz-mark.svg');

  const fromChip=await evalJS(`
   document.querySelector('[data-mz-prompt="أبغى عرض سعر"]').click();
   return {chat:document.getElementById('mz-bot-messages').textContent,
     url:document.querySelector('.mz-bot-actions a')?.getAttribute('href'),
     count:document.getElementById('mz-assistant').dataset.requestsRouted};`);
  assert.equal(fromChip.url,'/tools/quote/');
  assert.equal(fromChip.count,'1');
  assert.match(fromChip.chat,/أداة تعمل/);
  // A real in-chat execution, with no network or redirection.
  const teacher=await evalJS(`
   document.querySelector('[data-mz-prompt="أنا معلم وأحتاج رسالة لأولياء الأمور"]').click();
   const trigger=[...document.querySelectorAll('.mz-inline-trigger')].at(-1);
   trigger?.click();
   const form=[...document.querySelectorAll('.mz-inline-form')].at(-1);
   if(!form)return {form:false};
   form.elements.grade.value='الصف الرابع';
   form.elements.subject.value='متابعة القراءة';
   form.elements.details.value='الرجاء قراءة فقرة قصيرة يوميًا';
   form.elements.date.value='الخميس';
   form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
   const workspace=form.closest('.mz-inline-workspace');
   return {form:true,text:workspace.querySelector('.mz-inline-output').textContent,
     hidden:workspace.querySelector('.mz-inline-output').hidden,
     actionCount:workspace.querySelectorAll('.mz-bot-actions button').length,
     ready:document.getElementById('mz-assistant').dataset.ready};
  `);
  assert.equal(teacher.form,true,JSON.stringify(teacher));
  assert.match(teacher.text,/الصف الرابع/);
  assert.match(teacher.text,/متابعة القراءة/);
  assert.equal(teacher.hidden,false);
  assert.equal(teacher.actionCount,2);
  assert.equal(teacher.ready,'true');
  const fromText=await evalJS(`
   const input=document.getElementById('mz-bot-input');
   input.value='أبي نظام جديد لإدارة مخزون المعدات وعملاء المنشأة';
   document.getElementById('mz-bot-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
   const button=[...document.querySelectorAll('.mz-bot-actions button')].at(-1);
   const didOffer=!!button;
   button?.click();
   return {offered:didOffer,opened:document.getElementById('mz-request').open,
     prefill:document.getElementById('mz-intake-idea').value,
     consent:document.getElementById('mz-intake-consent').checked,
     messages:document.querySelectorAll('.mz-bot-bubble').length};`);
  assert.ok(fromText.offered&&fromText.opened,JSON.stringify(fromText));
  assert.match(fromText.prefill,/إدارة مخزون/);
  assert.equal(fromText.consent,false);
  const noXSS=await evalJS(`
   const box=document.getElementById('mz-bot-input');
   box.value='<img src=x onerror=alert(1)>';
   document.getElementById('mz-bot-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
   return {imgCount:document.querySelectorAll('#mz-bot-messages img').length,
    text:document.getElementById('mz-bot-messages').textContent.includes('<img src=x onerror=alert(1)>')};`);
  assert.equal(noXSS.imgCount,0);assert.equal(noXSS.text,true);
  await ensureMobile('/');
  await screenshot('mz-experience-mobile.png');

  await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,mobile:false,deviceScaleFactor:1});
  await navigate('/');
  const desktop=await evalJS(`return {client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
    bot:document.getElementById('mz-assistant').getBoundingClientRect().width,
    hideProbe:['.studio-hero','.community-invite','.featured-showcase','.site-header','.catalog-section','.projects-hero','.discovery-grid','.live-console','main','.site-footer']
      .map(selector=>{const el=document.querySelector(selector);if(!el)return null;const previous=el.style.display;el.style.display='none';const width=document.documentElement.scrollWidth;el.style.display=previous;return {selector,width};}).filter(Boolean),
    offenders:[...document.querySelectorAll('body *')].map(e=>({el:e,r:e.getBoundingClientRect(),style:getComputedStyle(e)}))
     .filter(x=>x.style.display!=='none'&&x.r.width&&x.r.right>document.documentElement.clientWidth+4)
     .sort((a,b)=>b.r.right-a.r.right).slice(0,12).map(x=>({tag:x.el.tagName,cls:String(x.el.className).slice(0,60),right:Math.round(x.r.right),width:Math.round(x.r.width)})),
    logo:document.querySelector('.site-header .brand img')?.getAttribute('src')};`);
  assert.ok(desktop.client>=1340&&desktop.scroll<=desktop.client+2,JSON.stringify(desktop));
  assert.ok(desktop.bot>=350,JSON.stringify(desktop));
  assert.deepEqual(exceptions,[],JSON.stringify(exceptions));
  await screenshot('mz-experience-desktop.png');
  console.log('MZ_EXPERIENCE_BROWSER_PASS: route, request prefill without consent, XSS, mobile 390px, desktop 1366px, brand');
}finally{
  ws?.close();chrome.kill('SIGKILL');server.close();
}
