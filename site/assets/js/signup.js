for (const form of document.querySelectorAll('[data-signup]')) {
  const mode = form.dataset.signup;
  const status = form.querySelector('[role=status]');
  const button = form.querySelector('button[type=submit]');
  const tool = new URLSearchParams(location.search).get('upgrade');
  if (mode === 'tools' && ['menu','property','quote'].includes(tool)) form.elements.tool.value = tool;
  form.hidden = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    button.disabled = true;
    status.textContent = 'جارٍ حفظ طلبك…';
    try {
      const tokenResponse = await fetch('/api/contact-token', {cache:'no-store'});
      if (!tokenResponse.ok) throw Error('استقبال الطلبات غير متاح الآن. حاول مجددًا أو راسلنا على info@mzcodehub.com.');
      const {token} = await tokenResponse.json();
      const response = await fetch('/api/contact', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({...values, mode, token, consent:form.elements.consent.checked})
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw Error(result.message || 'تعذر حفظ طلبك. أعد المحاولة.');
      form.reset();
      status.textContent = mode === 'coreresto' ? 'تم تسجيل اهتمامك بتجربة CoreResto. سنتواصل معك عند فتح التجربة.' : 'تم تسجيل اهتمامك. سنراسلك عند إتاحة النسخة التي اخترتها.';
      status.focus();
    } catch (error) {
      status.textContent = error instanceof TypeError ? 'تعذر الاتصال. بياناتك باقية في النموذج، حاول مرة أخرى.' : error.message;
    } finally {
      button.disabled = false;
    }
  });
}
