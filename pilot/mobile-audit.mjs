import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

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
  const viewport=innerWidth;
  const root=document.documentElement;
  const all=[...document.body.querySelectorAll('*')];
  const over=all.map((node)=>{
    const r=node.getBoundingClientRect(), c=getComputedStyle(node);
    return {tag:node.tagName,cls:typeof node.className==='string'?node.className.slice(0,58):'',id:node.id,
      left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),
      minWidth:c.minWidth,position:c.position,display:c.display,overflowX:c.overflowX};
  }).filter(x=>x.width&&x.display!=='none'&&(x.right>viewport+2||x.left< -2)).sort((a,b)=>b.right-a.right);
  return {title:document.title,viewportWidth:viewport,htmlScrollWidth:root.scrollWidth,bodyScrollWidth:document.body.scrollWidth,
    scrollLeft:scrollX,appWidth:root.clientWidth,over:over.slice(0,22),
    controls:[...document.querySelectorAll('.site-header nav,.studio-hero,.studio-pitch,.live-console,.hero-graphic,.hero,.experience')].map(x=>({el:x.className,r:{left:Math.round(x.getBoundingClientRect().left),right:Math.round(x.getBoundingClientRect().right),width:Math.round(x.getBoundingClientRect().width)},css:getComputedStyle(x).gridTemplateColumns})).slice(0,10)}
})();`;
try{
  await init();
  for(const url of (process.argv.slice(2).length?process.argv.slice(2):['https://mzcodehub.com/','https://mzcodehub.com/community/'])){
    await send('Page.navigate',{url});await delay(2300);
    const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));
    console.log('MOBILE_LAYOUT '+JSON.stringify({url,...response.result.value}));
  }
}finally{
  ws?.close();chrome.kill('SIGKILL');
}
