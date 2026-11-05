/**
 * Reviewed profession-only examples. These are possible needs, not claims about
 * specific people, government integrations or skills running automatically.
 */
const examples=[
  {
    id:'teacher',pattern:/(معلم|معلمه|مدرس|مدرسه|استاذ|تدريس)/,
    role:'التعليم',tasks:'تنسيق رسائل أولياء الأمور، إعداد خطة أسبوعية، وترتيب المتابعة.',
    ids:['teacher'],question:'وش أكثر شغلة تأخذ وقتك في المدرسة؟'
  },
  {
    id:'hotel',pattern:/(فندق|سياح|ضيافه|حجوزات|منسق تسويق|مسوق تنسيقي)/,
    role:'الفنادق والسياحة',tasks:'تجهيز صور العروض، إعداد عروض الأسعار، ومتابعة العملاء. الربط مع أنظمة الفنادق غير متاح تلقائيًا.',
    ids:['images','quote','clients'],question:'هل يستهلك وقتك إعداد العروض، متابعة الشركات، أو عمل آخر؟'
  },
  {
    id:'property',pattern:/(عقار|عقاري|وسيط عقاري|مكتب عقار|سمسار)/,
    role:'القطاع العقاري',tasks:'إعداد إعلانات العقار والصور ومتابعة العملاء، مع مراجعة متطلبات الترخيص بنفسك.',
    ids:['property','images','clients'],question:'وش أكثر مهمة تعيدها كل يوم في المكتب؟'
  },
  {
    id:'food',pattern:/(مطعم|كافيه|مقهي|بوفيه|فود ترك|طباخ|شيف)/,
    role:'المطاعم والمقاهي',tasks:'تجهيز المنيو، حساب تكلفة الوصفات، وإعداد عرض سعر.',
    ids:['menu','recipe','quote'],question:'هل المشكلة في المنيو أو تكاليف الأصناف أو متابعة الشغل؟'
  },
  {
    id:'health',pattern:/(طبيب|طبيبه|ممرض|ممرضه|عياده|مستشفى)/,
    role:'القطاع الصحي الإداري',tasks:'تنظيم مهام إدارية ونماذج عامة بعد مراجعتها، وليس تحليل بيانات المرضى أو تقديم تشخيص.',
    ids:[],question:'هل احتياجك إداري عام؟ لا تكتب أي بيانات مرضى.'
  },
  {
    id:'retiree',pattern:/(متقاعد|متقاعده|تقاعد)/,
    role:'الهوايات والفرص',tasks:'متابعة الزراعة المنزلية واستكشاف المصادر العامة للأخبار والفرص، دون ادعاء تحديث لحظي.',
    ids:['hydro','opportunities'],question:'تبي شي يخص هواياتك، أخبارك، أو مشروع بسيط؟'
  },
  {
    id:'freelance',pattern:/(مستقل|فريلانسر|freelancer|مصمم|مصور)/i,
    role:'العمل الحر',tasks:'إعداد عروض الأسعار، تجهيز صور المنتجات، وتسجيل متابعة العملاء.',
    ids:['quote','images','clients'],question:'وش أكثر شيء يستهلك وقتك بين العملاء والتسعير والتسليم؟'
  }
];
const specificTask=/(رساله|رسالة|منيو|قائمه طعام|قائمة طعام|عرض سعر|تسعير|اعلان عقاري|إعلان عقاري|تحويل ملف|اكسل|وورد|pdf|حساب تكلفه|تكلفة وصفة|برنامج جديد|تطبيق جديد|انشاء موقع)/i;
export function professionDiscovery(raw){
  if(typeof raw!=='string'||!raw.trim()||raw.length>1200)return null;
  const normalized=raw.normalize('NFKC').toLowerCase()
    .replace(/[\u064B-\u065F]/g,'').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
  if(specificTask.test(normalized))return null;
  const sample=examples.find(x=>x.pattern.test(normalized));
  if(!sample)return null;
  return Object.freeze({
    role:sample.role, tasks:sample.tasks,links:[...sample.ids],
    question:sample.question,
    intro:'من المهام الشائعة في '+sample.role+' (مجرد أمثلة قابلة للتعديل): '+sample.tasks+' '+sample.question
  });
}
