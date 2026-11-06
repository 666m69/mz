/* Recalculate the pinned source digest at execution time.
 * A registry label or 64-character string is not proof that the code
 * about to run matches the reviewed adapter.
 */
import {createHash} from 'node:crypto';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import reviewed from '../skills-server/reviewed.json' with {type:'json'};

const root=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;

export function verifyPinnedSource(adapter){
  if(!adapter || typeof adapter!=='object'
    || !/^[a-f0-9]{64}$/.test(adapter.digest||'')
    || !Array.isArray(adapter.sources) || adapter.sources.length===0
    || new Set(adapter.sources).size!==adapter.sources.length
    || !adapter.sources.includes(adapter.entry)||!adapter.sources.includes(adapter.module)){
    throw new Error('invalid_reviewed_adapter');
  }
  const hash=createHash('sha256');
  hash.update('mz-adapter-v1\0'+adapter.entry+'\0'+adapter.module+'\0');
  hash.update(JSON.stringify(stable([adapter.input_schema,adapter.daily_builds]))+'\0');
  for(const name of [...adapter.sources].sort()){
    if(typeof name!=='string'
      || !/^(?:skills-server|pilot)\/[a-zA-Z0-9_./-]+$/.test(name)
      || name.includes('..'))throw new Error('invalid_reviewed_source_path');
    const location=realpathSync(resolve(root,name));
    if(!location.startsWith(root+sep))throw new Error('reviewed_source_outside_repository');
    const digest=createHash('sha256').update(readFileSync(location)).digest();
    hash.update(name+'\0');
    hash.update(digest);
  }
  const actual=hash.digest('hex');
  if(actual!==adapter.digest)throw new Error('reviewed_source_changed');
  return actual;
}

export function verifyReviewedAdapter(skillId,ref){
  if(!Object.hasOwn(reviewed,skillId))throw new Error('unknown_reviewed_skill');
  const adapters=reviewed[skillId]?.adapters;
  if(!adapters || !Object.hasOwn(adapters,ref))throw new Error('unknown_reviewed_adapter');
  return verifyPinnedSource(adapters[ref]);
}
