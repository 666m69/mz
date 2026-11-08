import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import lab from "../../build/mz-ideas.mjs";
import gateway from "../mzcodehub-public-entry-with-idea-cta.mjs";

const origin = "https://mzcodehub.com";
const publicPage = path => lab.fetch(new Request(origin+path), {});

test("public demo opens with a fixed example, two clear exits and no network form", async () => {
  const response = await publicPage("/idea/demo");
  assert.equal(response.status, 200);
  const html = await response.text();
  const data = JSON.parse(html.match(/<script type="application\/json" id="spec">([^<]+)<\/script>/)[1]);
  assert.equal(data.features.length, 1);
  assert.match(data.features[0].failure, /موعد|المواعيد/);
  assert.match(html, /href="\/idea"/);
  assert.match(html, /href="\/idea#request"/);
  assert.doesNotMatch(html, /<form\b/);
  assert.match(response.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.equal((await publicPage("/idea/demo/")).status, 200);
  assert.equal(await (await lab.fetch(new Request(origin+"/idea/demo",{method:"HEAD"}),{})).text(),"");
});
test("opening the example preserves the lab tab and its draft", async () => {
  const html = await (await publicPage("/idea")).text();
  const link=html.match(/<a\b[^>]*href="\/idea\/demo"[^>]*>/)?.[0];
  assert.ok(link);
  assert.match(link,/target="_blank"/);
  assert.match(link,/rel="noopener"/);
});
test("visual concept and execution inquiry remain separate and no app is delivered by visitor actions", async () => {
  const html=await (await publicPage("/idea")).text();
  const script=readFileSync(new URL("../lab/lab.js",import.meta.url),"utf8");
  assert.match(html,/id="archive-consent" required/);
  assert.match(html,/id="workspace" hidden/);
  assert.match(html,/id="intake"/);
  assert.match(html,/href="#execution"/);
  assert.match(script,/sendIdea\(body,conceptKey\)/);
  assert.match(script,/idea_kind:'concept'/);
  assert.match(script,/idea_kind:'execution'/);
  assert.doesNotMatch(script,/createObjectURL|MZPrototype|downloadFile\(/);
  assert.doesNotMatch(html,/id="prototype"|id="download"/);
});
test("the public homepage links directly to a demo and still offers a blank idea",async t=>{
  t.mock.method(globalThis,"fetch",async()=>new Response('<!doctype html><html><head><title>MZcode</title></head><body><main><section class="intro"><h1>الرئيسية</h1><p>المقدمة</p></section></main></body></html>',{headers:{"content-type":"text/html"}}));
  const html=await (await gateway.fetch(new Request(origin+"/"),{})).text();
  assert.match(html,/href="\/idea\/demo"/);
  assert.match(html,/href="\/idea"/);
});
