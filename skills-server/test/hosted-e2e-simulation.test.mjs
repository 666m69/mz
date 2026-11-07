import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {localBinding} from '../dev/local.mjs';
import {runQaPhase,names} from '../qa/hosted-e2e-entry.mjs';

const token=()=>randomBytes(32).toString('base64url');
const sha=x=>createHash('sha256').update(x).digest('hex');
function newFixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=2000');
 const db={...localBinding(sqlite),exec:async sql=>sqlite.exec(sql)};
 const owner=token(),runner=token(),data=token(),capability=token();
 return {sqlite,env:{SKILLS_DB:db,TEST_OWNER_TOKEN:owner,TEST_RUNNER_TOKEN:runner,
  OWNER_TOKEN_SHA256:sha(owner),RUNNER_TOKEN_SHA256:sha(runner),
  DATA_KEY:data,CAPABILITY_KEY:capability}};
}
test('disposable 17-phase acceptance executes real Skills Server API against isolated SQLite',async t=>{
 const {sqlite,env}=newFixture();
 t.after(()=>sqlite.close());
 const reports=[];
 for(const phase of names){
  let result;
  try{result=await runQaPhase(phase,env)}
  catch(e){throw Error('QA phase '+phase+' failed: '+e.message,{cause:e})}
  reports.push({phase,result});
 }
 assert.equal(reports.length,17);
 assert.deepEqual(reports.map(x=>x.phase),names);
 assert.equal(reports.at(-1).result.expiredDeleted,1);
 assert.equal(reports.at(-1).result.liveKept,2);
 assert.equal(reports.find(x=>x.phase==='verify-a')?.result.crossClientDenied,true);
 assert.equal(reports.find(x=>x.phase==='verify-b')?.result.crossClientDenied,true);
 assert.equal(reports.find(x=>x.phase==='revoke-a')?.result.cannotUndo,true);
 assert.equal(reports.find(x=>x.phase==='sql-guard')?.result.nullExpiryRejected,true);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM ss_requests').get().n,2);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM ss_artifacts').get().n,2);
 const exp=sqlite.prepare("SELECT download_expires_at,purge_after FROM ss_artifacts ORDER BY job_id LIMIT 1").get();
 assert.ok(exp.purge_after>exp.download_expires_at);
});
test('private QA phases cannot be repeated or skipped',async t=>{
 const {sqlite,env}=newFixture();
 t.after(()=>sqlite.close());
 await runQaPhase('init',env);
 await assert.rejects(runQaPhase('review',env),/QA_PHASE_OUT_OF_ORDER/);
 await runQaPhase('release',env);
 await assert.rejects(runQaPhase('release',env),/QA_PHASE_OUT_OF_ORDER/);
});
