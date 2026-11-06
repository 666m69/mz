import {classifySkill} from './intent.mjs';
import {matches,knownDigest} from './catalog.mjs';
import {fields,requireThat,capability,seal,id} from './security.mjs';
import {first,stmt,mutation} from './store.mjs';

export async function assistantRun(req,env,body){
  fields(body,['idea','private_prototype_consent']);
  requireThat(body.private_prototype_consent===true,422,'private_consent_required');
  const idea=body.idea;
  requireThat(typeof idea==='string'&&idea.trim().length>=20&&idea.length<=2000,422,'invalid_input');
  const db=env.SKILLS_DB;
  const result=await mutation(db,req,'owner/assistant-run',body,env,async()=>{
    const skill=classifySkill(idea);
    requireThat(skill!==null,422,'technical_review');
    const release=await first(db,`SELECT r.manifest,r.version,r.digest FROM ss_skills s JOIN ss_releases r
      ON s.id=r.skill_id AND s.active_version=r.version WHERE s.id=? AND s.enabled=1 AND r.test_status='passed'`,skill);
    requireThat(release&&knownDigest(skill,release.digest),409,'inactive_release');
    const input={idea};
    requireThat(matches(JSON.parse(release.manifest).input_schema,input),422,'invalid_input');
    const request=id(), job=id();
    return {statements:[
      stmt(db,'INSERT INTO ss_requests(id,skill_id,input_cipher,private_consent) VALUES(?,?,?,1)',request,skill,await seal(env,'input/'+request,input)),
      stmt(db,"INSERT INTO ss_jobs(id,kind,request_id,skill_id,version,digest) VALUES(?,'build',?,?,?,?)",job,request,skill,release.version,release.digest)
    ],response:{request_id:request,job_id:job,skill_id:skill,version:release.version}};
  });
  return {...result,request_token:await capability(env,result.request_id)};
}
