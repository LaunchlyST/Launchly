// Premium micro-sounds — sine-based, short envelope, no gamey effect
let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setSoundMuted(v: boolean) { muted = v; try { localStorage.setItem('launchly_sound_muted', v ? '1' : '0'); } catch {} }
export function isSoundMuted() { try { return localStorage.getItem('launchly_sound_muted') === '1'; } catch { return false; } }
muted = isSoundMuted();

function tone(freq: number, duration: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration * 0.6);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sound = {
  tick() { tone(880, 0.06, 0.08, 'sine'); }, // subtle tick while moving
  snap() { tone(1100, 0.09, 0.11, 'sine', 1450); }, // soft neutral click at centre
  limit() { tone(220, 0.18, 0.13, 'sine', 160); setTimeout(() => tone(180, 0.12, 0.07, 'triangle'), 40); }, // warmer limit
  select() { tone(1200, 0.08, 0.09, 'sine'); },
  send() { tone(700, 0.12, 0.12, 'sine', 1050); },
};
