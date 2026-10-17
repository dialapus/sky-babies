/** Short synthesized cues; no network audio, and no AudioContext before a user gesture. */
export class Sound {
  constructor(enabled) { this.enabled = enabled; this.ctx = null; this.lastGift = 0; }
  unlock() {
    if (!this.enabled) return;
    try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; if (!this.ctx) this.ctx = new C(); if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); } catch { /* Audio is optional. */ }
  }
  tone(f, duration = .1, delay = 0, type = 'sine', gain = .06) {
    const c = this.ctx; if (!this.enabled || !c || c.state !== 'running') return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f,t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+duration+.03); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  play(type) {
    if (type === 'gift') { const now = this.ctx?.currentTime || 0; if (now - this.lastGift < .08) return; this.lastGift = now; this.tone(880,.12); this.tone(1320,.15,.05); }
    if (type === 'jump') { this.tone(440,.12); this.tone(660,.12,.06); }
    if (type === 'slide') this.tone(220,.13,0,'triangle',.04);
    if (type === 'bump') { this.tone(130,.22,0,'triangle',.11); this.tone(97,.25,.06,'triangle',.08); }
    if (type === 'fall' || type === 'gameover') [392,330,262].forEach((f,i) => this.tone(f,.3,i*.12,'triangle'));
    if (type === 'wings' || type === 'start') [523,659,784,1047].forEach((f,i) => this.tone(f,.25,i*.075,'sine',.055));
  }
}
