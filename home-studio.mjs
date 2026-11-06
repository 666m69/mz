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
  <div class="studio-pitch saudi-intro">
    <span class="studio-label"><i aria-hidden="true"></i> MZcode · من الفكرة إلى التنفيذ <span class="label-line" aria-hidden="true"></span></span>
    <p class="saudi-greeting">ارررحب <span aria-hidden="true">🫡</span></p>
    <h1 id="studio-title"><span class="mz-main-promise">خلّ التقنية علينا.</span></h1>
    <p class="saudi-brand-line"><strong dir="ltr">MZcode</strong> <span>— عندك فكرة؟ خلّها تشتغل.</span></p>
    <p class="saudi-question">وش ودك نسوي لك؟</p>
    <p class="saudi-guide">قل لنا وش تحتاج بطريقتك. نختار الأدوات والتقنيات المناسبة، ونبدأ بتصور واضح وتجربة ممكنة، ثم نتفق معك على نطاق التنفيذ والتسليم. بدون ما تتشتت بين الخدمات والمنصات.</p>
    <div class="mz-hero-links"><button type="button" data-mz-open-assistant class="mz-hero-primary">ابدأ بفكرتك <span aria-hidden="true">←</span></button><a href="#mz-live-demos" class="mz-hero-secondary">أبي أجرب الأدوات <span aria-hidden="true">↙</span></a></div>
    <p class="mz-promise"><span aria-hidden="true">✦</span> التجارب الأساسية ورفع الطلب للمراجعة مجانًا وبدون بطاقة. تنفيذ المشاريع الخاصة بعد اتفاق واضح.</p>
  </div>
  <details class="mz-request-area" id="mz-request">
    <summary class="mz-request-header"><span><small>محتاج حل خاص؟ المراجعة الأولية مجانًا</small><strong>أرسل طلبك مجانًا، وخذ رقم متابعة بعد حفظه</strong></span><span aria-hidden="true">+</span></summary>
    <div class="mz-request-inside">
      <p class="mz-request-explain">إرسال الفكرة ومراجعتها الأولية مجانًا، ولا يوجد دفع قبل اتفاق واضح. نطلب بريدًا لإكمال حفظ الطلب والتواصل، وتقدر تتابع برقم الطلب بعد الحفظ.</p>
    <form id="mz-quick-idea" class="saudi-intake-form" autocomplete="off" aria-label="أرسل طلبك إلى MZcode">
      <label for="mz-intake-idea" class="sr-only">اكتب وش تحتاج</label>
      <textarea id="mz-intake-idea" name="idea" rows="4" minlength="20" maxlength="1600" required placeholder="مثال: أنا معلم وأبي أجهّز خطة متابعة سهلة لطلابي..."></textarea>
      <div class="saudi-optional-contact">
        <label for="mz-intake-email">بريد التواصل (مطلوب حاليًا)</label><input id="mz-intake-email" name="email" type="email" maxlength="254" autocomplete="email" inputmode="email" dir="ltr" placeholder="you@example.com" required>
        <small>الاستلام بدون بريد قيد التطوير. نحتاجه حاليًا لإكمال حفظ الطلب، ولا نطلب منك أي دفع.</small></div>
      <div class="saudi-consent"><label><input id="mz-intake-consent" name="consent" type="checkbox" required><span>أوافق على حفظ وصفي وبريدي إن أضفته لمراجعة الطلب، وفق <a href="/privacy">سياسة الخصوصية</a>. لا تكتب معلومات شخصية حساسة.</span></label></div>
      <div class="saudi-honeypot" aria-hidden="true"><label for="mz-intake-website">اترك هذا الحقل فارغًا</label><input type="text" id="mz-intake-website" name="website" tabindex="-1" autocomplete="off"></div>
      <button type="submit" class="saudi-send" id="mz-intake-send">أرسل وخذ رقم طلبك <span aria-hidden="true">←</span></button>
      <p id="mz-intake-state" class="saudi-intake-state" role="status" aria-live="polite"></p>
    </form>
    <div id="mz-intake-success" class="saudi-intake-success" hidden role="status" aria-live="polite">
      <span class="saudi-success-label">وصل طلبك، يا هلا فيك</span>
      <strong id="mz-intake-reference" class="saudi-reference" dir="ltr"></strong>
      <span id="mz-intake-date" class="saudi-date"></span>
      <span id="mz-intake-mail" class="saudi-mail-info"></span>
      <div class="saudi-success-actions"><button id="mz-intake-copy" type="button">انسخ الرقم</button><button id="mz-intake-track" type="button">تابع طلبك</button><a href="#tools">خذلك فَرّة على MZcode 🚶‍♂️</a></div><p id="mz-intake-track-state" role="status" aria-live="polite"></p>
      <small>الرقم يؤكد الاستلام فقط، مو وعدًا بتنفيذ الطلب أو سعرًا نهائيًا.</small>
    </div>
    <div class="saudi-browse"><a href="#tools">ما عندك طلب؟ خذلك فَرّة على MZcode <span aria-hidden="true">🚶‍♂️</span></a><a href="/idea">تبي تختبر فكرتك؟ افتح المختبر</a></div>

    </div>
  </details>
  <div class="mz-live-heading" id="mz-live-demos"><div><span>ما يحتاج تسأل…</span><h2>جرّب وتشوف بنفسك.</h2><p>نماذج تفاعلية حقيقية بدون تسجيل، كل تجربة توضّح حدودها.</p></div><a href="/tools/">كل الأدوات <span aria-hidden="true">↗</span></a></div>
  <div class="live-console" aria-label="تجارب فورية">
    <div class="console-line"><span class="console-flag">تجربة حيّة · اضغط وجرّب</span><span class="terminal-id" dir="ltr">INTERACTIVE / 01</span></div>
    <div class="mode-switch" data-controls role="group" aria-label="اختر تجربة"><button type="button" data-mode="book" aria-pressed="true">احجز</button><button type="button" data-mode="quote" aria-pressed="false">سعّر</button><button type="button" data-mode="game" aria-pressed="false">العب</button><button type="button" data-mode="social" aria-pressed="false">خطّط</button></div>
    ${booking}${quoting}${gaming}${social}
    <noscript><p>تحتاج التجارب المضمّنة إلى JavaScript. يمكنك فتح <a href="/tools/">دليل الأدوات</a>.</p></noscript>
  </div></section><section id="mz-method" class="mz-method" aria-labelledby="mz-method-title">
  <div class="mz-method-heading"><div><span class="mz-method-kicker">فكرتك عندنا لها طريق واضح</span><h2 id="mz-method-title">الفكرة ثم التجربة ثم الاتفاق ثم التسليم.</h2></div><a href="/idea">خلّنا نبدأ بفكرتك ←</a></div>
  <ol class="mz-method-grid">
    <li><span aria-hidden="true">01</span><h3>تقول وش تبي</h3><p>اكتب فكرتك بالعربي؛ تطبيق، موقع، أداة، أو شغلة تحتاج لها حل.</p></li>
    <li><span aria-hidden="true">02</span><h3>نختار التقنية</h3><p>نحدّد ما يمكن تجربته من مهاراتنا، وما يحتاج مراجعة أو تطويرًا إضافيًا.</p></li>
    <li><span aria-hidden="true">03</span><h3>نجرّب ونتفق</h3><p>نوضح النموذج الممكن والتكلفة والنطاق قبل أي تنفيذ مدفوع.</p></li>
    <li><span aria-hidden="true">04</span><h3>ننفّذ ونسلّم</h3><p>نبني ونختبر ونسلّم وفق الاتفاق؛ مع بيان ما أُنجز فعلًا.</p></li>
  </ol>
  <div class="mz-method-trust"><p><strong>المراجعة الأولية مجانية.</strong> النماذج الآلية حاليًا محدودة بالمهارات المختبرة، وبقية الطلبات تُراجع قبل الوعد بالتنفيذ. لا يوجد دفع قبل الاتفاق.</p>
  <p>يمكن الاستفادة من خدمات مثل <b dir="ltr">ChatGPT</b> و<b dir="ltr">Claude</b> وأدوات البرمجة والنشر حسب احتياج المشروع وتوفّر الربط النظامي.</p>
  <p class="mz-brand-clarifier">ذكر أسماء خدمات الأطراف الأخرى للتوضيح فقط، ولا يعني شراكة أو ربطًا آليًا مفعلًا.</p></div>
</section><section id="mz-community-invite" class="community-invite" aria-labelledby="mz-community-title"><div><span>جديد · للأهل والأصدقاء وكل زائر</span><h2 id="mz-community-title">جرّب، صوّت، وشاركنا أفكارك.</h2><p>تجارب ومشاريع مفتوحة لرأيك، من غير تسجيل ولا طلب شراء.</p><p class="community-browse">ما عندك فكرة؟ ولا ودّك تشارك؟ 😏 ولا يهمك، <a href="/projects/">خذ لك فَرّة بالموقع</a> واستكشف المشاريع والأدوات والألعاب على راحتك 🫡</p></div><a href="/community/">ادخل مختبر MZ ←</a></section><div class="capability-strip" aria-label="ما يقدمه MZcode"><div><strong>فكرة غير تقليدية؟</strong><span>نحوّلها لمسار واضح قابل للتجربة</span></div><div><strong>منتجات جاهزة للاستخدام</strong><span>أدوات عربية تعمل من المتصفح</span></div><div><strong>من التجربة إلى التنفيذ</strong><span>نبدأ بما يحتاجه العميل فعلًا</span></div></div>`;
