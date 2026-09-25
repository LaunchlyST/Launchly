import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown } from 'lucide-react';
import { CoastalScene } from './CoastalScene';
import { FeedbackMenu } from './FeedbackMenu';
import { PLANS } from './plans';
import './dashboard-paywall.css';

export interface DashboardPaywallProps {
  /** The existing Stripe checkout handler. Unchanged. */
  onUnlock: () => void | Promise<void>;
  /** The Free card ("enter" action) sends them straight to the dashboard. */
  onEnter?: () => void;
  busy?: boolean;
  error?: string | null;
}

/** How far the page scrolls, in viewport heights, to run the camera. */
const TRAVEL_VH = 1.15;
/** Progress at which the camera stops and the cards are fully usable. */
const REVEALED = 0.62;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
/** Smoothstep, so a reversal mid-move has no visible kink. */
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * The unpaid gate on /dashboard.
 *
 * One scroll-progress value (0 at the top of the section, 1 at its end) drives
 * everything: the camera pushes into the scene, the introduction fades, and
 * the three plans rise into the middle with a short stagger. Because every
 * style is derived from that value rather than accumulated, scrolling back up
 * plays the whole thing backwards — including a reversal halfway through.
 *
 * Reduced motion and narrow screens skip the camera entirely and lay the plans
 * out as ordinary scrolling content, so nothing is reachable only by animation.
 */
export function DashboardPaywall({ onUnlock, onEnter, busy = false, error = null }: DashboardPaywallProps) {
  const [progress, setProgress] = useState(0);
  const [flat, setFlat] = useState(false);
  const plansRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);

  /* ---- flat mode: reduced motion, or a screen too narrow for a camera --- */
  useEffect(() => {
    const queries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(max-width: 860px)'),
    ];
    const sync = () => setFlat(queries.some((q) => q.matches));
    sync();
    queries.forEach((q) => q.addEventListener('change', sync));
    return () => queries.forEach((q) => q.removeEventListener('change', sync));
  }, []);

  /* ---- one progress value, from the document's own scroll --------------- */
  useEffect(() => {
    if (flat) {
      setProgress(1);
      return;
    }
    const read = () => {
      frame.current = 0;
      const travel = window.innerHeight * TRAVEL_VH;
      setProgress(travel > 0 ? clamp01(window.scrollY / travel) : 0);
    };
    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [flat]);

  /* The page owns the scrollbar while this is open; the app shell doesn't. */
  useEffect(() => {
    document.body.classList.add('dp-open');
    return () => document.body.classList.remove('dp-open');
  }, []);

  const handleUnlock = async () => {
    if (busy) return;
    await onUnlock(); // unchanged Stripe checkout
  };

  const goToPlans = useCallback(() => {
    if (flat) {
      plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    window.scrollTo({ top: window.innerHeight * TRAVEL_VH * 0.78, behavior: 'smooth' });
  }, [flat]);

  const goToScenery = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* ---- derived camera and reveal --------------------------------------- */
  const zoom = flat ? 0 : ease(clamp01(progress / REVEALED));
  const introOut = flat ? 1 : ease(clamp01(progress / 0.34));
  const revealed = flat || progress >= REVEALED * 0.92;

  /** Each card fades and rises on its own short cue. */
  const cardStyle = (index: number) => {
    if (flat) return undefined;
    const t = ease(clamp01((progress - (0.3 + index * 0.06)) / 0.24));
    return {
      opacity: t,
      transform: `translate3d(0, ${(1 - t) * 34}px, 0) scale(${0.97 + t * 0.03})`,
    };
  };

  const plansVisible = flat || progress > 0.3;

  return (
    <div className={`dp ${flat ? 'dp--flat' : ''}`}>
      {/* Header controls: fixed, never scaled, never blurred. */}
      <header className="dp__chrome">
        <p className="dp__badge">Launchly</p>
        <div className="dp__chrome-right">
          <FeedbackMenu />
        </div>
      </header>

      <section className="dp__stage" style={flat ? undefined : { height: `calc(100vh + ${TRAVEL_VH * 100}vh)` }}>
        <div className="dp__sticky">
          <CoastalScene zoom={zoom} still={flat} scrim={flat ? 1 : ease(clamp01((progress - 0.24) / 0.3))} />

          {/* Zoomed out: the introduction. */}
          <div
            className="dp__intro"
            style={flat ? undefined : { opacity: 1 - introOut, transform: `translate3d(0, ${introOut * -14}px, 0)` }}
            aria-hidden={!flat && introOut > 0.9}
          >
            <h1 className="dp__intro-title">Your next creation starts here.</h1>
            <button type="button" className="dp__explore" onClick={goToPlans}>
              Explore plans
            </button>
            {!flat && (
              <p className="dp__hint">
                <ChevronDown size={15} strokeWidth={2} />
                <span>Scroll to explore</span>
              </p>
            )}
          </div>

          {/* Revealed: the three plans. Inert until they are actually up. */}
          <div
            className="dp__plans"
            ref={plansRef}
            style={flat ? undefined : { pointerEvents: revealed ? 'auto' : 'none' }}
            aria-hidden={!plansVisible}
            {...(!plansVisible ? { inert: '' as unknown as boolean } : {})}
          >
            {PLANS.map((plan, i) => (
              <article
                key={plan.id}
                className={`dp__card ${plan.featured ? 'dp__card--featured' : ''}`}
                style={cardStyle(i)}
              >
                {plan.featured && <span className="dp__tag">Full workspace</span>}
                <h2 className="dp__card-name">{plan.name}</h2>
                <p className="dp__card-note">{plan.note}</p>

                <p className="dp__card-price">
                  <span className={`dp__amount ${plan.period ? '' : /\d/.test(plan.price) ? '' : 'dp__amount--words'}`}>
                    {plan.price}
                  </span>
                  {plan.period && <span className="dp__period">{plan.period}</span>}
                </p>

                <ul className="dp__list">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Check size={13} strokeWidth={2.6} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="dp__card-foot">
                  {plan.action === 'checkout' ? (
                    <button
                      type="button"
                      className="dp__cta"
                      onClick={handleUnlock}
                      disabled={busy}
                      tabIndex={plansVisible ? 0 : -1}
                    >
                      {busy ? 'Opening Stripe…' : 'Get access'}
                    </button>
                  ) : plan.action === 'enter' ? (
                    <button
                      type="button"
                      className="dp__cta"
                      onClick={onEnter}
                      tabIndex={plansVisible ? 0 : -1}
                    >
                      Continue with Free
                    </button>
                  ) : (
                    <p className="dp__status" aria-live="off">
                      Not available yet
                    </p>
                  )}
                  <p className="dp__fine">{plan.fine}</p>
                </div>
              </article>
            ))}

            {error && (
              <p className="dp__error" role="status">
                We couldn’t load subscription details right now. Please try again.
              </p>
            )}
          </div>

          {!flat && (
            <button
              type="button"
              className="dp__back"
              onClick={goToScenery}
              style={{ opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none' }}
              tabIndex={revealed ? 0 : -1}
            >
              <ArrowUp size={14} strokeWidth={2} />
              Back to scenery
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
