import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {executeInlineSkill,INLINE_SKILLS} from '../../site/assets/js/mz-inline-skills.mjs';
import {guideRequest} from '../../site/assets/js/mz-assistant-router.mjs';
import worker from '../../build/worker.mjs';

test('first reviewed skill really generates a school draft inside the browser',()=>{
  assert.equal(INLINE_SKILLS['teacher-draft-v1'].enabled,true);
  assert.equal(INLINE_SKILLS['teacher-draft-v1'].execution,'browser_local');
  const input={kind:'notice',audience:'parents',grade:'الرابع الابتدائي',
    subject:'متابعة القراءة',details:'الرجاء متابعة عشر دقائق يوميًا',date:'الخميس'};
  const result=executeInlineSkill('teacher-draft-v1',input);
  assert.equal(result.ok,true);
  assert.equal(result.skill_id,'teacher-draft-v1');
  assert.match(result.text,/متابعة القراءة/);
  assert.match(result.text,/الخميس/);
  assert.equal(result.filename,'mzcode-teacher-message.txt');
  assert.equal(result.sent,false);
  assert.equal(result.saved,false);
  const weekly=executeInlineSkill('teacher-draft-v1',{...input,kind:'plan'});
  assert.match(weekly.text,/اليوم الخامس/);
  assert.equal(weekly.filename,'mzcode-teacher-weekly-plan.txt');
});
test('inline execution refuses unknown skills, fields and missing inputs',()=>{
  const payload={kind:'notice',audience:'parents',grade:'ثالث',
    subject:'مشروع',details:'هدف الأسبوع'};
  assert.throws(()=>executeInlineSkill('shell',payload),/skill_unavailable/);
  assert.throws(()=>executeInlineSkill('teacher-draft-v1',{...payload,command:'curl bad.test'}),/invalid_input/);
  assert.throws(()=>executeInlineSkill('teacher-draft-v1',{...payload,grade:''}),/invalid_field/);
  assert.throws(()=>executeInlineSkill('teacher-draft-v1',null),/invalid_input/);
});
test('the only visible assistant keeps reviewed teacher skill, no hidden automatic execution',async()=>{
 assert.equal(guideRequest('أنا معلم وأحتاج رسالة لأولياء الأمور').skill_id,'teacher');
 const code=fs.readFileSync(new URL('../../site/assets/js/mz-floating-assistant.mjs',import.meta.url),'utf8');
 assert.match(code,/executeInlineSkill\('teacher-draft-v1'/);
 assert.match(code,/teacherForm\(bubble\)/);
 assert.match(code,/String\.fromCharCode\(0xFEFF\)/);
 assert.doesNotMatch(code,/innerHTML\s*=/);
 assert.match(code,/aiConsent\?\.checked/);
 for(const pathname of ['/assets/js/mz-inline-skills.mjs','/assets/js/mz-floating-assistant.mjs']){
  const response=await worker.fetch(new Request('https://mz702.pages.dev'+pathname),{});
  assert.equal(response.status,200,pathname);
  assert.match(response.headers.get('Content-Type'),/javascript/);
 }
 const homepage=await (await worker.fetch(new Request('https://mz702.pages.dev/'),{})).text();
 assert.doesNotMatch(homepage,/id="mz-bot-form"/);
 assert.match(homepage,/id="mz-chat-form"/);
});
test('every MZcode-owned standalone tool/game displays the unchanged approved MZ emblem, not just favicon',async()=>{
  const main=new URL('../../site/',import.meta.url);
  const routes=[];
  for(const group of ['tools','games']){
    const root=new URL(group+'/',main);
    for(const entry of fs.readdirSync(root,{withFileTypes:true})){
      if(!entry.isDirectory())continue;
      if(fs.existsSync(new URL(group+'/'+entry.name+'/index.html',main)))routes.push('/'+group+'/'+entry.name+'/');
    }
  }
  routes.push('/coreresto/');
  assert.ok(routes.length>=12,'all current standalone tools/games should be checked');
  for(const path of routes){
    const res=await worker.fetch(new Request('https://mz702.pages.dev'+path),{});
    assert.equal(res.status,200,path);
    const html=await res.text();
    assert.match(html,/<img\b[^>]*\bsrc=["']\/assets\/images\/mz-mark\.svg["']/i,path+' lacks visible original logo');
    assert.match(html,/<a[^>]+href="\/"/i,path+' missing way home');
  }
  for(const path of ['/','/tools/','/projects/']){
    const res=await worker.fetch(new Request('https://mz702.pages.dev'+path),{});
    assert.equal(res.status,200,path);
    assert.match(await res.text(),/<img\b[^>]*\bsrc=["']\/assets\/images\/mz-mark\.svg["']/i,path);
  }
  const logo=await worker.fetch(new Request('https://mz702.pages.dev/assets/images/mz-mark.svg'),{});
  assert.equal(logo.status,200);
  assert.match(await logo.text(),/<svg/);
});
test('the signature uses only a same-origin image, local stylesheet and link to MZcode',async()=>{
  const res=await worker.fetch(new Request('https://mz702.pages.dev/tools/quote/'),{});
  assert.equal(res.status,200);
  const html=await res.text();
  assert.match(html,/mz-made-by/);
  assert.match(html,/صُنع بواسطة MZcode/);
  assert.match(html,/href="\/assets\/css\/mz-project-signature\.css"/);
  const css=await worker.fetch(new Request('https://mz702.pages.dev/assets/css/mz-project-signature.css'),{});
  assert.equal(css.status,200);
  assert.match(css.headers.get('Content-Type'),/text\/css/);
});
