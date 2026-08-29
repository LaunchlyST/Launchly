import { useCallback, useRef } from 'react';
import { toLocalPoint } from './coordinates';
import { clamp, overshoot as computeOvershoot } from './clamp';
import { ExceededSide, Size } from './preview.types';
import { EDITOR_LIMITS } from '../editor-state/editorLimits';

interface UseMediaDragArgs {
  /** The element whose `transform` this hook drives directly (no React state per frame). */
  layerRef: React.RefObject<HTMLElement>;
  /** The canvas the object drags within — drag math is done in its local space. */
  canvasRef: React.RefObject<HTMLElement>;
  /** Current committed position, read fresh at drag start. */
  getPosition: () => { x: number; y: number };
  /** Current object size in canvas px, read fresh at drag start (scale may have changed). */
  getObjectSize: () => Size;
  getCanvasSize: () => Size;
  computeBounds: (canvas: Size, object: Size) => { minX: number; maxX: number; minY: number; maxY: number };
  /** Called once per animation frame while dragging, with the live (unclamped-for-display) position. */
  onDragMove?: (x: number, y: number) => void;
  /** Fired only on a change of exceeded state — not every frame — so callers can debounce cleanly. */
  onBoundaryChange?: (exceeded: boolean, side: ExceededSide) => void;
  /** Final, hard-clamped position — the only value that should ever be persisted to state. */
  onDragEnd: (x: number, y: number) => void;
  disabled?: boolean;
}

/**
 * Drives a pointer drag with rAF batching and a directly-written CSS
 * transform, so the element tracks the cursor every frame without going
 * through React state (and therefore without re-rendering anything) until
 * the gesture ends. Boundary clamping — with a small, hard-capped resistance
 * — happens every frame; only the *change* of boundary state is reported
 * back to React, so a caller can show an error without re-rendering on drag.
 */
export function useMediaDrag({
  layerRef,
  canvasRef,
  getPosition,
  getObjectSize,
  getCanvasSize,
  computeBounds,
  onDragMove,
  onBoundaryChange,
  onDragEnd,
  disabled,
}: UseMediaDragArgs) {
  const stateRef = useRef<{
    startPointer: { x: number; y: number };
    startPosition: { x: number; y: number };
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
    lastExceeded: boolean;
    rafId: number | null;
    pending: { x: number; y: number } | null;
    hardX: number;
    hardY: number;
  } | null>(null);

  const applyTransform = (x: number, y: number) => {
    const el = layerRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const flush = useCallback(() => {
    const s = stateRef.current;
    if (!s || !s.pending) return;
    const { x, y } = s.pending;
    s.pending = null;
    applyTransform(x, y);
    onDragMove?.(x, y);
    s.rafId = null;
  }, [onDragMove]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const s = stateRef.current;
      const canvasEl = canvasRef.current;
      if (!s || !canvasEl) return;

      const p = toLocalPoint(e.clientX, e.clientY, canvasEl);
      const startP = toLocalPoint(
        s.startPointer.x,
        s.startPointer.y,
        canvasEl
      );
      const dx = p.x - startP.x;
      const dy = p.y - startP.y;
      const rawX = s.startPosition.x + dx;
      const rawY = s.startPosition.y + dy;

      const hardX = clamp(rawX, s.bounds.minX, s.bounds.maxX);
      const hardY = clamp(rawY, s.bounds.minY, s.bounds.maxY);
      s.hardX = hardX;
      s.hardY = hardY;

      // A small, hard-capped nudge past the wall so the stop doesn't feel
      // abrupt, without ever turning into an unbounded rubber-band.
      const overX = computeOvershoot(rawX, s.bounds.minX, s.bounds.maxX);
      const overY = computeOvershoot(rawY, s.bounds.minY, s.bounds.maxY);
      const nudgeX = Math.sign(overX) * Math.min(Math.abs(overX) * EDITOR_LIMITS.boundaryResistanceFactor, EDITOR_LIMITS.boundaryResistancePx);
      const nudgeY = Math.sign(overY) * Math.min(Math.abs(overY) * EDITOR_LIMITS.boundaryResistanceFactor, EDITOR_LIMITS.boundaryResistancePx);

      const displayX = hardX + nudgeX;
      const displayY = hardY + nudgeY;

      const exceeded = overX !== 0 || overY !== 0;
      if (exceeded !== s.lastExceeded) {
        s.lastExceeded = exceeded;
        const side: ExceededSide = overY > 0 ? 'bottom' : overY < 0 ? 'top' : overX > 0 ? 'right' : overX < 0 ? 'left' : null;
        onBoundaryChange?.(exceeded, side);
      }

      s.pending = { x: displayX, y: displayY };
      if (s.rafId === null) s.rafId = requestAnimationFrame(flush);
    },
    [canvasRef, flush, onBoundaryChange]
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const s = stateRef.current;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (!s) return;
      if (s.rafId !== null) cancelAnimationFrame(s.rafId);
      layerRef.current?.releasePointerCapture?.(e.pointerId);

      // Always land exactly on the hard-clamped value — the resistance nudge
      // is a drag-time-only visual, never something that gets persisted.
      applyTransform(s.hardX, s.hardY);
      onDragEnd(s.hardX, s.hardY);
      if (s.lastExceeded) onBoundaryChange?.(false, null);
      stateRef.current = null;
    },
    [layerRef, onDragEnd, onBoundaryChange, onPointerMove]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const canvasSize = getCanvasSize();
      const objectSize = getObjectSize();
      stateRef.current = {
        startPointer: { x: e.clientX, y: e.clientY },
        startPosition: getPosition(),
        bounds: computeBounds(canvasSize, objectSize),
        lastExceeded: false,
        rafId: null,
        pending: null,
        hardX: getPosition().x,
        hardY: getPosition().y,
      };
      try {
        layerRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* pointer capture is best-effort */
      }
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [disabled, getCanvasSize, getObjectSize, getPosition, computeBounds, layerRef, onPointerMove, onPointerUp]
  );

  return { onPointerDown };
}
