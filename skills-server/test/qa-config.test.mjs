import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('scoped Wrangler QA config is explicitly private and cannot target production',()=>{
  const source=readFileSync(new URL('../wrangler.qa.jsonc',import.meta.url),'utf8');
  const config=JSON.parse(source.replace(/(^|\s)\/\/[^\n]*/g,''));
  assert.equal(config.name,'mzcode-skills-qa-20261104');
  assert.equal(config.workers_dev,false);
  assert.equal(config.preview_urls,false);
  assert.equal(config.main,'worker/index.mjs');
  assert.equal(config.d1_databases.length,1);
  assert.equal(config.d1_databases[0].binding,'SKILLS_DB');
  assert.equal(config.d1_databases[0].database_name,'mzcode-skills-qa-20261104');
  assert.equal(config.d1_databases[0].database_id,'5821d775-fa0c-4f7e-a20b-8dab1d0bd50e');
  assert.equal(config.routes,undefined);
  assert.equal(config.route,undefined);
  assert.equal(config.triggers,undefined);
  assert.ok(!source.includes('3c64b8bc-bd82-449e-b556-a7fc745ddaba'),'must not contain production ideas D1');
});
test('owner interface explains waiting, quota and runner failure, and does not represent failures as successful deliveries',()=>{
 const ui=readFileSync(new URL('../admin/admin.js',import.meta.url),'utf8');
 for(const [code,label] of Object.entries({
  queue_full:'قائمة التشغيل ممتلئة.',
  daily_limit:'اكتملت حصة اليوم.',
  capacity_limit:'بلغ السجل سقف هذه التجربة.',
  lease_exhausted:'انتهت مهلة المشغّل.'
 })){
  assert.ok(ui.includes(code+":'"+label+"'"),code+' must have meaningful Arabic feedback');
 }
 assert.match(ui,/r\.status==='failed'\?label\(r\.error_code\):'بانتظار اكتمال البناء\.'/);
 assert.match(ui,/if\(r\.status!=='succeeded'\)/);
});
