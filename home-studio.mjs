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
    <span class="studio-label"><i aria-hidden="true"></i> MZcode · مساعد سعودي لإنجاز شغلك <span class="label-line" aria-hidden="true"></span></span>
    <p class="saudi-greeting">ارررحب <span aria-hidden="true">🫡</span></p>
    <h1 id="studio-title">قول وش الوضع؟</h1>
    <p class="saudi-brand-line"><strong dir="ltr">MZcode</strong> <span>— أكبر نتيجة بأقل جهد <span aria-hidden="true">👍</span></span></p>
    <p class="saudi-question">وش اللي مجهدك؟ <span aria-hidden="true">😌</span></p>
    <p class="saudi-guide">اكتب اللي تحتاجه بطريقتك، سواء فكرة تطبيق أو شغلة معطّلتك. نستقبل طلبك برقم متابعة، ونوضح لك وش نقدر نسوي.</p>

    <div class="mz-hero-links"><a href="#mz-assistant" class="mz-hero-primary">خلّنا نبدأ <span aria-hidden="true">←</span></a><a href="#mz-live-demos" class="mz-hero-secondary">أبي أجرب الأدوات <span aria-hidden="true">↙</span></a></div>
    <p class="mz-promise"><span aria-hidden="true">✦</span> جرّب أدواتنا بدون تسجيل أو بطاقة دفع. تنفيذ المشاريع بعد اتفاق واضح.</p>
  </div>
  <section class="mz-ai-panel" id="mz-assistant" aria-label="مساعد MZcode">
    <div class="mz-ai-panel-top"><div><small dir="ltr">MZcode / SKILLS DESK</small><h2>مساعدك السعودي</h2></div><span class="mz-ai-status"><span aria-hidden="true"></span> مهارات تعمل</span></div>
    <div class="mz-ai-entity" aria-hidden="true"><span class="mz-entity-halo"></span><span class="mz-entity-orbit one"></span><span class="mz-entity-orbit two"></span><span class="mz-entity-orbit three"></span><span class="mz-entity-core"></span><span class="mz-entity-spark a"></span><span class="mz-entity-spark b"></span><span class="mz-entity-spark c"></span></div>
    <div class="mz-bot-messages" id="mz-bot-messages" role="log" aria-live="polite" aria-label="ردود مساعد المهارات">
      <div class="mz-bot-bubble assistant"><strong>ارررحب 🫡</strong><span>قول وش تحتاج، وأشوف لك أقرب أداة شغّالة عندنا. وإذا ما لقينا، نفتح لك طلب مراجعة.</span></div>
    </div>
    <div class="mz-bot-suggestions" aria-label="أمثلة للتجربة">
      <button type="button" data-mz-prompt="أنا معلم وأحتاج رسالة لأولياء الأمور">رسالة معلم</button>
      <button type="button" data-mz-prompt="أبغى عرض سعر">عرض سعر</button>
      <button type="button" data-mz-prompt="أبي منيو لمطعم">منيو</button>
      <button type="button" data-mz-prompt="أبي فرص وألعاب سوني مجانية">فرص ومجانيات</button>
    </div>
    <form id="mz-bot-form" class="mz-bot-form" autocomplete="off">
      <label class="sr-only" for="mz-bot-input">وش ودّك تنجز؟</label>
      <textarea id="mz-bot-input" name="prompt" maxlength="1200" rows="2" required placeholder="اكتب طلبك بطريقتك..."></textarea>
      <button type="submit" aria-label="أرسل للمساعد">←</button>
    </form>
    <p class="mz-bot-disclaimer">هنا مساعد يوجّهك إلى المهارات المتاحة، وليس محادثة AI عامة. الكلام يبقى بجهازك ولا يُرسل لخادم إلا إذا اخترت إرسال طلب مستقل.</p>
    <div class="mz-tech-truth" aria-label="حالة القدرات">
      <span><i class="ready"></i> أدوات فعلية</span><span><i class="preview"></i> نماذج AI: تجريبي</span><span><i class="planned"></i> MCP: تطوير</span>
    </div>
  </section>
  <details class="mz-request-area" id="mz-request">
    <summary class="mz-request-header"><span><small>محتاج شيء خاص؟</small><strong>أرسل طلبك، وخذ رقم متابعة بعد حفظه</strong></span><span aria-hidden="true">+</span></summary>
    <div class="mz-request-inside">
      <p class="mz-request-explain">نراجع طلبك قبل أي تسعير أو التزام. البريد اختياري؛ إذا ما أضفته، احتفظ برقم المتابعة.</p>
    <form id="mz-quick-idea" class="saudi-intake-form" autocomplete="off" aria-label="أرسل طلبك إلى MZcode">
      <label for="mz-intake-idea" class="sr-only">اكتب وش تحتاج</label>
      <textarea id="mz-intake-idea" name="idea" rows="4" minlength="20" maxlength="1600" required placeholder="مثال: أنا معلم وأبي أجهّز خطة متابعة سهلة لطلابي..."></textarea>
      <details class="saudi-optional-contact"><summary>تبغانا نرد عليك؟ أضف بريدك (اختياري)</summary>
        <label for="mz-intake-email">بريد التواصل</label><input id="mz-intake-email" name="email" type="email" maxlength="254" autocomplete="email" inputmode="email" dir="ltr" placeholder="you@example.com">
        <small>بدون بريد تقدر تتابع حالة الطلب برقم المتابعة، لكن ما نقدر نراسلك.</small></details>
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
  </div></section><section id="mz-community-invite" class="community-invite" aria-labelledby="mz-community-title"><div><span>جديد · للأهل والأصدقاء وكل زائر</span><h2 id="mz-community-title">جرّب، صوّت، وشاركنا أفكارك.</h2><p>تجارب ومشاريع مفتوحة لرأيك، من غير تسجيل ولا طلب شراء.</p><p class="community-browse">ما عندك فكرة؟ ولا ودّك تشارك؟ 😏 ولا يهمك، <a href="/projects/">خذ لك فَرّة بالموقع</a> واستكشف المشاريع والأدوات والألعاب على راحتك 🫡</p></div><a href="/community/">ادخل مختبر MZ ←</a></section><div class="capability-strip" aria-label="ما يقدمه MZcode"><div><strong>فكرة غير تقليدية؟</strong><span>نحوّلها لمسار واضح قابل للتجربة</span></div><div><strong>منتجات جاهزة للاستخدام</strong><span>أدوات عربية تعمل من المتصفح</span></div><div><strong>من التجربة إلى التنفيذ</strong><span>نبدأ بما يحتاجه العميل فعلًا</span></div></div>`;
