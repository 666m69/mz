import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../../build/worker.mjs';
import {guideRequest} from '../../site/assets/js/mz-assistant-router.mjs';
import {executeInlineSkill} from '../../site/assets/js/mz-inline-skills.mjs';

const host='https://mz702.pages.dev';
const loaded=async route=>{
  const response=await worker.fetch(new Request(host+route),{});
  assert.equal(response.status,200,route);
  return response.text();
};
test('public pages contain one accessible corner bot and the unchanged approved logo',async()=>{
  for(const route of ['/','/tools/','/projects/','/tools/quote/','/tools/teacher/','/games/code/','/privacy']){
    const html=await loaded(route);
    assert.equal((html.match(/id="mz-assistant-root"/g)||[]).length,1,route);
    assert.match(html,/<button id="mz-bot-trigger"[^>]+aria-expanded="false"/,route);
    assert.match(html,/id="mz-portal-canvas" width="160" height="160"/,route);
    assert.match(html,/class="mz-floating-logo" src="\/assets\/images\/mz-mark\.svg"/,route);
    assert.match(html,/<script type="module" src="\/assets\/js\/mz-floating-assistant\.mjs"><\/script>/,route);
    // Studio pages reuse the existing single CSS bundle; standalone tools load the isolated stylesheet.
    if(['/','/tools/','/projects/'].includes(route)){
      assert.match(html,/<link rel="stylesheet" href="\/assets\/css\/studio-site\.css">/,route);
      assert.doesNotMatch(html,/href="\/assets\/css\/mz-floating-assistant\.css"/,route);
    }else{
      assert.match(html,/<link rel="stylesheet" href="\/assets\/css\/mz-floating-assistant\.css">/,route);
    }
    assert.match(html,/id="mz-chat-window"[^>]* hidden>/,route);
    assert.match(html,/id="mz-chat-ai-consent" type="checkbox"/,route);
    assert.match(html,/id="mz-chat-ai-status"/,route);
    assert.doesNotMatch(html,/تم استلام الكود البرمجي وجاري تنفيذه بنجاح/,route);
  }
});
test('published customer-owned menus and admin do not get injected assistance',async()=>{
  for(const route of ['/tools/menu/view/','/admin/']){
    const response=await worker.fetch(new Request(host+route),{});
    if(response.status!==200)continue;
    const html=await response.text();
    assert.doesNotMatch(html,/id="mz-assistant-root"/,route);
  }
});
test('the script and CSS are served locally under current Worker CSP',async()=>{
  for(const [route,kind] of [
    ['/assets/js/mz-floating-assistant.mjs','javascript'],
    ['/assets/css/mz-floating-assistant.css','css']
  ]){
    const response=await worker.fetch(new Request(host+route),{});
    assert.equal(response.status,200,route);
    assert.match(response.headers.get('Content-Type')||'',new RegExp(kind));
  }
  const script=await loaded('/assets/js/mz-floating-assistant.mjs');
  assert.match(script,/import \{guideRequest\}/);
  assert.match(script,/executeInlineSkill\('teacher-draft-v1'/);
  assert.match(script,/document\.createElement/);
  assert.match(script,/textContent=/);
  assert.match(script,/requestAnimationFrame/);
  assert.match(script,/prefers-reduced-motion/);
  assert.match(script,/data-ready|dataset\.ready/);
  assert.match(script,/sendToReview/);
  assert.doesNotMatch(script,/setTimeout\(\s*\(\)\s*=>\s*\{\s*appendMsg/);
  assert.doesNotMatch(script,/innerHTML\s*=|eval\s*\(|new Function\s*\(/);
  assert.match(script,/fetch\('\/api\/assistant'/);
  assert.match(script,/aiConsent\?\.checked/);
  assert.match(script,/consent:true/);
  assert.doesNotMatch(script,/تم استلام الكود البرمجي وجاري تنفيذه بنجاح/);
  assert.doesNotMatch(script,/متصل ونشط برمجياً/);
});
test('the floating bot routes only real capabilities and truly executes teacher draft',()=>{
  const quote=guideRequest('أبغى عرض سعر للعميل');
  assert.equal(quote.url,'/tools/quote/');
  assert.equal(quote.verified_execution,false);
  const request=guideRequest('أبغى تطبيق جديد لإدارة منشأة');
  assert.equal(request.request_allowed,true);
  assert.equal(request.verified_execution,false);
  const result=executeInlineSkill('teacher-draft-v1',{
    kind:'notice',audience:'parents',grade:'الثالث',
    subject:'واجب القراءة',details:'الرجاء قراءة عشر دقائق',date:'الخميس'
  });
  assert.equal(result.ok,true);
  assert.equal(result.sent,false);
  assert.equal(result.saved,false);
  assert.match(result.text,/واجب القراءة/);
});
test('the right-corner widget avoids mobile bottom dock, keyboard clipping and print output',async()=>{
  const css=await loaded('/assets/css/mz-floating-assistant.css');
  assert.match(css,/#mz-assistant-root\{/);
  assert.match(css,/max-width:650px/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/100dvh/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/@media print/);
  assert.doesNotMatch(css,/(^|\n)\s*(input|button|body)\s*\{/);
});
