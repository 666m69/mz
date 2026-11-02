import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const hub=readFileSync(new URL('../site/tools/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../site/assets/css/vision.css',import.meta.url),'utf8');
test('modern theme is loaded on both visitor pages',()=>{
 for(const html of [page,hub])assert.match(html,/href="\/assets\/css\/vision.css"/);
 assert.match(css,/\.product-visual/);
 assert.match(css,/@media\(max-width:720px\)/);
});
test('home retains every working trial and displays product previews',()=>{
 for(const id of ['book','quote','game','social'])assert.match(page,new RegExp('data-panel="'+id+'"'));
 for(const id of ['menu','clients','quote','property','recipe','images','code','caravan'])assert.match(page,new RegExp('class="product-visual visual-'+id+'"'));
 for(const href of ['/idea','/tools/menu/','/tools/quote/','/games/code/','/games/caravan/'])assert.ok(page.includes('href="'+href+'"'),href);
});
test('catalog preview visual markup does not block accessible links',()=>{
 assert.match(hub,/aria-hidden="true"><div class="mock-phone"/);
 assert.match(hub,/class="product-copy"/);
 assert.match(hub,/aria-label="التنقل الرئيسي"/);
 assert.match(page,/id="quick-contact"/);
});