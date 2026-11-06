/* Synthetic browser acceptance for a generated static checklist.
 * Only copied into a Cloudflare Pages PREVIEW branch, never main or production.
 * It runs in real Chromium against app.js and browser localStorage.
 */
(()=>{
  'use strict';
  const signal=(state,error='')=>{
    document.documentElement.dataset.mzBrowserQa=state;
    if(error)document.documentElement.dataset.mzBrowserError=String(error).slice(0,150);
  };
  const assert=(value,label)=>{if(!value)throw new Error(label);};
  const phase='mzcode:synthetic-browser-qa:phase';
  try{
    const form=document.getElementById('add-form');
    const input=document.getElementById('item-input');
    const list=document.getElementById('items');
    const config=JSON.parse(document.getElementById('app-config').textContent);
    const key='mzcode:checklist:v1:'+config.id;
    assert(form&&input&&list,'missing_generated_app');
    if(sessionStorage.getItem(phase)!=='reload'){
      assert(list.children.length===0,'not_fresh');
      input.value='عنصر اختبار اصطناعي';
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      assert(list.children.length===1,'add_failed');
      assert(JSON.parse(localStorage.getItem(key))[0].title==='عنصر اختبار اصطناعي','persist_failed');
      const check=list.querySelector('input[type=checkbox]');
      check.checked=true;check.dispatchEvent(new Event('change',{bubbles:true}));
      assert(JSON.parse(localStorage.getItem(key))[0].done===true,'toggle_failed');
      const active=document.querySelector('[data-filter=active]');
      assert(active,'filter_not_found');active.click();
      assert(list.children.length===0,'filter_failed');
      sessionStorage.setItem(phase,'reload');
      location.reload();
      return;
    }
    assert(list.children.length===1,'reload_persistence_failed');
    assert(list.querySelector('input[type=checkbox]').checked===true,'reload_completion_lost');
    const originalPrompt=window.prompt;
    window.prompt=()=> 'عنصر معدل بعد إعادة التحميل';
    list.querySelector('button.quiet').click();
    window.prompt=originalPrompt;
    assert(JSON.parse(localStorage.getItem(key))[0].title==='عنصر معدل بعد إعادة التحميل','edit_failed');
    list.querySelector('button.danger').click();
    assert(JSON.parse(localStorage.getItem(key)).length===0,'delete_failed');
    assert(list.children.length===0,'ui_delete_failed');
    sessionStorage.removeItem(phase);
    signal('pass');
  }catch(error){signal('fail',error?.message);}
})();
