/* MZ Builder idea engine.
 * Deterministic, no external AI calls, no paid services.
 * User text is NEVER converted into executable code. */
(function (root) {
  "use strict";
  const clean = (value, max = 5000) =>
    String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

  const FEATURE_RULES = [
    { re: /حجز|موعد|مواعيد|appointment|booking/i, name: "الحجوزات والمواعيد" },
    { re: /متجر|تسوّق|تسوق|بيع|شراء|منتج|commerce|shop/i, name: "إدارة المنتجات والطلبات" },
    { re: /دفع|مدفوع|فاتور|سداد|payment|billing/i, name: "المدفوعات والفواتير" },
    { re: /خرائط|موقع جغرافي|توصيل|مندوب|map|location/i, name: "الخرائط والموقع" },
    { re: /تسجيل|مستخدم|عضوية|حسابات|login|auth/i, name: "حسابات المستخدمين والصلاحيات" },
    { re: /ذكاء اصطناعي|AI|تلخيص|توليد|مساعد ذكي|تحليل صورة/i, name: "معالجة ذكية أو تكامل AI" },
    { re: /دردشة|محادث|رسائل|شات|chat/i, name: "الرسائل والمحادثات" },
    { re: /رفع|ملفات|صور|مرفق|upload|media/i, name: "رفع وإدارة الملفات" },
    { re: /تقارير|إحصائ|رسوم بيانية|تحليلات|dashboard|analytics/i, name: "لوحة مؤشرات وتقارير" },
    { re: /إشعار|تنبيه|رسالة نصية|notification|sms/i, name: "الإشعارات والتنبيهات" },
    { re: /بحث|تصفية|فلتر|search/i, name: "البحث والتصفية" },
    { re: /اشتراك|باقات|عضوية مدفوعة|subscription/i, name: "الاشتراكات والباقات" },
    { re: /تقييم|مراجعات|تعليق|rating|review/i, name: "التقييمات والمراجعات" },
    { re: /تعليم|مدرس|دورات|اختبار|تدريب|course/i, name: "المحتوى التعليمي والتقدم" },
    { re: /عقار|سيارات|إعلانات|سوق|منصة عرض|marketplace/i, name: "إدراجات وعروض قابلة للتصفح" },
    { re: /مهام|فريق|مشاريع|جدولة|workflow|task/i, name: "المهام وسير العمل" },
  ];

  function titleFromIdea(text) {
    const input = clean(text, 5000)
      .replace(/^(?:أريد|ابغى|أبغى|أحتاج|ودي|نفسي|نبي|أبي|اريد|فكرتي|اصنع|صمم|سوّي|سوي|ابني|بناء|اعمل)\s+/i, "")
      ;
    const first = input.split(/[،؛.!?\n]/)[0].split(/\s+/).filter(Boolean).slice(0, 7).join(" ");
    return first ? `تصور: ${first}`.slice(0, 75) : "مشروعي الرقمي";
  }

  function ideaFeatures(idea) {
    const value = clean(idea, 5000);
    const result = [];
    for (const rule of FEATURE_RULES) if (rule.re.test(value)) result.push(rule.name);
    const segments = String(idea || "").split(/[\n،؛]/).map(s => clean(s, 155))
      .filter(s => s.length >= 13 && s.length <= 155);
    for (const part of segments) {
      if (result.length >= 7) break;
      if (!result.some(r => part.includes(r) || r.includes(part))) {
        result.push(part);
      }
    }
    if (!result.length) result.push("الوظيفة الأساسية كما وصفها صاحب الفكرة");
    return [...new Set(result)].slice(0, 9);
  }

  function screensForIdea(features) {
    const base = ["البداية والتعريف", "تجربة الميزة الأساسية", "نتائج المستخدم"];
    const list = features.map(f => {
      if (/مدفوع|فاتور/.test(f)) return "الدفع والفواتير";
      if (/حجز|مواعيد/.test(f)) return "إدارة المواعيد";
      if (/منتجات|طلبات/.test(f)) return "المنتجات والطلبات";
      if (/حسابات|المستخدمين/.test(f)) return "حساب المستخدم";
      if (/تقارير|مؤشرات/.test(f)) return "التقارير";
      if (/محادث/.test(f)) return "المحادثات";
      if (/خرائط/.test(f)) return "عرض الخريطة";
      if (/ملفات/.test(f)) return "الملفات";
      return null;
    }).filter(Boolean);
    return [...new Set([...base, ...list])].slice(0, 7);
  }

  function estimate(idea, features, complexity = 2) {
    const complexityValue = Math.max(1, Math.min(5, Number(complexity) || 2));
    const featureCount = Math.max(1, Math.min(15, (features || []).length));
    const heavyCount = (features || []).filter(f => /مدفوع|AI|خرائط|اشتراكات|المحادثات|صلاحيات/.test(f)).length;
    const lower = Math.round((1700 + featureCount * 480 + (complexityValue - 1) * 1250 + heavyCount * 850) / 100) * 100;
    const upper = Math.round((lower * (1.9 + (complexityValue - 1) * 0.12)) / 100) * 100;
    const minWeeks = Math.max(1, Math.ceil((featureCount + complexityValue) / 5));
    const maxWeeks = minWeeks + 2 + Math.ceil(complexityValue / 2);
    return { low: lower, high: upper, weeks: `${minWeeks}–${maxWeeks} أسابيع`, level: complexityValue };
  }

  function buildSpec(rawIdea, options = {}) {
    const idea = clean(rawIdea, 5000);
    if (idea.length < 15) throw new Error("اكتب وصفًا للفكرة من 15 حرفًا على الأقل.");
    const title = clean(options.title || titleFromIdea(idea), 90);
    const features = Array.isArray(options.features) && options.features.length
      ? options.features.map(v => clean(v, 155)).filter(Boolean).slice(0, 15) : ideaFeatures(idea);
    const screens = screensForIdea(features);
    const complexity = Math.max(1, Math.min(5, Number(options.complexity) || 2));
    const quote = estimate(idea, features, complexity);
    const steps = [
      `يبدأ المستخدم من شاشة «${screens[0]}»`,
      `يجرّب الوظيفة الأساسية: ${features[0]}`,
      `يشاهد الناتج ويمكنه طلب تعديل أو متابعة`,
    ];
    return { title, idea, features, screens, steps, complexity, quote };
  }

  function briefMarkdown(spec) {
    const lines = [
      `# ${spec.title}`,
      "", "## وصف الفكرة", spec.idea,
      "", "## الوظائف المقترحة (قابلة للتغيير)",
      ...spec.features.map(f => `- ${f}`),
      "", "## الشاشات المبدئية",
      ...spec.screens.map(s => `- ${s}`),
      "", "## رحلة المستخدم",
      ...spec.steps.map((s,i) => `${i+1}. ${s}`),
      "", "## التسعير",
      `مؤشر غير ملزم: ${spec.quote.low.toLocaleString("en-US")}–${spec.quote.high.toLocaleString("en-US")} ريال سعودي`,
      `مدة أولية غير ملزمة: ${spec.quote.weeks}`,
      "", "## تعليمات لفريق التنفيذ / Codex",
      "- حوّل هذه الفكرة إلى متطلبات قابلة للاختبار، واطرح الأسئلة اللازمة قبل اعتماد نطاق العمل.",
      "- أنشئ مخطط واجهات ثم نموذجًا قابلًا للتجربة، مع اختبارات واعتبارات الأمان والخصوصية.",
      "- لا تستخدم خدمات مدفوعة ولا تنشر المشروع قبل موافقة صاحب المشروع.",
      "- احترم سرية الفكرة وحقوق الملكية؛ إعادة الاستخدام أو العرض تتطلب موافقة مستقلة وصريحة.",
      "", "ملاحظة: هذا تصور آلي قائم على قواعد محلية، وليس توليد تطبيق مكتمل بالذكاء الاصطناعي."
    ];
    return lines.join("\n");
  }

  const api = Object.freeze({ clean, titleFromIdea, ideaFeatures, screensForIdea, estimate, buildSpec, briefMarkdown });
  root.MZBuilderEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
