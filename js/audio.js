// No files or network requests: tiny melodic SFX made by Web Audio on a user gesture.
export function createAudio() {
  let ctx = null;
  let unlocked = false;
  let disposed = false;
  let master = null;

  function unlock() {
    if (disposed) return;
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      try {
        ctx = new AudioContextClass();
        master = ctx.createGain();
        master.gain.value = 0.12;
        master.connect(ctx.destination);
      } catch {
        ctx = null;
        master = null;
        return;
      }
    }
    unlocked = true;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function note(freq, start, duration, { type = 'sine', gain = 0.22, endFreq = freq } = {}) {
    if (!ctx || !master || ctx.state === 'closed') return;
    try {
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = type;
      const t = ctx.currentTime + Math.max(0, start);
      oscillator.frequency.setValueAtTime(Math.max(40, freq), t);
      if (endFreq !== freq) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + duration);
      envelope.gain.setValueAtTime(0.0001, t);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + 0.018);
      envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(t);
      oscillator.stop(t + duration + 0.01);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
    } catch { /* Web Audio not supported or device suspended. */ }
  }

  function play(kind) {
    if (!unlocked || !ctx || disposed) return;
    if (kind === 'start') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.095, 0.20, { gain: 0.16 }));
    } else if (kind === 'jump') {
      note(340, 0, 0.25, { type: 'triangle', gain: 0.19, endFreq: 830 });
      note(740, 0.10, 0.17, { gain: 0.11 });
    } else if (kind === 'switch') {
      note(520, 0, 0.09, { type: 'sine', gain: 0.11, endFreq: 690 });
    } else if (kind === 'collect') {
      note(880, 0, 0.15, { gain: 0.17 });
      note(1175, 0.09, 0.19, { gain: 0.15 });
    } else if (kind === 'fall') {
      note(600, 0, 0.65, { type: 'triangle', gain: 0.23, endFreq: 120 });
      note(380, 0.12, 0.57, { gain: 0.12, endFreq: 80 });
    } else if (kind === 'over') {
      [392, 329.63, 261.63, 196].forEach((f, i) => note(f, i * 0.18, 0.37, { type: 'triangle', gain: 0.15 }));
    }
  }

  function dispose() {
    disposed = true;
    unlocked = false;
    if (ctx) ctx.close().catch(() => {});
    ctx = null;
    master = null;
  }

  return { unlock, play, dispose };
}
