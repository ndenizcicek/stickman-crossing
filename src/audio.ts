// Tiny synthesized sound effects (no audio files to download).
// Browsers only allow sound after the first tap or key press, so call unlock() from an input handler.
export class Sfx {
  private ac: AudioContext | null = null;
  muted = false;
  /** Ads must play with the game silent. */
  suspended = false;

  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') void this.ac.resume(); return; }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try { this.ac = new Ctor(); } catch { this.ac = null; }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    const ac = this.ac;
    if (!ac || this.muted || this.suspended) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + dur + .02);
  }

  hop() { this.tone(520 + Math.random() * 60, .06, 'square', .04, 700); }
  pickup() { this.tone(660, .08, 'triangle', .12); setTimeout(() => this.tone(990, .1, 'triangle', .12), 70); }
  hit() { this.tone(180, .35, 'sawtooth', .12, 60); this.tone(400, .12, 'square', .08, 900); }
  honk() { this.tone(330, .18, 'square', .06); setTimeout(() => this.tone(330, .22, 'square', .06), 210); }
  friendLost() { this.tone(500, .2, 'triangle', .1, 250); }
}
