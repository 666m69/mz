/**
 * MZcode Experience 2.0 — transparent, local tool routing.
 * This is NOT an LLM and must never claim to have executed a link.
 */
export const CAPABILITIES = Object.freeze([
  {id:'teacher',name:'مساعد المعلم',href:'/tools/teacher/',tags:['معلم','معلمة','مدرسة','طلاب','طالبات','أولياء','واجب','درس','خطة علاجية','خطة متابعة','خطاب مدرسي','تعليم']},
  {id:'quote',name:'صانع عروض الأسعار',href:'/tools/quote/',tags:['عرض سعر','عروض أسعار','تسعير','عميل','فاتورة مبدئية','مقايسة']},
  {id:'menu',name:'المنيو الإلكتروني',href:'/tools/menu/',tags:['منيو','قائمة طعام','مطعم','كافيه','بوفيه','قهوة','مقهى']},
  {id:'property',name:'صانع إعلانات العقار',href:'/tools/property/',tags:['عقار','شقة','فيلا','إعلان عقاري','اراضي','أرض للبيع','سمسار']},
  {id:'hydro',name:'دفتر الزراعة المائية',href:'/tools/hydroponics/',tags:['زراعة','نبات','مائي','خزان','مزرعة','مغذيات']},
  {id:'opportunities',name:'دليل الفرص والمجانيات',href:'/tools/opportunities/',tags:['وظيفة','فرصة','اكتتاب','مناقصة','اعتماد','دعم','ألعاب مجانية','سوني','بلايستيشن','علف','اغنام','غنم','اخبار','اليمن']},
  {id:'recipe',name:'حاسبة تكلفة الوصفات',href:'/tools/recipe/',tags:['تكلفة وصفة','وصفة','المكونات','تكلفة حصة','هامش ربح','تكلفة وجبة']},
  {id:'images',name:'تجهيز صور المنتجات',href:'/tools/images/',tags:['صور منتج','مقاس صورة','تعديل صور','شعار صورة','قص صور','resize']},
  {id:'clients',name:'متابعة العملاء',href:'/tools/clients/',tags:['متابعة عملاء','إدارة العملاء','مستحقات','دفعات','مدفوعات','عملائي']},
  {id:'game',name:'ألعاب MZcode',href:'/games/code/',tags:['لعبة','العب','العاب','تحدي','مراحل','برمجة لعبة']},
]);
const normalize=s=>s.normalize('NFKC').toLocaleLowerCase('ar-SA').replace(/[\u064B-\u065F]/g,'').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
const contains=(input,term)=>normalize(input).includes(normalize(term));
const entry=(id)=>CAPABILITIES.find(cap=>cap.id===id);
const action=(title,detail,cap,request=false)=>Object.freeze({
  title,detail,skill_id:cap?.id||null,skill_name:cap?.name||null,
  url:cap?.href||null,verified_execution:false,local_routing:true,
  request_allowed:request,mode:'guided_skills'
});
export function guideRequest(raw){
  if(typeof raw!=='string'||!raw.trim()||raw.length>1200)throw new TypeError('invalid_request');
  const input=normalize(raw);
  if(/اختراق|تصيد|سرقه بيانات|اختراق حساب|كلمه مرور شخص|برمجيات خبيثه/.test(input)){
    return action('الأمان أولًا','ما أساعد في اختراق حسابات أو كشف بيانات أشخاص. أقدر أدلك على خطوات حماية الأنظمة المصرّح لك بها.',null,false);
  }
  if(/(مريض|تشخيص|دواء|علاج|تحاليل طبيه|اعراض|سجلات صحيه)/.test(input)){
    return action('البيانات الصحية لها خصوصية','أقدر أوجّهك لمعلومات عامة، لكن ما أقدّم تشخيصًا أو توصية علاجية، ولا تكتب بيانات مرضى هنا.',null,false);
  }
  if(/(حوّل|تحويل|تحويل صيغ|word|excel|pdf|وورد|اكسل)/.test(input)&&/(ملف|مستند|وورد|اكسل|pdf|word|excel)/.test(input)){
    return action('تحويل الملفات قيد التطوير','ما عندنا حاليًا أداة تحويل ملفات معتمدة أقدر أشغّلها لك. تقدر تسجل احتياجك كطلب جديد، ونراجعه بدون وعد مسبق.',null,true);
  }
  // More specific matches outrank broad profession clues.
  const contextual=[
    ['recipe',/(تكلفه|مكون|هامش)/],
    ['quote',/(عرض سعر|تسعير|عروض اسعار|مقايسه)/],
    ['images',/(صور|صوره).*(منتج|قص|مقاس|شعار)/],
    ['property',/(عقار|فيلا|شقه|اراضي|ارض للبيع)/],
    ['hydro',/(زراع|نبات|مائي|خزان)/],
    ['teacher',/(معلم|معلمه|طلاب|طالبات|مدرسه|اولياء|واجب|خطة متابعة)/],
    ['opportunities',/(اكتتاب|مناقصه|فرص|سوني|بلايستيشن|اغنام|اعلاف|علف|اليمن|اخبار|مجانيات|وظيفه)/],
    ['menu',/(مطعم|كافيه|منيو|مقهي|قائمه طعام)/],
    ['clients',/(عملائي|متابعه عملا|اداره العملاء|مستحقات)/],
    ['game',/(العاب|لعبه|العب|تحدي)/],
  ];
  const target=contextual.find(([id,regexp])=>regexp.test(input))?.[0]||CAPABILITIES.find(c=>c.tags.some(t=>contains(input,t)))?.id;
  if(target){
    const selected=entry(target);
    const notes={
      teacher:'هذه الأداة تجهّز مسودة رسالة أو خطة مدرسية. تراجع النص بنفسك قبل الإرسال.',
      quote:'ابدأ بإضافة بنودك وشعارك وتنزيل عرض PDF. ما فيه شراء إجباري.',
      menu:'افتح منشئ المنيو، أضف الأصناف وجرّب القائمة من المتصفح.',
      property:'صمّم الإعلان داخل الأداة. تحقق من ترخيص الإعلان قبل نشره.',
      hydro:'سجّل قراءات مزرعتك واحسب استهلاكًا تقديريًا للخزان.',
      opportunities:'هذه روابط مصادر وليست أخبارًا مباشرة أو أكواد هدايا مضمونة. تحقق من المصدر.',
      recipe:'تقدر تحسب تكلفة الحصة وسعر بيع مبدئي حسب مدخلاتك.',
      images:'جهّز صور منتجاتك محليًا، ثم نزّل الناتج.',
      clients:'رتّب سجلات العملاء في الأداة المتاحة؛ جرّبها ببيانات غير حساسة أولًا.',
      game:'خذ لك فَرّة على التحديات، مجانية داخل المتصفح.'
    };
    return action('أبشر، عندنا لك أداة تعمل',notes[target],selected,false);
  }
  if(/(ابني|ابن|انشئ|انشاء|اصنع|اسوي|صمم|برنامج|تطبيق|موقع|نظام|بوت|ربط|اتمتة|mcp|chatgpt|claude|gemini)/.test(input)){
    return action('فكرتك تستحق مراجعة','هذا الطلب يحتاج فهم متطلباته قبل ما نعدك بتنفيذه. تقدر ترسله إلى MZcode وتأخذ رقم متابعة بعد الحفظ، بدون دفع مسبق.',null,true);
  }
  return action('ما حصرناك في أفكار معينة','ما لقيت مهارة منفذة تناسب وصفك مباشرة. اكتب تفاصيل أكثر، أو حوّل الكلام إلى طلب نراجعه ونعطيك رقم متابعة بعد حفظه.',null,true);
}
export function featuredChips(){
  return Object.freeze([
    {text:'أنا معلم وأبي رسالة لأولياء الأمور',label:'أنا معلم'},
    {text:'أبغى أصمم عرض سعر لعميل',label:'عرض سعر'},
    {text:'عندي مطعم وأبي منيو',label:'منيو مطعم'},
    {text:'أبي فرص أو ألعاب سوني مجانية',label:'فرص ومجانيات'}
  ]);
}
