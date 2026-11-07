import {assistantRun} from './assistant.mjs';
import {catalog,manifest,matches,knownDigest} from './catalog.mjs';
import {requireThat,fields,id,seal,unseal,capability,readJson,ApiError} from './security.mjs';
import {first,stmt,all,mutation,registry} from './store.mjs';
import {claim,complete} from './queue.mjs';
import {zipFiles} from './zip.mjs';
import {mayDownloadArtifact} from './delivery-policy.mjs';

const versionOK=v=>typeof v==='string' && /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(v);
const reviewed=id=>typeof id==='string' && Object.hasOwn(catalog,id);
function owner(a){requireThat(a.role==='owner',403,'owner_only');}
function scope(a,r){requireThat(a.role==='owner'||(a.role==='request' && a.subject===r),404,'not_found');}
const notFound=()=>{throw new ApiError(404,'not_found');};
export async function route(req,env,actor,path) {
  const db=env.SKILLS_DB, method=req.method, [area,item,sub,runId,asset]=path;
  if(area==='runner'){
    requireThat(actor.role==='runner',403,'runner_only');
    if(method==='POST'&&item==='claim'&&path.length===2){fields(await readJson(req),[]);return claim(env);}
    if(method==='POST'&&item==='jobs'&&runId==='complete'&&path.length===4)return complete(env,req,sub,await readJson(req,98304));
    return notFound();
  }
  requireThat(actor.role!=='runner',403,'wrong_role');
  if(area==='assistant'&&item==='runs'&&path.length===2&&method==='POST'){
    owner(actor);return assistantRun(req,env,await readJson(req));
  }
  if(area==='skills' && method==='GET' && path.length===1){owner(actor);return {catalog,skills:await registry(db)};}
  if(area==='releases' && method==='POST' && path.length===1){
    owner(actor);const b=await readJson(req);fields(b,['id','version','name_ar','adapter_ref'],['id','version','name_ar']);
    requireThat(reviewed(b.id)&&(!Object.hasOwn(b,'adapter_ref')||(typeof b.adapter_ref==='string' && Object.hasOwn(catalog[b.id].adapters,b.adapter_ref)))&&versionOK(b.version)&&typeof b.name_ar==='string'
      && /^[\p{L}\p{M}][\p{L}\p{M}\p{N} ()،-]{1,63}$/u.test(b.name_ar),422,'invalid_release');
    return mutation(db,req,'owner/release',b,env,async()=>{
      const job=id(), m=manifest(b.id,b.version,b.name_ar,b.adapter_ref);
      return {statements:[stmt(db,'INSERT INTO ss_skills(id) VALUES(?) ON CONFLICT(id) DO NOTHING',b.id),
        stmt(db,'INSERT INTO ss_releases(skill_id,version,manifest,digest) VALUES(?,?,?,?)',b.id,b.version,JSON.stringify(m),m.adapter_digest),
        stmt(db,"INSERT INTO ss_jobs(id,kind,skill_id,version,digest) VALUES(?,'test',?,?,?)",job,b.id,b.version,m.adapter_digest)],
        response:{id:b.id,version:b.version,test_job:job,test_status:'pending'}};
    });
  }
  if(area==='skills'&&method==='POST'&&path.length===3&&['activate','disable','rollback'].includes(sub)){
    owner(actor);const b=await readJson(req);fields(b,sub==='disable'?['revision']:['revision','version']);
    requireThat(reviewed(item)&&Number.isSafeInteger(b.revision)&&b.revision>=0&&(sub==='disable'||versionOK(b.version)),422,'invalid_release');
    return mutation(db,req,'owner/'+item+'/'+sub,b,env,async()=>{
      if(sub!=='disable'){
        const r=await first(db,'SELECT digest FROM ss_releases WHERE skill_id=? AND version=?',item,b.version);
        requireThat(r && knownDigest(item,r.digest),409,'review_required');
      }
      return {statements:[stmt(db,'INSERT INTO ss_decisions(skill_id,action,version,expected) VALUES(?,?,?,?)',item,sub,b.version??null,b.revision)],
        response:{id:item,action:sub,revision:b.revision+1}};
    });
  }
  if(area==='monitor'&&method==='GET'&&path.length===1){
    owner(actor);return {counts:await all(db,'SELECT status,count(*) AS total FROM ss_jobs GROUP BY status'),
      faults:await all(db,"SELECT id,kind,skill_id,version,error_code,finished_at FROM ss_jobs WHERE status='failed' ORDER BY finished_at DESC LIMIT 30"),
      improvements:await all(db,`SELECT skill_id,version,error_code,count(*) AS occurrences FROM ss_jobs
        WHERE status='failed' AND error_code IN ('contract_failed','digest_mismatch','resource_limit','timeout','sandbox_unavailable')
        GROUP BY skill_id,version,error_code HAVING count(*)>=2 ORDER BY occurrences DESC,skill_id,version,error_code LIMIT 12`),
      oldest_pending:await first(db,"SELECT min(created_at) AS at FROM ss_jobs WHERE status IN ('queued','running')"),
      expired_leases:(await first(db,"SELECT count(*) AS total FROM ss_jobs WHERE status='running' AND lease_until<=unixepoch()")).total,
      audit:await all(db,'SELECT seq,event,target,at FROM ss_audit ORDER BY seq DESC LIMIT 60')};
  }
  if(area!=='requests')return notFound();
  if(path.length===1 && method==='POST'){
    owner(actor);const b=await readJson(req);fields(b,['skill_id','input','private_prototype_consent']);
    requireThat(b.private_prototype_consent===true,422,'private_consent_required');
    requireThat(reviewed(b.skill_id) && b.input && typeof b.input.idea==='string' && b.input.idea.trim().length>=20,422,'invalid_input');
    const result=await mutation(db,req,'owner/intake',b,env,async()=>{
      const active=await first(db,'SELECT r.manifest,r.digest FROM ss_skills s JOIN ss_releases r ON r.skill_id=s.id AND r.version=s.active_version WHERE s.id=? AND s.enabled=1',b.skill_id);
      if(!active){
        requireThat(matches(manifest(b.skill_id,'','').input_schema,b.input),422,'invalid_input');
        throw new ApiError(409,'inactive_release');
      }
      requireThat(knownDigest(b.skill_id,active.digest),409,'inactive_release');
      requireThat(matches(JSON.parse(active.manifest).input_schema,b.input),422,'invalid_input');
      const rid=id();
      return {statements:[stmt(db,'INSERT INTO ss_requests(id,skill_id,input_cipher,private_consent) VALUES(?,?,?,1)',rid,b.skill_id,
        await seal(env,'input/'+rid,b.input))],response:{request_id:rid}};
    });
    return {...result,request_token:await capability(env,result.request_id)};
  }
  requireThat(typeof item==='string' && /^[0-9a-f-]{36}$/.test(item),404,'not_found');
  scope(actor,item);const r=await first(db,'SELECT id,skill_id,created_at FROM ss_requests WHERE id=?',item);
  requireThat(r,404,'not_found');
  if(path.length===2&&method==='GET')return {...r,runs:await all(db,'SELECT id,version,status,error_code FROM ss_jobs WHERE request_id=? ORDER BY created_at,rowid',item)};
  if(sub!=='runs')return notFound();
  if(path.length===3&&method==='POST'){
    const b=await readJson(req);fields(b,[]);
    return mutation(db,req,'request/'+item+'/build',b,env,async()=>{
      const s=await first(db,`SELECT s.active_version,r.digest,r.manifest FROM ss_skills s JOIN ss_releases r
        ON r.skill_id=s.id AND r.version=s.active_version WHERE s.id=? AND s.enabled=1 AND r.test_status='passed'`,r.skill_id);
      requireThat(s&&knownDigest(r.skill_id,s.digest),409,'inactive_release');
      const privateRow=await first(db,'SELECT input_cipher FROM ss_requests WHERE id=?',item);
      requireThat(matches(JSON.parse(s.manifest).input_schema,await unseal(env,'input/'+item,privateRow.input_cipher)),422,'invalid_input');
      const job=id();return {statements:[stmt(db,"INSERT INTO ss_jobs(id,kind,request_id,skill_id,version,digest) VALUES(?,'build',?,?,?,?)",
        job,item,r.skill_id,s.active_version,s.digest)],response:{id:job,version:s.active_version}};
    });
  }
  if(runId&&path.length===5&&asset==='revoke'&&method==='POST'){
    owner(actor);
    fields(await readJson(req),[]);
    const j=await first(db,'SELECT id FROM ss_jobs WHERE request_id=? AND id=?',item,runId);
    requireThat(j,404,'not_found');
    const v=await first(db,'SELECT job_id FROM ss_artifacts WHERE job_id=?',j.id);
    requireThat(v,404,'not_found');
    return mutation(db,req,'owner/delivery-revoke/'+item+'/'+runId,{},env,async()=>({
      statements:[stmt(db,'UPDATE ss_artifacts SET revoked_at=unixepoch() WHERE job_id=? AND revoked_at IS NULL',j.id)],
      response:{ok:true,revoked:true,run_id:j.id}
    }));
  }
  if(method==='GET'&&runId){
    const j=await first(db,'SELECT id,skill_id,version,status,result,error_code FROM ss_jobs WHERE request_id=? AND id=?',item,runId);
    requireThat(j,404,'not_found');
    if(path.length===4)return {...j,result:j.result?JSON.parse(j.result):null};
    if(path.length===5&&asset==='artifact'){
      requireThat(j.status==='succeeded',409,'artifact_unavailable');
      const v=await first(db,'SELECT cipher,download_expires_at,purge_after,revoked_at FROM ss_artifacts WHERE job_id=?',j.id);
      requireThat(mayDownloadArtifact(v),404,'not_found');
      const files=await unseal(env,'artifact/'+j.id,v.cipher);
      return new Response(zipFiles(files),{headers:{'Content-Type':'application/zip',
        'Content-Disposition':'attachment; filename="mz-project-'+j.id+'.zip"',
        'Cache-Control':'no-store'}});
    }
  }
  return notFound();
}
