import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Lock, Monitor, Smartphone } from 'lucide-react';
import type { DesignerState } from './store';
import { storeShareUrl } from './store';
import { PhonePreview } from './PhonePreview';

/** Intrinsic iPhone-ish viewport the mockup is authored against. */
const PHONE_W = 390;
const PHONE_H = 844;
/** Breathing room kept around the device so its shadow is never clipped. */
const STAGE_PAD = 44;

export type PreviewDevice = 'desktop' | 'mobile';

interface StorePreviewProps {
  designer: DesignerState;
  username: string;
  onBack: () => void;
}

/**
 * Full-screen, read-only preview of the published store.
 *
 * Deliberately *not* a modal over the editor: the editor is unmounted for the
 * duration, so no panel, overlay, grip or second device can ever bleed through.
 * The phone body is the same `PhonePreview` the editor uses, so the preview can
 * never drift from the real design, and nothing here mutates store state.
 */
export function StorePreview({ designer, username, onBack }: StorePreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>('mobile');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);
  // Uniform scale on the device so it is always fully visible top to bottom.
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const byH = (r.height - STAGE_PAD) / PHONE_H;
    const byW = (r.width - STAGE_PAD) / PHONE_W;
    setScale(Math.max(0.3, Math.min(1, byH, byW)));
  }, []);

  useLayoutEffect(measure);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // Escape leaves the preview, and the page behind it must not scroll or
  // shift while the preview owns the viewport.
  useEffect(() => {
    backRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onBack]);

  const url = storeShareUrl(username);
  const handle = username.replace(/^@+/, '');

  /* Drag-to-scroll inside the device.
   *
   * A mouse has no touch screen, so wheel-scrolling a phone mock-up feels
   * unlike a real handset. Grabbing the page and dragging it does. Only the
   * primary button drags, and only when the content is actually taller than
   * the frame, so a short store still scrolls normally instead of sticking.
   */
  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    const screen = root.querySelector<HTMLElement>('.pv-screen');
    if (!screen) return;

    let dragging = false;
    let startY = 0;
    let startScroll = 0;

    const canDrag = () => screen.scrollHeight - screen.clientHeight > 1;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !canDrag()) return;
      dragging = true;
      startY = e.clientY;
      startScroll = screen.scrollTop;
      screen.classList.add('is-grabbing');
      screen.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const next = startScroll - (e.clientY - startY);
      // Clamp by hand: smooth scrolling plus pointer capture can otherwise
      // let the page drift past either end.
      screen.scrollTop = Math.max(0, Math.min(next, screen.scrollHeight - screen.clientHeight));
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      screen.classList.remove('is-grabbing');
      if (screen.hasPointerCapture(e.pointerId)) screen.releasePointerCapture(e.pointerId);
    };

    const sync = () => screen.classList.toggle('is-grabbable', canDrag());
    sync();
    screen.addEventListener('pointerdown', onDown);
    screen.addEventListener('pointermove', onMove);
    screen.addEventListener('pointerup', onUp);
    screen.addEventListener('pointercancel', onUp);
    // Absent in jsdom, and the grab cursor is cosmetic anyway.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(screen);

    return () => {
      observer?.disconnect();
      screen.removeEventListener('pointerdown', onDown);
      screen.removeEventListener('pointermove', onMove);
      screen.removeEventListener('pointerup', onUp);
      screen.removeEventListener('pointercancel', onUp);
    };
  }, [device]);

  return (
    <div className="cs-pv" role="dialog" aria-modal="true" aria-label="Live store preview">
      <header className="cs-pv__bar">
        <button ref={backRef} type="button" className="cs-pv__back" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" />
          Back to Editor
        </button>

        <p className="cs-pv__url" title={url}>
          <Lock size={11} aria-hidden="true" />
          <span className="cs-pv__handle">@{handle}</span>
          <span className="cs-pv__host">{url}</span>
        </p>

        <div className="cs-pv__devices" role="group" aria-label="Preview size">
          <button
            type="button"
            className={device === 'desktop' ? 'is-on' : ''}
            aria-pressed={device === 'desktop'}
            onClick={() => setDevice('desktop')}
          >
            <Monitor size={14} aria-hidden="true" />
            Desktop
          </button>
          <button
            type="button"
            className={device === 'mobile' ? 'is-on' : ''}
            aria-pressed={device === 'mobile'}
            onClick={() => setDevice('mobile')}
          >
            <Smartphone size={14} aria-hidden="true" />
            Mobile
          </button>
        </div>
      </header>

      <div className="cs-pv__stage" ref={stageRef} data-device={device}>
        {device === 'mobile' ? (
          <div className="cs-pv__device">
            <div className="cs-pv__scale" style={{ transform: `scale(${scale})` }}>
              <PhonePreview designer={designer} username={username} selectedKey={null} hoverKey={null} interactive={false} />
            </div>
          </div>
        ) : (
          <div className="cs-pv__browser">
            <div className="cs-pv__chrome" aria-hidden="true">
              <span className="cs-pv__dots">
                <i />
                <i />
                <i />
              </span>
              <span className="cs-pv__addr">
                <Lock size={10} />
                {url}
              </span>
            </div>
            <div className="cs-pv__viewport">
              <PhonePreview designer={designer} username={username} selectedKey={null} hoverKey={null} interactive={false} frame="bare" />
            </div>
          </div>
        )}
      </div>

      <p className="cs-pv__hint">
        {device === 'mobile'
          ? 'Scroll inside the phone to use your store exactly like a customer.'
          : 'This is how your store looks on a desktop browser.'}
      </p>
    </div>
  );
}
