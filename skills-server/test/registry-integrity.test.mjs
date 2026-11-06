import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const root=new URL('../../',import.meta.url);
const reviewed=JSON.parse(readFileSync(new URL('../reviewed.json',import.meta.url),'utf8'));
const stable=(v)=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=(v)=>createHash('sha256').update(v).digest();

function sourceDigest(adapter){
  const {entry,module,sources,input_schema,daily_builds}=adapter;
  if(!sources.includes(entry)||!sources.includes(module))throw Error('unlisted entrypoint');
  const hash=createHash('sha256');
  hash.update('mz-adapter-v1\0'+entry+'\0'+module+'\0');
  hash.update(JSON.stringify(stable([input_schema,daily_builds]))+'\0');
  for(const path of [...sources].sort()){
    if(!/^(?:skills-server|pilot)\/[a-zA-Z0-9_./-]+$/.test(path)||path.includes('..'))throw Error('unsafe catalog source');
    hash.update(path+'\0');
    hash.update(digest(readFileSync(new URL('../../'+path,import.meta.url))));
  }
  return hash.digest('hex');
}

test('reviewed adapter source fingerprints must match pinned digest (fail closed)',()=>{
  for(const [id,skill] of Object.entries(reviewed)){
    for(const [ref,adapter] of Object.entries(skill.adapters)){
      assert.equal(sourceDigest(adapter),adapter.digest, id+'/'+ref+': sources changed without versioned release');
    }
  }
});
