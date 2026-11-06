// Capability gate: deterministic and advisory. Never execute visitor text.
const rules = [
  {id:"regulated", re:/تشخيص طبي|وصفة طبية|تداول تلقائي|قرض آلي|medical diagnosis|automated trading/iu, reason:"مجال عالي المخاطر يتطلب مراجعة مختص"},
  {id:"external", re:/واتساب|whatsapp|sms|رسائل نصية|دفع(?:\s+حقيقي)?|مدفوعات|بوابة دفع|payment gateway|خرائط مباشرة|maps api|متجر(?:\s+إلكتروني)?|تجارة إلكترونية|(?:تطبيق|موقع|منصة)\s+(?:تسوق|للتسوق|بيع)|تسوق\s+عبر\s+الإنترنت|سلة\s+شراء|نقاط\s+بيع|pos\b|فواتير|فاتورة|ضريبية|توصيل\s+طلبات|طلبات\s+العملاء|إشعارات|بريد|إيميل|تسعير|انشر|نشر|اشتراك/iu, reason:"يتطلب تكاملاً خارجياً أو وظائف تجارية لا يدعمها القالب المحلي"},
  {id:"native", re:/android|ios|apk|تطبيق جوال أصلي|بلوتوث|bluetooth|كاميرا الجهاز|عداد\s+(?:كهرباء|ماء)|عداد\s+ذكي|مستشعر|مستشعرات|حساسات|حسّاسات|إنترنت\s+الأشياء|\biot\b|أجهزة\s+استشعار/iu, reason:"تطبيق أصلي أو عتاد خارج نطاق البناء الآلي الحالي"},
  {id:"server", re:/قاعدة بيانات|تسجيل دخول|يسجل الدخول|الدخول|سيرفر|الخادم|صلاحيات|مزامنة|تزامن|تتزامن|متزامن|متزامنة|مشترك(?:ة|ين)?|تشاركي|يتشارك|يشاركها|سحابي|حسابات|database|login|authentication|backend|شركة|شركات|مؤسسة|مؤسسات|مقاولات|موظفين|فروع|فريق|للعملاء|العملاء|المستخدمون|مستخدمين|منشآت|عدة أجهزة|أجهزة متعددة|نظام\s+(?:إدارة\s+)?(?:مشتريات|مهام)/iu, reason:"يتطلب بنية خلفية أو مشاركة بيانات أو صلاحيات متعددة"},
  {id:"game", re:/لعبة|لعبه|3d game|multiplayer|متعددة اللاعبين/iu, reason:"تتطلب محرك ألعاب واختبارات أداء"},
];
const safeRe=/سرقة|اختراق|تصيد|phishing|malware|ransomware|سرّب بيانات|تجاوز صلاحيات/i;
export function assessCapability(input) {
 if(typeof input!=="string" || input.trim().length<20 || input.length>5000) throw new TypeError("idea_length_invalid");
 const idea=input.trim();
 const matched=rules.filter(r=>r.re.test(idea));
 const unsafe=safeRe.test(idea);
 const decision=unsafe?"requires_human_review":matched.length?"requires_human_review":"prototype_only";
 return Object.freeze({
  schema_version:1,decision,automated_delivery:false,
  reasons:unsafe?["طلب حساس: لا يُنفذ آلياً ولا تُشغّل تعليمات الزائر"]:matched.map(r=>r.reason),
  capabilities:decision==="prototype_only"?["مواصفات أولية","محاكاة محلية محدودة","تصدير نموذج HTML ثابت"]:["تحليل المتطلبات فقط قبل مراجعة بشرية"],
  missing:["إثبات بناء مشروع فعلي واختباره ونشره ضمن بيئة معزولة","موافقة العميل على النطاق والسعر"],
  price_status:"unverified_estimate_only",
  next_step:unsafe?"security_review":matched.length?"technical_review":"sandbox_prototype_review",
  visitor_text_is_untrusted:true
 });
}
