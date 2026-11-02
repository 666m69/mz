import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../build/worker.mjs';
import { initialState, advance } from '../site/assets/js/baad-preview.js';

const read = (path) => readFileSync(new URL('../site/'+path,import.meta.url),'utf8');

test('homepage and projects gallery feature three distinct real project names and truthful states',()=>{
  for(const html of [read('index.html'),read('projects/index.html')]) {
    for(const name of ['كفو | KAFU AI','فورمة | Formah','بعد مأرب'])assert.ok(html.includes(name),name);
    assert.match(html,/نسخة تجريبية/);
    assert.match(html,/تجربة لعب مصغّرة/);
    assert.ok(html.includes('href="/games/baad-marib/"'));
  }
});
test('public gallery and preview respond with cacheable HTML, privacy controls retained',async()=>{
  for(const path of ['/projects/','/games/baad-marib/']) {
    const r=await worker.fetch(new Request('https://mz702.pages.dev'+path),{});
    assert.equal(r.status,200,path);
    assert.match(r.headers.get('Content-Security-Policy'),/script-src 'self'/);
  }
  const redirect=await worker.fetch(new Request('https://mz702.pages.dev/projects'),{});
  assert.equal(redirect.status,302);
});
test('After Marib teaser is deterministic, discloses limits and uses no backend',()=>{
  const page=read('games/baad-marib/index.html');
  assert.match(page,/ليست نسخة اللعبة الجماعية الكاملة/);
  assert.deepEqual(initialState,{turn:1,water:5,food:5,scouts:0});
  const first=advance(initialState,'scout');
  assert.deepEqual(first,{turn:2,water:3,food:3,scouts:1});
  assert.equal(advance(first,'water').water,6);
  assert.equal(advance({...first,turn:5},'food').turn,5);
  assert.equal(advance({...first,water:0},'scout').turn,2);
  assert.equal(initialState.scouts,0);
});
