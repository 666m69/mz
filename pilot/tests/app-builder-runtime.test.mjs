import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { buildWebApp } from '../builder/engine.mjs';

function environment(source, storage, id, prompt = () => null) {
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag;
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.listeners = {};
      this.classList = { add: () => {} };
      this.textContent = '';
      this.value = '';
      this.checked = false;
      this.hidden = false;
    }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    focus() { this.focused = true; }
    click() { this.listeners.click?.(); }
    change(checked) { this.checked=checked; this.listeners.change?.(); }
  }
  const elements = new Map(['app-config','add-form','item-input','items','empty','stats','notice']
    .map((name) => [name, new Element()]));
  elements.get('app-config').textContent = JSON.stringify({ id, title:'منظم مهامي', category:'tasks' });
  const filters = ['all','active','done'].map((type) => {
    const button = new Element('button'); button.dataset.filter=type; return button;
  });
  const document = {
    getElementById: (name) => elements.get(name),
    createElement: (type) => new Element(type),
    querySelectorAll: (selector) => selector === '[data-filter]' ? filters : []
  };
  runInNewContext(source, { document, localStorage: storage, window: { prompt }, crypto: { randomUUID } }, {timeout:1000});
  return { elements, filters };
}

test('generated application runtime executes add/edit/complete/filter/reload/delete', async (t) => {
  const root=await mkdtemp(join(tmpdir(),'mz-runtime-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const app=await buildWebApp({idea:'أريد تطبيق لترتيب مهامي اليومية وحفظ القائمة'},{outputRoot:root});
  const script=await readFile(join(app.directory,'app.js'),'utf8');
  const values = new Map();
  const storage = { getItem: (k)=>values.get(k) ?? null, setItem: (k,v)=>values.set(k,v) };
  const initial=environment(script,storage,app.appId,()=> 'مهمة بعد التعديل');
  const form=initial.elements.get('add-form');
  initial.elements.get('item-input').value='مهمة الاختبار';
  form.listeners.submit({preventDefault() {}});
  assert.equal(initial.elements.get('items').children.length,1);
  const key=`mzcode:checklist:v1:${app.appId}`;
  assert.equal(JSON.parse(storage.getItem(key))[0].title,'مهمة الاختبار');
  initial.elements.get('items').children[0].children[0].change(true);
  assert.equal(JSON.parse(storage.getItem(key))[0].done,true);
  initial.filters[1].click();
  assert.equal(initial.elements.get('items').children.length,0);
  initial.filters[2].click();
  assert.equal(initial.elements.get('items').children.length,1);
  initial.elements.get('items').children[0].children[2].children[0].click();
  assert.equal(JSON.parse(storage.getItem(key))[0].title,'مهمة بعد التعديل');
  const reloaded=environment(script,storage,app.appId);
  assert.equal(reloaded.elements.get('items').children.length,1);
  assert.equal(reloaded.elements.get('items').children[0].children[1].textContent,'مهمة بعد التعديل');
  reloaded.elements.get('items').children[0].children[2].children[1].click();
  assert.equal(JSON.parse(storage.getItem(key)).length,0);
  assert.equal(reloaded.elements.get('items').children.length,0);
});

test('generated runtime renders visitor text as text nodes, never HTML', async (t)=>{
  const root=await mkdtemp(join(tmpdir(),'mz-runtime-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const app=await buildWebApp({idea:'أريد تطبيق لتنظيم قائمة مهام يومية للعائلة'},{outputRoot:root});
  const script=await readFile(join(app.directory,'app.js'),'utf8');
  const storage={getItem:()=>null,setItem:()=>{}};
  const ui=environment(script,storage,app.appId);
  ui.elements.get('item-input').value='<img src=x onerror=alert(1)>';
  ui.elements.get('add-form').listeners.submit({preventDefault(){}});
  const item=ui.elements.get('items').children[0];
  assert.equal(item.children[1].tagName,'span');
  assert.equal(item.children[1].textContent,'<img src=x onerror=alert(1)>');
  assert.equal(item.children.length,3);
});
