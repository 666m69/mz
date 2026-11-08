import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import worker from '../../build/mz-ideas.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const idea='أريد منصة متخصصة لتنسيق حجز القلابات والشيولات حسب المدينة والتاريخ مع متابعة حالة الطلب.';

async function browser(t,url){
 const dir=await mkdtemp(join(tmpdir(),'mz-visual-browser-'));
 const chrome=spawn(process.env.CHROME_BIN||'google-chrome',[
  '--headless=new','--no-sandbox','--no-first-run','--disable-dev-shm-usage',
  '--disable-background-networking','--disable-gpu','--remote-debugging-port=0',
  '--remote-debugging-address=127.0.0.1','--remote-allow-origins=*',
  '--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
 t.after(async()=>{chrome.kill('SIGTERM');await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:250})});
 let port=0;
 for(let n=0;n<80;n++){
  if(chrome.exitCode!==null)throw Error('Chrome exited early');
  try{port=Number((await readFile(join(dir,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break}
  catch{}
  await sleep(100);
 }
 assert.ok(port,'Chrome DevTools port missing');
 const pages=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
 const page=pages.find(p=>p.type==='page');
 assert.ok(page?.webSocketDebuggerUrl,'Chrome page target missing');
 const ws=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 t.after(()=>ws.close());
 let seq=0;const tasks=new Map();
 ws.addEventListener('message',event=>{
  const response=JSON.parse(event.data);
  if(!response.id||!tasks.has(response.id))return;
  const {resolve,reject}=tasks.get(response.id);tasks.delete(response.id);
  response.error?reject(new Error(response.error.message)):resolve(response.result);
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq;tasks.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async expression=>{
  const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error('Browser JS exception: '+r.exceptionDetails.text);
  return r.result.value;
 };
 await send('Page.enable');
 await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:780,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url});
 let ready=false;
 for(let n=0;n<100;n++){
  if(await evaluate('document.readyState==="complete" && !!document.getElementById("design") && !!window.MZBuilderEngine')){ready=true;break}
  await sleep(100);
 }
 assert.ok(ready,'browser page did not initialize');
 return {evaluate};
}

test('real Chromium mobile: consented idea saves, shows three SVG images, denies code downloads',{timeout:45000},async t=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec(await readFile(new URL('../schema.sql',import.meta.url),'utf8'));
 t.after(()=>sql.close());
 const DB={prepare(query){return {bind(...args){const stmt=sql.prepare(query);return {
  run:()=>({success:true,meta:stmt.run(...args)}),
  first:()=>stmt.get(...args),
  all:()=>({results:stmt.all(...args)})
 }}}}};
 const env={DB,HASH_SALT:'synthetic-browser-only'};
 const server=createServer(async(req,res)=>{
  try{
   const base='http://127.0.0.1:'+server.address().port;
   const headers=new Headers(req.headers);
   headers.set('CF-Connecting-IP','192.0.2.89');
   const hasBody=!['GET','HEAD'].includes(req.method);
   const request=new Request(base+req.url,{method:req.method,headers,
    ...(hasBody?{body:req,duplex:'half'}:{})});
   const response=await worker.fetch(request,env);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
 const {evaluate}=await browser(t,'http://127.0.0.1:'+server.address().port+'/idea');
 assert.equal(await evaluate('document.querySelector("#workspace").hidden'),true);
 assert.equal(await evaluate('document.querySelector("#reuse-consent").checked'),false);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM idea_requests').get().n,0);
 const fill="document.getElementById('idea').value="+JSON.stringify(idea)+
   ";document.getElementById('archive-consent').click();"+
   "document.getElementById('design').requestSubmit();true;";
 await evaluate(fill);
 let visible=false;
 for(let n=0;n<100;n++){
  const state=await evaluate('({visible:!document.getElementById("workspace").hidden,images:document.querySelectorAll("#concept-visuals svg").length,status:document.querySelector("#concept-state").textContent})');
  if(state.visible&&state.images===3){visible=true;break}
  if(state.status?.includes('تعذر'))throw Error(state.status);
  await sleep(150);
 }
 assert.ok(visible,'illustrations not rendered after verified archive save');
 const info=await evaluate('({title:document.querySelector("#concept-description").textContent,images:[...document.querySelectorAll("#concept-visuals svg")].map(x=>Math.round(x.getBoundingClientRect().width)),steps:document.querySelectorAll("#concept-steps li").length,download:!!document.querySelector("#workspace a[download],#workspace a[href$=\\".zip\\"]")})');
 assert.ok(info.title.includes('القلابات'));
 assert.equal(info.images.length,3);
 assert.ok(info.images.every(x=>x>150&&x<=360),'mockup screen must fit phone viewport');
 assert.equal(info.steps,3);
 assert.equal(info.download,false);
 const record=sql.prepare('SELECT idea,idea_kind,reuse_permission FROM idea_requests').get();
 assert.equal(record.idea,idea);
 assert.equal(record.idea_kind,'concept');
 assert.equal(record.reuse_permission,0);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM idea_requests').get().n,1);
});
