import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { PremiumScene } from './PremiumScene';
import { FEATURES, FeatureRow } from './FeatureShowcase';
import { useSound } from './useSound';
import './premium-scene.css';
import './premium-paywall.css';

const EASE = [0.16, 1, 0.3, 1] as const;

export interface PremiumPaywallProps {
  /** The existing Stripe checkout action. Untouched. */
  onUnlock: () => void | Promise<void>;
  /** Host-owned checkout-in-flight flag. */
  busy?: boolean;
  /** Subscription lookup failure, shown as a calm notice rather than a stack. */
  error?: string | null;
  onDismiss?: () => void;
}

/**
 * The unpaid gate.
 *
 * Left: the offer, composed as one column with room to breathe.
 * Right: the scene, which is the point — it carries the atmosphere while the
 * copy stays quiet. The column scrolls; the scene reacts with parallax.
 */
export function PremiumPaywall({ onUnlock, busy = false, error = null, onDismiss }: PremiumPaywallProps) {
  const reduce = useReducedMotion();
  const { muted, toggle, play } = useSound();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [lean, setLean] = useState({ x: 0, y: 0 });
  const [ripple, setRipple] = useState(0);
  const [ctaNear, setCtaNear] = useState(false);
  const ctaRef = useRef<HTMLButtonElement | null>(null);
  const lastScrollCue = useRef(0);

  /* ---- intro ----------------------------------------------------------- */
  useEffect(() => {
    const t = setTimeout(() => play('intro'), 350);
    return () => clearTimeout(t);
  }, [play]);

  /* ---- scroll progress drives the scene -------------------------------- */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const p = max > 0 ? el.scrollTop / max : 0;
    setProgress(p);

    const now = Date.now();
    if (now - lastScrollCue.current > 1400 && p > 0.08) {
      lastScrollCue.current = now;
      play('scroll');
    }
  }, [play]);

  /* ---- pointer lean ----------------------------------------------------- */
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setLean({
          x: (e.clientX / window.innerWidth - 0.5) * 2,
          y: (e.clientY / window.innerHeight - 0.5) * 2,
        });
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduce]);

  /* ---- the CTA gains focus as it comes into view ------------------------ */
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setCtaNear(entry.isIntersecting);
        if (entry.isIntersecting) play('focus');
      },
      { threshold: 0.7 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [play]);

  const handleUnlock = async () => {
    if (busy) return;
    play('click');
    setRipple((r) => r + 1);
    await onUnlock(); // unchanged Stripe checkout
  };

  const intro = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.85, ease: EASE, delay },
  });

  return (
    <div className="pp">
      <PremiumScene progress={progress} lean={lean} />

      <button
        type="button"
        className="pp__sound"
        onClick={toggle}
        aria-pressed={!muted}
        aria-label={muted ? 'Enable sound' : 'Mute sound'}
        title={muted ? 'Enable sound' : 'Mute sound'}
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        <span className="pp__sound-label">{muted ? 'Sound off' : 'Sound on'}</span>
      </button>

      <div className="pp__scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="pp__col">
          <motion.p className="pp__eyebrow" {...intro(0.15)}>
            <span className="pp__eyebrow-dot" />
            LAUNCHLY PRO
          </motion.p>

          <motion.h1 className="pp__headline" {...intro(0.26)}>
            Create without limits.
          </motion.h1>

          <motion.p className="pp__lede" {...intro(0.38)}>
            Unlock the full creative suite — every model, cleaner exports, faster
            generation, and a workflow built end to end for TikTok Shop content.
          </motion.p>

          <motion.div className="pp__divider" {...intro(0.48)} />

          <ul className="pp__features">
            {FEATURES.map((f, i) => (
              <FeatureRow key={f.id} feature={f} index={i} onReveal={() => play('reveal')} />
            ))}
          </ul>

          <motion.div className={`pp__cta-zone ${ctaNear ? 'is-near' : ''}`} {...intro(0.6)}>
            {/* Shapes that live around the button. */}
            <span className="pp__cta-orbit" aria-hidden="true" />
            <span className="pp__cta-orbit pp__cta-orbit--2" aria-hidden="true" />
            <span className="pp__cta-glow" aria-hidden="true" />

            <button
              ref={ctaRef}
              type="button"
              className="pp__cta"
              onClick={handleUnlock}
              onMouseEnter={() => play('hover')}
              onFocus={() => play('hover')}
              disabled={busy}
            >
              <span className="pp__cta-text">
                {busy ? 'Opening Stripe…' : 'Unlock Launchly Pro'}
              </span>
              {ripple > 0 && <span key={ripple} className="pp__ripple" aria-hidden="true" />}
            </button>

            <p className="pp__micro">£5/month · cancel anytime · secure payment via Stripe</p>

            {onDismiss && (
              <button type="button" className="pp__ghost" onClick={onDismiss}>
                Maybe later
              </button>
            )}

            {error && (
              <p className="pp__notice" role="status">
                We couldn’t load subscription details right now. Please try again.
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
