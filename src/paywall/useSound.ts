import { useCallback, useEffect, useRef, useState } from 'react';

export type Cue = 'intro' | 'reveal' | 'hover' | 'focus' | 'click' | 'scroll';

const STORAGE_KEY = 'launchly.paywall.sound';

/**
 * A tiny synthesised sound layer. No audio files: every cue is a couple of
 * oscillators through a gain envelope, which keeps the bundle unchanged and
 * lets each cue stay genuinely subtle (peak gain is 0.05 or below).
 *
 * Rules honoured here:
 *  - nothing plays until the user has interacted with the page (autoplay);
 *  - muted by default, so sound is opt-in rather than a surprise;
 *  - prefers-reduced-motion forces it off and hides the toggle's affordance.
 */
export function useSound(enabledByDefault = false) {
  const [muted, setMuted] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'muted';
    } catch {
      /* storage can throw in private mode — fall through to the default */
    }
    return !enabledByDefault;
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const busRef = useRef<GainNode | null>(null);
  const gestured = useRef(false);

  /* An AudioContext created before a gesture starts suspended, so we build it
     lazily on the first real interaction. */
  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;

    if (!ctxRef.current) {
      const ctx = new Ctor();
      const bus = ctx.createGain();
      bus.gain.value = 0.5;
      bus.connect(ctx.destination);
      ctxRef.current = ctx;
      busRef.current = bus;
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  useEffect(() => {
    const mark = () => {
      gestured.current = true;
      if (!muted) ensureCtx();
    };
    window.addEventListener('pointerdown', mark, { once: true });
    window.addEventListener('keydown', mark, { once: true });
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
    };
  }, [muted, ensureCtx]);

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  const play = useCallback(
    (cue: Cue) => {
      if (muted || !gestured.current) return;
      const ctx = ensureCtx();
      const bus = busRef.current;
      if (!ctx || !bus) return;

      const t = ctx.currentTime;

      /* [frequency, endFrequency, peak gain, duration, waveform] */
      const spec: Record<Cue, [number, number, number, number, OscillatorType]> = {
        intro: [110, 220, 0.05, 2.2, 'sine'],
        reveal: [660, 990, 0.022, 0.5, 'sine'],
        hover: [880, 880, 0.006, 0.1, 'sine'],
        focus: [520, 780, 0.028, 0.7, 'triangle'],
        click: [300, 200, 0.018, 0.2, 'sine'],
        scroll: [240, 300, 0.016, 0.9, 'sine'],
      };

      const [from, to, peak, dur, type] = spec[cue];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);

      // Rolls the top off everything so no cue is ever bright or clicky.
      filter.type = 'lowpass';
      filter.frequency.value = cue === 'hover' ? 2600 : 1800;

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.08, dur * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },
    [muted, ensureCtx]
  );

  const toggle = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'muted' : 'on');
      } catch {
        /* non-fatal */
      }
      if (!next) {
        gestured.current = true; // the toggle click is itself the gesture
        ensureCtx();
      }
      return next;
    });
  }, [ensureCtx]);

  return { muted, toggle, play };
}
