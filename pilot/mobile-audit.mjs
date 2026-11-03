import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const local=process.argv.includes('--local');
const strict=process.argv.includes('--assert');
let httpServer;
if(local){
  httpServer=createServer(async (req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    let root=new URL('../site/',import.meta.url);
    let name=pathname;
    if(pathname.startsWith('/community/')){root=new URL('./community/',import.meta.url);name=pathname.slice('/community'.length);}
    if(name==='/')name='/index.html';
    if(name.endsWith('/'))name+='index.html';
    if(!/^\/[a-zA-Z0-9_\-./]+$/.test(name)||name.includes('..')){res.writeHead(400).end();return;}
    const file=new URL('.'+name,root);
    const ext=name.split('.').pop();
    try{const buf=await readFile(file);res.writeHead(200,{'Content-Type':{html:'text/html',css:'text/css',js:'text/javascript',svg:'image/svg+xml',png:'image/png',webp:'image/webp'}[ext]||'application/octet-stream'}).end(buf);}
    catch{res.writeHead(404).end('Not found');}
  });
  await new Promise(resolve=>httpServer.listen(0,'127.0.0.1',resolve));
}
const chrome = spawn(process.env.CHROME_PATH || 'google-chrome',[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-debugging-port=9223','--remote-allow-origins=*',
  '--user-data-dir=/tmp/mz-mobile-audit-'+process.pid,'about:blank'
],{stdio:'ignore'});
const pending = new Map();
let ws,seq=0;
async function send(method,params={}){
  const id=++seq;
  const promise=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},12000);
    pending.set(id,{resolve(value){clearTimeout(timer);resolve(value);},reject(error){clearTimeout(timer);reject(error);}});
  });
  ws.send(JSON.stringify({id,method,params}));
  return promise;
}
async function init(){
  let data;
  for(let attempt=0;attempt<50;attempt++){
    try{
      const res=await fetch('http://127.0.0.1:9223/json/new?about:blank',{method:'PUT'});
      if(res.ok){data=await res.json();break;}
    }catch{}
    await delay(160);
  }
  if(!data)throw Error('Unable to connect to Chrome DevTools');
  ws=new WebSocket(data.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',ev=>{
    const obj=JSON.parse(ev.data);if(obj.id==null)return;
    const entry=pending.get(obj.id);if(!entry)return;
    pending.delete(obj.id);
    if(obj.error)entry.reject(Error(obj.error.message));else entry.resolve(obj.result);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
}
const expression = `(() => {
  const viewport=document.documentElement.clientWidth;
  const root=document.documentElement;
  const all=[...document.body.querySelectorAll('*')];
  const over=all.map((node)=>{
    const r=node.getBoundingClientRect(), c=getComputedStyle(node);
    return {tag:node.tagName,cls:typeof node.className==='string'?node.className.slice(0,58):'',id:node.id,
      left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),
      minWidth:c.minWidth,position:c.position,display:c.display,overflowX:c.overflowX};
  }).filter(x=>x.width&&x.display!=='none'&&(x.right>viewport+2||x.left< -2)).sort((a,b)=>b.right-a.right);
  return {title:document.title,viewportWidth:innerWidth,htmlScrollWidth:root.scrollWidth,bodyScrollWidth:document.body.scrollWidth,
    scrollLeft:scrollX,appWidth:root.clientWidth,rootMin:getComputedStyle(root).minWidth,bodyMin:getComputedStyle(document.body).minWidth,bodyRect:{width:document.body.getBoundingClientRect().width,left:document.body.getBoundingClientRect().left,right:document.body.getBoundingClientRect().right},over:over.slice(0,22),
    controls:[...document.querySelectorAll('.site-header nav,.studio-hero,.studio-pitch,.live-console,.hero-graphic,.hero,.experience')].map(x=>({el:x.className,r:{left:Math.round(x.getBoundingClientRect().left),right:Math.round(x.getBoundingClientRect().right),width:Math.round(x.getBoundingClientRect().width)},css:getComputedStyle(x).gridTemplateColumns})).slice(0,10)}
})();`;
try{
  await init();
  const base=local?'http://127.0.0.1:'+httpServer.address().port:'https://mzcodehub.com';
  const pages=['/','/community/'];
  for(const url of pages.map(p=>base+p)){
    await send('Page.navigate',{url});await delay(2300);
    const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));
    console.log('MOBILE_LAYOUT '+JSON.stringify({url,...response.result.value}));
    const metrics=response.result.value;
    if(strict && (metrics.htmlScrollWidth>metrics.appWidth+2 || metrics.viewportWidth>metrics.appWidth+2))throw Error('Horizontal overflow remains on '+url+' ('+metrics.htmlScrollWidth+' > '+metrics.appWidth+')');
  }
}finally{
  ws?.close();chrome.kill('SIGKILL');httpServer?.close();
}
