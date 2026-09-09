import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Film, Monitor, Sliders, Layers } from 'lucide-react';
import { EditorBackdrop } from './EditorBackdrop';
import { FilmGrain } from './FilmGrain';
import { UnlockSequence, UnlockPhase, PHASE_AT } from './UnlockSequence';
import { PremiumPaywall } from './PremiumPaywall';
import './editor-backdrop.css';
import './paywall.css';

const EASE = [0.16, 1, 0.3, 1] as const;

const FEATURES = [
  { icon: Film, label: 'Full timeline, no clip limit' },
  { icon: Monitor, label: '4K export, no watermark' },
  { icon: Sliders, label: 'Colour grading and LUTs' },
  { icon: Layers, label: 'Unlimited projects' },
];

export interface PaywallProps {
  /**
   * 'gate' is the wall an unpaid user meets. 'active' is the same room shown to
   * someone who already subscribed -- /pricing after the fact.
   */
  variant?: 'gate' | 'active';
  /** True while a completed checkout is being verified server side. */
  verifying?: boolean;
  /** Runs the unlock cinematic instead of the paywall content. */
  unlocking?: boolean;
  error?: string | null;
  /** External checkout-in-flight flag (the host app's own loading state). */
  busy?: boolean;
  onUnlock: () => void | Promise<void>;
  onDismiss?: () => void;
  /** 'active' only: opens the Stripe billing portal. */
  onManage?: () => void | Promise<void>;
  /** 'active' only: the primary way back to the work. */
  onBack?: () => void;
  /** 'active' only: ISO date the subscription renews. */
  renewsOn?: string | null;
  /** Fires once the cinematic has finished (or been skipped). */
  onUnlockComplete?: () => void;
}

/**
 * The grading suite at night.
 *
 * The user's own room is behind the glass: their editor, blurred and dimmed,
 * lit from one direction. The paywall is the glass, not a card sitting on top.
 */
export function Paywall({
  variant = 'gate',
  verifying = false,
  unlocking = false,
  error = null,
  busy: busyProp = false,
  onUnlock,
  onDismiss,
  onManage,
  onBack,
  renewsOn = null,
  onUnlockComplete,
}: PaywallProps) {
  const reduce = useReducedMotion();
  const [busySelf, setBusySelf] = useState(false);
  const busy = busySelf || busyProp;
  const [phase, setPhase] = useState<UnlockPhase>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finished = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const complete = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    clearTimers();
    setPhase('done');
    onUnlockComplete?.();
  }, [onUnlockComplete]);

  /* ---- the unlock timeline ---------------------------------------------- */
  useEffect(() => {
    if (!unlocking || phase !== 'idle') return;

    if (reduce) {
      // A plain 200ms fade straight to the settled room.
      setPhase('settle');
      timers.current.push(setTimeout(complete, 200));
      return;
    }

    setPhase('release');
    (['push', 'arrival', 'settle'] as const).forEach((next) => {
      timers.current.push(
        setTimeout(() => setPhase(next), PHASE_AT[next] - PHASE_AT.release)
      );
    });
    timers.current.push(setTimeout(complete, PHASE_AT.done));
  }, [unlocking, phase, reduce, complete]);

  useEffect(() => clearTimers, []);

  /* The app frame (left rail) stays usable behind the glass -- sign out must
     keep working -- but it gets the room's darkness while this is open. */
  useEffect(() => {
    document.body.classList.add('pw-open');
    return () => document.body.classList.remove('pw-open');
  }, []);

  /* ---- skippable on click or Escape --------------------------------------
     Armed a beat late: the click that starts the sequence must not also skip
     it as it bubbles up to the window. */
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') return;
    let armed = false;
    const arm = setTimeout(() => {
      armed = true;
    }, 300);
    const skip = (e: Event) => {
      if (!armed) return;
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      complete();
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('click', skip);
    return () => {
      clearTimeout(arm);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('click', skip);
    };
  }, [phase, complete]);

  const releasing = phase !== 'idle';

  const handleUnlock = async () => {
    if (busy) return;
    setBusySelf(true);
    try {
      await onUnlock();
    } finally {
      setBusySelf(false);
    }
  };

  /* Content staggers in at 60ms intervals; on release it falls away at
     staggered rates in the opposite order — micro text first, headline last. */
  const item = (index: number, releaseRank: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: releasing
      ? { opacity: 0, y: 10, transition: { duration: 0.42, ease: EASE, delay: releaseRank * 0.05 } }
      : { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay: 0.45 + index * 0.06 } },
  });

  if (phase === 'done') {
    return <UnlockSequence phase="settle" />;
  }

  /* The unpaid gate is its own premium scene. Every other state — verifying,
     the unlock cinematic, and the 'active' room shown on /pricing — keeps the
     original treatment below. Declared after all hooks, so the hook count is
     unchanged on every render. */
  if (variant === 'gate' && !verifying && !unlocking && phase === 'idle') {
    return (
      <PremiumPaywall
        onUnlock={handleUnlock}
        busy={busy}
        error={error}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <>
      <div className={`pw ${releasing ? 'pw--releasing' : ''}`}>
        {/* The room, behind the glass. Breathing 1.04 → 1.05 over 24s so it is
            never quite a static JPEG — but nobody should notice it move. */}
        <motion.div
          className="pw__room"
          initial={reduce ? false : { opacity: 0 }}
          animate={{
            opacity: 1,
            scale: reduce ? 1.04 : [1.04, 1.05, 1.04],
            filter: releasing ? 'blur(0px)' : 'blur(0px)',
          }}
          transition={{
            opacity: { duration: 0.9, ease: EASE },
            scale: { duration: 24, ease: 'easeInOut', repeat: Infinity },
          }}
        >
          {/* Blur drops 24px → 8px as the glass lifts. */}
          <motion.div
            className="pw__room-inner"
            animate={{
              filter: releasing
                ? 'blur(8px) saturate(0.15) brightness(0.5)'
                : 'blur(24px) saturate(0.15) brightness(0.35)',
            }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <EditorBackdrop variant="behind" />
          </motion.div>
          <div className="pw__room-fringe pw__room-fringe--r">
            <EditorBackdrop variant="behind" />
          </div>
          <div className="pw__room-fringe pw__room-fringe--c">
            <EditorBackdrop variant="behind" />
          </div>
          <div className="pw__scanlines" />
          <div className="pw__cast" />
        </motion.div>

        {/* The light in the room drifts 2% over 20s. */}
        <motion.div
          className="pw__falloff"
          animate={
            reduce
              ? undefined
              : { x: ['-1%', '1%', '-1%'], y: ['0.6%', '-0.6%', '0.6%'] }
          }
          transition={{ duration: 20, ease: 'easeInOut', repeat: Infinity }}
          style={{ opacity: releasing ? 0.35 : 1, transition: 'opacity 500ms' }}
        />
        <div className="pw__vignette" />

        <div className="pw__grid">
          {verifying ? (
            <div className="pw__verify">
              <span className="pw__verify-bar" />
              <span>Confirming your payment</span>
            </div>
          ) : variant === 'active' ? (
            <div className="pw__col">
              <motion.p className="pw__eyebrow" {...item(0, 4)}>
                Launchly Pro
              </motion.p>

              <motion.h1 className="pw__headline" {...item(1, 5)}>
                The room is yours.
              </motion.h1>

              <motion.p className="pw__body" {...item(2, 3)}>
                Your subscription is active — the full timeline, 4K exports and
                colour grading are unlocked on this account.
              </motion.p>

              <motion.div className="pw__rows" {...item(3, 2)}>
                {FEATURES.map(({ icon: Icon, label }) => (
                  <div className="pw__row" key={label}>
                    <Icon size={16} strokeWidth={1.25} />
                    <span>{label}</span>
                  </div>
                ))}
              </motion.div>

              <motion.div className="pw__actions" {...item(4, 1)}>
                <button className="pw__cta" onClick={onBack} type="button">
                  Back to the editor
                </button>
                <button
                  className="pw__quiet"
                  onClick={() => onManage?.()}
                  disabled={busy}
                  type="button"
                >
                  {busy ? 'Opening…' : 'Manage subscription'}
                </button>
              </motion.div>

              <motion.p className="pw__micro" {...item(5, 0)}>
                {renewsOn
                  ? `£5/month · renews ${new Date(renewsOn).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })} · billed via Stripe`
                  : '£5/month · cancel anytime · billed via Stripe'}
              </motion.p>

              {error && <p className="pw__error">{error}</p>}
            </div>
          ) : (
            <div className="pw__col">
              <motion.p className="pw__eyebrow" {...item(0, 4)}>
                Launchly Pro
              </motion.p>

              <motion.h1 className="pw__headline" {...item(1, 5)}>
                Finish your edit.
              </motion.h1>

              <motion.p className="pw__body" {...item(2, 3)}>
                Your timeline is capped at three clips and every export carries a
                watermark — the cut you have already made is waiting on the other
                side of this.
              </motion.p>

              <motion.div className="pw__rows" {...item(3, 2)}>
                {FEATURES.map(({ icon: Icon, label }) => (
                  <div className="pw__row" key={label}>
                    <Icon size={16} strokeWidth={1.25} />
                    <span>{label}</span>
                  </div>
                ))}
              </motion.div>

              <motion.div {...item(4, 1)}>
                <button
                  className="pw__cta"
                  onClick={handleUnlock}
                  disabled={busy}
                  type="button"
                >
                  {busy ? 'Opening Stripe…' : 'Unlock Launchly Pro'}
                </button>
              </motion.div>

              <motion.p className="pw__micro" {...item(5, 0)}>
                £5/month · cancel anytime · secure payment via Stripe
              </motion.p>

              {onDismiss && (
                <motion.div {...item(6, 0)}>
                  <button className="pw__ghost" type="button" onClick={onDismiss}>
                    Maybe later
                  </button>
                </motion.div>
              )}

              {error && <p className="pw__error">{error}</p>}
            </div>
          )}
        </div>

        {/* Phase 1 — the amber floods outward along the hairlines. */}
        <motion.div
          className="pw__release"
          animate={releasing ? { opacity: [0, 1, 0], scale: [0.6, 2.4, 3.2] } : { opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        />

        <FilmGrain />
      </div>

      <UnlockSequence phase={phase} />
    </>
  );
}
