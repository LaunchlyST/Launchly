import { PreviewBoundsResult, Size } from './preview.types';

/**
 * Computes how far a media object's centre can move from the canvas centre
 * before an edge would leave the canvas — the "editable area" the object is
 * allowed to travel inside.
 *
 * The object is treated as centred on the canvas at offset (0, 0). Moving it
 * changes that offset; the returned range is the set of offsets for which
 * the object still fully covers (or fits inside) the canvas on that axis.
 *
 * Because the same formula reads correctly whichever is larger:
 *  - object ≤ canvas → the object cannot leave the canvas (containment).
 *  - object > canvas → the object cannot reveal empty space at an edge
 *    (pan-while-zoomed, the same rule from the other direction).
 * At object === canvas (the default, unscaled state) the range collapses to
 * zero — nothing to pan until the user zooms — matching ordinary editors.
 */
export function computePreviewBounds(canvas: Size, object: Size, paddingPx = 0): PreviewBoundsResult {
  const usableW = Math.max(0, canvas.width - paddingPx * 2);
  const usableH = Math.max(0, canvas.height - paddingPx * 2);
  const maxX = Math.abs(usableW - object.width) / 2;
  const maxY = Math.abs(usableH - object.height) / 2;
  return { minX: -maxX, maxX, minY: -maxY, maxY };
}
