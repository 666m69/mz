// Disposable, single-purpose Cloudflare Workers / D1 integration QA.
// Deploy ONLY with an empty, newly created D1 database and temporary secrets.
// No production domains, real customer data, email or public /api/* endpoints.
import core from '../worker/index.mjs';
import {checks} from '../worker/catalog.mjs';
import {capability,unseal,canonical,hash} from '../worker/security.mjs';
import {buildReviewedEdgeApp} from './reviewed-edge-builder.mjs';
import {purgeExpiredArtifacts,mayDownloadArtifact} from '../worker/delivery-policy.mjs';
import {baseSchema,retentionSchema,nullGuardSchema,migrationStatements} from './migrations.mjs';

export const names=['init','release','review','activate','intake-a','intake-b','build-a','claim-a','finish-a','verify-a','revoke-a','build-b','claim-b','finish-b','verify-b','sql-guard','purge'];
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const fixtureId='qa-expired-artifact-20261107';
function check(ok,message){if(!ok)throw Error(message)}
async function requestApi(env,who,path,body){
  const token=who==='owner'?env.TEST_OWNER_TOKEN:who==='runner'?env.TEST_RUNNER_TOKEN:who;
  const method=body===undefined?'GET':'POST';
  const h=new Headers({'Authorization':'Bearer '+token,'Idempotency-Key':crypto.randomUUID()});
  if(body!==undefined)h.set('Content-Type','application/json');
  return core.fetch(new Request('https://mzcode-qa.internal/api/'+path,{
    method,headers:h,...(body===undefined?{}:{body:JSON.stringify(body)})
  }),env);
}
async function api(env,who,path,body,status=200){
  const res=await requestApi(env,who,path,body);
  let data;try{data=await res.json()}catch{data={not_json:true}}
  check(res.status===status,'BAD_API_STATUS_'+res.status+'_EXPECT_'+status+'_'+(data.error||''));
  return data;
}
async function put(db,key,value){
  await db.prepare('INSERT INTO qa_state(key,value) VALUES(?,?)').bind(key,String(value)).run();
}
async function get(db,key){
  const row=await db.prepare('SELECT value FROM qa_state WHERE key=?').bind(key).first();
  check(!!row,'MISSING_QA_STATE_'+key);
  return row.value;
}
async function perform(name,env){
  const db=env.SKILLS_DB,now=Math.floor(Date.now()/1000);
  if(name==='init'){
    const old=await db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").first();
    check(old?.n===0,'REFUSE_NONEMPTY_DATABASE');
    for(const statement of migrationStatements(baseSchema))await db.prepare(statement).run();
    // Old historical row gives a genuinely expired purge fixture after 0002 backfill.
    await db.prepare("INSERT INTO ss_skills(id) VALUES('qa-retention-fixture')").run();
    await db.prepare("INSERT INTO ss_releases(skill_id,version,manifest,digest,test_status) VALUES('qa-retention-fixture','1.0.0','{}',?,'passed')").bind('0'.repeat(64)).run();
    await db.prepare("INSERT INTO ss_jobs(id,kind,skill_id,version,digest,status,finished_at) VALUES(?,'test','qa-retention-fixture','1.0.0',?,'succeeded',unixepoch()-2678400)").bind(fixtureId,'0'.repeat(64)).run();
    await db.prepare('INSERT INTO ss_artifacts(job_id,cipher) VALUES(?,?)').bind(fixtureId,'QA_FAKE_EXPIRED_BYTES').run();
    for(const statement of migrationStatements(retentionSchema))await db.prepare(statement).run();
    for(const statement of migrationStatements(nullGuardSchema))await db.prepare(statement).run();
    await db.prepare('CREATE TABLE qa_state(key TEXT PRIMARY KEY,value TEXT NOT NULL)').run();
    const r=await db.prepare('SELECT purge_after FROM ss_artifacts WHERE job_id=?').bind(fixtureId).first();
    check(r?.purge_after<now,'OLD_ARTIFACT_NOT_EXPIRED');
    return {migrations:'0001+0002+0003',expiredFixture:true};
  }
  if(name==='release'){
    const r=await api(env,'owner','releases',{id:'local-checklist',version:'1.0.0',name_ar:'قوائم المهام'});
    check(!!r.test_job,'RELEASE_REVIEW_JOB_MISSING');
    return {releaseSubmitted:true};
  }
  if(name==='review'){
    const job=(await api(env,'runner','runner/claim',{})).job;
    check(!!job && job.kind==='test','WRONG_REVIEW_JOB');
    await api(env,'runner','runner/jobs/'+job.id+'/complete',{lease:job.lease,ok:true,checks});
    return {runnerTestCompleted:true};
  }
  if(name==='activate'){
    await api(env,'owner','skills/local-checklist/activate',{version:'1.0.0',revision:0});
    return {versionActivated:true};
  }
  if(name==='intake-a'||name==='intake-b'){
    const label=name.slice(-1);
    const r=await api(env,'owner','requests',{
      skill_id:'local-checklist',
      input:label==='a'?{idea:'أريد تطبيق قائمة مهام يومية محلية تحفظ الأعمال على هذا الجهاز فقط',title:'مهامي اليومية'}:{idea:'أريد قائمة مشتريات للبقالة تحفظ المنتجات محليًا على الجهاز مع إضافة وحذف العناصر',title:'مشترياتي اليومية'},
      private_prototype_consent:true
    });
    check(/^[0-9a-f-]{36}$/.test(r.request_id),'INVALID_REQUEST_ID');
    await put(db,'request_'+label,r.request_id);
    return {client:label,privateRequestCreated:true};
  }
  if(name==='build-a'||name==='build-b'){
    const label=name.slice(-1),rid=await get(db,'request_'+label);
    const r=await api(env,await capability(env,rid),'requests/'+rid+'/runs',{});
    check(/^[0-9a-f-]{36}$/.test(r.id),'INVALID_BUILD_ID');
    await put(db,'run_'+label,r.id);
    return {client:label,queued:true};
  }
  if(name==='claim-a'||name==='claim-b'){
    const label=name.slice(-1),id=await get(db,'run_'+label);
    const job=(await api(env,'runner','runner/claim',{})).job;
    check(job?.id===id,'WRONG_BUILD_LEASE');
    await put(db,'lease_'+label,job.lease);
    return {client:label,leased:true};
  }
  if(name==='finish-a'||name==='finish-b'){
    const label=name.slice(-1),id=await get(db,'run_'+label),lease=await get(db,'lease_'+label);
    const job=await db.prepare('SELECT j.skill_id,j.request_id,j.status,q.input_cipher FROM ss_jobs j JOIN ss_requests q ON q.id=j.request_id WHERE j.id=?').bind(id).first();
    check(job?.status==='running','JOB_NOT_RUNNING');
    const input=await unseal(env,'input/'+job.request_id,job.input_cipher);
    // Generate from decrypted real request input. Not a hard-coded ZIP fixture.
    const built=buildReviewedEdgeApp(job.skill_id,input);
    check(built.blueprint.category===(label==='a'?'tasks':'shopping'),'WRONG_RENDERED_CATEGORY');
    const files=built.files;
    const receipt=await api(env,'runner','runner/jobs/'+id+'/complete',{lease,ok:true,files});
    check(receipt.status==='succeeded'&&receipt.result?.sha256===await hash(canonical(files)),'RECEIPT_MISMATCH');
    const row=await db.prepare('SELECT cipher,download_expires_at,purge_after,revoked_at FROM ss_artifacts WHERE job_id=?').bind(id).first();
    check(row && mayDownloadArtifact(row,now),'ARTIFACT_NOT_DOWNLOADABLE');
    check(!row.cipher.includes(built.blueprint.title)&&!row.cipher.includes('<!doctype html>'),'ARTIFACT_NOT_ENCRYPTED');
    await put(db,'category_'+label,built.blueprint.category);
    await put(db,'title_'+label,built.blueprint.title);
    return {client:label,generated:true,category:built.blueprint.category,encrypted:true,files:4,downloadDays:14,purgeDays:30};
  }
  if(name==='verify-a'||name==='verify-b'){
    const label=name.slice(-1),other=label==='a'?'b':'a';
    const rid=await get(db,'request_'+label),otherId=await get(db,'request_'+other),job=await get(db,'run_'+label);
    const path='requests/'+rid+'/runs/'+job+'/artifact';
    const own=await requestApi(env,await capability(env,rid),path);
    check(own.status===200,'DOWNLOAD_HTTP_'+own.status);
    const bin=new Uint8Array(await own.arrayBuffer());
    check(bin.length>8000&&bin[0]===80&&bin[1]===75&&bin[2]===3&&bin[3]===4,'INVALID_GENERATED_ZIP');
    // The ZIP is STORE-only, source-pinned and validated in Node CRC parity tests.
    // Independently read member contents from actual authenticated HTTP bytes.
    const view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
    const decoder=new TextDecoder(),members={};let offset=0;
    while(offset+30<=bin.length&&view.getUint32(offset,true)===0x04034b50){
      const size=view.getUint32(offset+18,true),nameLen=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
      check(view.getUint16(offset+8,true)===0&&size<=49152&&nameLen<80,'ZIP_MEMBER_INVALID');
      const filename=decoder.decode(bin.slice(offset+30,offset+30+nameLen));
      check(['app.js','blueprint.json','index.html','styles.css'].includes(filename)&&!Object.hasOwn(members,filename),'ZIP_UNREVIEWED_MEMBER');
      const start=offset+30+nameLen+extra,end=start+size;
      check(end<=bin.length,'ZIP_TRUNCATED');
      members[filename]=decoder.decode(bin.slice(start,end));offset=end;
    }
    check(Object.keys(members).length===4,'ZIP_MEMBER_COUNT');
    const blueprint=JSON.parse(members['blueprint.json']);
    const expectedCategory=await get(db,'category_'+label),expectedTitle=await get(db,'title_'+label);
    check(blueprint.title===expectedTitle&&blueprint.category===expectedCategory&&
      members['index.html'].includes('<h1 id="app-title">'+expectedTitle+'</h1>')&&
      members['index.html'].includes('dir="rtl"')&&
      members['app.js'].includes('localStorage'),'GENERATED_CONTENT_NOT_DELIVERED');
    await api(env,await capability(env,otherId),path,undefined,404);
    await api(env,'runner',path,undefined,403);
    const anon=await core.fetch(new Request('https://mzcode-qa.internal/api/'+path),env);
    check(anon.status===401,'ANONYMOUS_DOWNLOAD');
    return {client:label,realGenerated:true,category:expectedCategory,zipBytes:bin.length,crossClientDenied:true,anonymousDenied:true,runnerDenied:true};
  }
  if(name==='revoke-a'){
    const rid=await get(db,'request_a'),job=await get(db,'run_a');
    const path='requests/'+rid+'/runs/'+job;
    await api(env,await capability(env,rid),path+'/revoke',{},403);
    await api(env,'owner',path+'/revoke',{});
    await api(env,await capability(env,rid),path+'/artifact',undefined,404);
    const row=await db.prepare('SELECT revoked_at FROM ss_artifacts WHERE job_id=?').bind(job).first();
    check(row?.revoked_at>0,'REVOCATION_NOT_SAVED');
    let blocked=false;
    try{await db.prepare('UPDATE ss_artifacts SET revoked_at=NULL WHERE job_id=?').bind(job).run()}
    catch(e){blocked=String(e).includes('immutable_artifact_revocation')}
    check(blocked,'REVOCATION_UNDONE');
    return {clientRevokeDenied:true,ownerRevoked:true,cannotUndo:true};
  }
  if(name==='sql-guard'){
    const id=await get(db,'run_b');
    let blocked=false;
    try{await db.prepare('UPDATE ss_artifacts SET download_expires_at=NULL WHERE job_id=?').bind(id).run()}
    catch(e){blocked=String(e).includes('immutable_artifact_retention')}
    check(blocked,'NULL_EXPIRY_BYPASS');
    return {nullExpiryRejected:true};
  }
  if(name==='purge'){
    const result=await purgeExpiredArtifacts(env);
    check(result.purged===1,'BAD_PURGE_COUNT_'+result.purged);
    const stale=await db.prepare('SELECT job_id FROM ss_artifacts WHERE job_id=?').bind(fixtureId).first();
    check(!stale,'EXPIRED_NOT_PURGED');
    const count=await db.prepare('SELECT count(*) n FROM ss_artifacts').first();
    check(count.n===2,'ACTIVE_ARTIFACT_REMOVED');
    return {expiredDeleted:1,liveKept:2};
  }
  throw Error('UNKNOWN_PHASE');
}
// State transitions are strictly one-time and ordered. This is a disposable QA
// harness only; a failed phase requires destroying the throwaway database.
export async function runQaPhase(name,env){
  check(names.includes(name),'UNKNOWN_PHASE');
  const db=env.SKILLS_DB;
  if(name!=='init'){
    const index=names.indexOf(name);
    const previous=names[index-1];
    const lock=await db.prepare(
      "UPDATE qa_state SET value=? WHERE key='qa_step' AND value=? RETURNING value"
    ).bind('running:'+name,previous).first();
    check(lock?.value==='running:'+name,'QA_PHASE_OUT_OF_ORDER');
  }
  const result=await perform(name,env);
  if(name==='init'){
    await db.prepare("INSERT INTO qa_state(key,value) VALUES('qa_step','init')").run();
  }else{
    const done=await db.prepare(
      "UPDATE qa_state SET value=? WHERE key='qa_step' AND value=? RETURNING value"
    ).bind(name,'running:'+name).first();
    check(done?.value===name,'QA_PHASE_COMMIT_FAILED');
  }
  return result;
}
function page(prefix){
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Private MZcode E2E</title>'
  +'<pre id="progress">Private QA running</pre><script>'
  +'(async()=>{var steps='+JSON.stringify(names)+',out=[];for(var name of steps){try{'
  +'var r=await fetch('+JSON.stringify(prefix)+'+"step/"+name,{method:"POST",cache:"no-store"});'
  +'var j=await r.json();out.push({step:name,ok:r.ok&&j.ok,result:j.result||{},error:j.error||null});'
  +'if(!r.ok||!j.ok)break;}catch(e){out.push({step:name,ok:false,error:"BROWSER_FETCH_FAILED"});break;}}'
  +'var result={ok:out.length===steps.length&&out.every(x=>x.ok),executed:out.length,tests:out};'
  +'var el=document.createElement("pre");el.id="qa-done";el.textContent=JSON.stringify(result);document.body.appendChild(el);'
  +'})().catch(()=>{var el=document.createElement("pre");el.id="qa-done";el.textContent="{\\"ok\\":false}";document.body.appendChild(el)});'
  +'</script></html>';
}
export default {
  async fetch(req,env){
    const url=new URL(req.url),until=Date.parse(env.QA_CLOSE_AT||'');
    const prefix='/__private_mzcode_qa/'+env.QA_ROUTE_SECRET+'/';
    if(!['GET','POST'].includes(req.method)||url.protocol!=='https:'||url.hostname!==env.QA_HOST
      ||!Number.isFinite(until)||Date.now()>=until
      ||!env.QA_ROUTE_SECRET||url.search||!url.pathname.startsWith(prefix)){
      return new Response('Not found',{status:404,headers});
    }
    const path=url.pathname.slice(prefix.length);
    if(path==='run'&&req.method==='GET')return new Response(page(prefix),{headers:{...headers,'Content-Type':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'"}});
    if(req.method!=='POST'||!path.startsWith('step/')||!names.includes(path.slice(5)))return new Response('Not found',{status:404,headers});
    try{return Response.json({ok:true,phase:path.slice(5),result:await runQaPhase(path.slice(5),env)},{headers})}
    catch(e){
      const error=String(e?.message||'failed').replace(/[0-9a-f]{32,}/gi,'[redacted]').slice(0,160);
      return Response.json({ok:false,phase:path.slice(5),error},{status:500,headers});
    }
  }
};
