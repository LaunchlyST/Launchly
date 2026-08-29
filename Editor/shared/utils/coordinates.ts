/** A point in the same coordinate space as the canvas element it's measured against. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Converts a pointer event's viewport coordinates into a point relative to
 * `el`'s own box — the space drag math should always work in, so it stays
 * correct regardless of where the canvas sits on the page or how it's scaled
 * by its parent (e.g. the preview's corner-resize `scale()` transform).
 */
export function toLocalPoint(clientX: number, clientY: number, el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  const scaleX = rect.width > 0 ? el.offsetWidth / rect.width : 1;
  const scaleY = rect.height > 0 ? el.offsetHeight / rect.height : 1;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}
