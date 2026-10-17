export function createInput({ onMove = () => {}, onJump = () => {}, onStart = () => {}, onPause = () => {} } = {}) {
  let startTouch = null;
  let disabled = false;
  const handledKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'Spacebar', 'Enter', 'Escape']);

  function keydown(event) {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const el = event.target;
    if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')) return;
    const key = event.key;
    if (handledKeys.has(key) || /^[aAdDwWpP]$/.test(key)) event.preventDefault();
    if (key === 'ArrowLeft' || key.toLowerCase() === 'a') onMove(-1);
    else if (key === 'ArrowRight' || key.toLowerCase() === 'd') onMove(1);
    else if (key === 'ArrowUp' || key === ' ' || key === 'Spacebar' || key.toLowerCase() === 'w') {
      if (!event.repeat) onJump();
    } else if (key === 'Enter') {
      if (!event.repeat) onStart();
    } else if (key === 'Escape' || key.toLowerCase() === 'p') {
      if (!event.repeat) onPause();
    }
  }

  function touchstart(event) {
    if (disabled || event.touches.length !== 1 || event.target.closest?.('button')) {
      startTouch = null;
      return;
    }
    const t = event.touches[0];
    startTouch = { x: t.clientX, y: t.clientY, time: performance.now() };
  }

  function touchend(event) {
    if (disabled || !startTouch) return;
    const t = event.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startTouch.x;
    const dy = t.clientY - startTouch.y;
    const age = performance.now() - startTouch.time;
    startTouch = null;
    if (Math.abs(dx) >= 35 && Math.abs(dx) > Math.abs(dy) * 1.1) onMove(dx > 0 ? 1 : -1);
    else if (dy < -35 && Math.abs(dy) > Math.abs(dx) * 0.8) onJump();
    else if (Math.abs(dx) < 22 && Math.abs(dy) < 22 && age < 650) onJump(); // tap to jump or start
  }

  function touchcancel() { startTouch = null; }
  window.addEventListener('keydown', keydown, { passive: false });
  window.addEventListener('touchstart', touchstart, { passive: true });
  window.addEventListener('touchend', touchend, { passive: true });
  window.addEventListener('touchcancel', touchcancel, { passive: true });

  return {
    dispose() {
      disabled = true;
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('touchstart', touchstart);
      window.removeEventListener('touchend', touchend);
      window.removeEventListener('touchcancel', touchcancel);
    }
  };
}
