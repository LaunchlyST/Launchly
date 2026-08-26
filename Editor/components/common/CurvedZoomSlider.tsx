import React, { useRef, useState, useCallback } from 'react';
import { sound } from '../../lib/sound';

interface CurvedZoomSliderProps {
  value: number; // 0..100
  onChange: (v: number) => void;
}

export function CurvedZoomSlider({ value, onChange }: CurvedZoomSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const lastTickRef = useRef(0);
  const lastSnapRef = useRef<number | null>(null);

  // Snap points: 0, 25, 50, 75, 100 — center 50 is strongest
  const snapPoints = [0, 25, 50, 75, 100];

  const getSnapped = (v: number) => {
    for (const p of snapPoints) {
      if (Math.abs(v - p) < 4) return p;
    }
    return v;
  };

  const updateFromClientX = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const t = Math.max(0, Math.min(1, x / rect.width));
    let v = Math.round(t * 100);
    const snapped = getSnapped(v);
    const isSnap = snapped !== v;
    v = snapped;
    if (isSnap && lastSnapRef.current !== snapped) {
      lastSnapRef.current = snapped;
      if (snapped === 50) sound.snap();
      else if (snapped === 0 || snapped === 100) sound.limit();
      else sound.tick();
    } else if (!isSnap) {
      lastSnapRef.current = null;
      if (Date.now() - lastTickRef.current > 90) {
        // subtle tick while dragging between snaps
      }
    }
    // Limit resistance at extremes
    if ((v === 0 && t < 0.02) || (v === 100 && t > 0.98)) {
      // visual resistance handled via CSS, sound done above
    }
    onChange(v);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    updateFromClientX(e.clientX);
    const onMove = (ev: MouseEvent) => updateFromClientX(ev.clientX);
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Position along curved arc: y = 18 - 14 * sin(pi * t)
  const getHandlePos = (v: number) => {
    const t = v / 100;
    const x = 8 + t * 144; // track width 160, padding 8
    const y = 22 - 12 * Math.sin(Math.PI * t);
    return { x, y };
  };

  const handlePos = getHandlePos(value);
  const isAtLimit = value === 0 || value === 100;
  const isNearCenter = Math.abs(value - 50) < 6;

  // Build arc path
  const arcPath = `M 8 22 Q 80 2 152 22`;

  return (
    <div className={`curved-zoom ${dragging ? 'dragging' : ''} ${isAtLimit ? 'at-limit' : ''} ${isNearCenter ? 'near-center' : ''}`} ref={trackRef} onMouseDown={handleMouseDown}>
      <svg width="160" height="30" viewBox="0 0 160 30" className="curved-zoom__svg">
        {/* Track base */}
        <path d={arcPath} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="6" strokeLinecap="round" />
        {/* Active fill */}
        <path
          d={arcPath}
          fill="none"
          stroke={value < 50 ? '#10B981' : value > 85 ? '#F472B6' : value > 60 ? '#F59E0B' : '#0891B2'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 158} 158`}
          style={{ transition: dragging ? 'none' : 'stroke-dasharray 180ms ease, stroke 200ms ease' }}
        />
        {/* Magnetic snap points */}
        {snapPoints.map((p) => {
          const pos = getHandlePos(p);
          const isActive = Math.abs(value - p) < 4;
          return <circle key={p} cx={pos.x} cy={pos.y} r={isActive ? 2.5 : 1.5} fill={isActive ? '#111827' : 'rgba(15,23,42,0.25)'} style={{ transition: 'all 150ms ease' }} />;
        })}
        {/* Center dominant marker */}
        <circle cx={getHandlePos(50).x} cy={getHandlePos(50).y - 1} r="3" fill="none" stroke="rgba(15,23,42,0.15)" strokeWidth="1" />
      </svg>
      {/* Handle */}
      <div
        className="curved-zoom__handle"
        style={{ left: `${handlePos.x}px`, top: `${handlePos.y}px` }}
        aria-label="Zoom"
      >
        <div className="curved-zoom__handle-dot" />
        {isAtLimit && <span className="curved-zoom__limit-pulse" />}
      </div>
      {/* Invisible hit area */}
      <div className="curved-zoom__hitarea" />
    </div>
  );
}
