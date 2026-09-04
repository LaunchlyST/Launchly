/** Restrict `value` to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) return min; // degenerate range — collapse rather than invert
  return Math.max(min, Math.min(value, max));
}

/** How far `value` sits outside [min, max]. 0 if it's inside. Sign shows the side. */
export function overshoot(value: number, min: number, max: number): number {
  if (value < min) return value - min; // negative
  if (value > max) return value - max; // positive
  return 0;
}
