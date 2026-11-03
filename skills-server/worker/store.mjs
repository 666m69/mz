import {ApiError,canonical,mac,requireThat} from './security.mjs';
export const stmt=(db,sql,...values)=>values.length?db.prepare(sql).bind(...values):db.prepare(sql);
export const first=(db,sql,...values)=>stmt(db,sql,...values).first();
export const all=async(db,sql,...values)=>(await stmt(db,sql,...values).all()).results;
export function dbError(e) {
  const msg=String(e?.message)+' '+String(e?.cause?.message);
  for(const code of ['daily_limit','capacity_limit','queue_full','request_limit','stale_revision','review_required','invalid_rollback',
    'inactive_release','stale_lease','immutable_release']) {
    if(msg.includes(code))return new ApiError(['daily_limit','capacity_limit','queue_full','request_limit'].includes(code)?429:409,code);
  }
  if(msg.includes('UNIQUE constraint failed'))return new ApiError(409,'already_exists');
  return e;
}
export async function rate(db,actor) {
  const cap=actor.role==='runner'?120:actor.role==='owner'?90:40;
  const r=await first(db,`INSERT INTO ss_rates(actor,minute,used) VALUES(?,unixepoch()/60,1)
    ON CONFLICT(actor) DO UPDATE SET minute=excluded.minute,
    used=CASE WHEN ss_rates.minute=excluded.minute THEN ss_rates.used+1 ELSE 1 END
    WHERE ss_rates.minute!=excluded.minute OR ss_rates.used<? RETURNING used`,actor.subject,cap);
  requireThat(r,429,'rate_limit');
}
export async function mutation(db,req,scope,payload,env,plan) {
  const k=req.headers.get('Idempotency-Key')??'';
  requireThat(/^[A-Za-z0-9_-]{12,80}$/.test(k),400,'idempotency_required');
  // A keyed fingerprint keeps even low-entropy input out of the receipt ledger.
  requireThat(/^[A-Za-z0-9_-]{43}$/.test(env.CAPABILITY_KEY||''),503,'secret_unavailable');
  const h=await mac(env,'receipt/v1\n'+scope+'\n'+canonical(payload));
  const read=async()=>{const r=await first(db,'SELECT hash,response FROM ss_ops WHERE scope=? AND key=?',scope,k);
    if(!r)return null;requireThat(r.hash===h,409,'idempotency_conflict');return JSON.parse(r.response);};
  const old=await read();if(old)return old;
  try {
    const {statements,response}=await plan();
    await db.batch([...statements,stmt(db,'INSERT INTO ss_ops(scope,key,hash,response) VALUES(?,?,?,?)',scope,k,h,JSON.stringify(response))]);
    return response;
  }catch(e){const concurrent=await read();if(concurrent)return concurrent;throw dbError(e);}
}
export async function registry(db) {
  const skills=await all(db,'SELECT * FROM ss_skills ORDER BY id');
  const versions=await all(db,`SELECT r.*,j.status,j.result,j.error_code,j.finished_at FROM ss_releases r
    LEFT JOIN ss_jobs j ON j.kind='test' AND r.skill_id=j.skill_id AND r.version=j.version ORDER BY r.created_at DESC,r.rowid DESC`);
  return skills.map(s=>({...s,enabled:Boolean(s.enabled),versions:versions.filter(v=>v.skill_id===s.id).map(v=>({
    ...JSON.parse(v.manifest),test_status:v.test_status,enabled:Boolean(s.enabled && s.active_version===v.version),
    rollback_version:s.rollback_version,created_at:v.created_at,test:{status:v.status,checks:v.result?JSON.parse(v.result).checks:[],
      error:v.error_code,finished_at:v.finished_at}}))}));
}
