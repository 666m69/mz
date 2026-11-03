(() => {
  'use strict';
  const el=id=>document.getElementById(id), count=el('count'), key='mzcode:counter:v1:'+count.dataset.key;
  let value=0;
  try{const saved=Number(localStorage.getItem(key));if(Number.isInteger(saved)&&saved>=0&&saved<=9999)value=saved;}
  catch{el('notice').textContent='الحفظ المحلي غير متاح.';}
  function render(){count.textContent=String(value);el('minus').disabled=value===0;el('plus').disabled=value===9999;}
  function set(n){value=Math.min(9999,Math.max(0,n));render();try{localStorage.setItem(key,String(value));}
    catch{el('notice').textContent='تعذر الحفظ. يعمل العدّاد مؤقتًا.';}}
  el('plus').addEventListener('click',()=>set(value+1));
  el('minus').addEventListener('click',()=>set(value-1));
  el('reset').addEventListener('click',()=>set(0));render();
})();
