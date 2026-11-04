import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localEnvironment,serve} from '../dev/local.mjs';
const execute=promisify(execFile),require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const agent=fileURLToPath(new URL('../runner/agent.py',import.meta.url));
const name='اختبار الاصدار';
async function boot(t) {
  const c=await localEnvironment(),{server,url}=await serve(c.env);
  t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
  t.after(()=>c.sqlite.close());
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,
    args:['--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
  t.after(()=>browser.close());
  const call=async(token,path,body,idem=randomUUID())=>{
    const r=await fetch(url+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{
      Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':idem},body:body===undefined?undefined:JSON.stringify(body)});
    assert.equal(r.status,200,path+' '+r.status+(r.status!==200?' '+await r.text():''));
    return r.headers.get('Content-Type')==='application/zip'?Buffer.from(await r.arrayBuffer()):r.json();
  };
  const once=async()=>{
    const r=await execute('python3',['-B',agent,'--once'],{env:{PATH:process.env.PATH,SKILLS_URL:url,SKILLS_RUNNER_TOKEN:c.runner}});
    return r.stdout.trim();
  };
  return {...c,browser,call,once,url};
}
async function openProject(t,browser,zip){
  const folder=await mkdtemp(join(tmpdir(),'mz-standalone-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const archive=join(folder,'project.zip');await writeFile(archive,zip);
  await execute('python3',['-c',"import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert sorted(z.namelist())==['app.js','blueprint.json','index.html','styles.css'] and z.testzip() is None; z.extractall(sys.argv[2])",archive,folder]);
  const server=createServer(async(q,s)=>{
    const n={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css'}[q.url];
    if(!n){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':{'index.html':'text/html; charset=utf-8','app.js':'text/javascript','styles.css':'text/css'}[n]});
    s.end(await readFile(join(folder,n)));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
  const base='http://127.0.0.1:'+server.address().port;
  const page=await browser.newPage({viewport:{width:360,height:760}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(base+'/'))external.push(new URL(r.url()).origin);});
  await page.goto(base);
  t.after(()=>{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);});
  return page;
}
const scenarios=[
  {id:'local-checklist',idea:'أريد قائمة مشتريات أسبوعية أحفظها على هذا الجهاز',title:'مشترياتي',async check(page){
    await page.locator('#item-input').fill('قهوة');await page.locator('#add-btn').click();
    await page.locator('#items input').check();await page.getByRole('button',{name:'المتبقي'}).click();
    assert.equal(await page.locator('#items li').count(),0);await page.getByRole('button',{name:'المكتمل'}).click();
    page.once('dialog',d=>d.accept('قهوة عربية'));await page.getByRole('button',{name:'تعديل'}).click();
    await page.reload();assert.equal(await page.locator('.item-text').textContent(),'قهوة عربية');
    assert.equal(await page.locator('#items input').isChecked(),true);
    await page.getByRole('button',{name:'حذف'}).click();assert.equal(await page.locator('#items li').count(),0);
  }},
  {id:'local-counter',idea:'أريد عداد محاولات لزيادة العدد وتصفيره محليا على جهازي',title:'عداد المحاولات',extra:{initial_count:3},async check(page){
    assert.equal(await page.locator('#count').textContent(),'3');
    await page.locator('#plus').click({clickCount:2});assert.equal(await page.locator('#count').textContent(),'5');
    await page.reload();assert.equal(await page.locator('#count').textContent(),'5');
    await page.locator('#minus').click();assert.equal(await page.locator('#count').textContent(),'4');
    await page.locator('#reset').click();assert.equal(await page.locator('#count').textContent(),'0');
    assert.equal(await page.locator('#minus').isDisabled(),true);
  }}
];
for(const scenario of scenarios)test('private intake → runner → ZIP → functional Chromium app: '+scenario.id,{timeout:35000},async t=>{
  const c=await boot(t);
  const release=await c.call(c.owner,'releases',{id:scenario.id,version:'1.0.0',name_ar:name});
  assert.equal(await c.once(),'succeeded');
  const review=(await c.call(c.owner,'skills')).skills[0].versions[0];
  assert.equal(review.test_status,'passed');assert.equal(review.test.checks.length,5);
  assert.equal(review.enabled,false);
  await c.call(c.owner,'skills/'+scenario.id+'/activate',{version:'1.0.0',revision:0});
  const r=await c.call(c.owner,'requests',{skill_id:scenario.id,input:{idea:scenario.idea,title:scenario.title,...(scenario.extra||{})},private_prototype_consent:true});
  const path='requests/'+r.request_id+'/runs', k=randomUUID();
  const j=await c.call(r.request_token,path,{},k);assert.equal((await c.call(r.request_token,path,{},k)).id,j.id);
  assert.equal(await c.once(),'succeeded');
  const completed=await c.call(r.request_token,path+'/'+j.id);
  assert.equal(completed.status,'succeeded');assert.equal(completed.result.files,4);
  const zip=await c.call(r.request_token,path+'/'+j.id+'/artifact');
  const page=await openProject(t,c.browser,zip);assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  await scenario.check(page);
  const monitoring=await c.call(c.owner,'monitor');assert.equal(monitoring.faults.length,0);
  assert.ok(monitoring.audit.some(e=>e.target===release.test_job && e.event==='test.succeeded'));
  if(process.env.MZ_EXAMPLE_DIR){
    await mkdir(process.env.MZ_EXAMPLE_DIR,{recursive:true});
    await writeFile(join(process.env.MZ_EXAMPLE_DIR,scenario.id+'.zip'),zip);
    console.log(scenario.id, 'archive SHA-256',createHash('sha256').update(zip).digest('hex'), 'bytes',zip.length);
  }
});
test('mobile owner UI submits a reviewed release, shows tests, activates and disables, forgets token on reload',{timeout:35000},async t=>{
  const c=await boot(t), page=await c.browser.newPage({viewport:{width:360,height:760}});
  await page.goto(c.url);await page.getByLabel('رمز المالك').fill(c.owner);await page.getByRole('button',{name:'دخول'}).click();
  await page.getByLabel('المهارة المراجعة').selectOption('local-counter');
  await page.getByLabel('اسم العرض').fill('عداد الاختبار');await page.getByLabel('رقم الإصدار').fill('1.0.0');
  await page.getByRole('button',{name:'إرسال للمراجعة'}).click();
  await page.getByText('بانتظار الاختبار',{exact:true}).first().waitFor();assert.equal(await c.once(),'succeeded');
  await page.getByRole('button',{name:'تحديث الحالة'}).click();await page.getByRole('button',{name:'تفعيل 1.0.0'}).click();
  await page.locator('#idea').fill('أريد عداد محاولات محلي يحفظ القيمة على جهازي');
  await page.locator('#private-consent').check();await page.locator('#assistant button').click();
  await page.locator('#assistant-result').waitFor();assert.equal(await c.once(),'succeeded');
  const download=page.waitForEvent('download');await page.locator('#assistant-fetch').click();
  assert.equal((await download).suggestedFilename(),'local-counter.zip');
  await page.getByRole('button',{name:'تعطيل المهارة'}).click();await page.getByText('معطلة',{exact:true}).first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  await page.reload();await page.getByLabel('رمز المالك').waitFor();assert.equal(await page.getByLabel('رمز المالك').inputValue(),'');
});
test('an unsupported private idea finishes with a visible reason and no downloadable artifact',{timeout:15000},async t=>{
  const c=await localEnvironment(),{server,url}=await serve(c.env);t.after(()=>c.sqlite.close());
  t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
  const call=(token,path,body)=>fetch(url+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{
    Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});
  const work=async()=> (await execute('python3',['-B',agent,'--once'],{env:{PATH:process.env.PATH,SKILLS_URL:url,SKILLS_RUNNER_TOKEN:c.runner}})).stdout.trim();
  assert.equal((await call(c.owner,'releases',{id:'local-counter',version:'1.0.0',name_ar:'عداد'})).status,200);
  assert.equal(await work(),'succeeded');
  assert.equal((await call(c.owner,'skills/local-counter/activate',{revision:0,version:'1.0.0'})).status,200);
  const idea='أريد عداد مبيعات من خلال واتساب مع دفع حقيقي';
  const receipt=await (await call(c.owner,'requests',{skill_id:'local-counter',input:{idea},private_prototype_consent:true})).json();
  const path='requests/'+receipt.request_id+'/runs', job=await (await call(receipt.request_token,path,{})).json();
  assert.equal(await work(),'technical_review');
  const state=await (await call(receipt.request_token,path+'/'+job.id)).json();
  assert.equal(state.status,'failed');assert.equal(state.error_code,'technical_review');
  assert.equal((await call(receipt.request_token,path+'/'+job.id+'/artifact')).status,409);
  const m=await (await call(c.owner,'monitor')).json();assert.equal(m.faults[0].id,job.id);
  assert.equal(JSON.stringify(m).includes(idea),false);
});

test('owner assistant selects each tested skill, queues it once and downloads the private project',{timeout:45000},async t=>{
  const c=await boot(t);
  const ask=(idea,token=c.owner,consent=true,key=randomUUID())=>fetch(c.url+'/api/assistant/runs',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':key},
    body:JSON.stringify({idea,private_prototype_consent:consent})});
  const list='أريد تطبيق قائمة مشتريات محلية للاستخدام الشخصي';
  assert.equal((await ask(list,c.runner)).status,403);
  assert.equal((await ask(list,c.owner,false)).status,422);
  assert.equal((await ask(list)).status,409);
  for(const idea of ['أريد قائمة مهام مع عداد مستقل لتتبع النقاط','أريد قائمة مهام ترسل بالبريد للمستخدمين','أريد إعداد خريطة للمطاعم القريبة مني']){
    assert.equal((await ask(idea)).status,422);
  }
  for(const [skill,idea] of [['local-checklist',list],['local-counter','أريد عدادًا محليًا يحفظ النتيجة على الجهاز']]){
    const version='1.0.0';await c.call(c.owner,'releases',{id:skill,version,name_ar:'أداة خاصة'});
    assert.equal(await c.once(),'succeeded');await c.call(c.owner,'skills/'+skill+'/activate',{version,revision:0});
    const k=randomUUID(),first=await ask(idea,c.owner,true,k);assert.equal(first.status,200);
    const result=await first.json();assert.equal(result.skill_id,skill);assert.deepEqual(await (await ask(idea,c.owner,true,k)).json(),result);
    assert.equal(await c.once(),'succeeded');assert.equal(await c.once(),'idle');
    const path='requests/'+result.request_id+'/runs/'+result.job_id;
    const zip=await c.call(result.request_token,path+'/artifact');
    const page=await openProject(t,c.browser,zip);
    await page.locator(skill==='local-checklist'?'#add-btn':'#plus').waitFor();
  }
});
