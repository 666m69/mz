import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildWebApp} from '../../pilot/builder/engine.mjs';
import {buildReviewedEdgeApp} from '../qa/reviewed-edge-builder.mjs';
import {artifactNames} from '../worker/catalog.mjs';
import {verifyRuntime} from '../runner/smoke-v1.mjs';

const inputs=[
 {idea:'أريد تطبيق قائمة مهام يومية شخصية مع إضافة المهام وإكمالها وحفظها محليًا',title:'مهامي في المدينة'},
 {idea:'أريد قائمة مشتريات للبقالة تحفظ المنتجات في المتصفح مع إضافتها وحذفها',title:'مشترياتي اليومية'},
 {idea:'أحتاج قائمة مهام محلية تحفظ بياناتي على هذا الجهاز فقط'},
];
const noId=html=>html.replace(/"id":"[0-9a-f-]{36}"/,'"id":"TEST_UUID"');
test('source-pinned Edge renderer matches the actual reviewed Node builder, four complete files',async t=>{
 const root=await mkdtemp(join(tmpdir(),'mz-edge-parity-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 for(const input of inputs){
  const node=await buildWebApp(input,{outputRoot:root});
  const edge=buildReviewedEdgeApp('local-checklist',input);
  assert.deepEqual(edge.blueprint,node.blueprint);
  for(const name of artifactNames){
    const expected=await readFile(join(node.directory,name),'utf8');
    const actual=edge.files[name];
    assert.equal(name==='index.html'?noId(actual):actual,
      name==='index.html'?noId(expected):expected,
      'source differs for '+name+'; idea='+input.idea);
  }
  verifyRuntime('local-checklist',edge.files);
 }
});
test('Edge builder refuses unreviewed code, backends, unsafe titles and unsupported skills',()=>{
 const rejected=[
  ['local-counter',{idea:inputs[0].idea}],
  ['local-checklist',{idea:'أريد برنامج إدارة شركة مع تسجيل دخول وقاعدة بيانات ومزامنة'}],
  ['local-checklist',{idea:'أريد أن أختـرق جهاز شخص آخر عبر تطبيق مهام محلي'}],
  ['local-checklist',{idea:'أريد قائمة مهام محلية قصيرة',title:'<img onerror=alert(1)>'}],
  ['local-checklist',{idea:'أريد متجرًا للبيع والشراء مع بوابة دفع حقيقي'}],
 ];
 for(const [skill,input] of rejected)assert.throws(()=>buildReviewedEdgeApp(skill,input));
});
