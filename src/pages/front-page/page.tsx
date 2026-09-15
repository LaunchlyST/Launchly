import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowRight } from 'lucide-react';

type Pt = { x: number; y: number; w: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; s: number; kind: 0 | 1 };

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%+*';

const WORK = [
  {
    no: '01',
    title: 'Affiliate creatives',
    year: '2026',
    meta: 'Shop',
    line: 'Hooks, proof, and offers that sell the listing.',
    reveal: 'Built for affiliates who post every week — not one-off brand films.',
  },
  {
    no: '02',
    title: 'Product angles',
    year: '2026',
    meta: 'Ideas',
    line: 'Paste a Shop product. Get angles worth posting.',
    reveal: 'Positioning, objections, and a first line that earns the swipe.',
  },
  {
    no: '03',
    title: 'Image ads',
    year: '2026',
    meta: 'Still',
    line: 'Shop-native frames with type you can actually read.',
    reveal: 'Composition for the For You grid — clear product, clear claim.',
  },
  {
    no: '04',
    title: 'Video ads',
    year: '2026',
    meta: 'Motion',
    line: 'Short cuts ready for TikTok Shop.',
    reveal: 'Script, cut, and polish a vertical ad you can download today.',
  },
  {
    no: '05',
    title: 'TikTok Shop export',
    year: '2026',
    meta: 'Ship',
    line: 'Download. Caption. Post. Keep the loop moving.',
    reveal: '1080×1920 files and copy that leave the studio with you.',
  },
  {
    no: '06',
    title: 'Studio access',
    year: 'GBP 5/mo',
    meta: 'Plan',
    line: 'Full toolkit. AI usage billed separately.',
    reveal: 'Five pounds for the workshop. Tokens stay on your own meter.',
  },
];

const STEPS = [
  { no: '01', title: 'Spark', body: 'Drop the product.' },
  { no: '02', title: 'Shape', body: 'Turn the angle into an ad.' },
  { no: '03', title: 'Cut', body: 'Download the file.' },
  { no: '04', title: 'Ship', body: 'Post to TikTok Shop.' },
];

const INTRO = [
  {
    no: '01',
    label: 'LAUNCHLY',
    line: 'You create.',
    sub: 'Affiliate angles and ads shaped for TikTok Shop.',
  },
  {
    no: '02',
    label: 'THE LOOP',
    line: 'You post.',
    sub: 'Download. Caption. Keep the weekly cadence.',
  },
  {
    no: '03',
    label: 'THE PAYOFF',
    line: 'You earn.',
    sub: 'A studio that ships work — not decks.',
  },
  {
    no: '04',
    label: 'ENTER',
    line: 'The desk is ready.',
    sub: 'Scroll into Launchly.',
  },
];

function circleMetrics(points: { x: number; y: number }[]) {
  if (points.length < 12) return { score: 0, wound: 0, mean: 0, coverage: 0 };
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  if (mean < 26) return { score: 0, wound: 0, mean, coverage: 0 };
  const variance = radii.reduce((a, r) => a + (r - mean) ** 2, 0) / radii.length;
  const std = Math.sqrt(variance);
  const circularity = Math.max(0, 1 - std / mean / 0.45);

  let wound = 0;
  for (let i = 1; i < points.length; i++) {
    const a0 = Math.atan2(points[i - 1].y - cy, points[i - 1].x - cx);
    const a1 = Math.atan2(points[i].y - cy, points[i].x - cx);
    let d = a1 - a0;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    wound += d;
  }
  const woundScore = Math.min(1, Math.abs(wound) / 5.76);
  const bins = new Set<number>();
  const binCount = 48;
  for (const p of points) {
    const angle = Math.atan2(p.y - cy, p.x - cx);
    const normalized = (angle + Math.PI) / (Math.PI * 2);
    bins.add(Math.max(0, Math.min(binCount - 1, Math.floor(normalized * binCount))));
  }
  const coverage = bins.size / binCount;
  const gap = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
  const closure = gap < mean * 0.62 ? 1 : Math.max(0, 1 - gap / (mean * 1.35));
  const score = Math.max(0, Math.min(1, coverage * 0.5 + woundScore * 0.3 + circularity * 0.12 + closure * 0.08));
  return { score, wound, mean, coverage };
}

function circleScore(points: { x: number; y: number }[]) {
  return circleMetrics(points).score;
}

function shouldUnlockCircle(points: { x: number; y: number }[], mode: 'move' | 'up') {
  const { score, wound, coverage } = circleMetrics(points);
  const threshold = mode === 'move' ? 0.72 : 0.66;
  if (score >= threshold) return true;
  if (coverage >= 0.82 && Math.abs(wound) >= 4.65 && points.length >= 20) return true;
  if (mode === 'up' && coverage >= 0.76 && Math.abs(wound) >= 4.35 && points.length >= 20) return true;
  return false;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function ScrambleText({ text, play, className }: { text: string; play: boolean; className?: string }) {
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (!play) {
      setOut(text);
      return;
    }
    let frame = 0;
    const total = 20;
    const id = window.setInterval(() => {
      frame += 1;
      if (frame >= total) {
        setOut(text);
        window.clearInterval(id);
        return;
      }
      const revealed = (frame / total) * text.length;
      setOut(
        text
          .split('')
          .map((ch, i) => {
            if (ch === ' ' || ch === '·' || ch === '©' || i < revealed - 1.5) return ch;
            return GLYPHS[(Math.random() * GLYPHS.length) | 0];
          })
          .join(''),
      );
    }, 38);
    return () => window.clearInterval(id);
  }, [play, text]);

  return <span className={className}>{out}</span>;
}

function PageGrain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const t = now * 0.001;
      ctx.clearRect(0, 0, w, h);
      const washes = [
        { x: w * 0.22, y: h * 0.18, r: w * 0.42, c0: 'rgba(255,196,176,0.22)', c1: 'rgba(255,196,176,0)' },
        { x: w * 0.78, y: h * 0.28, r: w * 0.38, c0: 'rgba(168,214,226,0.20)', c1: 'rgba(168,214,226,0)' },
        { x: w * 0.55, y: h * 0.72, r: w * 0.36, c0: 'rgba(232,206,140,0.16)', c1: 'rgba(232,206,140,0)' },
        { x: w * 0.12, y: h * 0.62, r: w * 0.28, c0: 'rgba(196,176,220,0.12)', c1: 'rgba(196,176,220,0)' },
      ];
      for (const p of washes) {
        const drift = reduced.matches ? 0 : Math.sin(t * 0.22 + p.x) * 16;
        const g = ctx.createRadialGradient(p.x + drift, p.y, 0, p.x + drift, p.y, p.r);
        g.addColorStop(0, p.c0);
        g.addColorStop(1, p.c1);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      const img = ctx.createImageData(Math.min(w, 260) | 0, Math.min(h, 150) | 0);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = n;
        d[i + 3] = 12;
      }
      const tmp = document.createElement('canvas');
      tmp.width = img.width;
      tmp.height = img.height;
      const tctx = tmp.getContext('2d');
      if (tctx) {
        tctx.putImageData(img, 0, 0);
        ctx.globalAlpha = 0.22;
        ctx.drawImage(tmp, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="lz-grain" aria-hidden="true" />;
}

export function FrontPage() {
  const gateRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const unlockRef = useRef<HTMLDivElement>(null);
  const accessRef = useRef<HTMLElement>(null);
  const drawing = useRef(false);
  const points = useRef<Pt[]>([]);
  const sparks = useRef<Spark[]>([]);
  const dust = useRef<Spark[]>([]);
  const holdActive = useRef(false);
  const holdRaf = useRef(0);
  const frost = useRef({ t: 0, x: 0.5, y: 0.45, on: false });
  const unlocked = useRef(false);
  const unlockDragging = useRef(false);
  const pointer = useRef({ x: 0.5, y: 0.45 });

  const [gateOpen, setGateOpen] = useState(false);
  const [gateGone, setGateGone] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [drawProgress, setDrawProgress] = useState(0);
  const [hold, setHold] = useState(0);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [slideT, setSlideT] = useState(1);
  const [slideGreen, setSlideGreen] = useState(false);
  const [accessZoom, setAccessZoom] = useState(1);
  const [clock, setClock] = useState('--:--:--');
  const [xy, setXy] = useState({ x: 0.5, y: 0.5 });
  const [hoverCard, setHoverCard] = useState<number | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [introBeat, setIntroBeat] = useState(0);
  const [introEnter, setIntroEnter] = useState(false);
  const introLock = useRef(false);
  const introBeatRef = useRef(0);
  const introAdvanceRef = useRef<(force?: boolean) => void>(() => {});
  const gateReturnTimer = useRef(0);

  const closeToGate = useCallback(() => {
    if (gateReturnTimer.current) return;
    introLock.current = true;
    setIntroEnter(false);
    gateReturnTimer.current = window.setTimeout(() => {
      if (holdRaf.current) {
        cancelAnimationFrame(holdRaf.current);
        holdRaf.current = 0;
      }
      drawing.current = false;
      holdActive.current = false;
      unlocked.current = false;
      unlockDragging.current = false;
      introLock.current = false;
      introBeatRef.current = 0;
      points.current = [];
      sparks.current = [];
      dust.current = [];
      frost.current = { t: 0, x: 0.5, y: 0.45, on: false };
      setGateOpen(false);
      setGateGone(false);
      setUnlocking(false);
      setDrawProgress(0);
      setHold(0);
      setIntroDone(false);
      setIntroBeat(0);
      setIntroEnter(false);
      setSlideT(1);
      setSlideGreen(false);
      setAccessZoom(1);
      setHoverCard(null);
      gateReturnTimer.current = 0;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 560);
  }, []);

  useEffect(() => {
    return () => {
      if (gateReturnTimer.current) window.clearTimeout(gateReturnTimer.current);
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 280);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    const lock = !gateOpen || !introDone;
    if (lock) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = prev || '';
    return () => {
      document.body.style.overflow = prev || '';
    };
  }, [gateOpen, introDone]);

  useEffect(() => {
    if (!gateOpen) return;
    const t = window.setTimeout(() => setGateGone(true), 1280);
    return () => window.clearTimeout(t);
  }, [gateOpen]);

  useEffect(() => {
    if (!gateOpen || introDone) return;
    const t = window.setTimeout(() => setIntroEnter(true), 80);
    return () => window.clearTimeout(t);
  }, [gateOpen, introDone]);

  useEffect(() => {
    if (!gateOpen || introDone) return;

    const finishIntro = () => {
      introLock.current = false;
      setIntroDone(true);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    const advance = (force = false) => {
      if (introLock.current && !force) return;
      introLock.current = true;
      const b = introBeatRef.current;
      if (b >= INTRO.length - 1) {
        window.setTimeout(finishIntro, 420);
        return;
      }
      const next = b + 1;
      introBeatRef.current = next;
      setIntroBeat(next);
      window.setTimeout(() => {
        introLock.current = false;
      }, 700);
    };

    const reverse = (force = false) => {
      if (introLock.current && !force) return;
      introLock.current = true;
      const b = introBeatRef.current;
      if (b <= 0) {
        closeToGate();
        return;
      }
      const next = b - 1;
      introBeatRef.current = next;
      setIntroBeat(next);
      window.setTimeout(() => {
        introLock.current = false;
      }, 700);
    };

    introAdvanceRef.current = advance;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      if (e.deltaY > 0) advance();
      else reverse();
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const y = e.changedTouches[0]?.clientY ?? touchY;
      if (touchY - y > 42) advance();
      if (y - touchY > 42) reverse();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advance();
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        reverse();
      }
      if (e.key === 'Escape') closeToGate();
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const auto = window.setInterval(() => {
      if (!reduced) advance();
    }, 3800);

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);

    return () => {
      window.clearInterval(auto);
      document.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
    };
  }, [gateOpen, introDone, closeToGate]);

  useEffect(() => {
    if (!introDone) return;

    const onWheel = (e: WheelEvent) => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if (y > 2 || e.deltaY >= -8 || introLock.current) return;
      e.preventDefault();
      introLock.current = true;
      introBeatRef.current = INTRO.length - 1;
      setIntroBeat(INTRO.length - 1);
      setIntroDone(false);
      setIntroEnter(false);
      window.requestAnimationFrame(() => {
        setIntroEnter(true);
        window.setTimeout(() => {
          introLock.current = false;
        }, 700);
      });
    };

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => document.removeEventListener('wheel', onWheel, true);
  }, [introDone]);

  useEffect(() => {
    if (gateOpen) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY <= 8 || unlocked.current) return;
      e.preventDefault();
      finishUnlock(0.5, 0.45);
    };

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => document.removeEventListener('wheel', onWheel, true);
  }, [gateOpen]);

  useEffect(() => {
    if (!introDone) {
      setAccessZoom(1);
      return;
    }

    let raf = 0;
    let lastScale = 1;
    let hidden = document.hidden;
    const minScale = 1;
    const maxScale = 1.18;
    const updateAccessZoom = () => {
      if (hidden) {
        raf = window.requestAnimationFrame(updateAccessZoom);
        return;
      }
      const section = accessRef.current;
      if (section) {
        const rect = section.getBoundingClientRect();
        const viewportH = Math.max(1, window.innerHeight);
        const start = viewportH;
        const end = viewportH * 0.18;
        const progress = Math.max(0, Math.min(1, (start - rect.top) / (start - end)));
        const nextScale = minScale + (maxScale - minScale) * progress;
        if (Math.abs(nextScale - lastScale) > 0.002) {
          lastScale = nextScale;
          setAccessZoom(nextScale);
        }
      }
      raf = window.requestAnimationFrame(updateAccessZoom);
    };
    const onVisibilityChange = () => {
      hidden = document.hidden;
    };

    raf = window.requestAnimationFrame(updateAccessZoom);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [introDone]);

  useEffect(() => {
    const canvas = trailRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const strokePath = () => {
      const pts = points.current;
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) * 0.5;
        const my = (pts[i].y + pts[i + 1].y) * 0.5;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    };

    const paintStroke = () => {
      const pts = points.current;
      if (pts.length < 2) return;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = 'rgba(170,236,255,0.85)';
      ctx.shadowBlur = 34;
      ctx.strokeStyle = 'rgba(150,224,255,0.16)';
      ctx.lineWidth = 36;
      strokePath();
      ctx.stroke();

      ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(190,240,255,0.28)';
      ctx.lineWidth = 16;
      strokePath();
      ctx.stroke();
      ctx.restore();

      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const mid = (a.w + b.w) * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(220,248,255,0.72)';
        ctx.lineWidth = mid * 1.7;
        ctx.shadowColor = 'rgba(200,245,255,0.7)';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.96)';
        ctx.lineWidth = Math.max(1.4, mid * 0.55);
        ctx.shadowBlur = 4;
        ctx.stroke();
      }
    };

    const paintSparks = (list: Spark[], dt: number) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.01;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        const a = p.life / p.max;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.kind === 1 ? 'rgba(190,240,255,0.95)' : '#fff';
        ctx.shadowColor = 'rgba(180,240,255,0.9)';
        ctx.shadowBlur = 8;
        if (p.kind === 1) {
          ctx.translate(p.x, p.y);
          ctx.rotate(0.78);
          ctx.fillRect(-p.s, -p.s * 0.25, p.s * 2, p.s * 0.5);
          ctx.fillRect(-p.s * 0.25, -p.s, p.s * 0.5, p.s * 2);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    };

    const paintFrost = () => {
      if (!frost.current.on && frost.current.t <= 0) return;
      if (frost.current.on) frost.current.t = Math.min(1, frost.current.t + 0.018);
      const t = frost.current.t;
      const cx = frost.current.x * w;
      const cy = frost.current.y * h;
      const maxR = Math.hypot(w, h) * 0.72;
      const r = (1 - Math.pow(1 - t, 3)) * maxR;
      const pulse = 0.55 + Math.sin(t * Math.PI * 3) * 0.22;

      const g = ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,255,${0.42 * pulse})`);
      g.addColorStop(0.28, `rgba(210,242,255,${0.22 * pulse})`);
      g.addColorStop(0.62, `rgba(170,220,235,${0.1 * pulse})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(220,246,255,${0.28 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.18 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = `rgba(255,255,255,${0.18 * t})`;
      for (let i = 0; i < 90; i++) {
        const ang = (i * 2.399) + t * 0.4;
        const dist = (i * 47 + t * 120) % r;
        const x = cx + Math.cos(ang) * dist;
        const y = cy + Math.sin(ang) * dist;
        ctx.fillRect(x, y, 1.2, 1.2);
      }

      ctx.save();
      ctx.globalAlpha = 0.22 * t;
      ctx.strokeStyle = 'rgba(230,248,255,0.7)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2 + t;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * r * 0.9, cy + Math.sin(ang) * r * 0.9);
        ctx.stroke();
      }
      ctx.restore();
    };

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) * 60 * 0.016;
      last = now;
      ctx.clearRect(0, 0, w, h);
      paintStroke();
      paintSparks(sparks.current, 0.016 + dt * 0.2);
      paintSparks(dust.current, 0.02);
      paintFrost();
      raf = requestAnimationFrame(loop);
    };

    resize();
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const spawnSpark = (x: number, y: number, burst = 1) => {
    for (let i = 0; i < burst; i++) {
      sparks.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.6,
        vy: (Math.random() - 0.85) * 1.4,
        life: 0.55 + Math.random() * 0.55,
        max: 1,
        s: 0.8 + Math.random() * 2.2,
        kind: Math.random() > 0.62 ? 1 : 0,
      });
    }
  };

  const addPoint = (x: number, y: number) => {
    const pts = points.current;
    const appendPoint = (px: number, py: number) => {
      const last = pts[pts.length - 1];
      if (!last) {
        pts.push({ x: px, y: py, w: 7 });
        return;
      }
      const dist = Math.hypot(px - last.x, py - last.y);
      if (dist < 2.2) return;
      const w = Math.max(2.2, Math.min(12, 11.5 - dist * 0.18));
      pts.push({ x: px, y: py, w });
    };

    const last = pts[pts.length - 1];
    if (last) {
      const dist = Math.hypot(x - last.x, y - last.y);
      if (dist < 2.2) return;
      const steps = Math.max(1, Math.ceil(dist / 7));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        appendPoint(last.x + (x - last.x) * t, last.y + (y - last.y) * t);
      }
    } else {
      appendPoint(x, y);
    }
    if (pts.length > 280) points.current = pts.slice(-280);
    if (Math.random() > 0.35) spawnSpark(x, y, 1);
    const score = circleScore(points.current);
    setDrawProgress((d) => Math.max(d, score));
    return score;
  };

  const finishUnlock = (seedX: number, seedY: number) => {
    if (unlocked.current) return;
    unlocked.current = true;
    drawing.current = false;
    frost.current = { t: 0, x: seedX, y: seedY, on: true };
    setUnlocking(true);
    setDrawProgress(1);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => setGateOpen(true), reduced ? 120 : 520);
    window.setTimeout(() => setUnlocking(false), reduced ? 260 : 1320);
  };

  const localXY = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
  };

  const onGateDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (unlocked.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    points.current = [];
    const { x, y } = localXY(e);
    addPoint(x, y);
  };

  const onGateMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const { x, y, rect } = localXY(e);
    pointer.current = { x: x / rect.width, y: y / rect.height };
    setXy({ x: pointer.current.x, y: pointer.current.y });
    dust.current.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      life: 0.28,
      max: 0.28,
      s: 0.7 + Math.random(),
      kind: 0,
    });
    if (dust.current.length > 80) dust.current.splice(0, dust.current.length - 80);
    if (!drawing.current || unlocked.current) return;
    addPoint(x, y);
    if (shouldUnlockCircle(points.current, 'move')) {
      finishUnlock(x / rect.width, y / rect.height);
    }
  };

  const onGateUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (unlocked.current) return;
    drawing.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (shouldUnlockCircle(points.current, 'up')) {
      const { rect } = localXY(e);
      const pts = points.current;
      let cx = 0;
      let cy = 0;
      for (const p of pts) {
        cx += p.x;
        cy += p.y;
      }
      cx /= Math.max(1, pts.length);
      cy /= Math.max(1, pts.length);
      finishUnlock(cx / rect.width, cy / rect.height);
    }
    // Keep stroke + progress if not unlocked; only clear on next pointerdown
  };

  const startHold = () => {
    if (unlocked.current) return;
    holdActive.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      if (!holdActive.current) return;
      const t = Math.min(1, (now - start) / 980);
      setHold(t);
      setDrawProgress((d) => Math.max(d, t * 0.8));
      if (t >= 1) {
        holdActive.current = false;
        finishUnlock(0.5, 0.45);
        return;
      }
      holdRaf.current = requestAnimationFrame(tick);
    };
    holdRaf.current = requestAnimationFrame(tick);
  };

  const endHold = () => {
    holdActive.current = false;
    if (holdRaf.current) cancelAnimationFrame(holdRaf.current);
    if (!unlocked.current) setHold(0);
  };

  const goGetAccess = () => {
    if (leaving) return;
    setLeaving(true);
    setSlideGreen(true);
    setSlideT(0);
    window.location.assign('/get-in');
  };

  const unlockMetrics = () => {
    const track = unlockRef.current;
    if (!track) return { usable: 1, scale: 1, rect: null as DOMRect | null, pad: 4, knob: 52 };
    const rect = track.getBoundingClientRect();
    const pad = 4;
    const knob = 46;
    const layoutW = track.offsetWidth || rect.width;
    const scale = layoutW > 0 ? rect.width / layoutW : 1;
    const usable = Math.max(1, layoutW - knob - pad * 2);
    return { usable, scale, rect, pad, knob };
  };

  const slideFromClientX = (clientX: number) => {
    const { usable, scale, rect, pad, knob } = unlockMetrics();
    if (!rect) return 1;
    const xVisual = clientX - rect.left - pad * scale - knob * scale * 0.5;
    const xLocal = xVisual / Math.max(0.001, scale);
    return Math.max(0, Math.min(1, xLocal / usable));
  };

  const onUnlockDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    unlockDragging.current = true;
    setSlideGreen(false);
    setSlideT(slideFromClientX(event.clientX));
  };

  const onUnlockMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!unlockDragging.current) return;
    event.stopPropagation();
    setSlideT(slideFromClientX(event.clientX));
  };

  const onUnlockUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!unlockDragging.current) return;
    event.stopPropagation();
    unlockDragging.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    const next = slideFromClientX(event.clientX);
    if (next <= 0.08) {
      setSlideT(0);
      goGetAccess();
    } else {
      setSlideT(1);
      setSlideGreen(false);
    }
  };

  const ring = Math.max(drawProgress, hold);
  const prompt = drawProgress > 0.08 || hold > 0.05 ? 'KEEP GOING' : 'DRAW A CIRCLE';

  return (
    <main
      className={`lz ${ready ? 'is-ready' : ''} ${!gateOpen ? 'is-gated' : introDone ? 'is-open' : 'is-intro'} ${unlocking ? 'is-unlocking' : ''}`}
      style={{
        ['--ring' as string]: ring,
        ['--mx' as string]: xy.x,
        ['--my' as string]: xy.y,
      }}
    >
      <style>{styles}</style>

      <div className="lz-page-bg" aria-hidden="true">
        <div className="lz-wash" />
        {gateOpen && <PageGrain />}
        <div className="lz-film" />
      </div>

      {!gateGone && (
        <div
          ref={gateRef}
          className={`lz-gate${gateOpen ? ' is-peel' : ''}`}
          onPointerDown={onGateDown}
          onPointerMove={onGateMove}
          onPointerUp={onGateUp}
          onPointerCancel={onGateUp}
          aria-hidden={gateOpen}
        >
          <div className="lz-gate-mist" />
          <canvas ref={trailRef} className="lz-gate-draw" />
          <div className="lz-gate-center">
            <div className="lz-gate-ring" />
            <p className="lz-gate-prompt">{prompt}</p>
            <button
              type="button"
              className="lz-gate-hold"
              onPointerDown={(e) => {
                e.stopPropagation();
                startHold();
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                endHold();
              }}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              aria-label="Hold to enter Launchly"
            >
              HOLD TO ENTER
            </button>
          </div>
          <p className="lz-gate-brand">launchly</p>
        </div>
      )}

      {gateOpen && !introDone && (
        <section
          className={`lz-intro${introEnter ? ' is-in' : ''}`}
          aria-label="Launchly introduction"
          aria-live="polite"
        >
          <div className="lz-intro-wash" aria-hidden="true" />
          <div className="lz-intro-frame">
            <p className="lz-intro-label">
              <span>{INTRO[introBeat].no}</span>
              <span aria-hidden="true"> / </span>
              <span>{INTRO[introBeat].label}</span>
            </p>
            <h2 className="lz-intro-line" key={introBeat}>
              {INTRO[introBeat].line}
            </h2>
            <p className="lz-intro-sub" key={`s-${introBeat}`}>
              {INTRO[introBeat].sub}
            </p>
          </div>
          <div className="lz-intro-foot">
            <span aria-hidden="true" />
            <button
              type="button"
              className="lz-intro-scroll"
              onClick={() => introAdvanceRef.current(true)}
            >
              SCROLL
              <i aria-hidden="true" />
            </button>
            <div className="lz-intro-dots" aria-hidden="true">
              {INTRO.map((beat, i) => (
                <span key={beat.no} className={i === introBeat ? 'is-on' : i < introBeat ? 'is-done' : ''} />
              ))}
            </div>
          </div>
        </section>
      )}

      {gateOpen && introDone && (
        <div className="lz-doc">
          <header className="lz-chrome">
            <span className="lz-chrome-brand">
              <ScrambleText text="LAUNCHLY©2026" play />
            </span>
            <span className="lz-chrome-clock">{clock}</span>
            <span className="lz-chrome-xy">
              {xy.x.toFixed(3)} / {xy.y.toFixed(3)}
            </span>
          </header>

          <section className="lz-hero" onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setXy({
              x: (e.clientX - r.left) / r.width,
              y: (e.clientY - r.top) / r.height,
            });
          }}>
            <div className="lz-glass" aria-hidden="true">
              <i className="lz-glass-light lz-glass-light-a" />
              <i className="lz-glass-light lz-glass-light-b" />
              <i className="lz-glass-light lz-glass-light-c" />
              <div className="lz-glass-plate">
                <span className="lz-glass-word">LAUNCHLY</span>
              </div>
            </div>
            <p className="lz-statement">
              <ScrambleText
                play
                text="Launchly shapes TikTok Shop affiliate workflows with craft — ideas to ads you can download and post."
              />
            </p>
            <p className="lz-statement-sub">
              Access is GBP 5/month. AI usage is billed separately.
            </p>
          </section>

          <section className="lz-work" id="work">
            <div className="lz-work-head">
              <p className="lz-kicker">
                <ScrambleText play text="WORK / FEATURES" />
              </p>
              <p className="lz-work-note">The studio, listed like a desk — not a pitch deck.</p>
            </div>
            <ul className="lz-grid">
              {WORK.map((item, i) => (
                <li
                  key={item.no}
                  className={`lz-card${hoverCard === i ? ' is-on' : ''}`}
                  onPointerEnter={() => setHoverCard(i)}
                  onPointerLeave={() => setHoverCard(null)}
                >
                  <div className="lz-card-meta">
                    <span>{item.no}</span>
                    <span>{item.year}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="lz-card-line">{item.line}</p>
                  <span className="lz-card-tag">{item.meta}</span>
                  <div className="lz-card-dots" aria-hidden="true" />
                  <div className="lz-card-reveal">
                    <p>{item.reveal}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="lz-steps">
            <p className="lz-kicker">PROCESS</p>
            <ol>
              {STEPS.map((step) => (
                <li key={step.no}>
                  <span>{step.no}</span>
                  <em>{step.title}</em>
                  <b>{step.body}</b>
                </li>
              ))}
            </ol>
          </section>

          <section
            ref={accessRef}
            className="lz-access"
            aria-label="Get access"
            style={{ ['--access-zoom' as string]: accessZoom }}
          >
            <div className="lz-access-copy">
            <p className="lz-kicker lz-kicker-gold">LAUNCHLY ACCESS</p>
            <h2>
              Create. Download.
              <br />
              Post.
            </h2>
            <p className="lz-access-sub">
              Full affiliate toolkit for <span>GBP 5/month</span>
            </p>
            <p className="lz-access-ai">AI usage separate.</p>
            <div
              ref={unlockRef}
              className={`lz-unlock${slideGreen ? ' is-green' : ''}`}
              role="slider"
              aria-label="Slide Get access left to open get-in page"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((1 - slideT) * 100)}
              onPointerDown={onUnlockDown}
              onPointerMove={onUnlockMove}
              onPointerUp={onUnlockUp}
              onPointerCancel={onUnlockUp}
            >
              <div className="lz-unlock-fill" style={{ width: `${(1 - slideT) * 100}%` }} />
              <span className="lz-unlock-label">{slideGreen ? 'Opening...' : 'Get access'}</span>
              <div className="lz-unlock-knob" style={{ ['--knob-x' as string]: `${unlockMetrics().usable * slideT}px` }}>
                <ArrowRight size={20} className="lz-unlock-arrow" aria-hidden="true" />
              </div>
            </div>
            <p className="lz-access-hint">SLIDE LEFT — OPEN GET-IN</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}


const styles = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,300;1,9..144,500&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
.app--inside:has(.lz),.app--inside:has(.lz) .app__main{background:transparent!important;padding:0!important;display:block!important}
.app--inside:has(.lz.is-gated),.app--inside:has(.lz.is-gated) .app__main,.app:has(.lz.is-gated),
.app--inside:has(.lz.is-intro),.app--inside:has(.lz.is-intro) .app__main,.app:has(.lz.is-intro){height:100%!important;overflow:hidden!important}
.app--inside:has(.lz.is-open),.app--inside:has(.lz.is-open) .app__main,.app:has(.lz.is-open){height:auto!important;min-height:100vh;overflow:visible!important}
html:has(.lz.is-open),body:has(.lz.is-open),#root:has(.lz.is-open){height:auto!important;overflow:auto!important}
html:has(.lz.is-intro),body:has(.lz.is-intro),#root:has(.lz.is-intro){height:100%!important;overflow:hidden!important}
.lz{position:relative;min-height:100vh;color:#1c2422;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f4efe6;opacity:0;transition:opacity .4s ease}
.lz.is-ready{opacity:1}
.lz *{box-sizing:border-box}
.lz button{font:inherit}
.lz-page-bg{position:fixed;inset:0;z-index:0;pointer-events:none}
.lz-wash{position:absolute;inset:0;background:linear-gradient(180deg,#f7f3ea 0%,#efe8db 42%,#e7ece8 100%)}
.lz-grain{position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:multiply;opacity:.55}
.lz-film{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,transparent 0 46%,rgba(40,50,45,.06) 100%)}
.lz-gate{position:fixed;inset:0;z-index:80;display:grid;place-items:center;cursor:crosshair;touch-action:none;user-select:none;background:radial-gradient(ellipse at 50% 42%,#8ea89a 0%,#6d8a7d 46%,#4f6d61 100%);transition:opacity 1.1s ease,filter 1.1s ease,visibility 1.1s}
.lz-gate.is-peel{opacity:0;filter:blur(10px);visibility:hidden;pointer-events:none}
.lz-gate-mist{position:absolute;inset:-8%;background:radial-gradient(ellipse at 72% 18%,rgba(255,255,245,.34),transparent 42%),radial-gradient(ellipse at 22% 78%,rgba(180,220,230,.18),transparent 46%),repeating-linear-gradient(118deg,transparent 0 22px,rgba(255,255,255,.03) 22px 24px);animation:lz-drift 16s ease-in-out infinite alternate}
.lz-gate-draw{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
.lz-gate-center{position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;gap:16px;pointer-events:none}
.lz-gate-ring{width:min(168px,44vw);aspect-ratio:1;border-radius:50%;background:conic-gradient(#fff calc(var(--ring,0)*1turn),rgba(255,255,255,.14) 0);mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.2px));-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1.2px));filter:drop-shadow(0 0 14px rgba(200,240,255,.45));animation:lz-pulse 2.6s ease-in-out infinite}
.lz-gate-prompt{margin:0;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.46em;font-weight:600;color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.22)}
.lz-gate-hold{pointer-events:auto;padding:9px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.1);backdrop-filter:blur(10px);color:#fff;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9px;letter-spacing:.28em;font-weight:600;cursor:pointer;touch-action:none}
.lz-gate-brand{position:absolute;left:clamp(14px,3vw,32px);bottom:clamp(14px,3vw,28px);z-index:3;margin:0;font-family:Fraunces,"Instrument Serif",Georgia,serif;font-size:clamp(40px,8vw,70px);font-weight:500;font-style:italic;color:rgba(255,255,255,.9);letter-spacing:-.04em;pointer-events:none;-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='discrete' tableValues='0 0 0 1 1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='discrete' tableValues='0 0 0 1 1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");-webkit-mask-size:cover;mask-size:cover}
.lz-intro{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:clamp(24px,5vw,56px);opacity:0;transform:translateY(10px);transition:opacity .7s ease,transform .7s cubic-bezier(.16,1,.3,1);pointer-events:auto}
.lz-intro.is-in{opacity:1;transform:none}
.lz-intro-wash{position:absolute;inset:0;background:
  radial-gradient(ellipse at 28% 32%,rgba(196,214,190,.55),transparent 52%),
  radial-gradient(ellipse at 78% 24%,rgba(255,236,210,.45),transparent 48%),
  radial-gradient(ellipse at 55% 78%,rgba(210,228,220,.4),transparent 50%),
  linear-gradient(180deg,#f6f1e8 0%,#ebe6db 100%);
  pointer-events:none}
.lz-intro-frame{position:relative;z-index:1;width:min(720px,92vw);text-align:center}
.lz-intro-label{margin:0 0 22px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.32em;font-weight:600;color:rgba(28,36,34,.42)}
.lz-intro-line{margin:0;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-weight:400;font-style:italic;font-size:clamp(42px,9vw,88px);letter-spacing:-.035em;line-height:1.02;color:#1c2422;animation:lz-intro-in .75s cubic-bezier(.16,1,.3,1) both}
.lz-intro-sub{margin:18px auto 0;max-width:28em;font-size:clamp(15px,2vw,18px);line-height:1.5;color:rgba(28,36,34,.58);animation:lz-intro-in .75s .08s cubic-bezier(.16,1,.3,1) both}
.lz-intro-foot{position:absolute;left:0;right:0;bottom:clamp(18px,4vh,36px);z-index:2;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:0 clamp(18px,4vw,40px)}
.lz-intro-skip{justify-self:start;border:0;background:transparent;padding:8px 4px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.28em;font-weight:600;color:rgba(28,36,34,.4);cursor:pointer}
.lz-intro-skip:hover{color:#1c2422}
.lz-intro-scroll{justify-self:center;display:inline-flex;align-items:center;gap:10px;border:0;background:transparent;padding:8px 4px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.34em;font-weight:600;color:rgba(28,36,34,.55);cursor:pointer}
.lz-intro-scroll i{position:relative;display:block;width:12px;height:28px;animation:lz-scroll-pulse 1.6s ease-in-out infinite}
.lz-intro-scroll i:before{content:"";position:absolute;left:50%;top:0;width:1px;height:22px;background:linear-gradient(180deg,rgba(28,36,34,.55),rgba(28,36,34,.18));transform:translateX(-50%)}
.lz-intro-scroll i:after{content:"";position:absolute;left:50%;bottom:0;width:8px;height:8px;border-right:1px solid rgba(28,36,34,.55);border-bottom:1px solid rgba(28,36,34,.55);transform:translateX(-50%) rotate(45deg)}
.lz-intro-dots{justify-self:end;display:flex;gap:7px;align-items:center}
.lz-intro-dots span{width:6px;height:6px;border-radius:50%;background:rgba(28,36,34,.18);transition:transform .35s ease,background .35s ease}
.lz-intro-dots span.is-done{background:rgba(28,36,34,.35)}
.lz-intro-dots span.is-on{background:#1c2422;transform:scale(1.25)}
@keyframes lz-intro-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes lz-scroll-pulse{0%,100%{opacity:.35;transform:scaleY(.7)}50%{opacity:1;transform:scaleY(1)}}
.lz-doc{position:relative;z-index:2;animation:lz-intro-in .8s cubic-bezier(.16,1,.3,1) both}
.lz-chrome{position:sticky;top:0;z-index:10;display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;padding:16px clamp(18px,4vw,40px);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.08em;color:rgba(28,36,34,.62);background:linear-gradient(180deg,#f7f3eae6,#f7f3ea00)}
.lz-chrome-brand{font-weight:600;color:#1c2422}
.lz-hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px clamp(18px,5vw,72px) 72px;text-align:center}
.lz-glass{position:relative;width:min(920px,94vw);display:grid;place-items:center;margin-bottom:36px}
.lz-glass-light{position:absolute;border-radius:50%;filter:blur(42px);opacity:.7;pointer-events:none}
.lz-glass-light-a{width:42%;height:52%;left:8%;top:8%;background:rgba(255,176,160,.35)}
.lz-glass-light-b{width:40%;height:48%;right:6%;top:12%;background:rgba(150,210,220,.32)}
.lz-glass-light-c{width:36%;height:40%;left:32%;bottom:0;background:rgba(232,200,130,.28)}
.lz-glass-plate{position:relative;padding:clamp(18px,4vw,40px) clamp(16px,3vw,36px);border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.48),rgba(255,255,255,.12));border:1px solid rgba(255,255,255,.62);box-shadow:0 24px 60px rgba(40,50,45,.08),inset 0 1px 0 rgba(255,255,255,.8);backdrop-filter:blur(18px) saturate(1.25);-webkit-backdrop-filter:blur(18px) saturate(1.25)}
.lz-glass-word{display:block;font-family:Fraunces,"Instrument Serif",Georgia,serif;font-style:italic;font-weight:500;font-size:clamp(44px,12vw,132px);letter-spacing:-.05em;line-height:.86;background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(210,232,236,.7) 42%,rgba(255,196,170,.55) 78%,rgba(255,255,255,.88));-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 10px 24px rgba(60,80,75,.12))}
.lz-statement{margin:0 auto;max-width:34em;font-size:clamp(18px,2.4vw,26px);line-height:1.45;font-weight:500;color:#24302c}
.lz-statement-sub{margin:14px 0 0;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;letter-spacing:.04em;color:rgba(28,36,34,.5)}
.lz-work{padding:40px clamp(18px,4vw,48px) 80px}
.lz-work-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:22px;flex-wrap:wrap}
.lz-kicker{margin:0;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.28em;font-weight:600;color:rgba(28,36,34,.45)}
.lz-work-note{margin:0;font-size:13px;color:rgba(28,36,34,.48)}
.lz-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.lz-card{position:relative;overflow:hidden;padding:22px 22px 20px;border-radius:18px;background:rgba(255,255,255,.52);border:1px solid rgba(255,255,255,.7);box-shadow:0 10px 28px rgba(40,50,45,.05);min-height:196px;cursor:default}
.lz-card-meta{display:flex;justify-content:space-between;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.16em;color:rgba(28,36,34,.42);margin-bottom:18px}
.lz-card h3{margin:0;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-weight:400;font-size:clamp(26px,3vw,36px);letter-spacing:-.03em}
.lz-card-line{margin:10px 0 0;max-width:28ch;font-size:14px;line-height:1.45;color:rgba(28,36,34,.58)}
.lz-card-tag{display:inline-block;margin-top:16px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.16em;color:rgba(28,36,34,.4)}
.lz-card-dots{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,rgba(28,36,34,.18) 1px,transparent 1.2px);background-size:8px 8px;opacity:0;transition:opacity .35s ease}
.lz-card-reveal{position:absolute;inset:0;display:grid;place-items:end start;padding:22px;background:linear-gradient(180deg,rgba(255,252,246,.2),rgba(36,48,44,.88));color:#f7f3ea;clip-path:inset(100% 0 0 0);transition:clip-path .45s cubic-bezier(.16,1,.3,1)}
.lz-card-reveal p{margin:0;max-width:28ch;font-size:14px;line-height:1.45}
.lz-card:hover .lz-card-reveal,.lz-card.is-on .lz-card-reveal{clip-path:inset(0)}
.lz-card:hover .lz-card-dots,.lz-card.is-on .lz-card-dots{opacity:.35}
.lz-steps{padding:10px clamp(18px,4vw,48px) 90px}
.lz-steps ol{list-style:none;margin:18px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.lz-steps li{padding:18px 0 0;border-top:1px solid rgba(28,36,34,.12)}
.lz-steps span{display:block;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.2em;color:rgba(28,36,34,.4);margin-bottom:10px}
.lz-steps em{display:block;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-style:italic;font-size:clamp(28px,4vw,42px);letter-spacing:-.03em}
.lz-steps b{display:block;margin-top:8px;font-weight:500;font-size:14px;color:rgba(28,36,34,.56)}
.lz-access{position:relative;min-height:clamp(560px,78vh,820px);display:grid;place-items:center;padding:80px clamp(18px,4vw,48px) 120px;text-align:center;overflow:hidden}
.lz-access-copy{position:relative;z-index:2;width:min(620px,100%);transform:scale(var(--access-zoom,1));transform-origin:center;transition:transform .16s ease-out;will-change:transform}
.lz-kicker-gold{color:#b8862d}
.lz-access h2{margin:12px 0 0;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-weight:400;font-size:clamp(40px,7vw,72px);letter-spacing:-.035em;line-height:1.02}
.lz-access-sub{margin:16px 0 0;font-size:16px;color:rgba(28,36,34,.62)}
.lz-access-sub span{display:inline-block;margin:0 2px;padding:3px 10px;border-radius:999px;background:#d7a243;color:#1a1200;font-weight:700;font-size:12px}
.lz-access-ai{margin:8px 0 0;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.08em;color:rgba(28,36,34,.42)}
.lz-unlock{position:relative;margin:26px auto 0;width:min(320px,86vw);height:54px;border-radius:999px;background:#d7a243;overflow:hidden;touch-action:none;user-select:none;cursor:grab;box-shadow:0 10px 32px rgba(180,130,40,.24)}
.lz-unlock.is-green{background:#12b76a}
.lz-unlock-fill{position:absolute;inset:0 auto 0 0;background:#12b76a;pointer-events:none}
.lz-unlock-label{position:absolute;inset:0;display:grid;place-items:center;z-index:1;font-size:14px;font-weight:750;color:#1a1200;pointer-events:none;padding:0 52px}
.lz-unlock.is-green .lz-unlock-label{color:#fff}
.lz-unlock-knob{position:absolute;top:4px;left:4px;width:46px;height:46px;border-radius:50%;background:#f8f6f0;box-shadow:0 2px 8px rgba(0,0,0,.2);display:grid;place-items:center;z-index:2;pointer-events:none;transform:translateX(var(--knob-x,0px));transition:transform .28s cubic-bezier(.2,.8,.2,1)}
.lz-unlock-arrow{transform:rotate(180deg);color:#111}
.lz-unlock:active{cursor:grabbing}
.lz-unlock:active .lz-unlock-knob{transition:none}
.lz-access-hint{margin-top:14px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9px;letter-spacing:.16em;font-weight:700;color:#b8862d}
@keyframes lz-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.03);opacity:.86}}
@keyframes lz-drift{from{transform:translate3d(-1%,-.8%,0)}to{transform:translate3d(1.6%,1%,0)}}
@media(max-width:800px){
  .lz-grid,.lz-steps ol{grid-template-columns:1fr}
  .lz-chrome{grid-template-columns:1fr auto}
  .lz-chrome-xy{display:none}
}
@media(prefers-reduced-motion:reduce){
  .lz-gate-mist,.lz-gate-ring,.lz-intro-scroll i{animation:none}
  .lz-card-reveal,.lz-intro,.lz-intro-line,.lz-intro-sub,.lz-doc{transition:none;animation:none}
}
`;
