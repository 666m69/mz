import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,appendFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {setTimeout as pause} from 'node:timers/promises';
import {exerciseChecklist} from './browser.mjs';
import {createRecipient,claimGrant} from './access.mjs';
const exec=promisify(execFile);
const host='https://mzcode-skills-qa-20261104.666m69.workers.dev';
const runner=fileURLToPath(new URL('../runner/agent.py',import.meta.url));
const digest=v=>createHash('sha256').update(v).digest('hex');
const names=['app.js','blueprint.json','index.html','styles.css'];
async function prepare(temp){
  const priv=join(temp,'mz-private');await mkdir(priv,{mode:0o700});
  const keys={owner:randomBytes(32).toString('base64url'),runner:randomBytes(32).toString('base64url')};
  await writeFile(join(priv,'tokens.json'),JSON.stringify(keys),{mode:0o600,flag:'wx'});
  const recipient=await createRecipient(priv);
  const fingerprints={sha:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,
    owner:digest(keys.owner),runner:digest(keys.runner)};
  await writeFile(join(temp,'mz-qa-fingerprints.json'),JSON.stringify(fingerprints),{mode:0o600});
  await appendFile(process.env.GITHUB_OUTPUT,'owner='+fingerprints.owner+'\nrunner='+fingerprints.runner+
    '\nkey_a='+recipient.slice(0,171)+'\nkey_b='+recipient.slice(171)+'\n');
}
export async function accept({url,owner,runnerToken,version,out,chrome,access,waitMs=0}){
  if(access){
    assert.equal(url,host);
    const gate=await fetch(url+'/api/skills',{redirect:'manual',signal:AbortSignal.timeout(10000)});
    assert.ok([302,401,403].includes(gate.status),'Cloudflare Access did not protect QA');
  }
  const api=async(token,path,body,expected=200,key=randomUUID())=>{
    const res=await fetch(url+'/api/'+path,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{...(access?{'CF-Access-Client-Id':access.id,'CF-Access-Client-Secret':access.secret}:{}),
        ...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json','Idempotency-Key':key},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    // Bodies may contain credentials. Print only typed error codes when a step fails.
    if(res.status!==expected){let c;try{c=(await res.json()).error;}catch{}
      throw Error(path.split('/')[0]+' expected '+expected+' received '+res.status+' '+(/^[a-z_]{2,40}$/.test(c)?c:'unavailable'));}
    if(res.headers.get('content-type')?.startsWith('application/zip'))return Buffer.from(await res.arrayBuffer());
    return res.json();
  };
  const once=async()=>{const {stdout}=await exec('python3',['-B',runner,'--once'],{timeout:20000,
    env:{PATH:process.env.PATH,SKILLS_URL:url,SKILLS_RUNNER_TOKEN:runnerToken,...(access?{
      SKILLS_ACCESS_ORIGIN:url,SKILLS_ACCESS_CLIENT_ID:access.id,SKILLS_ACCESS_CLIENT_SECRET:access.secret}:{})}});
    assert.equal(stdout.trim(),'succeeded','runner returned '+stdout.trim().slice(0,40));};
  if(waitMs){
    const deadline=Date.now()+waitMs;let ready=false;
    let last='waiting';
    while(Date.now()<deadline){try{await api(owner,'skills');ready=true;break;}catch(e){
      const reason=String(e.message).slice(0,120);
      if(reason!==last){console.log('QA readiness: '+reason);last=reason;}await pause(5000);}}
    assert.ok(ready,'QA owner fingerprint was not authorized before the wait deadline: '+last);
  }
  const probe=JSON.parse((await exec('python3',['-B',runner,'--probe'],{timeout:20000,env:{PATH:process.env.PATH}})).stdout);
  assert.equal(probe.network,'denied');assert.equal(probe.spawn,'denied');assert.equal(probe.limits,'verified');
  await api(null,'skills',undefined,401);await api(runnerToken,'skills',undefined,403);await api(owner,'runner/claim',{},403);
  const skill='local-checklist',prefix='hosted-qa-'+version.replaceAll('.','-')+'-';
  const release=await api(owner,'releases',{id:skill,version,name_ar:'قائمة الاختبار السحابي'},200,prefix+'release');
  const record=async()=>(await api(owner,'skills')).skills.find(s=>s.id===skill);
  let s=await record();
  if(s.versions.find(v=>v.version===version)?.test_status==='pending')await once();
  s=await record();const verified=s.versions.find(v=>v.version===version);
  assert.equal(verified.test_status,'passed');assert.equal(verified.test.checks.length,5);
  if(!s.enabled||s.active_version!==version)await api(owner,'skills/'+skill+'/activate',{version,revision:s.revision});
  try{
    const request={skill_id:skill,private_prototype_consent:true,input:{idea:'أريد قائمة مشتريات منزلية بسيطة أحفظها على الجهاز للاختبار',title:'مشتريات الاختبار'}};
    const a=await api(owner,'requests',request,200,prefix+'private-intake');
    const second=await api(owner,'requests',request,200,prefix+'separate-request');
    await api(a.request_token,'requests/'+second.request_id,undefined,404);
    const path='requests/'+a.request_id+'/runs';
    const idem=prefix+'build-synthetic';
    const first=await api(a.request_token,path,{},200,idem);const duplicate=await api(a.request_token,path,{},200,idem);
    assert.equal(first.id,duplicate.id);
    const status=async()=>api(a.request_token,path+'/'+first.id);
    if((await status()).status==='queued')await once();
    const result=await status();assert.equal(result.status,'succeeded');assert.equal(result.result.files,4);
    await api(second.request_token,path+'/'+first.id+'/artifact',undefined,404);
    const zip=await api(a.request_token,path+'/'+first.id+'/artifact');assert.ok(zip.length>1000&&zip.length<65536);
    await mkdir(out,{recursive:true,mode:0o700});const archivePath=join(out,'MZcode-Hosted-Checklist.zip');
    await writeFile(archivePath,zip,{mode:0o600});
    const unpacked=await mkdtemp(join(tmpdir(),'mz-qa-app-'));let browser;
    try{
      await exec('python3',['-c',`import sys,zipfile,pathlib
with zipfile.ZipFile(sys.argv[1]) as z:
 assert sorted(z.namelist())==['app.js','blueprint.json','index.html','styles.css'] and sum(i.file_size for i in z.infolist())<=49152 and z.testzip() is None
 for n in z.namelist(): (pathlib.Path(sys.argv[2])/n).write_bytes(z.read(n))`,archivePath,unpacked]);
      const files={};for(const n of names)files[n]=await readFile(join(unpacked,n),'utf8');
      assert.equal(digest(JSON.stringify(files)),result.result.sha256);
      assert.equal(Object.values(files).reduce((sum,x)=>sum+Buffer.byteLength(x),0),result.result.bytes);
      browser=await exerciseChecklist(unpacked,chrome);
    }finally{await rm(unpacked,{recursive:true,force:true});}
    const report={request:a.request_id,job:first.id,release_test:release.test_job,version,skill,zip_sha256:digest(zip),
      zip_bytes:zip.length,files_sha256:result.result.sha256,file_count:result.result.files,checks:verified.test.checks,
      browser,isolation:probe,idempotent:true,cross_request_denied:true,unauthenticated_denied:true};
    await writeFile(join(out,'acceptance.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  }finally{
    s=await record();if(s?.enabled&&s.active_version===version)await api(owner,'skills/'+skill+'/disable',{revision:s.revision});
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const temp=process.env.RUNNER_TEMP;
  assert.equal(process.env.GITHUB_REPOSITORY,'666m69/mz');assert.equal(process.env.GITHUB_EVENT_NAME,'push');
  assert.equal(process.env.GITHUB_REF,'refs/heads/test/skills-hosted-acceptance-20261104');
  if(process.argv[2]==='prepare')await prepare(temp);
  else if(process.argv[2]==='accept'){
    const k=JSON.parse(await readFile(join(temp,'mz-private','tokens.json'),'utf8'));
    const version='1.'+(Number(process.env.GITHUB_RUN_NUMBER)%1000)+'.'+Number(process.env.GITHUB_RUN_ATTEMPT);
    const access=await claimGrant(join(temp,'mz-private'),process.env);
    await accept({url:host,owner:k.owner,runnerToken:k.runner,version,access,out:join(temp,'mz-result'),
      chrome:process.env.MZ_QA_CHROME||'google-chrome',waitMs:90000});
  }else throw Error('Expected prepare or accept');
}
