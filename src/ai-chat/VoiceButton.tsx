import React, { useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';

export type VoiceOption = 'Voice' | 'Chat' | 'Script' | 'Model';

const OPTIONS: VoiceOption[] = ['Voice', 'Chat', 'Script', 'Model'];

interface VoiceButtonProps {
  option: VoiceOption;
  onOptionChange: (option: VoiceOption) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}

/**
 * Voice/mode control. The menu is anchored to the button rather than
 * overlaying the textarea, so opening it never hides what is being typed.
 */
export function VoiceButton({ option, onOptionChange, open, onOpenChange, disabled }: VoiceButtonProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="composer-voice" ref={wrapRef}>
      <button
        type="button"
        className={`composer-pill ${open ? 'is-active' : ''}`}
        onClick={() => onOpenChange(!open)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Input mode"
      >
        <Mic size={13} strokeWidth={2} />
        <span>{option}</span>
      </button>

      {open && (
        <div className="composer-menu" role="menu">
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              role="menuitemradio"
              aria-checked={option === opt}
              className={`composer-menu__item ${option === opt ? 'is-selected' : ''}`}
              onClick={() => {
                onOptionChange(opt);
                onOpenChange(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
