import {knownDigest,checks,artifactNames,matches} from './catalog.mjs';
import {requireThat,fields,id,seal,unseal,size,hash,canonical} from './security.mjs';
import {first,stmt,mutation} from './store.mjs';
export async function claim(env) {
  const db=env.SKILLS_DB, lease=id();
  // The UPDATE and its conditions execute together on D1. Never issue more than one live lease.
  const result=await db.batch([stmt(db,`UPDATE ss_jobs SET status='failed',error_code='lease_exhausted',
    lease=NULL,lease_until=NULL,finished_at=unixepoch() WHERE status='running' AND lease_until<=unixepoch() AND attempts>=2`),
    stmt(db,`UPDATE ss_jobs SET status='running',attempts=attempts+1,lease=?,lease_until=unixepoch()+30
      WHERE id=(SELECT id FROM ss_jobs WHERE status='queued' OR (status='running' AND lease_until<=unixepoch() AND attempts<2)
      ORDER BY created_at,rowid LIMIT 1) AND NOT EXISTS(SELECT 1 FROM ss_jobs WHERE status='running' AND lease_until>unixepoch())
      RETURNING id,kind,request_id,skill_id,version,digest,lease,lease_until`,lease)]);
  const job=result[1].results[0];if(!job)return {job:null};
  if(job.kind==='build'){
    const r=await first(db,'SELECT input_cipher FROM ss_requests WHERE id=?',job.request_id);
    job.input=await unseal(env,'input/'+job.request_id,r.input_cipher);
  }
  return {job};
}
const failureCodes=['unsupported_idea','technical_review','invalid_input','sandbox_unavailable','build_failed',
  'contract_failed','timeout','digest_mismatch','resource_limit'];
export async function complete(env,req,jobId,body) {
  const db=env.SKILLS_DB;
  fields(body,['lease','ok','error','checks','files'],['lease','ok']);
  requireThat(typeof body.ok==='boolean' && /^[0-9a-f-]{36}$/.test(body.lease),422,'invalid_result');
  return mutation(db,req,'finish/'+jobId+'/'+body.lease,body,env,async()=>{
    const job=await first(db,'SELECT j.*,r.manifest FROM ss_jobs j JOIN ss_releases r ON r.skill_id=j.skill_id AND r.version=j.version WHERE j.id=?',jobId);
    requireThat(job && job.status==='running' && job.lease===body.lease,409,'stale_lease');
    const statements=[];let error=null,result=null;
    if(!body.ok){fields(body,['lease','ok','error']);requireThat(failureCodes.includes(body.error),422,'invalid_result');error=body.error;}
    else{
      requireThat(knownDigest(job.skill_id,job.digest),409,'review_required');
      if(job.kind==='test'){
        fields(body,['lease','ok','checks']);
        requireThat(Array.isArray(body.checks)&&canonical(body.checks)===canonical(checks),422,'invalid_checks');
        result={checks};
      }else{
        fields(body,['lease','ok','files']);
        fields(body.files,artifactNames);
        requireThat(artifactNames.every(name=>typeof body.files[name]==='string' && size(body.files[name])>0),422,'invalid_artifact');
        const bytes=artifactNames.reduce((n,k)=>n+size(body.files[k]),0);
        result={files:artifactNames.length,bytes,sha256:await hash(canonical(body.files))};
        requireThat(matches(JSON.parse(job.manifest).output_schema,result),422,'invalid_artifact');
        statements.push(stmt(db,'INSERT INTO ss_artifacts(job_id,cipher) VALUES(?,?)',jobId,await seal(env,'artifact/'+jobId,body.files)));
      }
    }
    statements.unshift(stmt(db,'INSERT INTO ss_finishes(job_id,lease,status,result,error_code) VALUES(?,?,?,?,?)',
      jobId,body.lease,body.ok?'succeeded':'failed',result?JSON.stringify(result):null,error));
    return {statements,response:{id:jobId,status:body.ok?'succeeded':'failed',result,error}};
  });
}
