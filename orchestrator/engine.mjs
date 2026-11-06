/* MZcode Orchestrator v1 — isolated, consent-free synthetic/local QA only.
 * No network, payment, deployment, shell commands, or visitor-supplied code.
 * A reviewed static-template builder is a REAL app only within its stated scope.
 */
import {readFile,writeFile,rm,mkdtemp} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {buildWebApp,planApp,AppBuildError} from '../pilot/builder/engine.mjs';
import {classifySkill} from '../skills-server/worker/intent.mjs';
import {catalog,artifactNames} from '../skills-server/worker/catalog.mjs';
import {zipFiles} from '../skills-server/worker/zip.mjs';
import {verifyChecklistRuntime} from './runtime-qa.mjs';
import {verifyReviewedAdapter} from './source-integrity.mjs';

const EXPECTED_ADAPTER='checklist-v1';
const MAX_OUTPUT_BYTES=49152;
const sha256=data=>createHash('sha256').update(data).digest('hex');
const readyTools=Object.freeze([
  {id:'reviewed-checklist-builder',permissions:['write:isolated-output']},
  {id:'trusted-runtime-acceptance',permissions:['read:synthetic-artifact']},
  {id:'private-zip-packager',permissions:['write:isolated-output']}
]);

export function planIdea({idea,title}={}){
  if(typeof idea!=='string'||idea.trim().length<20||idea.length>2000){
    return Object.freeze({state:'manual_review',reason:'invalid_idea',automatic_delivery:false});
  }
  const skill=classifySkill(idea);
  if(!skill)return Object.freeze({state:'manual_review',reason:'not_supported_or_requires_review',automatic_delivery:false});
  if(skill!=='local-checklist'){
    return Object.freeze({state:'requires_trusted_linux_runner',skill_id:skill,reason:'no_reviewed_local_dispatch_for_this_skill',automatic_delivery:false});
  }
  const rec=catalog[skill];
  if(!rec||rec.default_adapter!==EXPECTED_ADAPTER||!/^[a-f0-9]{64}$/.test(rec.adapters[EXPECTED_ADAPTER]||'')){
    return Object.freeze({state:'manual_review',reason:'adapter_not_verified',automatic_delivery:false});
  }
  try {
    const blueprint=planApp({idea,title});
    return Object.freeze({
      state:'ready_for_staging',skill_id:skill,adapter_ref:EXPECTED_ADAPTER,adapter_digest:rec.adapters[EXPECTED_ADAPTER],
      app_type:blueprint.category,app_title:blueprint.title,features:blueprint.features,
      tools:readyTools,limits:{max_output_bytes:MAX_OUTPUT_BYTES,network:false,backend:false},
      automatic_delivery:false,production_deployment:false
    });
  }catch(error){
    if(error instanceof AppBuildError)return Object.freeze({state:'manual_review',reason:error.code,automatic_delivery:false});
    throw error;
  }
}

function inspectZip(zip,expected){
  const buf=Buffer.from(zip);let off=0;
  for(const name of artifactNames){
    if(off+30>buf.length||buf.readUInt32LE(off)!==0x04034b50)throw Error('zip_header');
    if(buf.readUInt16LE(off+8)!==0)throw Error('zip_not_store');
    const length=buf.readUInt32LE(off+18),n=buf.readUInt16LE(off+26),e=buf.readUInt16LE(off+28);
    const filename=buf.subarray(off+30,off+30+n).toString('utf8');
    if(filename!==name||n<1||length!==Buffer.byteLength(expected[name]))throw Error('zip_file_contract');
    const begin=off+30+n+e,end=begin+length;
    if(end>buf.length||buf.subarray(begin,end).toString('utf8')!==expected[name])throw Error('zip_content_corrupt');
    off=end;
  }
  if(off+4>buf.length||buf.readUInt32LE(off)!==0x02014b50)throw Error('zip_central_directory');
  if(buf.readUInt32LE(buf.length-22)!==0x06054b50||buf.readUInt16LE(buf.length-14)!==artifactNames.length)throw Error('zip_end_record');
  return {passed:true,files:artifactNames.length};
}

// Only the trusted caller chooses outputRoot. Never forward visitor input here.
export async function executeIdea({idea,title}={}, {outputRoot}={}){
  const plan=planIdea({idea,title});
  if(plan.state!=='ready_for_staging')return {ok:false,state:plan.state,reason:plan.reason,automatic_delivery:false};
  // Must fail before allocating an output directory if an adapter has changed.
  const reviewedDigest=verifyReviewedAdapter(plan.skill_id,plan.adapter_ref);
  if(reviewedDigest!==plan.adapter_digest)throw new Error('reviewed_digest_mismatch');
  const root=outputRoot===undefined?await mkdtemp(join(tmpdir(),'mz-orchestrator-')):resolve(outputRoot);
  let app;
  try{
    app=await buildWebApp({idea,title},{outputRoot:root});
    const files=Object.fromEntries(await Promise.all(artifactNames.map(async name=>[name,await readFile(join(app.directory,name),'utf8')])));
    const bytes=artifactNames.reduce((n,k)=>n+Buffer.byteLength(files[k]),0);
    if(bytes>MAX_OUTPUT_BYTES||bytes===0)throw Error('artifact_limit');
    const html=files['index.html'];
    if(!/dir="rtl"/.test(html)||!/Content-Security-Policy/.test(html)||/<script[^>]*src="https?:/i.test(html))throw Error('html_security_check');
    if(/<script>[^]*?(?:eval\(|new Function)/i.test(files['app.js']))throw Error('unexpected_runtime');
    const spec=JSON.parse(files['blueprint.json']);
    if(spec.category!==plan.app_type||spec.automatedRelease!==false)throw Error('blueprint_mismatch');
    const behavioral=verifyChecklistRuntime(files['app.js'],app.appId);
    const zipped=zipFiles(files);
    const packed=inspectZip(zipped,files);
    const zipName='MZcode-verified-local-app.zip';
    await writeFile(join(app.directory,zipName),zipped,{mode:0o600,flag:'wx'});
    const receipt={
      schema_version:1,id:randomUUID(),state:'staging_verified',
      skill_id:plan.skill_id,adapter:plan.adapter_ref,adapter_digest:reviewedDigest,source_verified:true,
      type:plan.app_type,files:[...artifactNames],artifact_sha256:sha256(zipped),artifact_bytes:zipped.byteLength,
      tests:{behavior:behavioral.checks,zip_contents:packed.files,html_security:true,source_limit:true},
      limits:plan.limits,delivery:'local_private_zip_only',
      customer_deployed:false,automatic_customer_delivery:false,additional_paid_services:false
    };
    await writeFile(join(app.directory,'acceptance.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600,flag:'wx'});
    return {ok:true,state:receipt.state,artifact_path:join(app.directory,zipName),receipt_path:join(app.directory,'acceptance.json'),receipt};
  }catch(e){
    if(app)await rm(app.directory,{recursive:true,force:true}).catch(()=>{});
    throw e;
  }
}
