import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import worker from '../../build/mz-ideas.mjs';
import {localEnvironment,serve} from '../../skills-server/dev/local.mjs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
const agent=fileURLToPath(new URL('../../skills-server/runner/agent.py',import.meta.url));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const idea='أريد قائمة مشتريات أسبوعية أحفظها على جهازي';

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
 return {evaluate,navigate:url=>send('Page.navigate',{url})};
}

test('real Chromium mobile: consented idea saves, shows three SVG images, denies code downloads',{timeout:90000},async t=>{
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
 const {evaluate,navigate}=await browser(t,'http://127.0.0.1:'+server.address().port+'/idea');
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
 assert.ok(info.title.length>15);
 assert.equal(info.images.length,3);
 assert.ok(info.images.every(x=>x>150&&x<=360),'mockup screen must fit phone viewport');
 assert.equal(info.steps,3);
 assert.equal(info.download,false);
 const record=sql.prepare('SELECT idea,idea_kind,reuse_permission FROM idea_requests').get();
 assert.equal(record.idea,idea);
 assert.equal(record.idea_kind,'concept');
 assert.equal(record.reuse_permission,0);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM idea_requests').get().n,1);

 const privateSkills=await localEnvironment();
 t.after(()=>privateSkills.sqlite.close());
 const skillsHost=await serve(privateSkills.env);
 t.after(()=>new Promise(r=>{skillsHost.server.closeAllConnections();skillsHost.server.close(r)}));
 const endpoint=async(token,path,body)=>{
  const r=await fetch(skillsHost.url+'/api/'+path,{
   method:body===undefined?'GET':'POST',
   headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':randomUUID()})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  return r;
 };
 const runOne=async()=>{
  const child=spawn('python3',['-B',agent,'--serve','--poll-seconds','1','--max-jobs','1','--max-seconds','25'],{
   env:{PATH:process.env.PATH,SKILLS_URL:skillsHost.url,SKILLS_RUNNER_TOKEN:privateSkills.runner},
   stdio:['ignore','ignore','pipe']
  });
  let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',x=>stderr=(stderr+x).slice(-256));
  const exit=await Promise.race([
   new Promise(r=>child.once('exit',(code,signal)=>r({code,signal}))),
   sleep(28000).then(()=>{child.kill('SIGTERM');return {timeout:true}})
  ]);
  assert.deepEqual(exit,{code:0,signal:null},'bounded runner failed '+stderr);
 };
 const reg=await endpoint(privateSkills.owner,'releases',{id:'local-checklist',version:'1.0.0',name_ar:'قائمة اختبار'});
 assert.equal(reg.status,200);
 await runOne();
 const activated=await endpoint(privateSkills.owner,'skills/local-checklist/activate',{version:'1.0.0',revision:0});
 assert.equal(activated.status,200);
 const requestIdea=sql.prepare('SELECT idea FROM idea_requests').get().idea;
 assert.equal(requestIdea,idea,'owner-approved build must use the exact archived synthetic idea');
 const accepted=await endpoint(privateSkills.owner,'requests',{
  skill_id:'local-checklist',private_prototype_consent:true,input:{idea:requestIdea,title:'مشترياتي'}
 });
 assert.equal(accepted.status,200);
 const ticket=await accepted.json();
 const jobResponse=await endpoint(ticket.request_token,'requests/'+ticket.request_id+'/runs',{});
 assert.equal(jobResponse.status,200);
 const job=await jobResponse.json();
 const path='requests/'+ticket.request_id+'/runs/'+job.id;
 const before=await (await endpoint(ticket.request_token,path)).json();
 assert.equal(before.status,'queued','stopped runner must leave request visibly queued');
 assert.equal((await endpoint(ticket.request_token,path+'/artifact')).status,409,
  'must not allow a ZIP before reviewed build completed');
 await sleep(300);
 assert.equal((await (await endpoint(ticket.request_token,path)).json()).status,'queued');
 await runOne();
 const result=await (await endpoint(ticket.request_token,path)).json();
 assert.equal(result.status,'succeeded');
 assert.equal(result.result.files,4);
 const artifact=await endpoint(ticket.request_token,path+'/artifact');
 assert.equal(artifact.status,200);
 const bytes=Buffer.from(await artifact.arrayBuffer());
 assert.equal(bytes.subarray(0,2).toString(),'PK');
 assert.equal((await endpoint('invalid',path+'/artifact')).status,401,'missing authorization must be rejected');
 const folder=await mkdtemp(join(tmpdir(),'mz-qa-real-app-'));
 t.after(()=>rm(folder,{recursive:true,force:true}));
 const zip=join(folder,'app.zip');await writeFile(zip,bytes);
 await exec('python3',['-c',
  "import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1]); assert sorted(z.namelist())==['app.js','blueprint.json','index.html','styles.css'] and z.testzip() is None\nz.extractall(sys.argv[2])",
  zip,folder]);
 const appServer=createServer(async(req,res)=>{
  const n={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'}[req.url];
  if(!n){res.writeHead(404);res.end();return}
  res.writeHead(200,{'Content-Type':{'index.html':'text/html; charset=utf-8','app.js':'text/javascript','styles.css':'text/css'}[n]});
  res.end(await readFile(join(folder,n)));
 });
 await new Promise(r=>appServer.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{appServer.closeAllConnections();appServer.close(r)}));
 await navigate('http://127.0.0.1:'+appServer.address().port+'/');
 let ready=false;
 for(let i=0;i<95;i++){
  if(await evaluate('!!document.getElementById("item-input")&&!!document.getElementById("add-btn")')){ready=true;break}
  await sleep(90);
 }
 assert.ok(ready,'generated app is not a functional HTML application');
 const first=await evaluate("(async()=>{document.getElementById('item-input').value='قهوة عربية';document.getElementById('add-btn').click();await new Promise(r=>setTimeout(r,200));return {count:document.querySelectorAll('#items li').length,rtl:document.documentElement.dir==='rtl'}})()");
 assert.equal(first.count,1);
 assert.equal(first.rtl,true);
 await evaluate('location.reload();true');
 await sleep(650);
 const state=await evaluate("({count:document.querySelectorAll('#items li').length, text:document.body.textContent.includes('قهوة عربية')})");
 assert.equal(state.count,1,'generated app state must survive browser reload');
 assert.equal(state.text,true);
 console.log('QA_SYNTHETIC_VISITOR_TO_REAL_APP_PASS',{screens:3,files:4,bytes:bytes.length,skill:'local-checklist',mobile:360});

});
