/** Which side of the canvas a drag/resize attempt pushed past. */
export type ExceededSide = 'top' | 'bottom' | 'left' | 'right' | null;

export interface Size {
  width: number;
  height: number;
}

export interface PreviewBoundsResult {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Visual state of the preview frame's border/glow. */
/**
 * How the canvas edge reads right now.
 *  active  — being resized or the selected object
 *  ok      — at the minimum size; shrinking is always safe, so it is green
 *  warning — reserved for non-blocking advisories
 *  error   — at the workspace edge; growing further is not possible, so red
 */
export type PreviewBorderState = 'normal' | 'active' | 'ok' | 'warning' | 'error';
