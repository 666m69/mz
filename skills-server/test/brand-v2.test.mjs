import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {build as checklist,fixture as checklistFixture} from '../runner/checklist-branded-v2.mjs';
import {build as counter,fixture as counterFixture} from '../runner/counter-branded-v2.mjs';
import {catalog,manifest} from '../worker/catalog.mjs';

const root=new URL('../../',import.meta.url);
const reviewed=JSON.parse(await readFile(new URL('../reviewed.json',import.meta.url),'utf8'));
const originalSVG=await readFile(new URL('../../site/assets/images/mz-mark.svg',import.meta.url),'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest();
const sortable=value=>Array.isArray(value)?value.map(sortable):value&&typeof value==='object'?
  Object.fromEntries(Object.keys(value).sort().map(k=>[k,sortable(value[k])])):value;

async function actualDigest(adapter){
  const h=createHash('sha256');
  h.update('mz-adapter-v1\u0000'+adapter.entry+'\u0000'+adapter.module+'\u0000');
  h.update(JSON.stringify(sortable([adapter.input_schema,adapter.daily_builds]))+'\u0000');
  for(const name of [...adapter.sources].sort()){
    h.update(name+'\u0000');
    h.update(sha(await readFile(new URL(name,root))));
  }
  return h.digest('hex');
}
test('v1 adapters remain immutable, default and rollback-ready',async()=>{
  assert.equal(reviewed['local-checklist'].default_adapter,'checklist-v1');
  assert.equal(reviewed['local-counter'].default_adapter,'counter-v1');
  for(const [name,ref,known] of [
    ['local-checklist','checklist-v1','28b489b8a2c38438ccac2d14407a351720c0077a7982b6204cdc6755feb7d091'],
    ['local-counter','counter-v1','1627e39b660e0f4d08e6e8d9c758c0a281fab66e407ed76594d7b78e0a9f210c']
  ]){
    const adapter=reviewed[name].adapters[ref];
    assert.equal(adapter.digest,known);
    assert.equal(await actualDigest(adapter),known);
  }
});
test('new branded versions use pinned reviewed digests and explicit activation',async()=>{
  for(const [name,ref] of [['local-checklist','checklist-branded-v2'],['local-counter','counter-branded-v2']]){
    const adapter=reviewed[name].adapters[ref];
    assert.ok(adapter.sources.includes('site/assets/images/mz-mark.svg'));
    assert.equal(await actualDigest(adapter),adapter.digest);
    assert.equal(catalog[name].default_adapter.endsWith('v1'),true);
    const spec=manifest(name,'2.0.0','تجربة معتمدة',ref);
    assert.equal(spec.adapter_digest,adapter.digest);
    assert.equal(spec.adapter_ref,ref);
  }
});
for(const [kind,build,fixture] of [
  ['قوائم المهام والمشتريات',checklist,checklistFixture],
  ['العدّاد',counter,counterFixture]
]){
  test(kind+' exports an offline, visibly MZ-branded, independent 4-file app',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'mz-brand-v2-'));
    try{
      const product=await build(fixture,dir);
      const names=(await readdir(product)).sort();
      assert.deepEqual(names,['app.js','blueprint.json','index.html','styles.css']);
      const contents=await Promise.all(names.map(n=>readFile(join(product,n),'utf8')));
      const files=Object.fromEntries(names.map((n,i)=>[n,contents[i]]));
      assert.ok(files['index.html'].includes(originalSVG),'original SVG must be embedded unchanged');
      assert.match(files['index.html'],/data-mz-builder-brand="2"/);
      assert.match(files['index.html'],/صُنع بواسطة MZcode/);
      assert.match(files['styles.css'],/\.mz-builder-emblem svg/);
      assert.match(files['index.html'],/connect-src 'none'/);
      assert.ok(contents.reduce((sum,item)=>sum+Buffer.byteLength(item),0)<49152);
      assert.doesNotMatch(files['index.html'],/https?:\/\//);
      assert.ok(files['app.js'].length>200,'non-placeholder working application');
    }finally{await rm(dir,{recursive:true,force:true});}
  });
}
test('new v2 builders reject unreviewed and network-enabled visitor ideas',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'mz-brand-denied-'));
  try{
    await assert.rejects(checklist({idea:'أريد واتساب مع دفع إلكتروني تلقائي وإرسال رسائل إلى العملاء'},dir));
    await assert.rejects(counter({idea:'أريد نظامًا يرسل رسائل واتساب ويعالج مدفوعات العملاء'},dir));
  }finally{await rm(dir,{recursive:true,force:true});}
});
