import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface DashboardSceneProps {
  children: ReactNode;
  intro?: ReactNode;
  revealed?: boolean;
  onReveal?: () => void;
  variant?: 'photo' | 'illustration';
}

export function DashboardScene({ children, intro, revealed, onReveal, variant = 'photo' }: DashboardSceneProps) {
  const [internalRevealed, setInternalRevealed] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const isRevealed = revealed ?? internalRevealed;

  const setRevealed = (next: boolean) => {
    if (revealed === undefined) {
      setInternalRevealed(next);
    }

    if (next) {
      onReveal?.();
    }
  };

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 8 && !isRevealed) {
        setRevealed(true);
      }

      if (e.deltaY < -8 && isRevealed && window.scrollY <= 2) {
        setRevealed(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') && !isRevealed) {
        e.preventDefault();
        setRevealed(true);
      }

      if ((e.key === 'Escape' || e.key === 'ArrowUp') && isRevealed && window.scrollY <= 2) {
        e.preventDefault();
        setRevealed(false);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? null;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartY.current === null) return;
      const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
      const delta = touchStartY.current - endY;

      if (delta > 28 && !isRevealed) {
        setRevealed(true);
      }

      if (delta < -28 && isRevealed && window.scrollY <= 2) {
        setRevealed(false);
      }

      touchStartY.current = null;
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRevealed, revealed, onReveal]);

  return (
    <div className={`dashboard-scene dashboard-scene--${variant} ${isRevealed ? 'is-revealed' : ''}`}>
      <div className="dashboard-nature">
        <img className="dashboard-nature__image" src="/launchly-nature-bg.png" alt="" />
        <div className="dashboard-nature__clouds dashboard-nature__clouds--front" />
        <div className="dashboard-nature__clouds dashboard-nature__clouds--back" />
        <div className="dashboard-nature__water" />
        <div className="dashboard-nature__trees" />
      </div>

      <header className="dashboard-topbar">
        <div className="dashboard-brand-logo" aria-label="Launchly">
          <Sparkles size={18} />
          <span>Launchly</span>
        </div>
        <div className="dashboard-feedback-box">Feedback, Bugs, Update</div>
      </header>

      {intro && (
        <div className="dashboard-intro" aria-hidden={isRevealed}>
          {intro}
        </div>
      )}

      <div className="dashboard-scene__content">{children}</div>
    </div>
  );
}
