/** Curated source destinations, NOT live deals or government integrations. */
export const SOURCES=Object.freeze([
  {id:'playstation',category:'games',title:'ألعاب PlayStation المجانية',hint:'افتح قائمة Free to Play في المتجر السعودي، ثم تحقق من شروط كل لعبة والحساب.',publisher:'متجر PlayStation السعودي',url:'https://store.playstation.com/en-sa/category/30749d2c-738f-4c36-9d6b-7ed517cca9ee/1/'},
  {id:'monshaat',category:'business',title:'برامج الدعم للمنشآت',hint:'استعرض البرامج حسب نشاطك ومرحلة منشأتك. الأهلية ومواعيد التقديم تحددها الجهة.',publisher:'منشآت',url:'https://www.monshaat.gov.sa/ar/catalyst-listing'},
  {id:'etimad',category:'business',title:'منافسات ومشتريات حكومية',hint:'ابحث في المنافسات المنشورة. بعض الإجراءات تتطلب تسجيلًا ومتطلبات إضافية.',publisher:'منصة اعتماد',url:'https://tenders.etimad.sa/'},
  {id:'ipo',category:'finance',title:'الاكتتابات القادمة',hint:'الصفحة الرسمية للاكتتابات. لا نقدم توصية بالشراء أو ضمان فرصة متاحة.',publisher:'تداول السعودية',url:'https://www.saudiexchange.sa/wps/portal/saudiexchange/listing/ipos?locale=ar'},
  {id:'yemen',category:'news',title:'متابعة أخبار اليمن',hint:'صفحة أخبار مخصصة لليمن. اقرأ تاريخ الخبر ومصادره؛ MZcode لا ينشر أخبارًا مباشرة هنا.',publisher:'الجزيرة نت',url:'https://www.aljazeera.net/where/mideast/arab/yemen'},
  {id:'sheep',category:'local',title:'إعلانات الأغنام',hint:'بحث مباشر في حراج؛ اختر مدينتك وتحقق من المعلن والسعر بنفسك.',publisher:'حراج (موقع خارجي مستقل)',url:'https://haraj.com.sa/search/%D8%A3%D8%BA%D9%86%D8%A7%D9%85/'},
  {id:'feed',category:'local',title:'بحث عن الأعلاف',hint:'عروض أعلاف منشورة في حراج؛ لا نسحب بيانات الإعلان أو نضمن جودته.',publisher:'حراج (موقع خارجي مستقل)',url:'https://haraj.com.sa/search/%D8%A8%D9%8A%D8%B9%20%D8%A7%D8%B9%D9%84%D8%A7%D9%81/'}
]);
const cats=new Set(['all','games','business','finance','news','local']);
export function filterSources(category='all',query=''){
  if(!cats.has(category))throw new Error('invalid_category');
  const q=String(query).trim().toLocaleLowerCase('ar-SA').slice(0,80);
  return SOURCES.filter(s=>(category==='all'||s.category===category)
    &&(!q||[s.title,s.hint,s.publisher].some(x=>x.toLocaleLowerCase('ar-SA').includes(q))));
}
export function toggleSaved(current,id){
  if(!SOURCES.some(s=>s.id===id))throw new Error('unknown_source');
  const existing=Array.isArray(current)?current.filter(x=>SOURCES.some(s=>s.id===x)):[];
  return existing.includes(id)?existing.filter(x=>x!==id):[...existing,id];
}
