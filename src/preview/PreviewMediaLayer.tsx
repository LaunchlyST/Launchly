import React, { useCallback, useEffect, useRef } from 'react';
import { Clip } from '../editor-types/editorTypes';
import { useMediaDrag } from './useMediaDrag';
import { computePreviewBounds } from './PreviewBounds';
import { ExceededSide } from './preview.types';
import { sound } from '../sound/sound';

interface PreviewMediaLayerProps {
  clip: Clip;
  canvasRef: React.RefObject<HTMLDivElement>;
  isSelected: boolean;
  /** Called once, on release, with the final clamped position — the only time state should update. */
  onCommitPosition: (clipId: string, x: number, y: number) => void;
  /** Fired on a change of boundary state (not every frame) so the frame border can react. */
  onBoundaryChange: (exceeded: boolean, side: ExceededSide) => void;
  children: React.ReactNode;
}

/**
 * Wraps the active clip's rendered media (video/image) in a layer that can be
 * dragged around inside the canvas. Position during the drag is written
 * straight to this element's `transform` (see useMediaDrag) — React only
 * re-renders once, when the gesture ends and the final position is committed
 * to the clip.
 */
export function PreviewMediaLayer({ clip, canvasRef, isSelected, onCommitPosition, onBoundaryChange, children }: PreviewMediaLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const position = clip.transform?.position ?? { x: 0, y: 0 };
  const scale = clip.transform?.scale ?? 1;
  const positionRef = useRef(position);
  positionRef.current = position;

  // Reset the DOM transform whenever the committed position changes from
  // outside the drag (clip switch, undo, etc.) so the layer never drifts
  // from the state it's supposed to represent.
  useEffect(() => {
    const el = layerRef.current;
    if (el) el.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
  }, [position.x, position.y, clip.id]);

  const getCanvasSize = useCallback(() => {
    const el = canvasRef.current;
    return { width: el?.clientWidth ?? 0, height: el?.clientHeight ?? 0 };
  }, [canvasRef]);

  const getObjectSize = useCallback(() => {
    const c = getCanvasSize();
    return { width: c.width * scale, height: c.height * scale };
  }, [getCanvasSize, scale]);

  const { onPointerDown } = useMediaDrag({
    layerRef,
    canvasRef,
    getPosition: () => positionRef.current,
    getObjectSize,
    getCanvasSize,
    computeBounds: computePreviewBounds,
    onBoundaryChange: (exceeded, side) => {
      if (exceeded) sound.limit();
      onBoundaryChange(exceeded, side);
    },
    onDragEnd: (x, y) => {
      onCommitPosition(clip.id, x, y);
      onBoundaryChange(false, null);
    },
  });

  return (
    <div
      ref={layerRef}
      className={`preview-media-layer ${isSelected ? 'is-selected' : ''}`}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)`, touchAction: 'none' }}
      onPointerDown={onPointerDown}
    >
      {children}
      {isSelected && (
        <span className="preview-media-layer__handles" aria-hidden="true">
          <span className="preview-media-layer__handle preview-media-layer__handle--tl" />
          <span className="preview-media-layer__handle preview-media-layer__handle--tr" />
          <span className="preview-media-layer__handle preview-media-layer__handle--bl" />
          <span className="preview-media-layer__handle preview-media-layer__handle--br" />
        </span>
      )}
    </div>
  );
}
