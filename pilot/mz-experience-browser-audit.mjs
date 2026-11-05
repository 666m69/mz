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
  const loaded=await evalJS("return {ready:document.getElementById('mz-assistant-root')?.dataset.ready,heading:document.getElementById('studio-title')?.textContent,embedded:!!document.getElementById('mz-assistant'),duplicate:!!document.getElementById('mz-bot-form'),launch:!!document.querySelector('[data-mz-open-assistant]'),request:!!document.getElementById('mz-quick-idea'),logo:document.querySelector('.site-header .brand img')?.getAttribute('src'),demo:!!document.getElementById('slot-book')};");
  assert.equal(loaded.ready,'true',JSON.stringify(loaded));
  assert.match(loaded.heading,/قول وش الوضع/);
  assert.ok(loaded.launch&&loaded.request&&loaded.demo);
  assert.equal(loaded.embedded,false);
  assert.equal(loaded.duplicate,false);
  assert.equal(loaded.logo,'/assets/images/mz-mark.svg');
  const cta=await evalJS("document.querySelector('[data-mz-open-assistant]').click();const root=document.getElementById('mz-assistant-root'),win=document.getElementById('mz-chat-window'),trigger=document.getElementById('mz-bot-trigger');return {opened:!win.hidden,aria:trigger.getAttribute('aria-expanded'),ready:root.dataset.ready};");
  assert.deepEqual(cta,{opened:true,aria:'true',ready:'true'});
  const quote=await evalJS("const input=document.getElementById('mz-chat-input');input.value='أبغى عرض سعر للعميل';document.getElementById('mz-chat-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return {link:[...document.querySelectorAll('#mz-chat-messages a')].at(-1)?.getAttribute('href'),intakeAction:[...document.querySelectorAll('#mz-chat-messages button')].some(x=>x.textContent.includes('المراجعة المجانية'))};");
  assert.equal(quote.link,'/tools/quote/');
  assert.equal(quote.intakeAction,true);
  const teacher=await evalJS("const input=document.getElementById('mz-chat-input');input.value='أنا معلم وأحتاج رسالة لأولياء الأمور';document.getElementById('mz-chat-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));const button=[...document.querySelectorAll('#mz-chat-messages button')].find(x=>x.textContent.includes('جهز مسودة هنا'));button?.click();const form=document.querySelector('.mz-floating-teacher-form');if(!form)return {form:false};form.elements.grade.value='الصف الرابع';form.elements.subject.value='متابعة القراءة';form.elements.details.value='الرجاء قراءة فقرة يوميًا';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return {form:true,content:document.querySelector('.mz-floating-output')?.textContent||'',displayed:!document.querySelector('.mz-floating-output').hidden};");
  assert.equal(teacher.form,true,JSON.stringify(teacher));
  assert.match(teacher.content,/متابعة القراءة/);
  assert.equal(teacher.displayed,true);
  const profession=await evalJS("const input=document.getElementById('mz-chat-input');input.value='أنا منسق تسويق في فندق';document.getElementById('mz-chat-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));const bubble=[...document.querySelectorAll('.mz-floating-bot')].at(-1);const links=[...bubble.querySelectorAll('a')].map(x=>x.getAttribute('href'));const action=[...bubble.querySelectorAll('button')].find(x=>x.textContent.includes('مجانًا'));action?.click();return {links,requestOpen:document.getElementById('mz-request').open,prefill:document.getElementById('mz-intake-idea').value,consent:document.getElementById('mz-intake-consent').checked};");
  assert.deepEqual(profession.links,['/tools/images/','/tools/quote/','/tools/clients/']);
  assert.equal(profession.requestOpen,true);
  assert.match(profession.prefill,/فندق/);
  assert.equal(profession.consent,false);
  const safety=await evalJS("const input=document.getElementById('mz-chat-input');document.getElementById('mz-bot-trigger').click();input.value='<img src=x onerror=alert(1)>';document.getElementById('mz-chat-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return {added:document.querySelectorAll('#mz-chat-messages img').length,text:document.getElementById('mz-chat-messages').textContent.includes('<img src=x onerror=alert(1)>')};");
  assert.equal(safety.added,0);
  assert.equal(safety.text,true);
  const drag=await evalJS("const root=document.getElementById('mz-assistant-root'),trigger=document.getElementById('mz-bot-trigger'),start=trigger.getBoundingClientRect();const x=start.left+10,y=start.top+10;root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const event=(type,cx,cy)=>new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:21,pointerType:'mouse',button:0,clientX:cx,clientY:cy});trigger.dispatchEvent(event('pointerdown',x,y));trigger.dispatchEvent(event('pointermove',x-70,y-160));trigger.dispatchEvent(event('pointerup',x-70,y-160));trigger.click();const after=trigger.getBoundingClientRect();return {moved:Math.abs(start.left-after.left)>20&&Math.abs(start.top-after.top)>20,closed:document.getElementById('mz-chat-window').hidden,saved:!!localStorage.getItem('mzcode:assistant-icon-position:v1'),x:after.left,y:after.top,width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth};");
  assert.equal(drag.moved,true,JSON.stringify(drag));
  assert.equal(drag.closed,true);
  assert.equal(drag.saved,true);
  assert.ok(drag.scroll<=drag.width+2,JSON.stringify(drag));
  await ensureMobile('/');
  await screenshot('mz-experience-mobile.png');
  await navigate('/');
  const persistent=await evalJS("const r=document.getElementById('mz-bot-trigger').getBoundingClientRect();return {x:r.left,y:r.top,saved:!!localStorage.getItem('mzcode:assistant-icon-position:v1')};");
  assert.equal(persistent.saved,true);
  assert.ok(Math.abs(persistent.x-drag.x)<3&&Math.abs(persistent.y-drag.y)<3,JSON.stringify({persistent,drag}));
  await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,mobile:false,deviceScaleFactor:1});
  await navigate('/');
  const desktop=await evalJS("const root=document.getElementById('mz-assistant-root');return {width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,ready:root.dataset.ready,duplicate:!!document.getElementById('mz-assistant'),logo:document.querySelector('.site-header .brand img')?.getAttribute('src')};");
  assert.ok(desktop.width>=1340&&desktop.scroll<=desktop.width+2,JSON.stringify(desktop));
  assert.equal(desktop.ready,'true');
  assert.equal(desktop.duplicate,false);
  assert.deepEqual(exceptions,[],JSON.stringify(exceptions));
  await screenshot('mz-experience-desktop.png');
  console.log('MZ_EXPERIENCE_BROWSER_PASS: single assistant, CTA, teacher, profession review, no XSS, drag and persistence, 390px and desktop');
}finally{
  ws?.close();chrome.kill('SIGKILL');server.close();
}
