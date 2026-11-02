// Standalone educational preview: no network requests, cookies or persistent game state.
export const initialState = Object.freeze({ turn: 1, water: 5, food: 5, scouts: 0 });
export function advance(state, action) {
  if (state.turn >= 5) return state;
  if (action === 'water') return { ...state, turn: state.turn + 1, water: state.water + 3 };
  if (action === 'food') return { ...state, turn: state.turn + 1, food: state.food + 3 };
  if (action === 'scout' && state.water >= 2 && state.food >= 2)
    return { ...state, turn: state.turn + 1, water: state.water - 2, food: state.food - 2, scouts: state.scouts + 1 };
  return state;
}
const root = typeof document === 'undefined' ? null : document.querySelector('.game');
if (root) {
  const $ = (selector) => root.querySelector(selector);
  const arabic = (number) => number.toLocaleString('ar-SA');
  let state = { ...initialState };
  function render(message) {
    $('#turn-label').textContent = 'الدور ' + arabic(Math.min(state.turn, 5)) + ' / ٥';
    $('#water').textContent = arabic(state.water);
    $('#food').textContent = arabic(state.food);
    $('#scouts').textContent = arabic(state.scouts);
    $('#progress').style.width = Math.min(100, state.scouts * 50) + '%';
    const finished = state.turn >= 5;
    $('#choices').hidden = finished;
    $('#game-message').textContent = finished
      ? state.scouts >= 2
        ? 'نجحت في المهمة! الكشافون الآن في الطريق، والقبيلة مستعدة للخطوة التالية.'
        : 'انتهت الجولة. جرّب التوازن بين جمع الموارد وإرسال الكشافين.'
      : message;
    $('[data-act="scout"]').disabled = state.water < 2 || state.food < 2;
    root.dataset.finished = finished ? 'true' : 'false';
  }
  root.querySelectorAll('[data-act]').forEach(button =>
    button.addEventListener('click', () => {
      const result = advance(state, button.dataset.act);
      if (result === state) return;
      state = result;
      const messages = { water: 'ملأت جرار الماء. +٣', food: 'ازداد مخزون الطعام. +٣', scout: 'خرج كشاف إلى المجهول. −٢ ماء، −٢ غذاء' };
      render(messages[button.dataset.act]);
    }),
  );
  $('#restart').addEventListener('click', () => {
    state = { ...initialState };
    render('القبيلة تنتظر قرارك الأول.');
  });
  render('القبيلة تنتظر قرارك الأول.');
}