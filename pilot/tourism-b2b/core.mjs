/**
 * MZcode travel-agency outreach planning — business rules only.
 * No bulk contact, booking claims, tracking pixels or server data writes.
 */
export const MARKETS = Object.freeze([
  {code:'SA',name:'السعودية',group:'الخليج'},
  {code:'AE',name:'الإمارات',group:'الخليج'},
  {code:'KW',name:'الكويت',group:'الخليج'},
  {code:'QA',name:'قطر',group:'الخليج'},
  {code:'BH',name:'البحرين',group:'الخليج'},
  {code:'OM',name:'عُمان',group:'الخليج'},
  {code:'TR',name:'تركيا',group:'تركيا وآسيا الوسطى'},
  {code:'UZ',name:'أوزبكستان',group:'تركيا وآسيا الوسطى'},
  {code:'DE',name:'ألمانيا',group:'أوروبا والأمريكتان'},
  {code:'FR',name:'فرنسا',group:'أوروبا والأمريكتان'},
  {code:'GB',name:'بريطانيا',group:'أوروبا والأمريكتان'},
  {code:'ES',name:'إسبانيا',group:'أوروبا والأمريكتان'},
  {code:'US',name:'الولايات المتحدة',group:'أوروبا والأمريكتان'},
  {code:'ID',name:'إندونيسيا',group:'آسيا'},
]);
export const STAGES=Object.freeze({
  new:'جهة جديدة',research:'بحاجة بحث',contacted:'تم التواصل',responded:'وصل رد',
  proposal:'عرض قيد النقاش',followup:'متابعة مطلوبة',closed:'مغلق',
});
const marketByCode=new Map(MARKETS.map(m=>[m.code,m]));
const ISO=/^\d{4}-\d{2}-\d{2}$/;
export function validDay(value){
  if(typeof value!=='string'||!ISO.test(value))return false;
  const parsed=new Date(value+'T00:00:00Z');
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function daysUntil(date,today){
  if(!validDay(date)||!validDay(today))throw new Error('invalid_day');
  return Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
}
export function publicHolidaysFromApi(payload,countryCode,year){
  if(!marketByCode.has(countryCode)||!Number.isInteger(year)||year<2025||year>2032||!Array.isArray(payload))throw new Error('invalid_holidays');
  return payload.filter(x=>x&&validDay(x.date)&&x.date.slice(0,4)===String(year)
      &&x.countryCode===countryCode&&typeof x.name==='string'&&x.name.trim().length>0)
    .slice(0,250).map(x=>({
      id:`api:${countryCode}:${x.date}:${x.name.slice(0,70)}`,
      date:x.date,country:countryCode,title:x.name.trim().slice(0,120),
      kind:'public_holiday',source:'Nager.Date',sourceUrl:'https://nagerholidays.com/api',
      note:'معلومة عن عطلة عامة؛ لا تُعد دليلًا على موسم حجوزات أو إجازة مدرسية. يجب تأكيد المواعيد المتغيرة.',
      verified:false
    }));
}
function text(value,max=120){
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new Error('invalid_text');
  return value.trim().replace(/[\u0000-\u001f\u007f]/g,' ');
}
function safeOptional(value,max=240){
  if(value==null||value==='')return '';
  return text(value,max);
}
export function makeAgency(record,{id,now=new Date().toISOString().slice(0,10)}={}){
  if(!record||!marketByCode.has(record.country))throw new Error('invalid_country');
  if(!STAGES[record.stage||'new'])throw new Error('invalid_stage');
  if(record.followup&& !validDay(record.followup))throw new Error('invalid_followup');
  if(!validDay(now))throw new Error('invalid_now');
  return Object.freeze({
    id:id||crypto.randomUUID(),name:text(record.name,100),country:record.country,
    stage:record.stage||'new',followup:record.followup||'',
    notes:safeOptional(record.notes,240),
    campaign:safeOptional(record.campaign,120),
    createdOn:now,
    evidence:'يدوي — ليس إثبات حجز أو عمولة'
  });
}
export function makeEvent(record,{id}={}){
  if(!record||!marketByCode.has(record.country)||!validDay(record.date))throw new Error('invalid_event');
  let sourceUrl='';
  if(record.sourceUrl){
    const url=new URL(record.sourceUrl);
    if(url.protocol!=='https:'||url.username||url.password)throw new Error('invalid_source_url');
    sourceUrl=url.href;
  }
  return Object.freeze({
    id:id||crypto.randomUUID(),date:record.date,country:record.country,
    title:text(record.title,120),kind:'manual',source:'أدخله المستخدم (غير متحقق)',
    sourceUrl, note:safeOptional(record.note,240),verified:false
  });
}
export function upcoming(events,{today,days=120,country='all'}){
  if(!validDay(today)||!Number.isInteger(days)||days<1||days>365)throw new Error('invalid_query');
  return events.filter(e=>e&&marketByCode.has(e.country)&&(country==='all'||e.country===country)
    &&validDay(e.date)&&daysUntil(e.date,today)>=0&&daysUntil(e.date,today)<=days)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
}
export function draftMessage({agency,event,hotelLabel='',language='ar'}){
  if(!agency||!event||agency.country!==event.country)throw new Error('country_mismatch');
  const target=text(agency.name,100),holiday=text(event.title,120);
  const hotel=hotelLabel?text(hotelLabel,120):(language==='en'?'our hotel':'الفندق');
  if(!['ar','en'].includes(language))throw new Error('invalid_language');
  if(language==='en')return `Subject: Potential hotel partnership around ${holiday}\n\nDear ${target} team,\n\nWe are exploring potential cooperation with travel agencies serving the ${marketByCode.get(agency.country).name} market around ${holiday} (${event.date}). We would like to discuss whether ${hotel} could be a suitable accommodation partner for your group itineraries.\n\nPlease let us know if you would like to discuss possible arrangements and requirements. Rates and room availability have not been confirmed in this draft.\n\nBest regards,\n[Your authorized hotel sales contact]`;
  return `الموضوع: استكشاف تعاون فندقي خلال ${holiday}\n\nفريق ${target} المحترم،\nالسلام عليكم ورحمة الله وبركاته،\n\nنود استكشاف فرصة تعاون مع شركتكم بخصوص البرامج السياحية المرتبطة بمناسبة ${holiday} بتاريخ ${event.date} في سوق ${marketByCode.get(agency.country).name}. يسعدنا مناقشة إمكانية إدراج ${hotel} ضمن خيارات الإقامة للمجموعات التي تنظمونها.\n\nنرجو إفادتنا إن كان الموضوع مناسبًا للنقاش، علمًا بأن الأسعار وتوفر الغرف لم يتم تأكيدهما في هذه المسودة.\n\nمع التحية،\n[اسم ممثل المبيعات المخوّل]`;
}
function csvCell(value){
  let s=String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ');
  if(/^\s*[=+@\-]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export function agenciesCsv(agencies){
  const head=['اسم الشركة','الدولة','حالة التواصل','تاريخ المتابعة','الحملة','ملاحظات','تنبيه'];
  const rows=agencies.map(a=>[a.name,marketByCode.get(a.country)?.name||a.country,STAGES[a.stage]||a.stage,a.followup,a.campaign,a.notes,a.evidence]);
  return '\ufeff'+[head,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
