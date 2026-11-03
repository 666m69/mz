/* Static, offline, no network or third-party scripts; data is browser-local. */
(() => {
  'use strict';
  const config = JSON.parse(document.getElementById('app-config').textContent);
  const key = `mzcode:checklist:v1:${config.id}`;
  const form = document.getElementById('add-form');
  const input = document.getElementById('item-input');
  const list = document.getElementById('items');
  const empty = document.getElementById('empty');
  const stats = document.getElementById('stats');
  const notice = document.getElementById('notice');
  let filter = 'all';
  let items = [];
  let storageAvailable = true;
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(stored)) throw new Error('invalid storage');
    items = stored.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.done === 'boolean')
      .slice(0, 500).map((item) => ({id:item.id.slice(0,64), title:item.title.slice(0,120), done:item.done}));
  } catch {
    storageAvailable = false;
    notice.textContent = 'تعذر قراءة التخزين المحلي؛ ستعمل القائمة مؤقتًا دون حفظ.';
  }

  function persist() {
    if (!storageAvailable) return;
    try { localStorage.setItem(key, JSON.stringify(items)); }
    catch { storageAvailable = false; notice.textContent = 'تعذر الحفظ في المتصفح؛ التغييرات مؤقتة.'; }
  }
  function makeButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }
  function render() {
    list.replaceChildren();
    const shown = items.filter((item) => filter === 'all' || (filter === 'done' ? item.done : !item.done));
    for (const item of shown) {
      const li = document.createElement('li');
      li.dataset.id = item.id;
      if (item.done) li.classList.add('completed');
      const check = document.createElement('input');
      check.type = 'checkbox'; check.checked = item.done;
      check.setAttribute('aria-label', `إكمال ${item.title}`);
      check.addEventListener('change', () => { item.done = check.checked; persist(); render(); });
      const label = document.createElement('span'); label.className='item-text'; label.textContent = item.title;
      const actions = document.createElement('div'); actions.className='actions';
      actions.append(
        makeButton('تعديل', 'quiet', () => {
          const next = window.prompt('تعديل العنصر', item.title);
          if (next === null) return;
          const value = next.trim();
          if (!value || value.length > 120) { notice.textContent='يجب أن يكون النص بين 1 و120 حرفًا.'; return; }
          item.title = value; persist(); render();
        }),
        makeButton('حذف', 'danger', () => {
          items = items.filter((other) => other.id !== item.id); persist(); render();
        })
      );
      li.append(check,label,actions); list.append(li);
    }
    const done = items.filter((item) => item.done).length;
    stats.textContent = `${items.length} إجمالي · ${items.length - done} متبقي · ${done} مكتمل`;
    empty.hidden = shown.length > 0;
    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title || title.length > 120) { notice.textContent='اكتب عنصرًا صالحًا (1 إلى 120 حرفًا).'; return; }
    if (items.length >= 500) { notice.textContent='وصلت القائمة إلى الحد الأقصى (500 عنصر).'; return; }
    items.unshift({id:crypto.randomUUID(), title, done:false});
    persist(); input.value=''; notice.textContent=''; filter='all'; render(); input.focus();
  });
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => { filter = button.dataset.filter; render(); });
  });
  render();
})();
