/**
 * Timeline Zoom / Visible Duration model.
 *
 * This controls how much timeline TIME is visible in the viewport — it never
 * changes the real duration of any media. Small durations deliberately get more
 * physical slider space than large ones, because precise edits happen there.
 *
 *   left half  (0 → 50):  5s → 10s → 15s → 30s → 45s → 1m
 *   right half (50 → 100): 1m → 3m → 10m → 30m → 1h
 *
 * Past 100 the control enters Extended Timeline Mode (1h → 30d), which is
 * stepped rather than dragged, because no slider is long enough for 30 days.
 */

export interface ZoomStage {
  /** Slider position, 0..100 */
  value: number;
  seconds: number;
  label: string;
}

/** Stops that define the non-linear curve. Interpolation between them is logarithmic. */
export const NORMAL_STAGES: ZoomStage[] = [
  { value: 0, seconds: 5, label: '5s' },
  { value: 12, seconds: 10, label: '10s' },
  { value: 25, seconds: 15, label: '15s' },
  { value: 37, seconds: 30, label: '30s' },
  { value: 44, seconds: 45, label: '45s' },
  { value: 50, seconds: 60, label: '1m' },
  { value: 62, seconds: 180, label: '3m' },
  { value: 74, seconds: 600, label: '10m' },
  { value: 87, seconds: 1800, label: '30m' },
  { value: 100, seconds: 3600, label: '1h' },
];

/** Discrete steps available only after Extended Timeline Mode is unlocked. */
export const EXTENDED_STAGES: ZoomStage[] = [
  { value: 100, seconds: 7200, label: '2h' },
  { value: 100, seconds: 18000, label: '5h' },
  { value: 100, seconds: 43200, label: '12h' },
  { value: 100, seconds: 86400, label: '1d' },
  { value: 100, seconds: 259200, label: '3d' },
  { value: 100, seconds: 604800, label: '7d' },
  { value: 100, seconds: 2592000, label: '30d' },
];

export const MIN_SECONDS = NORMAL_STAGES[0].seconds;                        // 5s
export const NORMAL_MAX_SECONDS = NORMAL_STAGES[NORMAL_STAGES.length - 1].seconds; // 1h
export const EXTENDED_MAX_SECONDS = EXTENDED_STAGES[EXTENDED_STAGES.length - 1].seconds; // 30d

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Slider position (0..100) → visible seconds. Logarithmic inside each segment. */
export function secondsForZoomValue(v: number): number {
  const x = clamp(v, 0, 100);
  for (let i = 0; i < NORMAL_STAGES.length - 1; i++) {
    const a = NORMAL_STAGES[i];
    const b = NORMAL_STAGES[i + 1];
    if (x >= a.value && x <= b.value) {
      const t = b.value === a.value ? 0 : (x - a.value) / (b.value - a.value);
      const secs = Math.exp(Math.log(a.seconds) + t * (Math.log(b.seconds) - Math.log(a.seconds)));
      return secs < 60 ? Math.round(secs) : Math.round(secs / 5) * 5;
    }
  }
  return NORMAL_MAX_SECONDS;
}

/** Visible seconds → slider position (0..100). Extended durations clamp to 100. */
export function zoomValueForSeconds(s: number): number {
  if (s <= MIN_SECONDS) return 0;
  if (s >= NORMAL_MAX_SECONDS) return 100;
  for (let i = 0; i < NORMAL_STAGES.length - 1; i++) {
    const a = NORMAL_STAGES[i];
    const b = NORMAL_STAGES[i + 1];
    if (s >= a.seconds && s <= b.seconds) {
      const t = (Math.log(s) - Math.log(a.seconds)) / (Math.log(b.seconds) - Math.log(a.seconds));
      return a.value + t * (b.value - a.value);
    }
  }
  return 50;
}

/**
 * Quantise a raw slider position to the nearest stage. The control is discrete
 * on purpose: the readout should always be a clean value the editor recognises
 * (5s, 15s, 45s, 1m, 10m, 1h) rather than an arbitrary one like "52s".
 */
export function snapZoomValue(v: number): number {
  let best = NORMAL_STAGES[0].value;
  let bestDist = Infinity;
  for (const stage of NORMAL_STAGES) {
    const d = Math.abs(v - stage.value);
    if (d < bestDist) {
      bestDist = d;
      best = stage.value;
    }
  }
  return best;
}

/** Move one stage along the normal range. dir: +1 longer, -1 shorter. */
export function stepNormalStage(seconds: number, dir: number): number | null {
  if (dir > 0) {
    const next = NORMAL_STAGES.find((s) => s.seconds > seconds + 0.5);
    return next ? next.seconds : null;
  }
  for (let i = NORMAL_STAGES.length - 1; i >= 0; i--) {
    if (NORMAL_STAGES[i].seconds < seconds - 0.5) return NORMAL_STAGES[i].seconds;
  }
  return null;
}

/** Compact label: 5s · 45s · 1m · 3m · 30m · 1h · 3d */
export function formatZoomLabel(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.round((seconds % 86400) / 3600);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** Spoken label for the drag tooltip: "45 seconds", "10 minutes". */
export function formatZoomVerbose(seconds: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (seconds < 60) return plural(Math.round(seconds), 'second');
  if (seconds < 3600) {
    const m = Math.round(seconds / 60);
    const rem = Math.round(seconds % 60);
    if (rem >= 5 && seconds < 300) return `${plural(Math.floor(seconds / 60), 'minute')} ${rem}s`;
    return plural(m, 'minute');
  }
  if (seconds < 86400) return plural(Math.round(seconds / 3600), 'hour');
  return plural(Math.round(seconds / 86400), 'day');
}

/* ── Colour ─────────────────────────────────────────────────────────────── */

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

function mix(a: string, b: string, t: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = clamp(t, 0, 1);
  return {
    r: Math.round(ca.r + (cb.r - ca.r) * k),
    g: Math.round(ca.g + (cb.g - ca.g) * k),
    b: Math.round(ca.b + (cb.b - ca.b) * k),
  };
}

/**
 * magenta → pink → warm coral → orange → amber → yellow across the normal
 * range, then yellow → violet as extended mode goes deeper (0..1).
 */
function rampRgb(v: number, extendedT: number) {
  if (extendedT > 0) return mix('#EAB308', '#A855F7', clamp(extendedT, 0, 1));
  const stops: Array<[number, string]> = [
    [0, '#E4308F'],
    [25, '#EC4899'],
    [50, '#F97316'],
    [75, '#F59E0B'],
    [100, '#EAB308'],
  ];
  const x = clamp(v, 0, 100);
  for (let i = 0; i < stops.length - 1; i++) {
    const [pa, ca] = stops[i];
    const [pb, cb] = stops[i + 1];
    if (x >= pa && x <= pb) return mix(ca, cb, (x - pa) / (pb - pa));
  }
  return hexToRgb('#EAB308');
}

/** `extendedT` is 0 in the normal range, or 0..1 for how deep extended mode goes. */
export function colorForZoomValue(v: number, extendedT = 0): string {
  const { r, g, b } = rampRgb(v, extendedT);
  return `rgb(${r}, ${g}, ${b})`;
}

export function colorForZoomValueAlpha(v: number, alpha: number, extendedT = 0): string {
  const { r, g, b } = rampRgb(v, extendedT);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * How far into Extended Timeline Mode the current duration sits, 0..1.
 * 0 while inside the normal range, so the normal colour ramp keeps its meaning.
 */
export function extendedProgress(seconds: number): number {
  if (seconds <= NORMAL_MAX_SECONDS + 0.5) return 0;
  const i = EXTENDED_STAGES.findIndex((s) => seconds <= s.seconds + 0.5);
  const idx = i === -1 ? EXTENDED_STAGES.length - 1 : i;
  return clamp((idx + 1) / EXTENDED_STAGES.length, 0.14, 1);
}

/* ── Extended mode stepping ─────────────────────────────────────────────── */

/** Next larger visible duration. Returns null at the 30d ceiling. */
export function nextExtendedDuration(current: number): number | null {
  for (const stage of EXTENDED_STAGES) {
    if (stage.seconds > current + 0.5) return stage.seconds;
  }
  return null;
}

/** Next smaller visible duration; falls back to the normal 1h maximum. */
export function prevExtendedDuration(current: number): number | null {
  for (let i = EXTENDED_STAGES.length - 1; i >= 0; i--) {
    if (EXTENDED_STAGES[i].seconds < current - 0.5) return EXTENDED_STAGES[i].seconds;
  }
  return current > NORMAL_MAX_SECONDS ? NORMAL_MAX_SECONDS : null;
}

export const isExtended = (seconds: number) => seconds > NORMAL_MAX_SECONDS + 0.5;
