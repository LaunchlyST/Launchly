// Non-linear mapping for timeline zoom: more space for short durations
export const NORMAL_STAGES: Array<{ value: number; seconds: number; label: string }> = [
  { value: 0, seconds: 5, label: '5s' },
  { value: 15, seconds: 15, label: '15s' },
  { value: 30, seconds: 30, label: '30s' },
  { value: 42, seconds: 45, label: '45s' },
  { value: 50, seconds: 60, label: '1m' },
  { value: 65, seconds: 180, label: '3m' },
  { value: 78, seconds: 600, label: '10m' },
  { value: 90, seconds: 1800, label: '30m' },
  { value: 100, seconds: 3600, label: '1h' },
];

export const EXTENDED_STAGES: Array<{ seconds: number; label: string }> = [
  { seconds: 7200, label: '2h' },
  { seconds: 18000, label: '5h' },
  { seconds: 36000, label: '10h' },
  { seconds: 86400, label: '24h' },
  { seconds: 172800, label: '48h' },
  { seconds: 604800, label: '7d' },
  { seconds: 2592000, label: '30d' },
];

export function secondsForZoomValue(v: number): number {
  const clamped = Math.max(0, Math.min(100, v));
  for (let i = 0; i < NORMAL_STAGES.length - 1; i++) {
    const a = NORMAL_STAGES[i];
    const b = NORMAL_STAGES[i + 1];
    if (clamped >= a.value && clamped <= b.value) {
      const t = (clamped - a.value) / (b.value - a.value);
      return Math.round(a.seconds + t * (b.seconds - a.seconds));
    }
  }
  return NORMAL_STAGES[NORMAL_STAGES.length - 1].seconds;
}

export function zoomValueForSeconds(s: number): number {
  if (s <= NORMAL_STAGES[0].seconds) return 0;
  if (s >= NORMAL_STAGES[NORMAL_STAGES.length - 1].seconds) return 100;
  for (let i = 0; i < NORMAL_STAGES.length - 1; i++) {
    const a = NORMAL_STAGES[i];
    const b = NORMAL_STAGES[i + 1];
    if (s >= a.seconds && s <= b.seconds) {
      const t = (s - a.seconds) / (b.seconds - a.seconds);
      return a.value + t * (b.value - a.value);
    }
  }
  return 50;
}

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

export function colorForZoomValue(v: number): string {
  // 0 = pink #EC4899, 50 = orange #F59E0B, 100 = yellow #EAB308
  // interpolate
  const t = v / 100;
  if (t < 0.5) {
    // pink -> orange
    const tt = t / 0.5;
    return interpolateColor('#EC4899', '#F59E0B', tt);
  } else {
    // orange -> yellow
    const tt = (t - 0.5) / 0.5;
    return interpolateColor('#F59E0B', '#EAB308', tt);
  }
}

function interpolateColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const b_ = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r}, ${g}, ${b_})`;
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

export function nextExtendedDuration(current: number): number | null {
  for (const stage of EXTENDED_STAGES) {
    if (stage.seconds > current) return stage.seconds;
  }
  return null;
}

export function prevExtendedDuration(current: number): number | null {
  // find previous
  for (let i = EXTENDED_STAGES.length - 1; i >= 0; i--) {
    if (EXTENDED_STAGES[i].seconds < current) return EXTENDED_STAGES[i].seconds;
  }
  return 3600; // back to normal max
}
