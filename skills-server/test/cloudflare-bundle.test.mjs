import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {adaptQaModuleForCloudflare,adaptQaModulesForCloudflare} from '../qa/cloudflare-bundle.mjs';
const source=await readFile(new URL('../qa/reviewed-edge-builder.mjs',import.meta.url),'utf8');
test('Cloudflare staging import remap changes only the reviewed capability gate path',()=>{
 const mapped=adaptQaModuleForCloudflare('qa/reviewed-edge-builder.mjs',source);
 assert.equal(mapped,source.replace("import {assessCapability} from '../../pilot/capability-gate.mjs';",
  "import {assessCapability} from '../pilot/capability-gate.mjs';"));
 assert.equal(adaptQaModuleForCloudflare('worker/index.mjs','export default {};'),'export default {};');
 assert.deepEqual(adaptQaModulesForCloudflare({'qa/reviewed-edge-builder.mjs':source,'worker/index.mjs':'export default {};'}),
  {'qa/reviewed-edge-builder.mjs':mapped,'worker/index.mjs':'export default {};'});
});
test('Cloudflare staging refuses unknown/broken imports instead of silently deploying',()=>{
 assert.throws(()=>adaptQaModuleForCloudflare('qa/reviewed-edge-builder.mjs',source.replace('../../pilot/','../pilot/')),
  /UNRECOGNIZED_EDGE_BUILDER_IMPORT/);
 assert.throws(()=>adaptQaModuleForCloudflare('qa/reviewed-edge-builder.mjs','console.log("unsafe replacement")'),
  /UNRECOGNIZED_EDGE_BUILDER_IMPORT/);
 assert.throws(()=>adaptQaModulesForCloudflare({'qa/other.mjs':source}),/REVIEWED_EDGE_BUILDER_REQUIRED/);
});
