import { useCallback, useRef } from 'react';
import { clamp, overshoot as computeOvershoot } from './clamp';
import { EDITOR_LIMITS } from '../editor-state/editorLimits';

interface UseMediaResizeArgs {
  /** Element whose `transform: scale()` this hook drives directly, rAF-batched. */
  layerRef: React.RefObject<HTMLElement>;
  getScale: () => number;
  minScale: number;
  maxScale: number;
  /**
   * Live limits, measured at gesture start. When supplied this wins over the
   * static min/max — it is how the caller says "you may grow until an edge
   * actually reaches the canvas", rather than to some fixed number.
   */
  getLimits?: () => { min: number; max: number };
  /** Corner drag distance (px) that maps to one full unit of scale. */
  sensitivity?: number;
  /**
   * Which pointer movement drives the resize.
   *  'both' — corner handle: horizontal + vertical
   *  'x'    — side handle: horizontal only
   */
  axis?: 'both' | 'x';
  /** Left-hand handles grow when dragged LEFT, so their delta is inverted. */
  invert?: boolean;
  /** 'scale' = uniform scale(s)  |  'scaleX' = horizontal stretch only (longer, not taller) */
  mode?: 'scale' | 'scaleX';
  onResizeMove?: (scale: number) => void;
  /** `edge` says which limit was hit, so the caller can colour the feedback. */
  onBoundaryChange?: (exceeded: boolean, edge: 'min' | 'max' | null) => void;
  onResizeEnd: (scale: number) => void;
  disabled?: boolean;
}

/**
 * Same shape as useMediaDrag but for a uniform corner-handle resize: pointer
 * capture, rAF-batched transform writes, a small hard-capped overshoot for
 * feel, and a boundary-change callback fired only when the exceeded state
 * flips — not every frame — so a caller can drive an error visual cheaply.
 */
export function useMediaResize({
  layerRef,
  getScale,
  minScale,
  maxScale,
  getLimits,
  sensitivity = 400,
  axis = 'both',
  invert = false,
  mode = 'scale',
  onResizeMove,
  onBoundaryChange,
  onResizeEnd,
  disabled,
}: UseMediaResizeArgs) {
  const stateRef = useRef<{
    startX: number;
    startY: number;
    startScale: number;
    lastExceeded: boolean;
    rafId: number | null;
    pending: number | null;
    hardScale: number;
    /** Limits captured when the gesture began, so they can't shift mid-drag. */
    min: number;
    max: number;
  } | null>(null);

  const applyScale = (s: number) => {
    const el = layerRef.current;
    if (!el) return;
    if (mode === 'scaleX') {
      // Keep existing vertical scale from transform if present, else just stretch horizontally.
      // We store uniform scale in a CSS var --fallback to current s.
      const current = el.style.transform;
      // If already has scale(...), preserve its uniform part and add scaleX wrapper.
      // For simplicity, side handles drive scaleX only: longer, not taller.
      el.style.transform = `scaleX(${s})`;
      // Also keep transformOrigin centered
      el.style.transformOrigin = 'center';
    } else {
      el.style.transform = `scale(${s})`;
    }
  };

  const flush = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.pending === null) return;
    const scale = s.pending;
    s.pending = null;
    applyScale(scale);
    onResizeMove?.(scale);
    s.rafId = null;
  }, [onResizeMove]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const dx = (e.clientX - s.startX) * (invert ? -1 : 1);
      const dy = e.clientY - s.startY;
      // A side handle tracks horizontal movement only, so dragging outwards
      // widens without the vertical drift a corner handle has.
      const travel = axis === 'x' ? dx : dx + dy;
      const rawScale = s.startScale + travel / sensitivity;

      const hard = clamp(rawScale, s.min, s.max);
      s.hardScale = hard;

      const over = computeOvershoot(rawScale, s.min, s.max);
      const nudge = Math.sign(over) * Math.min(Math.abs(over) * EDITOR_LIMITS.boundaryResistanceFactor, EDITOR_LIMITS.boundaryResistancePx / 100);
      const display = hard + nudge;

      const exceeded = over !== 0;
      if (exceeded !== s.lastExceeded) {
        s.lastExceeded = exceeded;
        // over > 0 means they pushed past the maximum, < 0 past the minimum.
        onBoundaryChange?.(exceeded, exceeded ? (over > 0 ? 'max' : 'min') : null);
      }

      s.pending = display;
      if (s.rafId === null) s.rafId = requestAnimationFrame(flush);
    },
    [flush, minScale, maxScale, sensitivity, onBoundaryChange]
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const s = stateRef.current;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (!s) return;
      if (s.rafId !== null) cancelAnimationFrame(s.rafId);
      layerRef.current?.releasePointerCapture?.(e.pointerId);
      applyScale(s.hardScale);
      onResizeEnd(s.hardScale);
      if (s.lastExceeded) onBoundaryChange?.(false, null);
      stateRef.current = null;
    },
    [layerRef, onResizeEnd, onBoundaryChange, onPointerMove]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const startScale = getScale();
      const live = getLimits?.();
      stateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startScale,
        lastExceeded: false,
        rafId: null,
        pending: null,
        hardScale: startScale,
        min: live ? live.min : minScale,
        // Never report "at the limit" while the element still has room to grow.
        max: live ? Math.max(live.max, startScale) : maxScale,
      };
      try {
        layerRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* best-effort */
      }
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [disabled, getScale, getLimits, minScale, maxScale, layerRef, onPointerMove, onPointerUp]
  );

  /** Bind this to any handle that should drive the same resize. */
  return { onPointerDown };
}
