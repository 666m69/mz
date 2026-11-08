import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {localEnvironment,serve} from '../dev/local.mjs';

const runner=fileURLToPath(new URL('../runner/agent.py',import.meta.url));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('bounded --serve picks up two newly queued jobs without any manual --once invocation', {timeout:45000}, async()=>{
  const c=await localEnvironment();
  const {server,url}=await serve(c.env);
  const child=spawn('python3',['-B',runner,'--serve','--poll-seconds','1','--max-jobs','2','--max-seconds','35'],{
    stdio:['ignore','ignore','pipe'],
    env:{PATH:process.env.PATH,SKILLS_URL:url,SKILLS_RUNNER_TOKEN:c.runner}
  });
  let stderr='';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data',data=>{stderr=(stderr+data).slice(-256);});
  const ended=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
  const api=async(token,path,body)=>{
    const res=await fetch(url+'/api/'+path,{
      method:body===undefined?'GET':'POST',
      headers:{
        Authorization:'Bearer '+token,
        ...(body===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':randomUUID()})
      },
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    assert.equal(res.status,200,path+' returned HTTP '+res.status);
    return res.headers.get('Content-Type')?.startsWith('application/zip')
      ?Buffer.from(await res.arrayBuffer()):res.json();
  };
  const until=async(check,label)=>{
    for(let n=0;n<100;n++){
      const value=await check();
      if(value!==null)return value;
      if(child.exitCode!==null&&child.exitCode!==0)throw Error(label+' runner exited '+child.exitCode);
      await sleep(250);
    }
    throw Error(label+' not completed by autonomous service');
  };
  try {
    await api(c.owner,'releases',{id:'local-checklist',version:'1.0.0',name_ar:'قائمة اختبار الخدمة'});
    await until(async()=>{
      const data=await api(c.owner,'skills');
      return data.skills[0]?.versions[0]?.test_status==='passed'?true:null;
    },'review');
    await api(c.owner,'skills/local-checklist/activate',{version:'1.0.0',revision:0});
    const receipt=await api(c.owner,'requests',{
      skill_id:'local-checklist',private_prototype_consent:true,
      input:{idea:'أريد قائمة مشتريات أسبوعية محلية للاختبار الآلي',title:'تجربة التشغيل'}
    });
    const path='requests/'+receipt.request_id+'/runs';
    const job=await api(receipt.request_token,path,{});
    const result=await until(async()=>{
      const current=await api(receipt.request_token,path+'/'+job.id);
      if(current.status==='failed')throw Error('autonomous build failed: '+current.error_code);
      return current.status==='succeeded'?current:null;
    },'build');
    assert.equal(result.result.files,4);
    const zip=await api(receipt.request_token,path+'/'+job.id+'/artifact');
    assert.ok(zip.length>1000&&zip.length<65536);
    assert.equal(zip.subarray(0,2).toString(),'PK');
    const completed=await Promise.race([ended,sleep(7000).then(()=>({timeout:true}))]);
    assert.deepEqual(completed,{code:0,signal:null},'bounded service must exit after two jobs');
    const jobs=c.sqlite.prepare('SELECT kind,status,attempts FROM ss_jobs ORDER BY created_at,rowid').all();
    assert.deepEqual(jobs.map(j=>[j.kind,j.status,j.attempts]),[
      ['test','succeeded',1],['build','succeeded',1]
    ]);
    assert.ok(!stderr.includes('control_unavailable'),'runner lost control plane');
  } finally {
    if(child.exitCode===null)child.kill('SIGTERM');
    await Promise.race([ended,sleep(3000)]);
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    c.sqlite.close();
  }
});
