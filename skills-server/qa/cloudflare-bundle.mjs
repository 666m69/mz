// Strict, test-only Cloudflare Workers module path adapter.
// The canonical source is executed by Node in skills-server/qa, but the
// disposable Cloudflare QA bundle is rooted at qa/ + pilot/ (not skills-server/qa/).
// Only the one source-reviewed import is remapped; no visitor-provided content.
const moduleName='qa/reviewed-edge-builder.mjs';
const canonical="import {assessCapability} from '../../pilot/capability-gate.mjs';";
const worker="import {assessCapability} from '../pilot/capability-gate.mjs';";

export function adaptQaModuleForCloudflare(name,source){
 if(typeof name!=='string'||typeof source!=='string')throw Error('INVALID_QA_SOURCE');
 if(name!==moduleName)return source;
 if(source.split(canonical).length!==2||source.includes(worker))
  throw Error('UNRECOGNIZED_EDGE_BUILDER_IMPORT');
 return source.replace(canonical,worker);
}
export function adaptQaModulesForCloudflare(modules){
 if(!modules||typeof modules!=='object'||!Object.hasOwn(modules,moduleName))
  throw Error('REVIEWED_EDGE_BUILDER_REQUIRED');
 return Object.fromEntries(Object.entries(modules).map(([name,code])=>
  [name,adaptQaModuleForCloudflare(name,code)]));
}
