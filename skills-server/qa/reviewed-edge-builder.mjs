// MZcode v1 reviewed checklist renderer — a deterministic Cloudflare Workers port.
// Source: pilot/builder/engine.mjs + runtime.js + styles.css at staging review.
// This is NOT a Linux sandbox or an open-ended code generator. Refuse unreviewed skills.
// Parity tests compare all four files to the original source-pinned Node builder.
import {assessCapability} from '../pilot/capability-gate.mjs';
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
  const assessment = assessCapability(idea);
  // Rules are advisory and never authorization to execute source supplied by visitors.
  if (assessment.decision !== 'prototype_only') {
    throw new AppBuildError('REVIEW_REQUIRED', 'هذه الفكرة تتطلب مراجعة تقنية وبشرية قبل البناء');
  }
  const category = SHOP_IDEA.test(idea) ? 'shopping' : TASK_IDEA.test(idea) ? 'tasks' : null;
  if (!category) {
    throw new AppBuildError('UNSUPPORTED_IDEA', 'المحرك الأول يدعم قوائم المهام والمشتريات المحلية فقط');
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


const PINNED_RUNTIME = "/* Static, offline, no network or third-party scripts; data is browser-local. */\n(() => {\n  'use strict';\n  const config = JSON.parse(document.getElementById('app-config').textContent);\n  const key = `mzcode:checklist:v1:${config.id}`;\n  const form = document.getElementById('add-form');\n  const input = document.getElementById('item-input');\n  const list = document.getElementById('items');\n  const empty = document.getElementById('empty');\n  const stats = document.getElementById('stats');\n  const notice = document.getElementById('notice');\n  let filter = 'all';\n  let items = [];\n  let storageAvailable = true;\n  try {\n    const stored = JSON.parse(localStorage.getItem(key) || '[]');\n    if (!Array.isArray(stored)) throw new Error('invalid storage');\n    items = stored.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.done === 'boolean')\n      .slice(0, 500).map((item) => ({id:item.id.slice(0,64), title:item.title.slice(0,120), done:item.done}));\n  } catch {\n    storageAvailable = false;\n    notice.textContent = 'تعذر قراءة التخزين المحلي؛ ستعمل القائمة مؤقتًا دون حفظ.';\n  }\n\n  function persist() {\n    if (!storageAvailable) return;\n    try { localStorage.setItem(key, JSON.stringify(items)); }\n    catch { storageAvailable = false; notice.textContent = 'تعذر الحفظ في المتصفح؛ التغييرات مؤقتة.'; }\n  }\n  function makeButton(label, className, onClick) {\n    const button = document.createElement('button');\n    button.type = 'button';\n    button.className = className;\n    button.textContent = label;\n    button.addEventListener('click', onClick);\n    return button;\n  }\n  function render() {\n    list.replaceChildren();\n    const shown = items.filter((item) => filter === 'all' || (filter === 'done' ? item.done : !item.done));\n    for (const item of shown) {\n      const li = document.createElement('li');\n      li.dataset.id = item.id;\n      if (item.done) li.classList.add('completed');\n      const check = document.createElement('input');\n      check.type = 'checkbox'; check.checked = item.done;\n      check.setAttribute('aria-label', `إكمال ${item.title}`);\n      check.addEventListener('change', () => { item.done = check.checked; persist(); render(); });\n      const label = document.createElement('span'); label.className='item-text'; label.textContent = item.title;\n      const actions = document.createElement('div'); actions.className='actions';\n      actions.append(\n        makeButton('تعديل', 'quiet', () => {\n          const next = window.prompt('تعديل العنصر', item.title);\n          if (next === null) return;\n          const value = next.trim();\n          if (!value || value.length > 120) { notice.textContent='يجب أن يكون النص بين 1 و120 حرفًا.'; return; }\n          item.title = value; persist(); render();\n        }),\n        makeButton('حذف', 'danger', () => {\n          items = items.filter((other) => other.id !== item.id); persist(); render();\n        })\n      );\n      li.append(check,label,actions); list.append(li);\n    }\n    const done = items.filter((item) => item.done).length;\n    stats.textContent = `${items.length} إجمالي · ${items.length - done} متبقي · ${done} مكتمل`;\n    empty.hidden = shown.length > 0;\n    document.querySelectorAll('[data-filter]').forEach((button) => {\n      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));\n    });\n  }\n  form.addEventListener('submit', (event) => {\n    event.preventDefault();\n    const title = input.value.trim();\n    if (!title || title.length > 120) { notice.textContent='اكتب عنصرًا صالحًا (1 إلى 120 حرفًا).'; return; }\n    if (items.length >= 500) { notice.textContent='وصلت القائمة إلى الحد الأقصى (500 عنصر).'; return; }\n    items.unshift({id:crypto.randomUUID(), title, done:false});\n    persist(); input.value=''; notice.textContent=''; filter='all'; render(); input.focus();\n  });\n  document.querySelectorAll('[data-filter]').forEach((button) => {\n    button.addEventListener('click', () => { filter = button.dataset.filter; render(); });\n  });\n  render();\n})();\n";
const PINNED_STYLES = ":root{font-family:system-ui,-apple-system,\"Segoe UI\",sans-serif;color-scheme:dark;background:#080d18;color:#f3f7ff}\n*{box-sizing:border-box}\nbody{margin:0;min-height:100vh;background:radial-gradient(ellipse 90% 50% at 100% 0, #1a3855 0,transparent 75%),#080d18}\n.shell{max-width:840px;margin:auto;padding:28px 20px 36px}\n.mast{display:flex;align-items:center;gap:12px;color:#a7bbcf;font-size:13px}.symbol{display:grid;place-items:center;width:42px;height:42px;font-weight:850;border-radius:12px;color:#061520;background:linear-gradient(135deg,#56e0b8,#67b9ff)}\n.hero{padding:46px 0 30px}.eyebrow{color:#55ddb9;font-size:13px;font-weight:700;margin:0 0 12px}.hero h1{font-size:clamp(30px,6vw,52px);line-height:1.3;letter-spacing:-.03em;margin:0 0 14px}.hero p:last-child{color:#abbad2;line-height:1.8;max-width:550px}\n.panel{background:#121d2e;border:1px solid #293b52;border-radius:24px;padding:24px;box-shadow:0 25px 75px #05081177}\nlabel{display:block;font-size:14px;font-weight:700;margin-bottom:12px}.input-row{display:flex;gap:10px}input[type=text],input:not([type]){width:100%;min-width:0;min-height:46px;padding:10px 14px;border:1px solid #43576b;border-radius:12px;background:#091321;color:white;font-size:16px}input:focus-visible,button:focus-visible{outline:3px solid #64b8fa;outline-offset:2px}button{cursor:pointer;border:0;border-radius:12px;font-size:14px;font-weight:700;padding:12px 16px;background:#52dcb1;color:#071c26}button:hover{filter:brightness(1.08)}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:26px;padding-bottom:16px;border-bottom:1px solid #293b52;color:#bacce2;font-size:13px}.filters{display:flex;gap:5px;flex-wrap:wrap}.filters button{background:#23354c;color:#c9d6e6;padding:9px 12px}.filters button[aria-pressed=true]{background:#377b82;color:white}\n#items{padding:0;margin:12px 0 0;list-style:none}#items li{display:flex;align-items:center;gap:12px;border-bottom:1px solid #23354c;min-height:64px;padding:11px 0}#items li:last-child{border-bottom:0}input[type=checkbox]{accent-color:#55d7a8;width:20px;height:20px;flex-shrink:0}.item-text{flex:1;min-width:0;overflow-wrap:anywhere;font-size:15px}.completed .item-text{text-decoration:line-through;color:#879bb2}.actions{display:flex;gap:6px}.actions button{padding:8px 10px;font-size:12px}.quiet{background:#28445e;color:#d6ebfa}.danger{background:#4b2a34;color:#ffc2cc}.empty{color:#9cb2c8;text-align:center;padding:20px 0}.empty[hidden]{display:none}.notice{min-height:1em;color:#f7cf9d;font-size:13px}footer{margin:24px 0;color:#738fa9;text-align:center;font-size:12px;line-height:1.8}\n@media(max-width:520px){.shell{padding:16px}.hero{padding:30px 0 20px}.panel{padding:16px;border-radius:18px}.input-row{flex-direction:column}.input-row button{width:100%}.toolbar{align-items:flex-start}.actions button{padding:7px 8px}.mast{font-size:11px}}\n";
export function buildReviewedEdgeApp(skillId,input){
  if(skillId!=='local-checklist')throw new AppBuildError('UNREVIEWED_SKILL','Reviewed checklist only');
  // Conservative anti-obfuscation guard (tatweel, bidi and zero-width controls):
  // do not silently normalize potentially malicious visitor intent.
  if(typeof input?.idea!=='string'||/[\u0640\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(input.idea))
    throw new AppBuildError('REVIEW_REQUIRED','Ambiguous or visually obfuscated input');
  const blueprint=planApp(input),appId=crypto.randomUUID();
  const config={id:appId,title:blueprint.title,category:blueprint.category,schemaVersion:1};
  const files={
    'app.js':PINNED_RUNTIME,
    'blueprint.json':JSON.stringify(blueprint,null,2)+'\n',
    'index.html':htmlFor(blueprint,config),
    'styles.css':PINNED_STYLES
  };
  return {files,blueprint,appId};
}
