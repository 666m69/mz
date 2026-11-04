import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';

const root=new URL('../site/',import.meta.url);
const server=createServer(async(req,res)=>{
  let p;
  try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  if(p.includes('..')||p.includes('\\')||!/^\/[a-zA-Z0-9_.\/\-]+$/.test(p)){res.writeHead(400).end();return;}
  if(p.endsWith('/'))p+='index.html';
  const extension=p.slice(p.lastIndexOf('.')+1);
  try{
    const bytes=await readFile(new URL('.'+p,root));
    const type={html:'text/html',css:'text/css',js:'text/javascript',mjs:'text/javascript',svg:'image/svg+xml',png:'image/png'}[extension]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(bytes);
  }catch{res.writeHead(404).end('Missing');}
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
    if(x.method==='Runtime.exceptionThrown')exceptions.push(x.params.exceptionDetails?.text||'runtime exception');
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
try{
  await connect();
  await navigate('/tools/teacher/');
  const teacher=await evalJS(`
   const f=document.querySelector('#teacher-form');
   f.elements.grade.value='الرابع';
   f.elements.subject.value='القراءة';
   f.elements.details.value='مراجعة النص يوميًا';
   f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
   return {result:document.querySelector('#result').textContent,download:document.querySelector('#download').disabled};`);
  assert.ok(teacher.result.includes('الرابع')&&teacher.result.includes('القراءة'));
  assert.equal(teacher.download,false);
  await ensureMobile('/tools/teacher/');

  await navigate('/tools/hydroponics/');
  const hydro=await evalJS(`
   const f=document.querySelector('#calculate');
   f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
   const out=document.querySelector('#estimate').textContent;
   const o=document.querySelector('#observation');
   o.elements.date.value='2026-11-04';
   o.elements.waterLiters.value='1';
   o.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
   return {out,rows:document.querySelector('#rows').children.length,storage:localStorage.getItem('mzcode:hydro-notes:v1')};`);
  assert.match(hydro.out,/15/);
  assert.ok(hydro.storage?.includes('2026-11-04'));
  assert.equal(hydro.rows,1);
  await ensureMobile('/tools/hydroponics/');
  await navigate('/tools/hydroponics/');
  const count=await evalJS("return document.querySelector('#rows').children.length;");
  assert.equal(count,1,'hydro notes should persist across reload');

  await navigate('/tools/opportunities/');
  const opportunities=await evalJS(`
    document.querySelector('[data-category="games"]').click();
    const count=document.querySelectorAll('.source-card').length;
    const link=document.querySelector('.source-card a').href;
    document.querySelector('.source-card button').click();
    return {count,link,stored:localStorage.getItem('mzcode:source-favorites:v1')};`);
  assert.equal(opportunities.count,1);
  assert.ok(opportunities.link.includes('playstation.com'));
  assert.ok(opportunities.stored?.includes('playstation'));
  await ensureMobile('/tools/opportunities/');
  console.log('DISCOVERY_BROWSER_ACCEPTANCE PASS: teacher form, hydro estimate+persistence, gaming source+favorite, 390px');
}finally{
  ws?.close();chrome.kill('SIGKILL');server.close();
}
