/**
 * The scenic asset behind the unpaid /dashboard.
 *
 * The scene is built around ONE illustrated coastal sunset image — clouds,
 * water, cliffs, trees. Drop the asset in and it is used automatically:
 *
 *   Image:  public/paywall/landscape.jpg   (2400px wide or more)
 *   Video:  public/paywall/landscape.mp4   (muted, looping)
 *
 * Either can be overridden per environment:
 *   VITE_PAYWALL_IMAGE=https://cdn.example.com/coast.jpg
 *   VITE_PAYWALL_VIDEO=https://cdn.example.com/coast.mp4
 *
 * When no asset resolves the scene renders a graded sunset sky rather than
 * substituting invented scenery, so a missing asset reads as "not supplied
 * yet" instead of pretending to be the artwork.
 */

export const LANDSCAPE_IMAGE: string =
  (import.meta.env.VITE_PAYWALL_IMAGE as string | undefined) || '/paywall/landscape.jpg';

export const LANDSCAPE_VIDEO: string | null =
  (import.meta.env.VITE_PAYWALL_VIDEO as string | undefined) || null;

/**
 * Where the animated bands sit in the image, top 0 → bottom 1.
 *
 * Only these bands move: everything between `skyEnd` and `waterStart` — the
 * cliffs, the buildings and the horizon line itself — comes from the static
 * base layer and never shifts. Tune per artwork with:
 *
 *   VITE_PAYWALL_HORIZON=0.62      (waterline, 0..1 from the top)
 *   VITE_PAYWALL_FOLIAGE=0.58      (top of the tree line)
 */
const num = (v: unknown, fallback: number) => {
  const n = typeof v === 'string' ? Number.parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1 ? n : fallback;
};

const horizon = num(import.meta.env.VITE_PAYWALL_HORIZON, 0.62);
const foliage = num(import.meta.env.VITE_PAYWALL_FOLIAGE, 0.58);

export const BANDS = {
  /** Clouds drift above this line; the mask feathers out well before it. */
  skyEnd: Math.max(0.2, horizon - 0.1),
  /** Water ripples and shimmers below this line. */
  waterStart: horizon,
  /** Foliage sways at the left and right edges below this line. */
  foliageStart: foliage,
} as const;

/** Probes the configured image so a 404 falls back to the graded sky. */
export function probeImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !src) return resolve(false);
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}
