import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const html = read('pilot/lab/index.html');
const script = read('pilot/lab/lab.js');
const styles = read('pilot/lab/lab.css');
const worker = read('pilot/mz-ideas-worker.js');

test('the idea → interactive preview → request journey is complete', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const id of ['design', 'idea', 'apply', 'live-preview', 'preview-heading',
    'preview-subtitle', 'preview-actions', 'preview-status', 'preview-reset',
    'preview-request', 'trial', 'estimate', 'handoff', 'request', 'intake',
    'brief', 'email', 'consent', 'send', 'receipt']) {
    assert.ok(ids.has(id), 'Missing element: ' + id);
  }
  assert.equal([...html.matchAll(/id="estimate"/g)].length, 1);
  assert.match(script, /function renderPreview\(\)/);
  assert.match(script, /renderHistory\(\);renderRule\(\);renderPreview\(\)/);
  assert.match(script, /field\("preview-request"\)\.onclick=\(\)=>field\("handoff"\)\.click\(\)/);
  assert.match(script, /field\("request"\)\.scrollIntoView/);
});

test('preview treats customer ideas as text and supports mobile screens', () => {
  assert.match(script, /field\("preview-heading"\)\.textContent=spec\.title/);
  assert.match(script, /field\("preview-subtitle"\)\.textContent=spec\.idea/);
  assert.match(script, /heading\.textContent=feature/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
  assert.match(styles, /\.preview-actions\{display:grid/);
  assert.match(styles, /@media\(max-width:590px\)/);
});

test('estimations are nonbinding and have a duration', () => {
  assert.match(script, /تقدير آلي غير ملزم/);
  assert.match(script, /spec\.quote\.weeks/);
  assert.match(script, /ليست عرض سعر معتمدًا/);
  const sandbox = {};
  runInNewContext(read('pilot/lab/engine.js'), sandbox, {timeout: 1000});
  const engine = sandbox.MZBuilderEngine;
  const spec = engine.buildSpec('أريد خدمة جديدة تساعد أصحاب المبادرات على متابعة كل أفكارهم بمرونة.', {
    title: 'تصور جديد', features: ['ميزة مبتكرة مختلفة تمامًا']
  });
  assert.equal(spec.features[0], 'ميزة مبتكرة مختلفة تمامًا');
  assert.ok(spec.quote.low > 0);
  assert.ok(spec.quote.high >= spec.quote.low);
  assert.match(spec.quote.weeks, /أسابيع/);
});

test('intake requires consent and confirms a persisted request', () => {
  assert.match(html, /type="checkbox" id="consent" required/);
  assert.match(script, /fetch\("\/api\/ideas",\{method:"POST"/);
  assert.match(script, /data\.ok!==true/);
  assert.match(script, /رقم المتابعة/);
  assert.match(worker, /if\(data\.consent!=="yes"\)/);
  assert.match(worker, /INSERT INTO idea_requests/);
  assert.match(worker, /ON CONFLICT\(id\) DO NOTHING/);
  assert.match(worker, /origin!==url\.origin/);
});


test('customer tracking accepts an unguessable ID and returns only the status', async () => {
  const code=worker.replace('export default', 'const exported =')+'\nexport {exported};';
  const mod=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));
  const id='12345678-1234-4234-8234-123456789abc';
  let queried=null;
  const env={DB:{prepare(sql){queried=sql;return {bind(value){assert.equal(value,id);return {async first(){return {status:'reviewing',email:'private@example.invalid',idea:'private'};}}}}}}};
  const ok=await mod.exported.fetch(new Request('https://mzcodehub.com/api/ideas/'+id),env);
  assert.equal(ok.status,200);
  assert.deepEqual(await ok.json(),{ok:true,id,status:'reviewing'});
  assert.equal(queried,'SELECT status FROM idea_requests WHERE id=?');
  const invalid=await mod.exported.fetch(new Request('https://mzcodehub.com/api/ideas/not-a-uuid'),env);
  assert.equal(invalid.status,400);
  const missing=await mod.exported.fetch(new Request('https://mzcodehub.com/api/ideas/'+id),{DB:{prepare(){return {bind(){return {async first(){return null;}}}}}}});
  assert.equal(missing.status,404);
  const forbidden=await mod.exported.fetch(new Request('https://mzcodehub.com/api/ideas/'+id,{method:'POST'}),env);
  assert.equal(forbidden.status,405);
});
test('tracking UX has an accessible, private status form and no user content HTML injection', () => {
  for (const id of ['track','track-form','tracking-id','tracking-result','track-submit']) assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(script,/fetch\("\/api\/ideas\/"\+encodeURIComponent\(id\)/);
  assert.match(script,/trackingLabels/);
  assert.match(html,/id="tracking-result"[^>]*role="status"/);
  assert.doesNotMatch(script,/\.innerHTML\s*=/);
});
