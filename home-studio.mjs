const booking = `<div class="demo-stage" data-panel="book">
  <div class="stage-meta"><span>آخر موعد</span><span dir="ltr">01 / 04</span></div>
  <div class="ticket-line"><strong class="instrument" id="slot-count" dir="ltr">01</strong><span>موعد متاح<br>لجولة في المدينة</span></div>
  <div class="activity-controls" data-controls><button type="button" class="try-button" id="slot-book">احجز الموعد</button><button type="button" class="plain-button" id="slot-reset">إعادة ضبط</button></div>
  <p role="status" id="slot-status" class="result">بيانات تجريبية</p>
  <a class="deep-link" href="/idea/demo">افتح تجربة الحجز <span aria-hidden="true">↗</span></a></div>`;
const quoting = `<div class="demo-stage" data-panel="quote" hidden>
  <div class="stage-meta"><span>تسعير فوري</span><span dir="ltr">02 / 04</span></div>
  <div class="ticket-line"><strong class="instrument" id="mini-amount" dir="ltr">120</strong><span>ريال<br>إجمالي العرض</span></div>
  <div class="activity-controls" data-controls><button type="button" class="step" id="qty-plus" aria-label="زيادة الكمية">+</button><span id="qty-label">الكمية ١</span><button type="button" class="step" id="qty-minus" aria-label="خفض الكمية" disabled>−</button></div>
  <p role="status" id="qty-status" class="result">سعر الوحدة التجريبي ١٢٠ ر.س</p>
  <a class="deep-link" href="/tools/quote/">أنشئ عرضك بصيغة PDF <span aria-hidden="true">↗</span></a></div>`;
const gaming = `<div class="demo-stage" data-panel="game" hidden>
  <div class="stage-meta"><span>تحدّي المبرمج</span><span dir="ltr">03 / 04</span></div>
  <div class="trial-field"><div class="mini-board" dir="ltr" id="mini-board" aria-label="لوحة التحدي"></div><p>التقط البطارية<br>وصِل إلى العلم.</p></div>
  <div class="activity-controls directions" data-controls><div class="direction-keys" dir="ltr">
    <button class="step" data-move="left" aria-label="يسار">←</button><button class="step" data-move="up" aria-label="أعلى">↑</button><button class="step" data-move="down" aria-label="أسفل">↓</button><button class="step" data-move="right" aria-label="يمين">→</button></div><button class="plain-button" type="button" id="game-reset">إعادة</button></div>
  <p role="status" id="game-status" class="result">حرّك الروبوت بالأسهم.</p>
  <a class="deep-link" href="/games/code/">افتح كل المراحل <span aria-hidden="true">↗</span></a></div>`;
const social = `<div class="demo-stage social-trial" data-panel="social" hidden>
  <div class="stage-meta"><span>خطة محتوى</span><span dir="ltr">04 / 04</span></div>
  <label for="content-topic">ما موضوعك؟</label>
  <input id="content-topic" type="text" maxlength="90" placeholder="مثال: افتتاح مقهى">
  <div class="activity-controls" data-controls><button type="button" class="try-button" id="content-create">جهّز ٣ أفكار</button></div>
  <div id="content-result" hidden><label for="content-output">مسودة قابلة للتعديل</label><textarea id="content-output" rows="5" maxlength="3000"></textarea>
  <button type="button" class="plain-button" id="content-copy">انسخ الخطة</button></div>
  <p role="status" id="content-status" class="result">تُجهّز المسودة على جهازك.</p></div>`;
export const mobileNav=`<nav class="mobile-dock" aria-label="روابط الجوال"><a href="/community/"><span aria-hidden="true">✦</span>المختبر</a><a href="/projects/"><span aria-hidden="true">▤</span>المشاريع</a><a href="/idea"><span aria-hidden="true">✧</span>فكرتك</a><a href="/#contact"><span aria-hidden="true">✉</span>تواصل</a></nav>`;
export const studio = `<section id="playground" class="studio-hero" aria-labelledby="studio-title">
  <div class="studio-pitch"><span class="studio-label"><i aria-hidden="true"></i> MZcode · استوديو تطوير لأصحاب المشاريع <span class="label-line" aria-hidden="true"></span></span>
   <h1 id="studio-title">عندك فكرة؟<br><em>خلّها تشتغل.</em></h1>
   <p>نحوّل فكرتك إلى تجربة تعمل أمامك، ثم ننفّذها. وعندنا أدوات عربية جاهزة تستخدمها مجانًا من المتصفح.</p>
   <div class="pitch-actions"><a class="primary" href="/idea">ابدأ بفكرتك <span aria-hidden="true">←</span></a><a class="outline-link" href="#tools">جرّب الأدوات <span aria-hidden="true">↙</span></a></div><div class="hero-footnote"><span class="hero-live-dot" aria-hidden="true"></span> تجارب مباشرة <span class="hero-separator" aria-hidden="true">/</span> بدون تسجيل</div></div>
  <div class="live-console" aria-label="تجارب فورية">
    <div class="console-line"><span class="console-flag">تجربة حيّة · اضغط وجرّب</span><span class="terminal-id" dir="ltr">INTERACTIVE / 01</span></div>
    <div class="mode-switch" data-controls role="group" aria-label="اختر تجربة"><button type="button" data-mode="book" aria-pressed="true">احجز</button><button type="button" data-mode="quote" aria-pressed="false">سعّر</button><button type="button" data-mode="game" aria-pressed="false">العب</button><button type="button" data-mode="social" aria-pressed="false">خطّط</button></div>
    ${booking}${quoting}${gaming}${social}
    <noscript><p>تحتاج التجارب المضمّنة إلى JavaScript. يمكنك فتح <a href="/tools/">دليل الأدوات</a>.</p></noscript>
  </div></section><section id="mz-community-invite" class="community-invite" aria-labelledby="mz-community-title"><div><span>جديد · للأهل والأصدقاء وكل زائر</span><h2 id="mz-community-title">جرّب، صوّت، وشاركنا أفكارك.</h2><p>تجارب ومشاريع مفتوحة لرأيك، من غير تسجيل ولا طلب شراء.</p><p class="community-browse">ما عندك فكرة؟ ولا ودّك تشارك؟ 😏 ولا يهمك، <a href="/projects/">خذ لك فَرّة بالموقع</a> واستكشف المشاريع والأدوات والألعاب على راحتك 🫡</p></div><a href="/community/">ادخل مختبر MZ ←</a></section><div class="capability-strip" aria-label="ما يقدمه MZcode"><div><strong>فكرة غير تقليدية؟</strong><span>نحوّلها لمسار واضح قابل للتجربة</span></div><div><strong>منتجات جاهزة للاستخدام</strong><span>أدوات عربية تعمل من المتصفح</span></div><div><strong>من التجربة إلى التنفيذ</strong><span>نبدأ بما يحتاجه العميل فعلًا</span></div></div>`;
