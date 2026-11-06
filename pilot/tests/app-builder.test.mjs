import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildWebApp, planApp, AppBuildError } from '../builder/engine.mjs';

const idea = 'أريد تطبيق ويب ينظم مهامي اليومية مع إضافة وحذف المهام';

test('creates a complete runnable web app, not a simulation response', async (t) => {
  const root = await mkdtemp(join(tmpdir(),'mz-builder-test-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  const app = await buildWebApp({idea,title:'منظم المهام'}, {outputRoot:root});
  assert.match(app.directory, /mz-app-/);
  assert.equal(app.blueprint.kind,'local-checklist');
  assert.equal(app.blueprint.automatedRelease,false);
  assert.deepEqual((await readdir(app.directory)).sort(), ['app.js','blueprint.json','index.html','styles.css']);
  const html = await readFile(join(app.directory,'index.html'),'utf8');
  const runtime = await readFile(join(app.directory,'app.js'),'utf8');
  assert.match(html,/dir="rtl"/);
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/"title":"منظم المهام"/);
  assert.match(runtime,/localStorage\.setItem/);
  assert.match(runtime,/addEventListener\('submit'/);
  assert.match(runtime,/addEventListener\('change'/);
  assert.match(runtime,/makeButton\('حذف'/);
  assert.doesNotMatch(runtime,/\beval\s*\(|new Function\s*\(/);
});

test('supports shopping list idea as a real checklist', () => {
  const r=planApp({idea:'أريد قائمة مشتريات يومية تساعد الأسرة على متابعة التسوق'});
  assert.equal(r.category,'shopping');
  assert.equal(r.storage,'localStorage on the visitor device only');
});

test('rejects unsupported ideas instead of pretending to build them', () => {
  assert.throws(()=>planApp({idea:'أريد بناء لعبة طيران احترافية على الكمبيوتر'}), (error)=>error instanceof AppBuildError && error.code==='UNSUPPORTED_IDEA');
});

test('requires review for payment, login, WhatsApp and other external requirements', () => {
  for(const risky of ['واتساب','تسجيل دخول','دفع حقيقي','قاعدة بيانات']){
    assert.throws(()=>planApp({idea:`أريد تطبيق مهام يومي مرتبط مع ${risky} لكل العملاء`}), (error)=>error.code==='REVIEW_REQUIRED', risky);
  }
});

test('never executes or writes visitor text into scripts or paths', async (t) => {
  const root=await mkdtemp(join(tmpdir(),'mz-builder-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const attack='أريد قائمة مهام يومية مع <script>alert(1)</script> حقيقية';
  const app=await buildWebApp({idea:attack, title:'قائمتي'}, {outputRoot:root});
  for(const file of ['index.html','app.js','styles.css','blueprint.json']) {
    const content=await readFile(join(app.directory,file),'utf8');
    assert.equal(content.includes('<script>alert(1)</script>'),false, file);
  }
  assert.equal(app.directory.startsWith(root),true);
});

test('validates malformed and overlong inputs', () => {
  for (const input of [null,'قصير','أ'.repeat(2001)]){
    assert.throws(()=>planApp({idea:input}), (e)=>e.code==='INVALID_IDEA');
  }
  assert.throws(()=>planApp({idea,title:'</script><script>alert(1)</script>'}), (e)=>e.code==='INVALID_TITLE');
});

test('each generated app has independent browser storage identity', async (t)=>{
  const root=await mkdtemp(join(tmpdir(),'mz-builder-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const a=await buildWebApp({idea},{outputRoot:root});
  const b=await buildWebApp({idea},{outputRoot:root});
  assert.notEqual(a.appId,b.appId);
  assert.notEqual(a.directory,b.directory);
});
