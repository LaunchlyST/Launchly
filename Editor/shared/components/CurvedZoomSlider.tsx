import React, { useRef, useState, useCallback, useEffect } from 'react';
import { sound } from '../utils/sound';
import {
  NORMAL_STAGES,
  colorForZoomValue,
  colorForZoomValueAlpha,
  snapZoomValue,
  secondsForZoomValue,
  formatZoomLabel,
} from '../../timeline/logic/timelineZoom';

interface CurvedZoomSliderProps {
  /** Slider position 0..100 (pinned at 100 while in extended mode). */
  value: number;
  /** True once the visible duration exceeds the normal 1h maximum. */
  extended?: boolean;
  /** How deep into extended mode, 0..1 — drives the violet end of the colour ramp. */
  extendedProgress?: number;
  /** True once the user has confirmed Extended Timeline Mode this session. */
  extendedUnlocked?: boolean;
  onChange: (v: number) => void;
  /** User pushed past the right edge — either confirm extended, or step it up. */
  onPushMax?: (anchorX: number) => void;
  /** User pushed past the left edge while already at 5s. */
  onPushMin?: () => void;
  /** Wheel / trackpad over the control. dir: +1 = longer timeline, -1 = shorter. */
  onWheelStep?: (dir: number, anchorX: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

const W = 210; // svg width — wider so the ten stages are not cramped
const H = 34; // svg height
const PAD = 12; // horizontal padding of the arc
const SPAN = W - PAD * 2;
const ARC_LIFT = 10; // flatter arc: the handle stays nearer one line, easier to aim

/** Point on the arc for a 0..1 progress. */
function arcPoint(t: number) {
  const k = Math.max(0, Math.min(1, t));
  const x = PAD + k * SPAN;
  const y = 24 - ARC_LIFT * Math.sin(Math.PI * k);
  return { x, y };
}

/** Approximate arc length up to t, so the gradient fill tracks the handle. */
function arcLengthAt(t: number) {
  const steps = 48;
  const limit = Math.max(0, Math.min(1, t));
  let len = 0;
  let prev = arcPoint(0);
  for (let i = 1; i <= steps; i++) {
    const p = arcPoint((i / steps) * limit);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

const TOTAL_LEN = arcLengthAt(1);
const ARC_PATH = `M ${PAD} 24 Q ${W / 2} ${24 - ARC_LIFT * 1.27} ${W - PAD} 24`;

export function CurvedZoomSlider({
  value,
  extended = false,
  extendedProgress = 0,
  extendedUnlocked = false,
  onChange,
  onPushMax,
  onPushMin,
  onWheelStep,
  onDragStateChange,
}: CurvedZoomSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [overdrag, setOverdrag] = useState(0); // -1..1, elastic resistance at the ends
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const lastSnapRef = useRef<number | null>(null);
  const lastEdgeRef = useRef(0);
  const lastWheelRef = useRef(0);

  useEffect(() => onDragStateChange?.(dragging), [dragging, onDragStateChange]);

  /**
   * Screen x of the handle — the exact point the popup should point back at.
   * Falls back to the arc's right end, which is where a max push happens.
   */
  const handleClientX = useCallback((v: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / W;
    return rect.left + arcPoint(Math.max(0, Math.min(1, v / 100))).x * scale;
  }, []);

  // A drag binds its pointermove listener once, so the handlers it calls must be
  // read from a ref or they would stay frozen at their drag-start values.
  const liveRef = useRef({ onChange, onPushMax, onPushMin, extendedUnlocked, handleClientX });
  liveRef.current = { onChange, onPushMax, onPushMin, extendedUnlocked, handleClientX };

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = (clientX - rect.left) / rect.width;
      const t = Math.max(0, Math.min(1, raw));

      // Elastic resistance + edge intents once the pointer leaves the track.
      if (raw > 1.02) {
        setOverdrag(Math.min(1, (raw - 1) * 3));
        if (Date.now() - lastEdgeRef.current > (liveRef.current.extendedUnlocked ? 260 : 900)) {
          lastEdgeRef.current = Date.now();
          // Anchor on the handle, i.e. the right end of the arc being pushed past.
          liveRef.current.onPushMax?.(liveRef.current.handleClientX(100));
        }
      } else if (raw < -0.02) {
        setOverdrag(Math.max(-1, raw * 3));
        if (Date.now() - lastEdgeRef.current > 900) {
          lastEdgeRef.current = Date.now();
          liveRef.current.onPushMin?.();
        }
      } else {
        setOverdrag(0);
      }

      const next = snapZoomValue(t * 100);
      const isSnap = NORMAL_STAGES.some((s) => s.value === next);
      if (isSnap && lastSnapRef.current !== next) {
        lastSnapRef.current = next;
        if (next === 0 || next === 100) sound.limit?.();
        else if (next === 50) sound.snap?.();
        else sound.tick?.();
      } else if (!isSnap) {
        lastSnapRef.current = null;
      }
      liveRef.current.onChange(next);
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    lastEdgeRef.current = 0;
    updateFromClientX(e.clientX);
    const onMove = (ev: PointerEvent) => updateFromClientX(ev.clientX);
    const onUp = () => {
      setDragging(false);
      setOverdrag(0);
      lastSnapRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Wheel / trackpad over the control. Native listener so preventDefault works.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 1) return;
      if (Date.now() - lastWheelRef.current < 110) return;
      lastWheelRef.current = Date.now();
      onWheelStep?.(delta > 0 ? 1 : -1, handleClientX(value));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheelStep]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (value >= 100) onWheelStep?.(1, handleClientX(value));
      else onChange(Math.min(100, value + 2));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (extended) onWheelStep?.(-1, handleClientX(value));
      else if (value <= 0) onPushMin?.();
      else onChange(Math.max(0, value - 2));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(100);
    }
  };

  // Hovering shows the stage you'd land on, so you can aim before committing.
  const handleHover = (e: React.PointerEvent) => {
    if (dragging) return;
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = (e.clientX - rect.left) / rect.width;
    if (raw < 0 || raw > 1) return setHoverValue(null);
    setHoverValue(snapZoomValue(Math.max(0, Math.min(1, raw)) * 100));
  };

  const t = Math.max(0, Math.min(1, value / 100));
  const pos = arcPoint(t);
  const showHover = hoverValue !== null && !dragging && Math.abs(hoverValue - value) > 0.5;
  const hoverPos = hoverValue !== null ? arcPoint(hoverValue / 100) : null;
  const color = colorForZoomValue(value, extendedProgress);
  const atMin = value <= 0.5;
  const atMax = value >= 99.5;
  const fillLen = arcLengthAt(t);

  return (
    <div
      ref={trackRef}
      className={['curved-zoom', dragging ? 'dragging' : '', atMin ? 'at-min' : '', atMax ? 'at-max' : '', extended ? 'is-extended' : '']
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--zoom-color': color,
          '--zoom-glow': colorForZoomValueAlpha(value, 0.42, extendedProgress),
          '--zoom-glow-soft': colorForZoomValueAlpha(value, 0.16, extendedProgress),
          transform: `translateX(${overdrag * 4}px)`,
        } as React.CSSProperties
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handleHover}
      onPointerLeave={() => setHoverValue(null)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="slider"
      aria-label="Timeline zoom — visible duration"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="curved-zoom__svg">
        <defs>
          <linearGradient id="czGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colorForZoomValue(0)} />
            <stop offset="50%" stopColor={colorForZoomValue(50)} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>

        {/* Inactive track */}
        <path d={ARC_PATH} fill="none" stroke="rgba(15,23,42,0.09)" strokeWidth="6" strokeLinecap="round" />

        {/* Soft glow beneath the active portion */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          opacity={dragging ? 0.22 : 0.1}
          strokeDasharray={`${fillLen} ${TOTAL_LEN}`}
          style={{ filter: 'blur(3px)', transition: dragging ? 'none' : 'stroke-dasharray 220ms ease, opacity 200ms ease' }}
        />

        {/* Active gradient fill */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke="url(#czGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${fillLen} ${TOTAL_LEN}`}
          style={{ transition: dragging ? 'none' : 'stroke-dasharray 220ms cubic-bezier(0.22,1,0.36,1)' }}
        />

        {/* Stage markers */}
        {NORMAL_STAGES.map((stage) => {
          const p = arcPoint(stage.value / 100);
          const passed = value >= stage.value - 0.5;
          const active = Math.abs(value - stage.value) < 1.5;
          return (
            <circle
              key={stage.seconds}
              cx={p.x}
              cy={p.y}
              r={active ? 2.4 : 1.3}
              fill={passed ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.22)'}
              style={{ transition: 'r 160ms ease, fill 200ms ease' }}
            />
          );
        })}
      </svg>

      {/* Ghost of the stage under the cursor, before you commit to it */}
      {showHover && hoverPos && (
        <>
          <span className="curved-zoom__ghost" style={{ left: `${hoverPos.x}px`, top: `${hoverPos.y}px` }} />
          <span className="curved-zoom__ghost-label" style={{ left: `${hoverPos.x}px` }}>
            {formatZoomLabel(secondsForZoomValue(hoverValue!))}
          </span>
        </>
      )}

      {/* Handle */}
      <div className="curved-zoom__handle" style={{ left: `${pos.x}px`, top: `${pos.y}px` }}>
        <span className="curved-zoom__handle-ring" />
        {extended && <span className="curved-zoom__handle-inf">∞</span>}
        {(atMin || atMax) && dragging && <span className="curved-zoom__limit-pulse" />}
      </div>
    </div>
  );
}
