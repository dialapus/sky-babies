// SKYLARK synthesizer. Audio hardware stays untouched until resume() is called by a user gesture.
const SOUND = Object.freeze({
  jump:  [[0, 320, 540, .16, .10, 'triangle']],
  coin:  [[0, 720, 1000, .09, .10, 'sine'], [.095, 1000, 1340, .13, .10, 'sine']],
  block: [[0, 180, 260, .11, .12, 'square']],
  stomp: [[0, 155, 68, .17, .13, 'triangle']],
  hurt:  [[0, 290, 100, .24, .13, 'sawtooth']],
  win:   [[0, 523, 523, .11, .09, 'triangle'], [.12, 659, 659, .11, .09, 'triangle'], [.24, 784, 784, .3, .11, 'triangle']],
  lose:  [[0, 440, 360, .16, .10, 'triangle'], [.17, 340, 220, .16, .10, 'triangle'], [.34, 220, 110, .36, .1, 'triangle']]
});

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function resume() {
    if (!context) {
      const AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioCtor) return Promise.resolve(false);
      try {
        context = new AudioCtor();
        master = context.createGain();
        master.gain.value = muted ? 0 : .28;
        master.connect(context.destination);
      } catch {
        context = null;
        master = null;
        return Promise.resolve(false);
      }
    }
    try {
      return Promise.resolve(context.resume()).then(() => context.state === 'running').catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  function mute(on = true) {
    muted = !!on;
    if (master) master.gain.setTargetAtTime(muted ? 0 : .28, context.currentTime, .01);
  }

  function play(name) {
    if (muted || !context || context.state !== 'running' || !SOUND[name]) return;
    const start = context.currentTime;
    for (const [delay, hz, targetHz, duration, gain, wave] of SOUND[name]) {
      const osc = context.createOscillator();
      const amp = context.createGain();
      const t = start + delay;
      osc.type = wave;
      osc.frequency.setValueAtTime(hz, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, targetHz), t + duration);
      amp.gain.setValueAtTime(.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + Math.min(.018, duration / 4));
      amp.gain.exponentialRampToValueAtTime(.0001, t + duration);
      osc.connect(amp);
      amp.connect(master);
      osc.onended = () => { osc.disconnect(); amp.disconnect(); };
      osc.start(t);
      osc.stop(t + duration + .01);
    }
  }
  return Object.freeze({ play, resume, mute });
}
