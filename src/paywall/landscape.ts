/**
 * The paywall's landscape asset.
 *
 * The scene is built to be driven by a real photograph or video of mountains,
 * a valley and a river — not by generated shapes. Drop the asset in and it is
 * used automatically; nothing else needs to change.
 *
 *   Image:  put the file at  public/paywall/landscape.jpg   (2400px wide+)
 *   Video:  put the file at  public/paywall/landscape.mp4   (muted, looping)
 *
 * Either can be overridden per environment:
 *   VITE_PAYWALL_IMAGE=https://cdn.example.com/valley.jpg
 *   VITE_PAYWALL_VIDEO=https://cdn.example.com/valley.mp4
 *
 * When no asset resolves, the scene renders a plain graded sky rather than
 * substituting abstract scenery, so a missing asset reads as "not supplied
 * yet" instead of pretending to be the landscape.
 */

export const LANDSCAPE_IMAGE: string =
  (import.meta.env.VITE_PAYWALL_IMAGE as string | undefined) || '/paywall/landscape.jpg';

export const LANDSCAPE_VIDEO: string | null =
  (import.meta.env.VITE_PAYWALL_VIDEO as string | undefined) || null;

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
