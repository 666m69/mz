/* Trusted-template behavioral acceptance; this VM is a test fixture, NOT an untrusted-code sandbox. */
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';

export function verifyChecklistRuntime(runtime, appId) {
  if(typeof runtime!=='string'||runtime.length>24000)throw Error('unreviewed_runtime');
  class Element {
    constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.classList={add(){}};this.textContent='';this.value='';this.checked=false;this.hidden=false;}
    addEventListener(event,fn){this.listeners[event]=fn;}
    setAttribute(k,v){this.attributes[k]=v;}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=items;}
    focus(){this.focused=true;}
    click(){this.listeners.click?.();}
    change(checked){this.checked=checked;this.listeners.change?.();}
  }
  const store=new Map();
  const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const storageKey=`mzcode:checklist:v1:${appId}`;
  function activate() {
    const elements=new Map(['app-config','add-form','item-input','items','empty','stats','notice'].map(k=>[k,new Element()]));
    elements.get('app-config').textContent=JSON.stringify({id:appId,title:'اختبار MZcode',category:'tasks'});
    const filters=['all','active','done'].map(type=>{const node=new Element('button');node.dataset.filter=type;return node;});
    const document={getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),querySelectorAll:q=>q==='[data-filter]'?filters:[]};
    runInNewContext(runtime,{document,localStorage:storage,crypto:{randomUUID},window:{prompt:()=> 'اسم بعد التعديل'}},{timeout:1200});
    return {elements,filters};
  }
  const first=activate();
  const field=first.elements.get('item-input');
  field.value='عنصر قبول اصطناعي';
  first.elements.get('add-form').listeners.submit({preventDefault(){}});
  let saved=JSON.parse(store.get(storageKey)||'[]');
  if(saved.length!==1||saved[0].title!=='عنصر قبول اصطناعي')throw Error('acceptance_add_persistence');
  first.elements.get('items').children[0].children[0].change(true);
  saved=JSON.parse(store.get(storageKey)||'[]');
  if(!saved[0].done)throw Error('acceptance_completion');
  first.filters[1].click();
  if(first.elements.get('items').children.length!==0)throw Error('acceptance_filter');
  const reloaded=activate();
  if(reloaded.elements.get('items').children.length!==1)throw Error('acceptance_reload');
  const li=reloaded.elements.get('items').children[0];
  li.children[2].children[0].click();
  if(JSON.parse(store.get(storageKey))[0].title!=='اسم بعد التعديل')throw Error('acceptance_edit');
  const current=reloaded.elements.get('items').children[0];
  current.children[2].children[1].click();
  if(JSON.parse(store.get(storageKey)||'[]').length!==0)throw Error('acceptance_delete');
  return Object.freeze({passed:true,checks:['add','persist','complete','filter','reload','edit','delete']});
}
