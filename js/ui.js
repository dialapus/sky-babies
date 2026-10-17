const byId = id => document.getElementById(id);

export function createUI({ onStart = () => {}, onPause = () => {} } = {}) {
  const overlay = byId('overlay');
  const title = byId('overlay-title');
  const eyebrow = byId('overlay-eyebrow');
  const subtitle = byId('overlay-subtitle');
  const primary = byId('primary-button');
  const pause = byId('pause-button');
  const help = byId('overlay-help');
  const stats = byId('overlay-stats');
  const finalScore = byId('final-score');
  const finalBest = byId('final-best');
  const scoreText = byId('score');
  const bestText = byId('best');
  const touchHint = byId('touch-hint');
  let state = 'start';
  let lastScore = 0;
  let lastBest = 0;

  function updateScore(score = 0, best = 0) {
    lastScore = Math.max(0, Math.floor(Number(score) || 0));
    lastBest = Math.max(lastScore, Math.floor(Number(best) || 0));
    if (scoreText) scoreText.textContent = 'Счёт: ' + String(lastScore);
    if (bestText) bestText.textContent = 'Рекорд: ' + String(lastBest);
    if (finalScore) finalScore.textContent = lastScore.toLocaleString('ru-RU');
    if (finalBest) finalBest.textContent = lastBest.toLocaleString('ru-RU');
  }

  function setState(next, { score = lastScore, best = lastBest } = {}) {
    state = next;
    updateScore(score, best);
    document.body.dataset.state = next;
    const showOverlay = next === 'start' || next === 'paused' || next === 'gameover';
    if (overlay) {
      overlay.hidden = !showOverlay;
      overlay.setAttribute('aria-hidden', String(!showOverlay));
    }
    if (pause) {
      pause.hidden = !(next === 'running' || next === 'paused');
      pause.setAttribute('aria-label', next === 'paused' ? 'Продолжить игру' : 'Пауза');
      pause.textContent = next === 'paused' ? '▶' : 'Ⅱ';
    }
    if (stats) stats.hidden = next === 'start';
    if (touchHint) touchHint.hidden = next !== 'running';

    if (next === 'start') {
      if (eyebrow) eyebrow.textContent = 'ПРИКЛЮЧЕНИЕ НАД ОБЛАКАМИ';
      if (title) title.textContent = 'Небесная малышка';
      if (subtitle) subtitle.textContent = 'Беги к волшебному замку. Перепрыгивай облачные провалы и меняй дорожки!';
      if (primary) primary.textContent = 'Начать полёт';
      if (help) help.textContent = '← → / A D — дорожка · ↑ / пробел — прыжок · на телефоне — свайпы и касание';
    } else if (next === 'paused') {
      if (eyebrow) eyebrow.textContent = 'МИНУТКА ОТДЫХА';
      if (title) title.textContent = 'Пауза';
      if (subtitle) subtitle.textContent = 'Облака подождут. Продолжим?';
      if (primary) primary.textContent = 'Продолжить';
      if (help) help.textContent = 'Esc или P — продолжить';
    } else if (next === 'gameover') {
      if (eyebrow) eyebrow.textContent = 'НЕБОЛЬШАЯ НЕУДАЧА';
      if (title) title.textContent = 'Ой, ты упала на Землю!';
      if (subtitle) subtitle.textContent = 'Но настоящие небесные герои всегда пробуют снова.';
      if (primary) primary.textContent = 'Ещё раз';
      if (help) help.textContent = 'Нажмите Enter или «Ещё раз», чтобы начать новый забег';
    }
  }

  function primaryClick(event) {
    event.preventDefault();
    if (state === 'paused') onPause();
    else onStart();
  }
  function pauseClick(event) {
    event.preventDefault();
    onPause();
  }

  primary?.addEventListener('click', primaryClick);
  pause?.addEventListener('click', pauseClick);
  setState('start', { score: 0, best: 0 });

  return {
    setState,
    updateScore,
    dispose() {
      primary?.removeEventListener('click', primaryClick);
      pause?.removeEventListener('click', pauseClick);
    }
  };
}
