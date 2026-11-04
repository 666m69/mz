import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as pause} from 'node:timers/promises';

// Visit the unmodified, downloaded application in a new browser profile on loopback.
export async function exerciseChecklist(directory, executable){
  const files={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
  const server=createServer(async(req,res)=>{
    const file=files[req.url];if(!file){res.writeHead(404);res.end();return;}
    try{const data=await readFile(join(directory,file));res.writeHead(200,{'Content-Type':
      {'index.html':'text/html; charset=utf-8','app.js':'text/javascript','styles.css':'text/css'}[file]});res.end(data);}
    catch{res.writeHead(500);res.end();}
  });
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
  const profile=await mkdtemp(join(tmpdir(),'mz-qa-chrome-'));
  const page='http://127.0.0.1:'+server.address().port+'/';
  const flags=['--headless','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking',
    '--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'];
  // Local root containers may lack a Chrome system sandbox. The hosted job runs as a normal user.
  if(process.getuid?.()===0)flags.unshift('--no-sandbox');
  const proc=spawn(executable,flags,{stdio:'ignore',env:{PATH:process.env.PATH,HOME:profile,TMPDIR:tmpdir(),LANG:'C.UTF-8'}});
  let ws,spawnError;proc.on('error',e=>{spawnError=e;});
  const wait=async(fn)=>{const end=Date.now()+10000;while(Date.now()<end){if(spawnError)throw spawnError;
    const value=await fn();if(value)return value;await pause(100);}throw Error('Browser did not reach expected state');};
  try{
    const port=await wait(async()=>{try{return (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return false;}});
    const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise((ok,bad)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',bad,{once:true});});
    let seq=0;const pending=new Map();
    ws.onmessage=({data})=>{const msg=JSON.parse(data);const cb=pending.get(msg.id);if(cb){pending.delete(msg.id);cb(msg);}};
    const cmd=(method,params={})=>new Promise((ok,bad)=>{const id=++seq;
      const timer=setTimeout(()=>{pending.delete(id);bad(Error('Browser command timed out'));},4000);
      pending.set(id,msg=>{clearTimeout(timer);if(msg.error)bad(Error('Browser rejected '+method));else ok(msg.result);});
      ws.send(JSON.stringify({id,method,params}));});
    const value=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true});
      if(r.exceptionDetails)throw Error('Browser assertion script failed');return r.result?.value;};
    await cmd('Page.navigate',{url:page});
    await wait(()=>value("document.readyState==='complete' && document.querySelector('#add-btn')!==null"));
    assert.equal(await value("document.documentElement.dir"),'rtl');
    await value("document.querySelector('#item-input').value='قهوة سحابية'; document.querySelector('#add-btn').click()");
    await wait(()=>value("document.querySelector('.item-text')?.textContent==='قهوة سحابية'"));
    await value("document.querySelector('#items input').click(); window.__qaBeforeReload=true");
    await cmd('Page.reload');
    await wait(()=>value("window.__qaBeforeReload===undefined && document.querySelector('#items input')?.checked===true && document.querySelector('.item-text')?.textContent==='قهوة سحابية'"));
    return ['arabic-rtl','add','complete','persist-after-reload'];
  }finally{
    ws?.close();proc.kill('SIGKILL');
    if(proc.exitCode===null && proc.signalCode===null && !spawnError)await Promise.race([new Promise(r=>proc.once('exit',r)),pause(1500)]);
    await new Promise(r=>{server.close(r);server.closeAllConnections();});await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
