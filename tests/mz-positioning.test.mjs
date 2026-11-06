import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const site=new URL('../site/',import.meta.url);
const read=(path)=>readFileSync(new URL(path,site),'utf8');

test('main promise focuses on execution, not claims of a fully automated builder',()=>{
  const html=read('index.html');
  assert.match(html,/<h1 id="studio-title"><span class="mz-main-promise">خلّ التقنية علينا\.<\/span><\/h1>/);
  assert.match(html,/عندك فكرة؟ خلّها تشتغل/);
  assert.match(html,/id="mz-method"/);
  assert.match(html,/الفكرة ثم التجربة ثم الاتفاق ثم التسليم/);
  assert.match(html,/المراجعة الأولية مجانية/);
  assert.match(html,/لا يعني شراكة أو ربطًا آليًا مفعلًا/);
  assert.doesNotMatch(html,/مضمون\s*100%|كل\s*الأفكار\s*آليًا/);
  assert.equal((html.match(/id="mz-method"/g)||[]).length,1);
  for(const href of ['/idea','/tools/','/games/code/','/community/','/#contact'])assert.ok(html.includes('href="'+href+'"'),href);
});
test('approved MZ emblem remains in header, and third-party logos are not co-branded',()=>{
  const html=read('index.html');
  assert.match(html,/<a class="brand" href="\/"[^>]*><img src="\/assets\/images\/mz-mark\.svg"/);
  assert.doesNotMatch(html,/<img[^>]+(?:chatgpt|claude|openai|anthropic)/i);
  const css=read('assets/css/mz-positioning.css');
  assert.match(css,/@media\(max-width:520px\)/);
  assert.match(css,/\.mz-method-grid/);
  assert.match(css,/@media\(max-width:360px\)/);
  assert.match(css,/#mz-bot-trigger,#mz-portal-canvas\{width:50px;height:50px\}/);
});
