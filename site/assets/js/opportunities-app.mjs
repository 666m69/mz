import {SOURCES,filterSources,toggleSaved} from './opportunities-core.mjs';
const $=id=>document.getElementById(id),key='mzcode:source-favorites:v1';
let selected='all',favorites=[];
try{
 const data=JSON.parse(localStorage.getItem(key)||'[]');
 if(Array.isArray(data))favorites=data.filter(x=>SOURCES.some(s=>s.id===x));
}catch{}
function save(){try{localStorage.setItem(key,JSON.stringify(favorites));}catch{$('status').textContent='المفضلة تعمل مؤقتًا؛ التخزين المحلي غير متاح.';}}
function render(){
 const cards=$('sources');cards.replaceChildren();
 let sourceList=filterSources(selected,$('search').value);
 if($('saved-filter').value==='saved')sourceList=sourceList.filter(x=>favorites.includes(x.id));
 $('status').textContent='عدد المصادر المعروضة: '+sourceList.length+'. افحص حالة كل فرصة في موقع المصدر.';
 if(!sourceList.length){const p=document.createElement('p');p.textContent='ما لقينا مصدر مطابق. غيّر البحث أو التصفية.';cards.append(p);return;}
 for(const source of sourceList){
  const article=document.createElement('article');article.className='source-card';
  const badge=document.createElement('span');badge.className='badge';badge.textContent='رابط مصدر · ليس عرضًا مؤكدًا';
  const h=document.createElement('h3');h.textContent=source.title;
  const desc=document.createElement('p');desc.textContent=source.hint;
  const publisher=document.createElement('span');publisher.className='badge';publisher.textContent='الجهة: '+source.publisher;
  const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='افتح المصدر الأصلي ↗';
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=favorites.includes(source.id)?'إزالة من مفضلتي':'احفظ في مفضلتي';
  button.addEventListener('click',()=>{favorites=toggleSaved(favorites,source.id);save();render();});
  article.append(badge,h,desc,publisher,link,button);cards.append(article);
 }
}
document.querySelectorAll('[data-category]').forEach(button=>{
 button.addEventListener('click',()=>{
   selected=button.dataset.category;
   document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   render();
 });
});
$('search').addEventListener('input',render);
$('saved-filter').addEventListener('change',render);
render();
