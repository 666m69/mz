import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import worker from '../worker/index.mjs';
import {route} from '../worker/routes.mjs';
import {seal} from '../worker/security.mjs';
import {artifactNames} from '../worker/catalog.mjs';
import {mayDownloadArtifact,purgeExpiredArtifacts,DOWNLOAD_WINDOW_SECONDS,PURGE_WINDOW_SECONDS} from '../worker/delivery-policy.mjs';

const now=1_800_000_000;
const rid='5a60595e-479d-49cf-8fb8-285f6ed2924a';
const runId='a5015783-25fa-47ae-9617-4f8abe9a2463';
const key=()=>randomBytes(32).toString('base64url');
function row(overrides={}){return {cipher:'sealed',download_expires_at:now+DOWNLOAD_WINDOW_SECONDS,
 purge_after:now+PURGE_WINDOW_SECONDS,revoked_at:null,...overrides};}
test('download policy allows current, valid artifact and ends at exact expiry',()=>{
 const r=row();
 assert.equal(mayDownloadArtifact(r,now),true);
 assert.equal(mayDownloadArtifact(r,r.download_expires_at-1),true);
 assert.equal(mayDownloadArtifact(r,r.download_expires_at),false);
});
test('revoked, missing timestamps, malformed retention and purged artifacts fail closed',()=>{
 assert.equal(mayDownloadArtifact(null,now),false);
 assert.equal(mayDownloadArtifact(row({revoked_at:now}),now),false);
 assert.equal(mayDownloadArtifact(row({download_expires_at:null}),now),false);
 assert.equal(mayDownloadArtifact(row({purge_after:null}),now),false);
 assert.equal(mayDownloadArtifact(row({purge_after:now+1}),now),false);
 assert.equal(mayDownloadArtifact(row({download_expires_at:1}),now),false);
 assert.equal(mayDownloadArtifact(row({purge_after:now}),now),false);
});
function fakeDb(artifact){
 const sqls=[];
 return {
  sqls,
  prepare(sql){
   const stmt={bind(...args){this.args=args;return this},
    async first(){
      if(sql.includes('FROM ss_requests WHERE id=?'))return {id:rid,skill_id:'local-checklist',created_at:now};
      if(sql.includes('FROM ss_jobs WHERE request_id=? AND id=?'))return {id:runId,skill_id:'local-checklist',version:'1.0.0',status:'succeeded',result:null,error_code:null};
      if(sql.includes('FROM ss_artifacts WHERE job_id=?'))return artifact;
      if(sql.includes('SELECT hash,response FROM ss_ops'))return null;
      throw Error('Unexpected SQL: '+sql);
    },
    async run(){sqls.push({sql,args:this.args});return {meta:{changes:2}};}};
   return stmt;
  },
  async batch(statements){for(const x of statements)sqls.push({sql:x.sql||x.text||'batch',args:x.args});return statements.map(()=>({success:true}));}
 };
}
async function getArtifact(actor,artifact,options={}){
 const env={SKILLS_DB:fakeDb(artifact),DATA_KEY:key(),CAPABILITY_KEY:key()};
 if(artifact && !options.leaveCipher){
   const files=Object.fromEntries(artifactNames.map(n=>[n,'content '+n]));
   artifact.cipher=await seal(env,'artifact/'+runId,files);
 }
 const req=new Request('https://example.com/api/requests/'+rid+'/runs/'+runId+'/artifact');
 return route(req,env,actor,['requests',rid,'runs',runId,'artifact']);
}
test('different client capability cannot reach another request artifact',async()=>{
 await assert.rejects(getArtifact({role:'request',subject:'c602f203-398e-4d19-8355-76f55a20122b'},row()),e=>e.status===404);
});
test('expired or revoked artifacts are denied even with matching capability',async()=>{
 const actor={role:'request',subject:rid};
 await assert.rejects(getArtifact(actor,row({download_expires_at:1}),{leaveCipher:true}),e=>e.status===404);
 await assert.rejects(getArtifact(actor,row({revoked_at:now}),{leaveCipher:true}),e=>e.status===404);
});
test('current matching request capability downloads real ZIP from encrypted D1 row',async()=>{
 const r=await getArtifact({role:'request',subject:rid},row({
  download_expires_at:Math.floor(Date.now()/1000)+3600,
  purge_after:Math.floor(Date.now()/1000)+7200
 }));
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-type'),/application\/zip/);
 assert.equal(r.headers.get('cache-control'),'no-store');
 const bytes=Buffer.from(await r.arrayBuffer());
 assert.equal(bytes.readUInt32LE(0),0x04034b50);
 assert.ok(bytes.length>100);
});
test('unauthorized request bearer cannot revoke a ZIP',async()=>{
 const env={SKILLS_DB:fakeDb(row()),DATA_KEY:key(),CAPABILITY_KEY:key()};
 const req=new Request('https://example.com/api/requests/'+rid+'/runs/'+runId+'/revoke',{method:'POST',
  headers:{'Content-Type':'application/json','Idempotency-Key':'test-key-12345678'},body:'{}'});
 await assert.rejects(route(req,env,{role:'request',subject:rid},['requests',rid,'runs',runId,'revoke']),e=>e.status===403);
});
test('explicit purge calls D1 with bounded retention predicate',async()=>{
 const sqls=[];
 const env={SKILLS_DB:{prepare(sql){sqls.push(sql);return {run:async()=>({meta:{changes:2}})}}}};
 const result=await purgeExpiredArtifacts(env);
 assert.deepEqual(result,{purged:2});
 assert.match(sqls[0],/DELETE FROM ss_artifacts WHERE purge_after IS NOT NULL AND purge_after<=unixepoch\(\)/);
});
test('scheduler is dormant until invoked, and schedules only reviewed purge',async()=>{
 const sqls=[],promises=[];
 const env={SKILLS_DB:{prepare(sql){sqls.push(sql);return {run:async()=>({meta:{changes:1}})}}}};
 await worker.scheduled({},env,{waitUntil:p=>promises.push(p)});
 assert.equal(promises.length,1);
 assert.equal(sqls.length,1);
 assert.deepEqual(await promises[0],{purged:1});
});
