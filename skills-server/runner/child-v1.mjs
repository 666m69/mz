import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {verifyRuntime} from './smoke-v1.mjs';
let payload='';for await(const part of process.stdin)payload+=part;
const job=JSON.parse(payload);
const [adapterPath,out,skill]=process.argv.slice(2); // Supervisor supplies staged paths, never the visitor.
const {build,fixture}=await import(pathToFileURL(resolve(adapterPath)).href);
const checks=['schema','negative_input','standalone_files','runtime_mutation','runtime_persistence'];
try{
  if(job.kind==='test'){
    assert.equal(typeof fixture.idea,'string');
    await assert.rejects(build({idea:'قصير'},out));
    await assert.rejects(build({idea:'أريد واتساب وربطه بنظام دفع حقيقي على الخادم'},out));
    await assert.rejects(build({idea:'أريد برنامج أرشفة ونشر مقالات علمية محلية'},out));
  }
  const target=await build(job.kind==='test'?fixture:job.input,out);
  const names=['app.js','blueprint.json','index.html','styles.css'],files={};
  for(const n of names)files[n]=await readFile(join(target,n),'utf8');
  assert.match(files['index.html'],/dir="rtl"/);
  assert.match(files['index.html'],/connect-src 'none'/);
  assert.ok(names.every(k=>files[k].length>0));
  assert.ok(names.reduce((sum,k)=>sum+Buffer.byteLength(files[k]),0)<=49152);
  verifyRuntime(skill,files);
  process.stdout.write(JSON.stringify(job.kind==='test'?{ok:true,checks}:{ok:true,files}));
}catch(e){
  const codes={REVIEW_REQUIRED:'technical_review',UNSUPPORTED_IDEA:'unsupported_idea',INVALID_TITLE:'invalid_input',INVALID_IDEA:'invalid_input'};
  process.stdout.write(JSON.stringify({ok:false,error:codes[e.code]??'contract_failed'}));
}
