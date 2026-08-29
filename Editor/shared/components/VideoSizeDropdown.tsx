import React, { useState, useRef, useEffect } from 'react';
import { ASPECT_RATIOS } from '../../preview/config/aspectRatios';

interface VideoSizeDropdownProps {
  value: string;
  onChange: (id: string) => void;
}

function AspectIcon({ ratio, size = 18 }: { ratio: string; size?: number }) {
  if (ratio === '16:9') {
    return (
      <svg width={size} height={size * 0.6} viewBox="0 0 18 11" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="17" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  if (ratio === '9:16') {
    return (
      <svg width={size * 0.6} height={size} viewBox="0 0 11 18" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="10" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function VideoSizeDropdown({ value, onChange }: VideoSizeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = ASPECT_RATIOS.find((p) => p.id === value) ?? ASPECT_RATIOS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  return (
    <div className="video-size-dropdown" ref={ref}>
      <button
        className={`video-size-dropdown__trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        type="button"
      >
        <span className="video-size-dropdown__trigger-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <rect x="4" y="4" width="6" height="6" rx="0.8" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          </svg>
        </span>
        <span className="video-size-dropdown__trigger-label">
          <span className="video-size-dropdown__trigger-platform">{selected.platform}</span>
          <span className="video-size-dropdown__trigger-ratio">{selected.ratio}</span>
        </span>
        <span className={`video-size-dropdown__chevron ${open ? 'rotated' : ''}`} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="video-size-dropdown__menu" role="menu">
          <div className="video-size-dropdown__menu-title">Video Size</div>
          {ASPECT_RATIOS.map((preset) => {
            const isActive = preset.id === value;
            return (
              <button
                key={preset.id}
                role="menuitemradio"
                aria-checked={isActive}
                className={`video-size-dropdown__option ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onChange(preset.id);
                  setOpen(false);
                }}
                type="button"
              >
                <span className="video-size-dropdown__option-icon">
                  <AspectIcon ratio={preset.ratio} size={20} />
                </span>
                <span className="video-size-dropdown__option-text">
                  <strong>{preset.platform}</strong>
                  <em>{preset.ratio}</em>
                </span>
                {isActive && (
                  <span className="video-size-dropdown__check" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
