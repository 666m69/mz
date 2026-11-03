'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const tabButtons = [...document.querySelectorAll('[data-tab]')];
  const panels = ['idea', 'vote', 'try'];
  const projectIds = ['kafu', 'formah', 'marib'];
  const invitation = 'ادخل مختبر MZ وخلّنا نشوف أفكارك. ما فيه تسجيل ولا بيع؛ جرّب، صوّت، وقل رأيك بصراحة!\nhttps://mzcodehub.com/join';
  let snapshot = null;
  let busy = false;

  function showTab(name) {
    if (!panels.includes(name)) return;
    tabButtons.forEach(btn => {
      const active = btn.dataset.tab === name;
      btn.setAttribute('aria-selected', String(active));
      btn.tabIndex = active ? 0 : -1;
    });
    panels.forEach(key => { $('panel-' + key).hidden = key !== name; });
  }
  tabButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
    btn.addEventListener('keydown', e => {
      if (!['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabButtons.length - 1 :
        (index + (e.key === 'ArrowLeft' ? 1 : -1) + tabButtons.length) % tabButtons.length;
      tabButtons[next].focus();
      showTab(tabButtons[next].dataset.tab);
    });
  });

  function status(id, message, isError=false) {
    const node = $(id);
    node.textContent = message;
    node.classList.toggle('error', isError);
  }
  function lock(button, value) {
    button.disabled = value;
    button.setAttribute('aria-busy', String(value));
  }
  async function api(method, path, body) {
    const opts = {method, credentials:'same-origin', cache:'no-store', headers:{'Accept':'application/json'}};
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const response = await fetch(path, opts);
    let value;
    try { value = await response.json(); } catch { throw new Error('تعذر الاتصال الآن. جرّب بعد قليل.'); }
    if (!response.ok || !value.ok) throw new Error(value.message || 'تعذر تنفيذ الطلب.');
    return value;
  }
  function renderVotes(data) {
    snapshot = data;
    const sum = projectIds.reduce((total, id) => total + (Number(data.counts?.[id]) || 0), 0);
    for (const id of projectIds) {
      const card = document.querySelector('[data-project="' + id + '"]');
      const count = Number(data.counts?.[id]) || 0;
      card.querySelector('.vote-count').textContent = count.toLocaleString('ar-SA') + ' صوت';
      card.querySelector('.vote-meter i').style.width = (sum ? (count * 100 / sum) : 0) + '%';
      const btn = card.querySelector('[data-vote]');
      btn.disabled = Boolean(data.selected) || busy;
      btn.textContent = data.selected === id ? 'اختيارك ✓' : 'صوّت للمشروع';
    }
    if (data.selected) status('vote-status', 'تم تسجيل صوتك لهذا المتصفح. شكرًا لمشاركتك.');
    else status('vote-status', sum ? 'مجموع المشاركات: ' + sum.toLocaleString('ar-SA') : 'كن أول من يصوّت!');
  }
  async function loadVotes() {
    try { renderVotes(await api('GET','/api/community')); }
    catch { status('vote-status','التصويت غير متاح مؤقتًا. بقية التجارب تعمل كالمعتاد.',true); }
  }
  document.querySelectorAll('[data-vote]').forEach(button => {
    button.addEventListener('click', async () => {
      if (busy || snapshot?.selected) return;
      busy = true;
      document.querySelectorAll('[data-vote]').forEach(b => lock(b,true));
      status('vote-status','جاري تسجيل اختيارك...');
      try {
        const result = await api('POST','/api/community/vote',{project:button.dataset.vote});
        renderVotes(result);
      } catch (error) {
        status('vote-status',error.message,true);
        await loadVotes();
      } finally {
        busy = false;
        if (snapshot) renderVotes(snapshot);
      }
    });
  });
  const ideaInput = $('idea-text');
  ideaInput.addEventListener('input', () => {
    $('idea-length').textContent = ideaInput.value.length + ' / 800';
  });
  $('idea-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!$('idea-form').reportValidity()) return;
    const button = $('idea-send');
    lock(button,true);
    status('idea-status','جاري حفظ مساهمتك...');
    try {
      const value = await api('POST','/api/community/ideas',{
        idea:ideaInput.value.trim(),
        nickname:$('idea-name').value.trim(),
        website:$('idea-web').value,
        consent:$('idea-consent').checked
      });
      $('idea-ref').textContent = value.reference;
      $('idea-receipt').hidden = false;
      $('idea-form').hidden = true;
      status('idea-status','');
      $('idea-receipt').scrollIntoView({behavior:'smooth',block:'nearest'});
    } catch (error) { status('idea-status',error.message,true); }
    finally { lock(button,false); }
  });
  $('another-idea').addEventListener('click',() => {
    $('idea-form').reset();
    ideaInput.dispatchEvent(new Event('input'));
    $('idea-receipt').hidden = true;
    $('idea-form').hidden = false;
    ideaInput.focus();
  });
  $('review-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!$('review-form').reportValidity()) return;
    const button = $('review-send');
    lock(button,true);
    status('review-status','جاري حفظ رأيك...');
    try {
      await api('POST','/api/community/reviews',{
        project:$('review-project').value,
        score:Number(document.querySelector('input[name="score"]:checked')?.value),
        note:$('review-note').value.trim()
      });
      status('review-status','وصل تقييمك. شكرًا على رأيك الصريح!');
      $('review-form').reset();
    } catch (error) { status('review-status',error.message,true); }
    finally { lock(button,false); }
  });
  async function copy(value) {
    if (!navigator.clipboard?.writeText) return false;
    try { await navigator.clipboard.writeText(value); return true; }
    catch { return false; }
  }
  $('copy-ref').addEventListener('click', async () => {
    status('idea-status', await copy($('idea-ref').textContent) ? 'تم نسخ رقم المساهمة.' : 'يمكنك تحديد الرقم ونسخه يدويًا.');
  });
  async function invite() {
    if (navigator.share) {
      try { await navigator.share({title:'مختبر MZ',text:'جرّب وشاركنا رأيك دون تسجيل أو شراء.',url:'https://mzcodehub.com/join'}); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    const copied = await copy(invitation);
    const button = $('share-bottom');
    const old = button.textContent;
    button.textContent = copied ? 'نسخت الدعوة — أرسلها لمن تحب' : 'الرابط: mzcodehub.com/join';
    setTimeout(() => { button.textContent = old; },4000);
  }
  $('share-top').addEventListener('click',invite);
  $('share-bottom').addEventListener('click',invite);
  const initial = location.hash.slice(1);
  if (panels.includes(initial)) showTab(initial);
  loadVotes();
})();