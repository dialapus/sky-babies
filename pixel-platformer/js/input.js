// SKYLARK — keyboard and independent multi-pointer touch controls.
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const JUMP = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyZ']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CODES = new Set([...LEFT, ...RIGHT, ...JUMP, ...PAUSE]);

function keyCode(event) {
  if (CODES.has(event.code)) return event.code;
  const key = String(event.key || '');
  if (key === ' ' || key === 'Spacebar') return 'Space';
  if (key === 'Esc') return 'Escape';
  if (key === 'Left' || key === 'Right' || key === 'Up') return 'Arrow' + key;
  if (key.length === 1) return 'Key' + key.toUpperCase();
  return key;
}

export function createInput(canvas) {
  const doc = canvas?.ownerDocument ?? document;
  const win = doc.defaultView ?? window;
  const down = new Set();
  const pointers = new Map(); // pointerId -> 'left' | 'right' | 'jump'
  const removers = [];
  let jumpEdge = false;
  let pauseEdge = false;
  let destroyed = false;

  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    removers.push(() => target.removeEventListener(type, callback, options));
  }
  function clear() {
    down.clear();
    pointers.clear();
    jumpEdge = false;
    pauseEdge = false;
  }
  function onKeyDown(event) {
    const code = keyCode(event);
    if (!CODES.has(code) || destroyed) return;
    if (event.cancelable) event.preventDefault();
    if (!down.has(code)) {
      if (JUMP.has(code)) jumpEdge = true;
      if (PAUSE.has(code)) pauseEdge = true;
    }
    down.add(code);
  }
  function onKeyUp(event) {
    const code = keyCode(event);
    if (!CODES.has(code)) return;
    if (event.cancelable) event.preventDefault();
    down.delete(code);
  }

  listen(doc, 'keydown', onKeyDown);
  listen(doc, 'keyup', onKeyUp);
  listen(win, 'blur', clear);
  listen(win, 'pagehide', clear);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) clear(); });

  const controls = ['left', 'right', 'jump'];
  for (const name of controls) {
    const button = doc.getElementById(name);
    if (!button) continue;
    // Prevent touchscreen gestures from swallowing a held action.
    const oldTouchAction = button.style.touchAction;
    button.style.touchAction = 'none';
    removers.push(() => { button.style.touchAction = oldTouchAction; });
    listen(button, 'pointerdown', event => {
      if (destroyed || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (event.cancelable) event.preventDefault();
      if (!pointers.has(event.pointerId)) {
        pointers.set(event.pointerId, name);
        if (name === 'jump') jumpEdge = true;
      }
      try { button.setPointerCapture(event.pointerId); } catch { /* release handled globally */ }
    }, { passive: false });
    const release = event => { pointers.delete(event.pointerId); };
    listen(button, 'pointerup', release);
    listen(button, 'pointercancel', release);
    listen(button, 'lostpointercapture', release);
  }
  // Fallback if capture is unavailable or a finger lifts beyond its button.
  listen(win, 'pointerup', event => { pointers.delete(event.pointerId); });
  listen(win, 'pointercancel', event => { pointers.delete(event.pointerId); });

  function held(codes, name) {
    for (const code of codes) if (down.has(code)) return true;
    for (const action of pointers.values()) if (action === name) return true;
    return false;
  }

  return {
    read() {
      const state = {
        left: held(LEFT, 'left'),
        right: held(RIGHT, 'right'),
        jump: held(JUMP, 'jump'),
        jumpPressed: jumpEdge,
        pausePressed: pauseEdge
      };
      jumpEdge = false;
      pauseEdge = false;
      return state;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (let i = removers.length - 1; i >= 0; i--) removers[i]();
      clear();
    }
  };
}
