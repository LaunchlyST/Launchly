import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AI_MODELS, AIProvider } from './aiModels';
import { sound } from '../sound/sound';

interface ModelCurveProps {
  value: string;
  onChange: (id: string) => void;
}

/** Small, subtle provider mark shown under the model name. */
function ProviderMark({ provider }: { provider: AIProvider }) {
  if (provider === 'claude') {
    // Radiating burst
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <line x1="12" y1="3" x2="12" y2="9" />
        <line x1="12" y1="15" x2="12" y2="21" />
        <line x1="3" y1="12" x2="9" y2="12" />
        <line x1="15" y1="12" x2="21" y2="12" />
        <line x1="5.6" y1="5.6" x2="9.5" y2="9.5" />
        <line x1="14.5" y1="14.5" x2="18.4" y2="18.4" />
        <line x1="18.4" y1="5.6" x2="14.5" y2="9.5" />
        <line x1="9.5" y1="14.5" x2="5.6" y2="18.4" />
      </svg>
    );
  }
  // Interlocking knot
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3.4a8.6 8.6 0 0 1 7.4 4.3" />
      <path d="M19.4 16.3A8.6 8.6 0 0 1 12 20.6" />
      <path d="M4.6 16.3A8.6 8.6 0 0 1 4.6 7.7" />
    </svg>
  );
}

/* ── Curve geometry ──────────────────────────────────────────────────────
 * Models ride a shallow arc. The selected one sits at the FRONT — the lowest,
 * nearest point of the curve — and its neighbours travel up and back along it,
 * shrinking, fading and blurring with distance. One circular path, no lists.
 */

/** Half-width of the arc, px. */
const ARC_RX = 128;
/** How far the curve rises away from the viewer at its edges, px. */
const ARC_RY = 26;
/** Angle between two adjacent models along the curve, radians. */
const STEP_ANGLE = 0.62;
/** Models drawn either side of the selected one. */
const NEIGHBOURS = 2;

/** Position/appearance on the curve for a signed distance from the front. */
function seatOnCurve(d: number) {
  const angle = d * STEP_ANGLE;
  const depth = 1 - Math.cos(angle); // 0 at the front, grows going back
  const ad = Math.abs(d);
  return {
    x: Math.sin(angle) * ARC_RX,
    // Negative = up the sides of the valley. The front seat is the low point.
    y: -depth * ARC_RY,
    scale: Math.max(0.6, 1 - ad * 0.17),
    blur: Math.min(4.5, ad * 1.7),
    // Front card is fully opaque; the ones behind sit back in the haze.
    opacity: ad === 0 ? 1 : Math.max(0, 0.52 - (ad - 1) * 0.2),
    z: 20 - Math.round(ad * 4),
  };
}

/** Idle time before the neighbours sink back behind the curve. */
const IDLE_MS = 2200;
/** Minimum gap between steps driven by wheel/drag. */
const STEP_COOLDOWN_MS = 210;
/** Horizontal drag distance that counts as one step. */
const DRAG_STEP_PX = 62;

export function ModelCurve({ value, onChange }: ModelCurveProps) {
  const activeIndex = Math.max(0, AI_MODELS.findIndex((m) => m.id === value));

  /** True while the user is engaging with the curve — neighbours are visible. */
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockPulse, setLockPulse] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const lastStep = useRef(0);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  /** Any interaction reveals the curve and restarts the idle countdown. */
  const wake = useCallback(() => {
    setOpen(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setOpen(false), IDLE_MS);
  }, []);

  const rest = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setOpen(false), 420);
  }, []);

  useEffect(
    () => () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    },
    []
  );

  /** Move the selection `dir` seats along the curve. */
  const step = useCallback(
    (dir: number) => {
      if (lockedRef.current) return;
      const n = AI_MODELS.length;
      const from = AI_MODELS.findIndex((m) => m.id === value);
      const next = (((from + dir) % n) + n) % n;
      if (next === from) return;
      onChange(AI_MODELS[next].id);
      sound.tick?.();
      wake();
    },
    [value, onChange, wake]
  );

  /** Select a specific seat — it glides to the front. */
  const selectIndex = useCallback(
    (index: number) => {
      if (lockedRef.current || index === activeIndex) return;
      onChange(AI_MODELS[index].id);
      sound.tick?.();
      wake();
    },
    [activeIndex, onChange, wake]
  );

  // Wheel / trackpad, horizontal or vertical.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 1) return;
      e.preventDefault();
      wake();
      if (lockedRef.current) return;
      if (Date.now() - lastStep.current < STEP_COOLDOWN_MS) return;
      lastStep.current = Date.now();
      step(delta > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [step, wake]);

  const onPointerDown = (e: React.PointerEvent) => {
    wake();
    if (lockedRef.current) return;
    drag.current = { x: e.clientX, moved: false };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const steps = Math.round((d.x - ev.clientX) / DRAG_STEP_PX);
      if (steps !== 0) {
        drag.current = { x: ev.clientX, moved: true };
        step(steps > 0 ? 1 : -1);
      }
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Double click on the front card locks the choice in place. */
  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    lockedRef.current = next;
    setLockPulse(true);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setLockPulse(false), 520);
    next ? sound.snap?.() : sound.tick?.();
    wake();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    wake();
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleLock();
    }
  };

  /**
   * The seats currently on the curve: the selected model at the front plus a
   * couple either side. Rendering a stable window (rather than every model)
   * keeps the DOM small and stops distant cards from piling up at the edges.
   */
  const seats = useMemo(() => {
    const n = AI_MODELS.length;
    const out: { model: (typeof AI_MODELS)[number]; index: number; d: number }[] = [];
    for (let d = -NEIGHBOURS; d <= NEIGHBOURS; d++) {
      const index = (((activeIndex + d) % n) + n) % n;
      out.push({ model: AI_MODELS[index], index, d });
    }
    // Farthest first so the front card paints last, over its neighbours.
    return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  }, [activeIndex]);

  const active = AI_MODELS[activeIndex];

  return (
    <div
      ref={rootRef}
      className={['model-curve', open ? 'is-open' : '', locked ? 'is-locked' : '', lockPulse ? 'is-pulsing' : '']
        .filter(Boolean)
        .join(' ')}
      onPointerDown={onPointerDown}
      onPointerEnter={wake}
      onPointerLeave={rest}
      // Locking is a deliberate act on a model card. A double-click on the
      // empty curve area must do nothing at all.
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest('.model-curve__card')) {
          e.stopPropagation();
        }
      }}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="listbox"
      aria-label="AI model — scroll or drag along the curve to browse"
      aria-activedescendant={`model-seat-${active.id}`}
    >
      {/* The path the models ride along */}
      <svg className="model-curve__track" viewBox="0 0 280 92" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="mcFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(15,23,42,0)" />
            <stop offset="30%" stopColor="rgba(15,23,42,0.16)" />
            <stop offset="50%" stopColor="rgba(15,23,42,0.22)" />
            <stop offset="70%" stopColor="rgba(15,23,42,0.16)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </linearGradient>
        </defs>
        {/*
         * A shallow valley the models ride, lowest at the centre where the
         * selected card rests. `non-scaling-stroke` keeps the line an even
         * hairline — without it the stretched viewBox thickens the middle and
         * the curve reads as a crease rather than an arc.
         */}
        <path
          className="model-curve__line"
          d="M 10 40 Q 140 74 270 40"
          fill="none"
          stroke="url(#mcFade)"
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="model-curve__stage">
        {seats.map(({ model, index, d }) => {
          const seat = seatOnCurve(d);
          const isFront = d === 0;
          return (
            <button
              key={model.id}
              type="button"
              id={`model-seat-${model.id}`}
              role="option"
              aria-selected={isFront}
              tabIndex={-1}
              className={`model-curve__card ${isFront ? 'is-front' : 'is-behind'}`}
              style={
                {
                  transform: `translate(-50%, -50%) translate3d(${seat.x}px, ${seat.y}px, 0) scale(${seat.scale})`,
                  opacity: open || isFront ? seat.opacity : isFront ? 1 : 0,
                  filter: seat.blur ? `blur(${seat.blur}px)` : 'none',
                  zIndex: seat.z,
                  pointerEvents: open && !isFront ? 'auto' : isFront ? 'auto' : 'none',
                } as React.CSSProperties
              }
              onClick={(e) => {
                e.stopPropagation();
                if (drag.current?.moved) return;
                if (isFront) return;
                selectIndex(index);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (isFront) toggleLock();
              }}
            >
              <span className="model-curve__name">
                {model.name} {model.version}
              </span>
              <span className="model-curve__logo" aria-hidden="true">
                <ProviderMark provider={model.provider} />
              </span>
            </button>
          );
        })}
      </div>

      <span className="model-curve__lock" aria-hidden="true">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>

      <span className="sr-only" aria-live="polite">
        {active.name} {active.version}
        {locked ? ', locked' : ''}
      </span>
    </div>
  );
}
