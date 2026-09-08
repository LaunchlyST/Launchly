import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { LandscapeScene } from './LandscapeScene';
import { useSound } from './useSound';
import './dashboard-paywall.css';

export interface DashboardPaywallProps {
  /** The existing Stripe checkout handler. Unchanged. */
  onUnlock: () => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
}

/**
 * Things the workspace actually does today. Nothing here promises credits,
 * included generation or free API usage.
 */
const PANELS = [
  {
    id: 'models',
    title: 'ChatGPT and Grok',
    body: 'Pick the model per job and switch whenever you need to.',
    side: 'left' as const,
    at: 0.1,
  },
  {
    id: 'media',
    title: 'Images and video',
    body: 'Generate product stills or short video from the same prompt.',
    side: 'right' as const,
    at: 0.26,
  },
  {
    id: 'styles',
    title: 'Realistic or cartoon',
    body: 'Style presets tuned for product content.',
    side: 'left' as const,
    at: 0.44,
  },
  {
    id: 'keys',
    title: 'Your own API keys',
    body: 'Keys stay in your browser. You keep direct control of usage.',
    side: 'right' as const,
    at: 0.6,
  },
];

/**
 * The unpaid gate on /dashboard.
 *
 * The offer panel is anchored dead centre and never moves: price and button
 * are on screen the moment the page paints, and stay there for the whole
 * scroll. Scrolling dollies the landscape and brings supporting panels in
 * beside the offer — outside its column, behind it in depth, so they can
 * never cover the price or the button.
 */
export function DashboardPaywall({ onUnlock, busy = false, error = null }: DashboardPaywallProps) {
  const { muted, toggle, play } = useSound();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [entry, setEntry] = useState(0);
  const [pressed, setPressed] = useState(false);

  /* ---- entry camera move ------------------------------------------------ */
  useEffect(() => {
    const t = requestAnimationFrame(() => setEntry(1));
    return () => cancelAnimationFrame(t);
  }, []);

  /* ---- scroll drives the camera; fully reversible ----------------------- */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
  }, []);

  const handleUnlock = async () => {
    if (busy) return;
    play('click');
    await onUnlock(); // unchanged Stripe checkout
  };

  /** A panel's reveal: fades and settles as progress passes its cue. */
  const panelStyle = (at: number) => {
    const span = 0.18;
    const t = Math.min(1, Math.max(0, (progress - at) / span));
    // Fades back out near the very end so the scroll has a clear finish.
    const out = progress > 0.9 ? Math.max(0, 1 - (progress - 0.9) / 0.1) : 1;
    return {
      opacity: t * out,
      transform: `translate3d(0, ${(1 - t) * 26}px, 0) scale(${0.97 + t * 0.03})`,
    };
  };

  return (
    /* The container itself scrolls. Nothing is layered over the offer, so the
       button stays directly clickable while the wheel still drives the camera. */
    <div className="dp" ref={scrollRef} onScroll={onScroll}>
      <div className="dp__scene">
        <LandscapeScene progress={progress} entry={entry} />
      </div>

      <button
        type="button"
        className="dp__sound"
        onClick={toggle}
        aria-pressed={!muted}
        aria-label={muted ? 'Enable sound' : 'Mute sound'}
      >
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        <span className="dp__sound-label">{muted ? 'Sound off' : 'Sound on'}</span>
      </button>

      {/* Supporting panels sit in their own layer, behind the offer. */}
      <div className="dp__aside" aria-hidden={progress < 0.05}>
        {PANELS.map((p) => (
          <article
            key={p.id}
            className={`dp__panel dp__panel--${p.side} dp__panel--${p.id}`}
            style={panelStyle(p.at)}
          >
            <h2 className="dp__panel-title">{p.title}</h2>
            <p className="dp__panel-body">{p.body}</p>
          </article>
        ))}
      </div>

      {/* The offer. Anchored: never scrolls, never covered. */}
      <div className="dp__anchor">
        <section
          className="dp__offer"
          style={{
            opacity: entry,
            transform: `translate3d(0, ${(1 - entry) * 18}px, 0) scale(${0.98 + entry * 0.02})`,
          }}
          aria-label="Launchly Pro subscription"
        >
          <p className="dp__brand">Launchly</p>
          <h1 className="dp__title">Create your next TikTok Shop ad.</h1>
          <p className="dp__lede">
            Access the creative workspace for making product images and videos.
          </p>

          <div className="dp__rule" />

          <p className="dp__price">
            <span className="dp__amount">£5</span>
            <span className="dp__period">/ month</span>
          </p>

          <button
            type="button"
            className={`dp__cta ${pressed ? 'is-pressed' : ''}`}
            onClick={handleUnlock}
            onMouseEnter={() => play('hover')}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            disabled={busy}
          >
            {busy ? 'Opening Stripe…' : 'Get access'}
          </button>

          <p className="dp__note">
            Your own API keys are required. Generation costs are billed separately by
            the provider.
          </p>

          {error && (
            <p className="dp__error" role="status">
              We couldn’t load subscription details right now. Please try again.
            </p>
          )}
        </section>
      </div>

      {/* Scroll driver: tall enough to pace the reveal, with a defined end. */}
      <div className="dp__track" />

      {/* Mobile reads the panels as ordinary stacked content below the fold. */}
      <div className="dp__stack">
        {PANELS.map((p) => (
          <article key={p.id} className="dp__stack-item">
            <h2 className="dp__panel-title">{p.title}</h2>
            <p className="dp__panel-body">{p.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
