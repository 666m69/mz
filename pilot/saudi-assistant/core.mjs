/** MZcode Saudi assistant v1 — bounded, deterministic intents, NOT a foundation model. */
const has = (text, re) => re.test(text);
export class AssistantInputError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function interpret(message) {
  if (typeof message !== 'string' || !message.trim() || message.length > 1200) {
    throw new AssistantInputError('invalid_message');
  }
  const text = message.normalize('NFKC').trim();
  const answer = (intent, reply, action = null, skill = null) => Object.freeze({
    intent, reply, action, skill, execution: action ? 'local_only' : 'not_executed',
    assistant_mode: 'guided_v1', sends_to_server: false,
  });
  if (has(text, /اختراق|تصيد|سرقة بيانات|برمجية خبيثة|ransomware|phishing/i)) {
    return answer('safety_review', 'ما أقدر أنفذ طلبًا يضر الآخرين أو بياناتهم. أقدر أساعدك في حماية نظامك واختباره بتصريح واضح.');
  }
  if (has(text, /تشخيص|أعراض|علاج|دواء|مريض|تحاليل|طبيب|مستشفى|medical|diagnosis|patient/i)) {
    return answer('health_review', 'أقدر أساعدك في شرح مصطلحات عامة أو صياغة مستند إداري غير حساس. لا أقدّم تشخيصًا أو توصية علاجية، ولا تُدخل بيانات مرضى في هذه النسخة.');
  }
  if (has(text, /تحويل|حوّل|حول|convert|اكسل|إكسل|excel|word|وورد|pdf|بي دي اف/i) && has(text, /ملف|مستند|وورد|word|excel|اكسل|إكسل|pdf|بي دي اف/i)) {
    return answer('file_conversion', 'فهمت طلب تحويل الملفات. هذه الميزة غير موصولة بعد، لذلك لن أقول إن التحويل تم. حاليًا أقدر أساعدك في تحديد الصيغة المناسبة وخطوات التحويل، دون رفع مستنداتك.');
  }
  if (has(text, /عقار|عقاري|شقة|فيلا|ارض للبيع|أرض للبيع|إعلان عقار|تسويق عقار|real estate/i)) {
    return answer('real_estate', 'أبشر. أقدر أجهّز مسودة إعلان عقاري سعودي من البيانات التي تدخلها، مع توضيح أي معلومات ناقصة. لا أتحقق من صلاحية الترخيص ولا أنشر الإعلان تلقائيًا.', 'property_draft');
  }
  if (has(text, /معلم|معلمة|طلاب|طالبات|مدرسة|أولياء الأمور|ولي أمر|واجب|اختبار|درس|teacher/i)) {
    if (has(text, /رسالة|واتساب|قروب|أولياء|ولي أمر|تنبيه|تذكير|واجب|whatsapp/i)) {
      return answer('teacher_message', 'أقدر أكتب لك رسالة مناسبة لأولياء الأمور أو لقروب المدرسة. اكتب الموضوع والصف، ثم أنشئ لك نصًا قابلًا للنسخ والمراجعة.', 'teacher_draft');
    }
    return answer('education', 'أهلاً بأهل التعليم. في هذه النسخة أقدر أجهز رسالة مدرسية قابلة للنسخ. أما التحاضير والخطط والاختبارات الكاملة فتحتاج مهارات إضافية لم تُفعّل بعد.', 'teacher_draft');
  }
  if (has(text, /مشتريات|بقالة|قائمة تسوق|shopping/i)) {
    return answer('shopping', 'أقدر أفتح لك قائمة مشتريات فعلية: تضيف العناصر وتحدد المكتمل وتحذف ما انتهيت منه. تُحفظ في هذا المتصفح فقط.', 'checklist', 'local-checklist');
  }
  if (has(text, /مهام|مهمات|مهامي|to.do|checklist|قائمة أعمال|قائمة انجاز|قائمة إنجاز/i)) {
    return answer('tasks', 'أقدر أفتح لك منظم مهام حقيقي يعمل داخل الصفحة، مع حفظ محلي على جهازك.', 'checklist', 'local-checklist');
  }
  if (has(text, /اصنع|أنشئ|ابن|ابني|بناء|تطبيق|موقع|لعبة|برنامج|أتمتة|نظام/i)) {
    return answer('app_request', 'فهمت أنك تريد تنفيذ فكرة. محرك MZcode التجريبي يدعم حاليًا تطبيقات محلية محدودة، وليس بناء أي تطبيق تلقائيًا. نحتاج مراجعة المتطلبات والخصوصية والتكلفة قبل الوعد بالتنفيذ.');
  }
  if (has(text, /السلام|هلا|مرحبا|يا هلا|حياك|hello/i)) {
    return answer('greeting', 'حياك الله. أنا مساعد MZcode السعودي في نسخته الأولية. قل لي وش تحتاج تنجز؛ مثل رسالة مدرسية، إعلان عقاري، أو قائمة مهام.');
  }
  return answer('unclassified', 'فهمت طلبك، لكن ما عندي مهارة موثّقة لتنفيذه آليًا في هذه النسخة. تقدر تصفه بمزيد من التفاصيل، ولن أدّعي أني أنجزته دون أداة تعمل.');
}
function clean(value, max = 140) {
  if (typeof value !== 'string') throw new AssistantInputError('invalid_field');
  const out = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!out || out.length > max) throw new AssistantInputError('invalid_field');
  return out;
}
export function teacherDraft(data) {
  const topic = clean(data?.topic, 280);
  const level = clean(data?.level, 80);
  const audience = data?.audience === 'school' ? 'الزملاء والزميلات' : 'أولياء الأمور الكرام';
  return `السلام عليكم ورحمة الله وبركاته\n\n${audience}،\nنود إشعاركم بخصوص الصف ${level}:\n${topic}\n\nشاكرين لكم تعاونكم وتفهمكم.\nمع خالص التقدير.`;
}
export function propertyDraft(data) {
  const type = clean(data?.type, 80), city = clean(data?.city, 80);
  const district = clean(data?.district, 80), area = clean(data?.area, 40);
  const price = clean(data?.price, 60);
  const license = typeof data?.license === 'string' ? data.license.trim() : '';
  if (license.length > 80 || /[\u0000-\u001f]/.test(license)) throw new AssistantInputError('invalid_field');
  const missing = license ? [] : ['رقم ترخيص الإعلان'];
  const body = `لل${type === 'إيجار' ? 'إيجار' : 'بيع'}: ${type === 'إيجار' ? 'عقار' : type} في ${city} – حي ${district}\nالمساحة: ${area} م²\nالسعر: ${price} ريال\nرقم ترخيص الإعلان: ${license || '[يلزم إضافته بعد التحقق]'}\n\nللمزيد من التفاصيل يرجى التواصل مع المعلن.`;
  return { text:body, missing, verified:false, publish_ready:false,
    warning:'مسودة فقط: يجب التحقق من الترخيص ومتطلبات الإعلان لدى الهيئة العامة للعقار قبل النشر، ولم يتم التحقق منها آليًا.' };
}
