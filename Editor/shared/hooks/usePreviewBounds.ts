import { useCallback, useMemo } from 'react';
import { computePreviewBounds } from '../../preview/logic/PreviewBounds';
import { ExceededSide, Size } from '../../preview/types/preview.types';
import { clamp } from '../utils/clamp';
import { EDITOR_LIMITS } from '../../editor-core/config/editorLimits';

interface UsePreviewBoundsArgs {
  canvas: Size;
  object: Size;
}

/**
 * The reusable bounds contract for anything draggable inside the preview
 * canvas: the allowed range, a function to clamp a candidate position into
 * it, and a way to read which side (if any) a position sits past.
 */
export function usePreviewBounds({ canvas, object }: UsePreviewBoundsArgs) {
  const bounds = useMemo(
    () => computePreviewBounds(canvas, object, EDITOR_LIMITS.previewPadding),
    [canvas.width, canvas.height, object.width, object.height]
  );

  const clampPosition = useCallback(
    (x: number, y: number) => ({
      x: clamp(x, bounds.minX, bounds.maxX),
      y: clamp(y, bounds.minY, bounds.maxY),
    }),
    [bounds]
  );

  /** Which edge (if any) a candidate position has been pushed past. */
  const exceededSide = useCallback(
    (x: number, y: number): ExceededSide => {
      if (y > bounds.maxY) return 'bottom';
      if (y < bounds.minY) return 'top';
      if (x > bounds.maxX) return 'right';
      if (x < bounds.minX) return 'left';
      return null;
    },
    [bounds]
  );

  const isOutOfBounds = useCallback(
    (x: number, y: number) => exceededSide(x, y) !== null,
    [exceededSide]
  );

  return { ...bounds, clampPosition, isOutOfBounds, exceededSide };
}
