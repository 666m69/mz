import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import gateway from '../pilot/mzcodehub-public-entry-with-idea-cta.mjs';

const home=new URL('../site/index.html',import.meta.url);
const tools=new URL('../site/tools/index.html',import.meta.url);
const origin='https://mzcodehub.com';

test('generated homepage exposes community without replacing business flow',()=>{
  const html=readFileSync(home,'utf8');
  assert.match(html,/id="mz-community-invite"/);
  assert.match(html,/href="\/community\/"/);
  assert.match(html,/id="playground"/);
  assert.match(html,/href="\/idea"/);
  assert.match(html,/info@mzcodehub.com/);
  assert.doesNotMatch(html,/Vexa702@gmail\.com/i);
});

test('gateway short invitation link redirects to live community',async()=>{
  const response=await gateway.fetch(new Request(origin+'/join'),{});
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),origin+'/community/');
});

test('gateway injects discoverable invitation and no stale email in deployed old home',async t=>{
  const outdated='<!doctype html><html lang="ar"><head><title>MZcode</title></head><body><header><nav><a href="/about/">من نحن</a></nav></header><main><section id="playground"></section><div class="capability-strip"></div><section><a href="mailto:Vexa702@gmail.com">Vexa702@gmail.com</a></section></main></body></html>';
  t.mock.method(globalThis,'fetch',async()=>new Response(outdated,{headers:{'content-type':'text/html'}}));
  const response=await gateway.fetch(new Request(origin+'/'),{});
  const html=await response.text();
  assert.match(html,/id="mz-community-invite"/);
  assert.match(html,/href="\/community\/"/);
  assert.match(html,/info@mzcodehub.com/);
  assert.doesNotMatch(html,/Vexa702@gmail\.com/i);
  assert.equal((html.match(/id="mz-community-invite"/g)||[]).length,1);
  assert.match(response.headers.get('cache-control'),/no-cache/);
});

test('gateway adds navigation on tools without rewriting its title',async t=>{
  const sample='<!doctype html><html><head><title>الأدوات | MZcode</title></head><body><nav><a href="/about/">من نحن</a></nav><main>الأدوات</main></body></html>';
  t.mock.method(globalThis,'fetch',async()=>new Response(sample,{headers:{'content-type':'text/html'}}));
  const response=await gateway.fetch(new Request(origin+'/tools/'),{});
  const html=await response.text();
  assert.match(html,/href="\/community\/"/);
  assert.match(html,/<title>الأدوات \| MZcode<\/title>/);
  assert.doesNotMatch(html,/id="mz-community-invite"/);
  assert.equal(response.status,200);
});
