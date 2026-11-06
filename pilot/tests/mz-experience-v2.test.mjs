import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {guideRequest,CAPABILITIES,featuredChips} from '../../site/assets/js/mz-assistant-router.mjs';
import worker from '../../build/worker.mjs';

test('10 verified routes target actual site tools and each is unique',()=>{
  assert.equal(CAPABILITIES.length,10);
  const paths=CAPABILITIES.map(c=>c.href);
  assert.equal(new Set(paths).size,paths.length);
  for(const c of CAPABILITIES){
    assert.match(c.href,/^\/(tools|games)\/[a-z-]+\/$/);
    const file='site'+c.href+'index.html';
    assert.ok(fs.existsSync(new URL('../../'+file,import.meta.url)),c.id+' missing file '+file);
  }
});
test('routing is local and never claims execution',()=>{
  const cases=[
    ['أنا معلم وأحتاج رسالة لأولياء الأمور','teacher'],
    ['أبغى عرض سعر لمشروع جديد','quote'],
    ['مطعم يحتاج منيو رقمي','menu'],
    ['إعلان عقاري لشقة','property'],
    ['أنا متقاعد وأبي الزراعة المائية بالبيت','hydro'],
    ['أبي أخبار اليمن','opportunities'],
    ['أبي عرض ألعاب سوني مجانية','opportunities'],
    ['أبغى تكلفة وصفة في المقهى','recipe'],
    ['أبغى تعديل صور منتجاتي','images'],
    ['احتاج متابعة عملائي والدفعات','clients'],
    ['أبي ألعب لعبة','game']
  ];
  for(const [phrase,id] of cases){
    const r=guideRequest(phrase);
    assert.equal(r.skill_id,id,phrase);
    assert.equal(r.local_routing,true);
    assert.equal(r.verified_execution,false);
    assert.ok(r.url);
    assert.equal(r.request_allowed,false);
  }
});
test('unsupported and sensitive requests never hallucinate capabilities',()=>{
  const conversion=guideRequest('أبغى أحول مستند وورد إلى ملف اكسل');
  assert.equal(conversion.url,null);
  assert.equal(conversion.request_allowed,true);
  const app=guideRequest('أبغى أصمم تطبيق iOS متكامل');
  assert.equal(app.url,null);
  assert.equal(app.request_allowed,true);
  const health=guideRequest('أبي تشخيص مريض');
  assert.equal(health.request_allowed,false);
  assert.equal(health.url,null);
  const harm=guideRequest('أبي اختراق حساب شخص');
  assert.equal(harm.url,null);
  assert.equal(harm.request_allowed,false);
  assert.throws(()=>guideRequest(''),/invalid_request/);
  assert.throws(()=>guideRequest('x'.repeat(1201)),/invalid_request/);
});
test('prompts are deterministic; local mode never secretly runs paid AI',()=>{
 assert.equal(featuredChips().length,4);
 const code=fs.readFileSync(new URL('../../site/assets/js/mz-floating-assistant.mjs',import.meta.url),'utf8');
 assert.match(code,/guideRequest\(text\)/);
 assert.doesNotMatch(code,/innerHTML\s*=/);
 assert.match(code,/aiConsent\?\.checked/);
 assert.match(code,/intakeOnHome/);
});
test('homepage renders accepted brand, Saudi hero, honest capabilities and demos',async()=>{
  const result=await worker.fetch(new Request('https://mz702.pages.dev/'),{});
  assert.equal(result.status,200);
  const html=await result.text();
  for(const expected of [
    'ارررحب','خلّ التقنية علينا','عندك فكرة؟ خلّها تشتغل',
    'id="mz-assistant-root"','id="mz-chat-form"','id="mz-chat-input"',
    'id="mz-quick-idea"','id="mz-intake-consent"','id="mz-intake-reference"',
    'id="mz-request"','id="mz-live-demos"','id="slot-book"','data-panel="game"',
    'المراجعة الأولية مجانًا','بدون بطاقة',
    '/assets/images/mz-mark.svg','/assets/js/mz-floating-assistant.mjs'
  ]) assert.ok(html.includes(expected),'missing '+expected);
  const js=await worker.fetch(new Request('https://mz702.pages.dev/assets/js/mz-assistant-ui.mjs'),{});
  assert.equal(js.status,200);
  assert.match(js.headers.get('Content-Type'),/javascript/);
  const css=await worker.fetch(new Request('https://mz702.pages.dev/assets/css/studio-site.css'),{});
  assert.equal(css.status,200);
  assert.match(await css.text(),/\.mz-hero-links/);
});
test('lead form remains explicit and separate from the one floating assistant',async()=>{
 const html=await (await worker.fetch(new Request('https://mz702.pages.dev/'),{})).text();
 for(const id of ['mz-quick-idea','mz-intake-idea','mz-intake-consent','mz-chat-form','mz-chat-input','mz-assistant-root']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 assert.doesNotMatch(html,/id="mz-assistant"/);
 const source=fs.readFileSync(new URL('../../site/assets/js/mz-floating-assistant.mjs',import.meta.url),'utf8');
 assert.match(source,/details.open=true/);
 assert.match(source,/text.value=value/);
 assert.match(source,/intakeOnHome/);
 assert.match(source,/sendToReview/);
});
