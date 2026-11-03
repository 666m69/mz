import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import gateway from '../pilot/mzcodehub-public-entry-with-idea-cta.mjs';

const origin='https://mzcodehub.com';
test('unified share JS and CSS are served on the real public gateway route',async()=>{
  const js=await gateway.fetch(new Request(origin+'/_mz/share.js'),{});
  assert.equal(js.status,200);
  assert.match(js.headers.get('content-type'),/text\/javascript/);
  const source=await js.text();
  new vm.Script(source);
  assert.match(source,/navigator\.share/);
  assert.match(source,/navigator\.clipboard\.writeText/);
  assert.match(source,/MZcode/);
  const css=await gateway.fetch(new Request(origin+'/_mz/share.css'),{});
  assert.equal(css.status,200);
  assert.match(css.headers.get('content-type'),/text\/css/);
  assert.match(await css.text(),/#mz-share-float/);
});
test('universal share message preserves section path but removes tracking parameters',async()=>{
  const js=await(await gateway.fetch(new Request(origin+'/_mz/share.js'),{})).text();
  const win={location:{href:origin+'/tools/quote/?utm_source=whatsapp&access_token=secret'}};
  const document={readyState:'loading',addEventListener(){}};
  const context={window:win,document,navigator:{},URL,setTimeout,clearTimeout};
  vm.runInNewContext(js,context);
  assert.match(win.MZShare.buildMessage(),/mzcodehub.com\/tools\/quote\//);
  assert.doesNotMatch(win.MZShare.buildMessage(),/utm_source|access_token|secret/);
  win.location.href=origin+'/community/?utm_campaign=test';
  assert.equal(win.MZShare.urlForPage(),origin+'/join');
  assert.match(win.MZShare.buildMessage(),/جرّب/);
});
test('public pages receive one shared script tag and preserve their own content',async t=>{
  const html='<html lang="ar"><head><title>MZ</title></head><body><main><h1>صفحة الأداة</h1></main></body></html>';
  t.mock.method(globalThis,'fetch',async()=>new Response(html,{headers:{'content-type':'text/html'}}));
  for(const path of ['/', '/tools/', '/tools/quote/','/games/code/','/about/','/privacy']){
    const r=await gateway.fetch(new Request(origin+path),{});
    const result=await r.text();
    assert.equal((result.match(/data-mz-share-script/g)||[]).length,1,path);
    assert.match(result,/<link rel="stylesheet" href="\/_mz\/share.css"/,path);
    assert.match(result,/صفحة الأداة/,path);
  }
});
test('community and idea lab include the same shared script',()=>{
  for(const path of ['../pilot/community/index.html','../pilot/lab/index.html','../pilot/lab/demo.html']){
    const html=readFileSync(new URL(path,import.meta.url),'utf8');
    assert.match(html,/\/_mz\/share.js/);
    assert.match(html,/\/_mz\/share.css/);
  }
  const communityCss=readFileSync(new URL('../pilot/community/style.css',import.meta.url),'utf8');
  assert.doesNotMatch(communityCss,/left:-9999px/);
  assert.match(communityCss,/clip-path:inset\(50%\)/);
  const css=readFileSync(new URL('../site/assets/css/showcase.css',import.meta.url),'utf8');
  assert.match(css,/@media\(max-width:640px\)\{\.marib-ridge/);
});
