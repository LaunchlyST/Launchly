import React, { useState, useRef, useEffect } from 'react';
import { AI_MODELS } from '../../config/aiModels';
import { sound, isSoundMuted, setSoundMuted } from '../../lib/sound';

interface FloatingComposerProps {
  value: string;
  onChange: (v: string) => void;
  model: string;
  onModelChange: (v: string) => void;
  onSend: () => void;
}

export function FloatingComposer({ value, onChange, model, onModelChange, onSend }: FloatingComposerProps) {
  const effectiveModel = AI_MODELS.find((m) => m.id === model)?.id ?? AI_MODELS[0].id;
  const activeIndex = AI_MODELS.findIndex((m) => m.id === effectiveModel);
  const [focusedIndex, setFocusedIndex] = useState(activeIndex === -1 ? 0 : activeIndex);
  const [locked, setLocked] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [muted, setMuted] = useState(isSoundMuted());
  const [showActivePulse, setShowActivePulse] = useState<string | null>(null);
  const [isFaded, setIsFaded] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<number | null>(null);
  const fadeTimeout = useRef<number | null>(null);
  const rapidCount = useRef(0);
  const lastInteraction = useRef(0);
  const dragRef = useRef<{ startX: number; startFocused: number } | null>(null);

  // Keep focused in sync when active changes externally
  useEffect(() => {
    if (!locked) setFocusedIndex(activeIndex);
  }, [activeIndex, locked]);

  // Disappearing logic
  const scheduleFade = () => {
    if (fadeTimeout.current) window.clearTimeout(fadeTimeout.current);
    const now = Date.now();
    const isRapid = now - lastInteraction.current < 900;
    if (isRapid) rapidCount.current += 1;
    else rapidCount.current = 0;
    lastInteraction.current = now;
    const isRapidBurst = rapidCount.current >= 3;
    const delay = isRapidBurst ? 11000 + Math.random() * 2000 : 4000 + Math.random() * 2000;
    // fade far models when a model is focused but not yet active (or locked)
    const shouldFade = focusedIndex !== activeIndex || locked;
    if (shouldFade) {
      setIsFaded(true);
      fadeTimeout.current = window.setTimeout(() => setIsFaded(false), delay);
    } else {
      // if focused == active, still fade far ones slightly for cleaner look after 5s idle
      fadeTimeout.current = window.setTimeout(() => setIsFaded(true), delay);
      // and restore after another interval — but we keep faded as cleaner; will restore on interaction
    }
  };

  useEffect(() => {
    scheduleFade();
    return () => { if (fadeTimeout.current) window.clearTimeout(fadeTimeout.current); };
  }, [focusedIndex, locked, activeIndex]);

  // Reset faded on interaction
  const resetFadeOnInteraction = () => {
    if (isFaded) setIsFaded(false);
    if (fadeTimeout.current) window.clearTimeout(fadeTimeout.current);
  };

  const handleSelectModel = (idx: number) => {
    resetFadeOnInteraction();
    if (idx === focusedIndex && idx === activeIndex) {
      // centre model clicked when already focused & active -> toggle lock
      setLocked((v) => !v);
      if (!muted) sound.snap();
      scheduleFade();
      return;
    }
    if (idx === focusedIndex) {
      // already focused, toggle lock
      setLocked((v) => !v);
      if (!muted) sound.snap();
      scheduleFade();
      return;
    }
    // move to centre (focus, not select)
    setFocusedIndex(idx);
    if (!muted) sound.tick();
    scheduleFade();
  };

  const handleActivate = (idx: number) => {
    const m = AI_MODELS[idx];
    if (!m) return;
    onModelChange(m.id);
    setFocusedIndex(idx);
    setLocked(false);
    setShowActivePulse(m.id);
    if (!muted) {
      sound.select();
      setTimeout(() => sound.snap(), 80);
    }
    setTimeout(() => setShowActivePulse(null), 900);
    scheduleFade();
  };

  const handleRailMouseDown = (e: React.MouseEvent) => {
    if (locked) {
      setIsBouncing(true);
      if (!muted) sound.limit();
      setTimeout(() => setIsBouncing(false), 280);
      return;
    }
    const startX = e.clientX;
    const startFocused = focusedIndex;
    dragRef.current = { startX, startFocused };
    let hasMoved = false;
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      if (Math.abs(dx) > 6) hasMoved = true;
      // curve: 56px per model step
      const steps = Math.round(dx / 56);
      let next = startFocused - steps;
      next = Math.max(0, Math.min(AI_MODELS.length - 1, next));
      if (next !== focusedIndex) {
        setFocusedIndex(next);
        if (!muted && next !== lastInteraction.current) sound.tick();
        scheduleFade();
      }
      // Resistance at ends
      if ((next === 0 && dx > 30) || (next === AI_MODELS.length - 1 && dx < -30)) {
        if (!isBouncing) {
          setIsBouncing(true);
          setTimeout(() => setIsBouncing(false), 220);
        }
      }
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!hasMoved) {
        // click handled via button onClick, not drag
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (locked) {
      e.preventDefault();
      if (!isBouncing) {
        setIsBouncing(true);
        if (!muted) sound.limit();
        setTimeout(() => setIsBouncing(false), 220);
      }
      return;
    }
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    e.preventDefault();
    const dir = e.deltaX > 0 ? 1 : -1;
    const next = Math.max(0, Math.min(AI_MODELS.length - 1, focusedIndex + dir));
    if (next !== focusedIndex) {
      setFocusedIndex(next);
      if (!muted) sound.tick();
      scheduleFade();
    } else if ((next === 0 && dir < 0) || (next === AI_MODELS.length - 1 && dir > 0)) {
      setIsBouncing(true);
      if (!muted) sound.limit();
      setTimeout(() => setIsBouncing(false), 220);
    }
  };

  const handleSend = () => {
    if (!value.trim() || isGenerating) return;
    setIsGenerating(true);
    if (!muted) sound.send();
    onSend();
    setTimeout(() => setIsGenerating(false), 1400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (v: string) => {
    onChange(v);
    setIsTyping(true);
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => setIsTyping(false), 600);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    containerRef.current.style.setProperty('--mouse-x', `${x}%`);
    containerRef.current.style.setProperty('--mouse-y', `${y}%`);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  return (
    <div
      ref={containerRef}
      className={`floating-composer ${isTyping ? 'typing' : ''} ${isFocused ? 'focused' : ''} ${isGenerating ? 'generating' : ''} ${locked ? 'locked' : ''}`}
      onMouseMove={handleMouseMove}
    >
      <div className="floating-composer__header">
        <span className="floating-composer__title">AI Assistant</span>
        <div className="floating-composer__header-right">
          {locked && <span className="floating-composer__lock-badge">Locked</span>}
          <button className="floating-composer__mute" onClick={toggleMute} title={muted ? 'Unmute sounds' : 'Mute sounds'} aria-label={muted ? 'Unmute' : 'Mute'}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              {muted ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></> : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.02"/></>}
            </svg>
          </button>
        </div>
      </div>

      <div className="floating-composer__body">
        <textarea
          className="floating-composer__textarea"
          placeholder="Ask AI to edit your video…"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          rows={3}
          aria-label="AI prompt"
        />
        <button
          className={`floating-composer__send ${isGenerating ? 'generating' : value.trim() ? 'ready' : 'idle'}`}
          onClick={handleSend}
          disabled={!value.trim() && !isGenerating}
          aria-label="Send"
        >
          {isGenerating ? (
            <span className="send-generating">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      <div
        className={`floating-composer__wheel ${isBouncing ? 'bounce' : ''} ${locked ? 'locked' : ''} ${isFaded ? 'faded' : ''}`}
        ref={railRef}
        onMouseDown={handleRailMouseDown}
        onWheel={handleWheel}
        role="tablist"
        aria-label="Model selection wheel"
      >
        <div className="wheel-track" aria-hidden="true">
          <svg width="100%" height="32" viewBox="0 0 200 32" preserveAspectRatio="none">
            <path d="M 10 22 Q 100 4 190 22" fill="none" stroke="rgba(15,23,42,0.07)" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 10 22 Q 100 4 190 22" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="8" strokeLinecap="round" />
          </svg>
        </div>
        <div className="wheel-rail">
          {AI_MODELS.map((m, idx) => {
            const offset = idx - focusedIndex;
            const abs = Math.abs(offset);
            const y = -Math.pow(offset, 2) * 2.2 - abs * 1.5;
            const scale = Math.max(0.72, 1 - abs * 0.14);
            const blur = abs > 1 ? abs * 0.6 : 0;
            const opacity = isFaded && abs > 1 ? Math.max(0, 0.35 - (abs - 1) * 0.25) : Math.max(0.52, 1 - abs * 0.22);
            const isCenter = idx === focusedIndex;
            const isActive = m.id === effectiveModel;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={isActive}
                className={`wheel-chip ${isCenter ? 'center' : ''} ${isActive ? 'active' : ''} ${showActivePulse === m.id ? 'pulse' : ''}`}
                style={{
                  transform: `translateY(${y}px) scale(${scale})`,
                  opacity: abs > 2 && isFaded ? 0 : opacity,
                  filter: blur ? `blur(${blur}px)` : undefined,
                  zIndex: 10 - abs,
                  pointerEvents: abs > 2 && isFaded ? 'none' : 'auto',
                } as React.CSSProperties}
                onClick={() => {
                  if (locked && isCenter) {
                    // already handled via focused toggle, but allow unlock via click
                    setLocked(false);
                    return;
                  }
                  if (isCenter) {
                    // single click on centre toggles lock
                    setLocked((v) => !v);
                    if (!muted) sound.snap();
                  } else {
                    // move to centre (focus, not active)
                    setFocusedIndex(idx);
                    if (!muted) sound.tick();
                  }
                }}
                onDoubleClick={() => handleActivate(idx)}
                title={`${m.label} — ${isCenter ? (locked ? 'Locked — click to unlock' : 'Click to lock, double-click to activate') : 'Click to focus, double-click to activate'}`}
              >
                <span className="wheel-chip__icon" aria-hidden="true">{m.icon}</span>
                <span className="wheel-chip__label">{m.shortLabel}</span>
                {isActive && <span className="wheel-chip__active">Active</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="floating-composer__footer">
        <span>Press Enter to send · Shift+Enter for new line</span>
        <span className="footer-model">{AI_MODELS.find((m) => m.id === effectiveModel)?.label ?? effectiveModel} · {isTyping ? 'typing…' : isGenerating ? 'generating…' : locked ? 'locked' : 'ready'}</span>
      </div>
    </div>
  );
}
