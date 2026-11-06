/**
 * MZcode isolated static app builder v1.
 * Only trusted, pre-audited templates are emitted; visitor input is NEVER code.
 * No shell, plugins, external APIs, network, data-store or production paths.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { assessCapability } from '../capability-gate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TASK_IDEA = /مهام|مهامي|مهمات|to[ -]?do|tasks?|قائمة إنجاز|checklist|قائمة متابعة/i;
const SHOP_IDEA = /مشتريات|تسوق|shopping(?: list)?|قائمة البقالة/i;
const SAFE_TITLE = /^[\p{L}\p{N}][\p{L}\p{N} \u060C.,()،\-]{1,58}$/u;

export class AppBuildError extends Error {
  constructor(code, message) { super(message); this.name = 'AppBuildError'; this.code = code; }
}

export function planApp({ idea, title } = {}) {
  if (typeof idea !== 'string' || idea.trim().length < 20 || idea.length > 2000) {
    throw new AppBuildError('INVALID_IDEA', 'يجب كتابة فكرة بين 20 و2000 حرف');
  }
  // Distinguish unsupported app types from apparently supported templates that
  // actually require a backend, commerce, synchronization or physical devices.
  const category = SHOP_IDEA.test(idea) ? 'shopping' : TASK_IDEA.test(idea) ? 'tasks' : null;
  if (!category) {
    throw new AppBuildError('UNSUPPORTED_IDEA', 'المحرك الأول يدعم قوائم المهام والمشتريات المحلية فقط');
  }
  const assessment = assessCapability(idea);
  // Rules are advisory and never authorization to execute source supplied by visitors.
  if (assessment.decision !== 'prototype_only') {
    throw new AppBuildError('REVIEW_REQUIRED', 'هذه الفكرة تتطلب مراجعة تقنية وبشرية قبل البناء');
  }
  const displayTitle = title === undefined
    ? (category === 'shopping' ? 'قائمة مشترياتي' : 'منظم مهامي')
    : title;
  if (typeof displayTitle !== 'string' || !SAFE_TITLE.test(displayTitle.trim())) {
    throw new AppBuildError('INVALID_TITLE', 'اسم التطبيق غير صالح (2 إلى 59 حرفًا دون رموز برمجية)');
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: 'local-checklist',
    category,
    title: displayTitle.trim(),
    features: ['add', 'edit', 'toggle', 'delete', 'filter', 'local-persistence'],
    storage: 'localStorage on the visitor device only',
    authorization: 'No accounts or shared/team access',
    deliverable: 'Standalone static web app',
    limitations: ['لا يوجد تسجيل دخول أو مزامنة أو مشاركة', 'البيانات محفوظة في المتصفح فقط'],
    automatedRelease: false,
    externalCostsSar: 0
  });
}

function safeJsonForHtml(obj) {
  return JSON.stringify(obj).replace(/[<>&\u2028\u2029]/g, (char) => ({
    '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029'
  }[char]));
}

function htmlFor(blueprint, config) {
  // Only generated metadata from strict validation is inserted; no idea text or script.
  const appConfig = safeJsonForHtml(config);
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(blueprint.title)}</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main class="shell">
    <header class="mast"><div class="symbol" aria-hidden="true">MZ</div><span>صُنع بواسطة MZcode • تجربة محلية مستقلة</span></header>
    <section class="hero"><p class="eyebrow">تطبيق ويب يعمل دون حساب</p><h1 id="app-title">${escapeHtml(blueprint.title)}</h1>
      <p>أضف العناصر ونظّمها؛ تُحفَظ على هذا الجهاز فقط، دون إرسالها لخادم.</p></section>
    <section class="panel" aria-label="إدارة العناصر">
      <form id="add-form" autocomplete="off"><label for="item-input">${blueprint.category === 'shopping' ? 'إضافة مشتريات' : 'إضافة مهمة'}</label>
        <div class="input-row"><input id="item-input" name="item" maxlength="120" required placeholder="${blueprint.category === 'shopping' ? 'مثال: حليب وقهوة' : 'مثال: تجهيز العرض الأول'}"><button type="submit" id="add-btn">إضافة +</button></div></form>
      <div class="toolbar"><div id="stats" role="status" aria-live="polite"></div>
        <div class="filters" role="group" aria-label="تصفية القائمة"><button type="button" data-filter="all" aria-pressed="true">الكل</button><button type="button" data-filter="active" aria-pressed="false">المتبقي</button><button type="button" data-filter="done" aria-pressed="false">المكتمل</button></div></div>
      <p id="notice" aria-live="polite" class="notice"></p>
      <ul id="items" aria-label="عناصر القائمة"></ul><p id="empty" class="empty">القائمة فارغة. ابدأ بإضافة عنصر جديد.</p>
    </section>
    <footer>نسخة أولية محدودة • تُحفظ البيانات محليًا فقط • لا يوجد دفع أو نشر تلقائي</footer>
  </main>
  <script type="application/json" id="app-config">${appConfig}</script>
  <script src="./app.js" defer></script>
</body>
</html>
`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}

/** Trusted caller chooses outputRoot, never interpolate visitor text into a path. */
export async function buildWebApp(input, { outputRoot = resolve('.mz-generated') } = {}) {
  const blueprint = planApp(input);
  if (typeof outputRoot !== 'string' || !outputRoot.trim()) {
    throw new AppBuildError('INVALID_OUTPUT', 'مسار البناء غير صالح');
  }
  const root = resolve(outputRoot);
  await mkdir(root, {recursive:true,mode:0o700});
  const directory = await mkdtemp(join(root, 'mz-app-'));
  const appId = randomUUID();
  const config = { id:appId, title:blueprint.title, category:blueprint.category, schemaVersion:1 };
  const [runtime, stylesheet] = await Promise.all([
    readFile(join(here, 'runtime.js'), 'utf8'),
    readFile(join(here, 'styles.css'), 'utf8'),
  ]);
  await Promise.all([
    writeFile(join(directory, 'index.html'), htmlFor(blueprint, config), {mode:0o600}),
    writeFile(join(directory, 'app.js'), runtime, {mode:0o600}),
    writeFile(join(directory, 'styles.css'), stylesheet, {mode:0o600}),
    writeFile(join(directory, 'blueprint.json'), JSON.stringify(blueprint, null, 2) + '\n', {mode:0o600}),
  ]);
  return {directory, appId, blueprint, files:['index.html','app.js','styles.css','blueprint.json']};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const idea = process.argv[2];
  if (!idea) {
    console.error('Usage: node pilot/builder/engine.mjs "أريد قائمة لتنظيم مهامي اليومية"');
    process.exitCode = 2;
  } else {
    try {
      const result = await buildWebApp({idea});
      console.log(JSON.stringify(result,null,2));
    } catch (error) {
      console.error(`${error.code || 'BUILD_FAILED'}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
