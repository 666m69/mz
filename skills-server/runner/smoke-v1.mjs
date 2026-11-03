// Run only the generated, source-pinned template. The VM simulates a DOM for assertions, not isolation.
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
class Element {
  constructor(){this.children=[];this.listeners={};this.dataset={};this.classList={add(){}};this.value='';this.textContent='';}
  addEventListener(k,fn){this.listeners[k]=fn;}
  fire(k){this.listeners[k]({preventDefault(){}});}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  focus(){}
  setAttribute(){}
}
function mount(files,storage){
  const nodes=new Map();
  const el=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  const config=files['index.html'].match(/id="app-config">([^<]*)</)?.[1];
  if(config)el('app-config').textContent=config;
  else el('count').dataset.key=files['index.html'].match(/data-key="([a-f0-9-]+)"/)[1];
  const document={getElementById:el,createElement:()=>new Element(),querySelectorAll:()=>[]};
  runInNewContext(files['app.js'],{document,localStorage:storage,crypto:{randomUUID},window:{prompt:()=>null}},{timeout:300});
  return el;
}
export function verifyRuntime(kind,files){
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const el=mount(files,storage);
  if(kind==='local-checklist'){
    el('item-input').value='تجربة';el('add-form').fire('submit');
    assert.equal(el('items').children.length,1);
    const row=el('items').children[0];row.children[0].checked=true;row.children[0].fire('change');
    const again=mount(files,storage);assert.equal(again('items').children[0].children[1].textContent,'تجربة');
    assert.equal(again('items').children[0].children[0].checked,true);
  }else if(kind==='local-counter'){
    assert.equal(el('count').textContent,'0');el('plus').fire('click');assert.equal(el('count').textContent,'1');
    const again=mount(files,storage);assert.equal(again('count').textContent,'1');
    again('minus').fire('click');assert.equal(again('count').textContent,'0');
    again('plus').fire('click');again('reset').fire('click');assert.equal(again('count').textContent,'0');
  }else throw new Error('unknown adapter');
}
