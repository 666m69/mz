import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import gateway from "../pilot/mzcodehub-public-entry-with-idea-cta.mjs";
const site=new URL("../site/",import.meta.url);
const read=path=>readFileSync(new URL(path,site),"utf8");
test("the shipped homepage offers four usable activities and full-product links",()=>{
  const h=read("index.html");
  for(const key of ["book","quote","game","social"])assert.match(h,new RegExp('data-mode="'+key+'"'));
  for(const path of ["/idea","/idea/demo","/tools/quote/","/games/code/"])assert.ok(h.includes('href="'+path+'"'));
  assert.match(h,/type="module" src="\/assets\/js\/home-lab.js"/);
  assert.match(h,/id="quick-contact"/);
});
test("the gateway preserves the new playground and does not add the old sales block",async t=>{
  const h=read("index.html");
  t.mock.method(globalThis,"fetch",async()=>new Response(h,{headers:{"content-type":"text/html"}}));
  const page=await(await gateway.fetch(new Request("https://mzcodehub.com/"),{})).text();
  assert.equal(page.match(/id="playground"/g)?.length,1);
  assert.doesNotMatch(page,/id="mzcode-project-cta"/);
});
test("the small MZ mark is vector geometry with no glyph or external asset dependency",()=>{
 const s=read("assets/images/mz-mark.svg");assert.match(s,/viewBox="0 0 64 64"/);assert.doesNotMatch(s,/<text\b|<image\b/);assert.match(s,/path/);
});

test("studio games, quotes, content plans and booking run locally and remain independent when switching",async()=>{
 const {runInNewContext}=await import("node:vm");
 const {quoteTotal}=await import("../site/assets/js/tool-core.js");
 const {startPuzzle,stepPuzzle}=await import("../site/assets/js/puzzle-core.js");
 function element(dataset={}) {return {dataset,value:"",children:[],events:{},focus(){this.focused=true},select(){this.selected=true},setAttribute(k,v){this[k]=v},appendChild(x){this.children.push(x)},addEventListener(k,fn){this.events[k]=fn;}}}
 const modes=["book","quote","game","social"].map(mode=>element({mode})),panels=["book","quote","game","social"].map(panel=>element({panel})),directions=["left","up","down","right"].map(move=>element({move}));
 const refs=new Map(),get=id=>{if(!refs.has(id))refs.set(id,element());return refs.get(id)};
 const root={dataset:{},querySelector:get,querySelectorAll:s=>({"[data-mode]":modes,"[data-panel]":panels,"[data-move]":directions}[s])};
 const context={document:{getElementById:()=>root,createElement:()=>element()},Intl,quoteTotal,startPuzzle,stepPuzzle,location:{hash:"#try-quote"},window:{addEventListener(){}},history:{replaceState(){}}};
 runInNewContext(read("assets/js/home-lab.js").replace(/^import .+;$/gm,""),context);
 assert.equal(panels[1].hidden,false);assert.equal(panels[0].hidden,true);
 get("#qty-plus").onclick();assert.equal(get("#mini-amount").textContent,"240");get("#qty-minus").onclick();assert.equal(get("#mini-amount").textContent,"120");assert.equal(get("#qty-minus").disabled,true);
 modes[0].events.click();get("#slot-book").onclick();assert.equal(get("#slot-count").textContent,"00");get("#slot-book").onclick();assert.match(get("#slot-status").textContent,/لم يُسجَّل/);
 modes[2].events.click();assert.equal(panels[2].hidden,false);directions[3].onclick();directions[1].onclick();directions[3].onclick();assert.match(get("#game-status").textContent,/اكتمل/);
 get("#game-reset").onclick();directions[0].onclick();assert.match(get("#game-status").textContent,/خرجت/);
 modes[3].events.click();assert.equal(panels[3].hidden,false);
 get("#content-create").onclick();assert.match(get("#content-status").textContent,/موضوع/);
 get("#content-topic").value="افتتاح مقهى";get("#content-create").onclick();assert.match(get("#content-output").value,/افتتاح مقهى/);
 const edited="خطة اختارها الزائر";get("#content-output").value=edited;await get("#content-copy").onclick();assert.ok(get("#content-output").selected);
 modes[0].events.click();assert.equal(get("#slot-count").textContent,"00");get("#slot-reset").onclick();assert.equal(get("#slot-count").textContent,"01");
});
