import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {planIdea,executeIdea} from '../engine.mjs';

const good='أريد تطبيق ويب بسيط لقائمة مهام يومية يحتفظ بما أضيفه على جهازي';
const bad=[
  'نظام مشتريات لشركة مقاولات يراجع طلبات الموردين والفروع',
  'أريد تطبيق تسوق للملابس يعرض المنتجات ويستقبل الطلبات',
  'أريد قائمة تسوق مشتركة تتزامن بين أفراد الأسرة',
  'أريد عداد كهرباء ذكي متصل بالعدادات والمستشعرات',
  'تطبيق مهام يسجل الدخول ويحفظ البيانات على السيرفر',
  'أريد قائمة مهام مع دفع حقيقي وتسجيل مستخدمين',
  'أحتاج تطبيقًا لمزامنة قائمة مهام الأسرة على السحابة',
  'أريد إنشاء متجر إلكتروني لبيع منتجاتي عبر الإنترنت',
  'لعبة تفاعلية تستخدم قائمة مشتريات متصلة بالإنترنت'
];

test('orchestrator selects a real reviewed local builder and an explicit test/ZIP chain',()=>{
  const p=planIdea({idea:good,title:'قائمتي اليومية'});
  assert.equal(p.state,'ready_for_staging');
  assert.equal(p.skill_id,'local-checklist');
  assert.equal(p.adapter_ref,'checklist-v1');
  assert.match(p.adapter_digest,/^[0-9a-f]{64}$/);
  assert.deepEqual(p.tools.map(x=>x.id),['reviewed-checklist-builder','trusted-runtime-acceptance','private-zip-packager']);
  assert.equal(p.automatic_delivery,false);
  assert.equal(p.production_deployment,false);
  assert.equal(p.limits.network,false);
});
test('unsupported or synchronized/commercial ideas never enter an auto-build',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'mz-orch-deny-'));
  try {
    for(const idea of bad){
      const result=await executeIdea({idea},{outputRoot:temp});
      assert.equal(result.ok,false,idea);
      assert.notEqual(result.state,'ready_for_staging',idea);
    }
    assert.deepEqual(await readdir(temp),[]);
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('counter requires the separate digest-pinned Linux runner; no invented dispatch',()=>{
  const p=planIdea({idea:'أريد عداد محاولات بسيط يعمل محليًا ويزيد بالضغط على زر'});
  assert.equal(p.state,'requires_trusted_linux_runner');
  assert.equal(p.skill_id,'local-counter');
});
test('malformed or excessive ideas do not create files',()=>{
  for(const idea of [null,'قصير','ا'.repeat(2001)])assert.equal(planIdea({idea}).state,'manual_review');
  assert.equal(planIdea({idea:good,title:'<script>alert(1)</script>'}).state,'manual_review');
});
test('synthetic idea goes from route to runnable local app to tested private ZIP with receipt',async t=>{
  const root=await mkdtemp(join(tmpdir(),'mz-orch-e2e-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const built=await executeIdea({idea:good,title:'قائمتي اليومية'},{outputRoot:root});
  assert.equal(built.ok,true);
  assert.equal(built.state,'staging_verified');
  assert.equal(built.receipt.delivery,'local_private_zip_only');
  assert.equal(built.receipt.customer_deployed,false);
  assert.equal(built.receipt.automatic_customer_delivery,false);
  assert.equal(built.receipt.tests.behavior.length,7);
  assert.equal(built.receipt.tests.zip_contents,4);
  assert.deepEqual(built.receipt.files,['app.js','blueprint.json','index.html','styles.css']);
  const zip=await readFile(built.artifact_path);
  assert.equal(zip.readUInt32LE(0),0x04034b50);
  assert.equal(zip.length,built.receipt.artifact_bytes);
  assert.ok(zip.length>1000);
  assert.ok(!zip.toString('utf8').includes(good),'full private idea must not be embedded');
  const receipt=JSON.parse(await readFile(built.receipt_path,'utf8'));
  assert.equal(receipt.artifact_sha256,built.receipt.artifact_sha256);
});
test('different runs keep different app IDs and private artifact locations',async t=>{
  const root=await mkdtemp(join(tmpdir(),'mz-orch-independent-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const a=await executeIdea({idea:good},{outputRoot:root});
  const b=await executeIdea({idea:good},{outputRoot:root});
  assert.notEqual(a.artifact_path,b.artifact_path);
  assert.notEqual(a.receipt.id,b.receipt.id);
  assert.equal(a.ok,true);
  assert.equal(b.ok,true);
});
