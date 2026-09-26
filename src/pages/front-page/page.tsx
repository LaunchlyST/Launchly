import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowRight } from 'lucide-react';

type Pt = { x: number; y: number; w: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; s: number; kind: 0 | 1 };

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%+*';

const FEEDBACK = [
  {
    no: '01',
    title: 'Clearer posts, faster',
    role: 'TikTok Shop affiliate',
    line: 'I used to sit on a product for days. Now I leave with a caption and a frame the same sitting.',
    reveal: 'Angles that actually sound like something you would post — not a brand deck.',
  },
  {
    no: '02',
    title: 'Less guessing',
    role: 'UGC creator',
    line: 'Paste the listing, pick an angle, ship the creative. The loop finally feels short.',
    reveal: 'Hooks and proof points lined up before I hit record.',
  },
  {
    no: '03',
    title: 'Desk, not deck',
    role: 'Shop affiliate',
    line: 'GBP 5 for the studio. I keep the commissions. AI stays on my own meter.',
    reveal: 'Access is cheap. The upside is still the Shop payout.',
  },
];

const WORK = [
  {
    no: '01',
    title: 'Winning products',
    body: 'Scan product signals, creator velocity, and Shop demand before you spend time on a weak angle.',
    tag: 'SIGNAL',
  },
  {
    no: '02',
    title: 'Search Creator API',
    body: 'Turn creator and product searches into usable brief data for hooks, proof points, and creative direction.',
    tag: 'SEARCH',
  },
  {
    no: '03',
    title: 'Search ideas',
    body: 'Collect angles from TikTok patterns, then rewrite them into posts that fit your voice.',
    tag: 'IDEAS',
  },
  {
    no: '04',
    title: 'Bots that draft',
    body: 'Generate caption sets, image prompts, voiceover scripts, and testing variants from one product page.',
    tag: 'BOTS',
  },
  {
    no: '05',
    title: 'Credits sidebar',
    body: 'Keep AI usage clear with visible credit states while the studio stays GBP 5/month.',
    tag: 'CREDITS',
  },
  {
    no: '06',
    title: 'Export desk',
    body: 'Package ready-to-post files, notes, and next tests so a product moves from idea to upload.',
    tag: 'FILES',
  },
];

const STEPS = [
  { no: '01', title: 'Idea', body: 'Find a product, study the current TikTok angle, and save the opening promise.', bars: [42, 78, 54] },
  { no: '02', title: 'Creation', body: 'Launchly drafts hooks, captions, visuals, and shot notes around that product.', bars: [68, 48, 86] },
  { no: '03', title: 'Files', body: 'Review the pack, download the assets, and keep the next test version ready.', bars: [52, 88, 64] },
  { no: '04', title: 'Posted', body: 'Publish on TikTok Shop, watch what sells, then repeat the winning pattern.', bars: [74, 58, 92] },
];

const EARN_STEPS = [
  { no: '01', title: 'Create', body: 'Build affiliate ads in Launchly — angles, captions, image and video packs.' },
  { no: '02', title: 'Post', body: 'Download and post to TikTok Shop on your own cadence.' },
  { no: '03', title: 'Earn', body: 'You keep the commissions from the Shop. Launchly does not take a cut.' },
  { no: '04', title: 'Access', body: 'GBP 5/month for the studio. AI usage billed separately.' },
];

const INTRO = [
  {
    no: '01',
    label: 'STEP ONE',
    line: 'Found ideas.',
    sub: 'Search ideas on TikTok, spot what is working, and level up your style.',
  },
  {
    no: '02',
    label: 'STEP TWO',
    line: 'You created.',
    sub: 'Create your own style with Launchly: hooks, captions, images, and video ideas.',
  },
  {
    no: '03',
    label: 'STEP THREE',
    line: 'You post.',
    sub: 'What you create becomes ready to post, so you can publish faster.',
  },
  {
    no: '04',
    label: 'STEP FOUR',
    line: 'Repeat.',
    sub: 'If it wins and starts earning money, do it again with the next idea.',
  },
];

const ENTRY_GATE_STEP = 0;
const ENTRY_MAIN_STEP = INTRO.length + 1;
const HERO_LINES = ['Take the risk', 'create ads that can earn lots of money'];
const HERO_WORD = HERO_LINES.join('');

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
        { x: w * 0.22, y: h * 0.18, r: w * 0.42, c0: 'rgba(180,220,255,0.28)', c1: 'rgba(180,220,255,0)' },
        { x: w * 0.78, y: h * 0.28, r: w * 0.38, c0: 'rgba(210,235,255,0.32)', c1: 'rgba(210,235,255,0)' },
        { x: w * 0.55, y: h * 0.72, r: w * 0.36, c0: 'rgba(255,255,255,0.22)', c1: 'rgba(255,255,255,0)' },
        { x: w * 0.12, y: h * 0.62, r: w * 0.28, c0: 'rgba(140,190,240,0.18)', c1: 'rgba(140,190,240,0)' },
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

function shouldSkipToMain() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('main') === '1' || params.get('skip') === '1';
}

export function FrontPage() {
  const gateRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const unlockRef = useRef<HTMLDivElement>(null);
  const accessRef = useRef<HTMLElement>(null);
  const accessCopyRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const points = useRef<Pt[]>([]);
  const sparks = useRef<Spark[]>([]);
  const dust = useRef<Spark[]>([]);
  const holdActive = useRef(false);
  const holdRaf = useRef(0);
  const frost = useRef({ t: 0, x: 0.5, y: 0.45, on: false });
  const skipToMain = shouldSkipToMain();
  const unlocked = useRef(skipToMain);
  const unlockDragging = useRef(false);
  const unlockGrabOffset = useRef(0);
  const pointer = useRef({ x: 0.5, y: 0.45 });
  const heroWordRef = useRef<HTMLDivElement>(null);
  const heroDragRef = useRef<{ index: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [gateOpen, setGateOpen] = useState(skipToMain);
  const [gateGone, setGateGone] = useState(skipToMain);
  const [unlocking, setUnlocking] = useState(false);
  const [drawProgress, setDrawProgress] = useState(0);
  const [hold, setHold] = useState(0);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [slideT, setSlideT] = useState(1);
  const [slideGreen, setSlideGreen] = useState(false);
  const [unlockDragActive, setUnlockDragActive] = useState(false);
  const [unlockHover, setUnlockHover] = useState(false);
  const [accessZoom, setAccessZoom] = useState(1);
  const [clock, setClock] = useState('--:--:--');
  const [xy, setXy] = useState({ x: 0.5, y: 0.5 });
  const [hoverCard, setHoverCard] = useState<number | null>(null);
  const [introDone, setIntroDone] = useState(skipToMain);
  const [introBeat, setIntroBeat] = useState(0);
  const [introEnter, setIntroEnter] = useState(false);
  const [heroLetters, setHeroLetters] = useState(() =>
    Array.from(HERO_WORD, () => ({ x: 0, y: 0, active: false }))
  );
  const introLock = useRef(false);
  const introBeatRef = useRef(0);
  const introAdvanceRef = useRef<(force?: boolean) => void>(() => {});
  const entryStepRef = useRef(skipToMain ? ENTRY_MAIN_STEP : ENTRY_GATE_STEP);
  const gateReturnTimer = useRef(0);
  const gatePeelTimer = useRef(0);

  const clearGateAttempt = useCallback(() => {
    drawing.current = false;
    holdActive.current = false;
    points.current = [];
    sparks.current = [];
    dust.current = [];
    frost.current = { t: 0, x: 0.5, y: 0.45, on: false };
    setDrawProgress(0);
    setHold(0);
    const canvas = trailRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const closeToGate = useCallback((delay = 1180) => {
    if (gateReturnTimer.current) return;
    if (gatePeelTimer.current) {
      window.clearTimeout(gatePeelTimer.current);
      gatePeelTimer.current = 0;
    }
    introLock.current = true;
    setIntroEnter(false);
    clearGateAttempt();
    unlocked.current = false;
    unlockDragging.current = false;
    setUnlockDragActive(false);
    setUnlockHover(false);
    entryStepRef.current = ENTRY_GATE_STEP;
    introBeatRef.current = 0;
    setUnlocking(false);
    setIntroBeat(0);
    setIntroDone(false);
    setGateGone(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setGateOpen(false));
    });
    gateReturnTimer.current = window.setTimeout(() => {
      if (holdRaf.current) {
        cancelAnimationFrame(holdRaf.current);
        holdRaf.current = 0;
      }
      introLock.current = false;
      setGateOpen(false);
      setGateGone(false);
      setIntroEnter(false);
      setSlideT(1);
      setSlideGreen(false);
      setAccessZoom(1);
      setHoverCard(null);
      gateReturnTimer.current = 0;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, delay);
  }, [clearGateAttempt]);

  useEffect(() => {
    return () => {
      if (gateReturnTimer.current) window.clearTimeout(gateReturnTimer.current);
      if (gatePeelTimer.current) window.clearTimeout(gatePeelTimer.current);
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
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = prev || '';
    };
  }, [gateOpen, introDone]);

  useEffect(() => {
    if (!gateOpen) return;
    gatePeelTimer.current = window.setTimeout(() => {
      setGateGone(true);
      gatePeelTimer.current = 0;
    }, 1280);
    return () => {
      if (gatePeelTimer.current) {
        window.clearTimeout(gatePeelTimer.current);
        gatePeelTimer.current = 0;
      }
    };
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
      entryStepRef.current = ENTRY_MAIN_STEP;
      setIntroDone(true);
      window.requestAnimationFrame(() => window.scrollTo({ top: 12, behavior: 'auto' }));
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
      entryStepRef.current = next + 1;
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
      entryStepRef.current = next + 1;
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
      e.stopPropagation();
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
      if (y > 24 || e.deltaY >= -8 || introLock.current) return;
      e.preventDefault();
      e.stopPropagation();
      introLock.current = true;
      entryStepRef.current = INTRO.length;
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
    if (!introDone) return;

    const onMove = (event: PointerEvent) => {
      setXy({
        x: Math.max(0, Math.min(1, event.clientX / Math.max(1, window.innerWidth))),
        y: Math.max(0, Math.min(1, event.clientY / Math.max(1, window.innerHeight))),
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [introDone]);

  useEffect(() => {
    if (!introDone) return;
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>('.lz-reveal, [data-reveal]'));
    if (!revealItems.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealItems.forEach((item) => item.classList.add('is-visible', 'is-in'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible', 'is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -18% 0px', threshold: 0.16 },
    );

    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [introDone]);

  useEffect(() => {
    if (gateOpen) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY <= 8 || unlocked.current) return;
      e.preventDefault();
      e.stopPropagation();
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
    const writeScale = (scale: number) => {
      const viewportW = Math.max(1, window.innerWidth);
      const viewportH = Math.max(1, window.innerHeight);
      const copy = accessCopyRef.current;
      const baseW = copy?.offsetWidth || 620;
      const baseH = copy?.offsetHeight || 360;
      const safeMax = Math.max(
        1.25,
        Math.min(1.55, (viewportW - 36) / baseW, (viewportH - 56) / baseH),
      );
      const clamped = Math.max(minScale, Math.min(safeMax, scale));
      accessRef.current?.style.setProperty('--access-zoom', clamped.toFixed(4));
      accessCopyRef.current?.style.setProperty('--access-zoom', clamped.toFixed(4));
      if (Math.abs(clamped - lastScale) > 0.002) {
        lastScale = clamped;
        setAccessZoom(clamped);
      }
    };
    const updateAccessZoom = () => {
      if (hidden) {
        raf = window.requestAnimationFrame(updateAccessZoom);
        return;
      }
      const section = accessRef.current;
      if (section) {
        const sectionTop = section.offsetTop;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const zoomStart = Math.max(0, Math.min(sectionTop, maxScroll - window.innerHeight * 0.82));
        const progress = Math.max(0, Math.min(1, (window.scrollY - zoomStart) / Math.max(1, maxScroll - zoomStart)));
        writeScale(minScale + progress * 0.55);
      }
      raf = window.requestAnimationFrame(updateAccessZoom);
    };
    const onVisibilityChange = () => {
      hidden = document.hidden;
    };

    writeScale(1);
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
    entryStepRef.current = 1;
    introBeatRef.current = 0;
    setIntroBeat(0);
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
    } else {
      clearGateAttempt();
    }
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
    window.location.assign('/inside');
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

  const slideFromGrabbedClientX = (clientX: number) => {
    const { usable, scale, rect, pad } = unlockMetrics();
    if (!rect) return 1;
    // grabOffset = pointerX - knobLeftScreen; keep relative grab while dragging
    const knobLeftScreen = clientX - unlockGrabOffset.current;
    const xLocal = (knobLeftScreen - rect.left) / Math.max(0.001, scale) - pad;
    return Math.max(0, Math.min(1, xLocal / usable));
  };

  const onUnlockDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    unlockDragging.current = true;
    setUnlockDragActive(true);
    setSlideGreen(false);
    // Do NOT snap slideT on down — store grab offset so the knob stays under the pointer
    const { usable, scale, rect, pad } = unlockMetrics();
    if (rect) {
      const knobLeftScreen = rect.left + (pad + usable * slideT) * scale;
      unlockGrabOffset.current = event.clientX - knobLeftScreen;
    } else {
      unlockGrabOffset.current = 0;
    }
  };

  const onUnlockMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!unlockDragging.current) return;
    event.stopPropagation();
    // Keep custom page cursor tracking alive during pointer capture
    setXy({
      x: Math.max(0, Math.min(1, event.clientX / Math.max(1, window.innerWidth))),
      y: Math.max(0, Math.min(1, event.clientY / Math.max(1, window.innerHeight))),
    });
    setSlideT(slideFromGrabbedClientX(event.clientX));
  };

  const onUnlockUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!unlockDragging.current) return;
    event.stopPropagation();
    unlockDragging.current = false;
    setUnlockDragActive(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    const next = slideFromGrabbedClientX(event.clientX);
    if (next <= 0.08) {
      setSlideT(0);
      goGetAccess();
    } else {
      setSlideT(1);
      setSlideGreen(false);
    }
  };

  const resetHeroLetters = useCallback(() => {
    heroDragRef.current = null;
    setHeroLetters((letters) => letters.map(() => ({ x: 0, y: 0, active: false })));
  }, []);

  const onHeroWordMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = heroWordRef.current?.getBoundingClientRect();
    if (!box) return;
    const draggingLetter = heroDragRef.current;
    if (draggingLetter) {
      const dx = event.clientX - draggingLetter.startX;
      const dy = event.clientY - draggingLetter.startY;
      setHeroLetters((letters) =>
        letters.map((letter, index) =>
          index === draggingLetter.index
            ? {
                x: Math.max(-110, Math.min(110, draggingLetter.originX + dx)),
                y: Math.max(-90, Math.min(90, draggingLetter.originY + dy)),
                active: true,
              }
            : letter
        )
      );
      return;
    }

    const spans = Array.from(event.currentTarget.querySelectorAll<HTMLSpanElement>('.lz-reactive-letter'));
    setHeroLetters((letters) =>
      letters.map((letter, index) => {
        const span = spans[index];
        if (!span) return letter;
        const rect = span.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const radius = Math.max(96, Math.min(150, box.width * 0.14));
        const force = Math.max(0, 1 - dist / radius) ** 1.8;
        const pull = Math.max(0, 1 - dist / (radius * 1.3)) ** 2;
        return {
          x: (-dx / dist) * force * 14 + (dx / dist) * pull * 2,
          y: (-dy / dist) * force * 10 + (dy / dist) * pull * 1,
          active: force > 0.03,
        };
      })
    );
  };

  const onHeroLetterDown = (event: ReactPointerEvent<HTMLSpanElement>, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const letter = heroLetters[index] ?? { x: 0, y: 0 };
    heroDragRef.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      originX: letter.x,
      originY: letter.y,
    };
    setHeroLetters((letters) =>
      letters.map((item, itemIndex) => (itemIndex === index ? { ...item, active: true } : item))
    );
  };

  const onHeroLetterUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    resetHeroLetters();
  };

  const onPagePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    setXy({
      x: Math.max(0, Math.min(1, event.clientX / Math.max(1, window.innerWidth))),
      y: Math.max(0, Math.min(1, event.clientY / Math.max(1, window.innerHeight))),
    });
  };

  const ring = Math.max(drawProgress, hold);
  const prompt = drawProgress > 0.08 || hold > 0.05 ? 'KEEP GOING' : 'DRAW A CIRCLE';

  return (
    <main
      className={`lz ${ready ? 'is-ready' : ''} ${!gateOpen ? 'is-gated' : introDone ? 'is-open' : 'is-intro'} ${unlocking ? 'is-unlocking' : ''} ${unlockDragActive ? 'is-unlock-dragging' : ''} ${unlockHover ? 'is-unlock-hover' : ''}`}
      onPointerMove={onPagePointerMove}
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
        <span className="lz-page-cursor" aria-hidden="true" />
      )}

      {gateOpen && introDone && (
        <div className="lz-doc">
          <header className="lz-chrome">
            <span className="lz-chrome-brand">
              <ScrambleText text="LAUNCHLY©2026" play />
            </span>
            <a className="lz-top-logo" href="/front-page" aria-label="Launchly front page">launchly</a>
            <nav className="lz-chrome-nav" aria-label="Front page sections">
              <a href="#studio">Studio</a>
              <a href="#features">Features</a>
              <a href="#process">Process</a>
            </nav>
            <span className="lz-chrome-clock">{clock}</span>
            <span className="lz-chrome-xy">
              {xy.x.toFixed(3)} / {xy.y.toFixed(3)}
            </span>
            <a className="lz-chrome-cta" href="/inside">Get access</a>
          </header>

          <section className="lz-hero lz-reveal" data-reveal>
            <span className="lz-custom-cursor" aria-hidden="true" />
            <div className="lz-hero-copy">
              <p className="lz-kicker">AFFILIATE AD STUDIO</p>
              <h1>
                Launch TikTok Shop ads
                <ScrambleText className="lz-gradient-line" text="before the trend moves." play />
              </h1>
              <p className="lz-hero-lead">
                Search the product, find the angle, generate the creative pack, and move from idea to post without rebuilding your workflow.
              </p>
              <div className="lz-hero-actions">
                <a className="lz-primary" href="/inside">Get access <ArrowRight size={18} /></a>
                <a className="lz-secondary" href="#studio">View studio</a>
              </div>
              <div className="lz-trust-row" aria-label="Launchly proof points">
                <span className="lz-avatar-stack" aria-hidden="true"><i /><i /><i /></span>
                <b>GBP 5/month studio</b>
                <span>AI usage stays separate</span>
                <span>Ready-to-post files</span>
              </div>
            </div>
            <div
              ref={heroWordRef}
              className="lz-reactive-word"
              aria-label="Launchly"
              onPointerMove={onHeroWordMove}
              onPointerLeave={resetHeroLetters}
              onPointerCancel={resetHeroLetters}
            >
              {HERO_LINES.map((line, lineIndex) => {
                const offset = HERO_LINES.slice(0, lineIndex).join('').length;
                return (
                  <span className="lz-reactive-line" data-long={line.length > 20 ? 'true' : undefined} key={line}>
                    {Array.from(line).map((letter, letterIndex) => {
                      const index = offset + letterIndex;
                      return (
                        <span
                          key={`${letter}-${index}`}
                          className={`lz-reactive-letter${heroLetters[index]?.active ? ' is-active' : ''}`}
                          style={{
                            ['--tx' as string]: `${heroLetters[index]?.x ?? 0}px`,
                            ['--ty' as string]: `${heroLetters[index]?.y ?? 0}px`,
                          }}
                          onPointerDown={(event) => onHeroLetterDown(event, index)}
                          onPointerUp={onHeroLetterUp}
                        >
                          {letter === ' ' ? '\u00a0' : letter}
                        </span>
                      );
                    })}
                  </span>
                );
              })}
            </div>
            <div className="lz-glass" aria-hidden="true">
              <i className="lz-glass-light lz-glass-light-a" />
              <i className="lz-glass-light lz-glass-light-b" />
              <i className="lz-glass-light lz-glass-light-c" />
              <div className="lz-product-window">
                <div className="lz-window-bar">
                  <span>Launchly angle desk</span>
                  <b>LIVE</b>
                </div>
                <div className="lz-product-grid-preview">
                  <div className="lz-preview-main">
                    <small>WINNING PRODUCT</small>
                    <strong>Portable blender, 19.4k saves, creator velocity rising.</strong>
                    <p>Angle: morning protein drink in one hand before school run.</p>
                  </div>
                  <div className="lz-preview-shot"><span>9:16</span></div>
                  <div className="lz-preview-list">
                    <span>3 hooks generated</span>
                    <span>Caption set ready</span>
                    <span>Shot list exported</span>
                  </div>
                </div>
                <div className="lz-window-sheen" />
              </div>
              <div className="lz-floating-panel lz-float-a"><b>+42%</b><span>creator match</span></div>
              <div className="lz-floating-panel lz-float-b"><b>8 files</b><span>queued</span></div>
            </div>
            <div className="lz-metrics-band" aria-label="Launchly metrics">
              <span><b>14 min</b><em>idea to pack</em></span>
              <span><b>6</b><em>creative angles</em></span>
              <span><b>9:16</b><em>post format</em></span>
            </div>
          </section>

          <section className="lz-showcase lz-reveal" id="studio" data-reveal aria-label="Studio showcase">
            <div className="lz-showcase-head">
              <p className="lz-kicker">STUDIO SHOWCASE</p>
              <h2>One browser-like workspace for finding, building, and shipping ads.</h2>
            </div>
            <div className="lz-browser-frame">
              <div className="lz-browser-bar"><span /><span /><span /><b>launchly.studio/product-desk</b></div>
              <div className="lz-browser-body">
                <aside className="lz-rail"><span>Search</span><span>Ideas</span><span>Bots</span><span>Credits</span></aside>
                <div className="lz-bento-canvas">
                  <article className="lz-bento-wide">
                    <small>QUOTE CARD</small>
                    <strong>"Make the first three seconds obvious, then prove the product works."</strong>
                  </article>
                  <article className="lz-media-tile"><span>hook-01.mp4</span></article>
                  <article className="lz-media-tile is-alt"><span>ugc-frame.png</span></article>
                  <article className="lz-export-queue">
                    <b>Export queue</b>
                    <span><i style={{ width: '84%' }} />Script pack</span>
                    <span><i style={{ width: '62%' }} />Caption variants</span>
                    <span><i style={{ width: '48%' }} />Image prompts</span>
                  </article>
                </div>
              </div>
            </div>
          </section>

          <section className="lz-spotlight lz-reveal" data-reveal aria-label="Product research spotlight">
            <div>
              <p className="lz-kicker">SPOTLIGHT 01</p>
              <h2>Research feels like a control room, not a blank document.</h2>
              <p>Product signals, creator examples, and saved angles sit together so the next ad decision is visible.</p>
            </div>
            <div className="lz-spotlight-panel"><span>creator velocity</span><b>19.4k saves</b><i /></div>
          </section>

          <section className="lz-spotlight lz-spotlight-flip lz-reveal" data-reveal aria-label="Creative production spotlight">
            <div className="lz-spotlight-panel"><span>creative pack</span><b>8 assets ready</b><i /></div>
            <div>
              <p className="lz-kicker">SPOTLIGHT 02</p>
              <h2>The output is built for posting, testing, and repeating.</h2>
              <p>Every idea ends with files, captions, shot notes, and the next variant ready to run.</p>
            </div>
          </section>

          <section className="lz-work lz-reveal" id="features" data-reveal aria-label="Features">
            <div className="lz-work-head">
              <h2>Built like a glass desk for affiliate work.</h2>
              <p className="lz-work-note">The middle of Launchly is focused on the actual loop: search, shape, generate, export, and keep credits visible.</p>
            </div>
            <ul className="lz-grid">
              {WORK.map((item, i) => (
                <li
                  className={`lz-card lz-card-${i + 1}${hoverCard === i ? ' is-on' : ''}`}
                  key={item.no}
                  onPointerEnter={() => setHoverCard(i)}
                  onPointerLeave={() => setHoverCard(null)}
                >
                  <span>{item.no}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <em>{item.tag}</em>
                  <div className="lz-card-reveal">{item.body}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="lz-steps lz-reveal" id="process" data-reveal aria-label="Workflow">
            <p className="lz-kicker">PROCESS</p>
            <h2 className="lz-earn-title">Idea to creation to files to posted.</h2>
            <p className="lz-earn-lead">A simple flow line keeps the work moving from research to a pack you can publish.</p>
            <div className="lz-workflow-line" aria-hidden="true"><i /><i /><i /></div>
            <ol>
              {STEPS.map((step) => (
                <li key={step.no}>
                  <span>{step.no}</span>
                  <em>{step.title}</em>
                  <b>{step.body}</b>
                  <div className="lz-step-bars" aria-hidden="true">
                    {step.bars.map((bar) => <i key={bar} style={{ width: `${bar}%` }} />)}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            ref={accessRef}
            className="lz-access lz-reveal"
            aria-label="Get access"
            style={{ ['--access-zoom' as string]: accessZoom }}
          >
            <div ref={accessCopyRef} className="lz-access-copy">
            <p className="lz-kicker lz-kicker-gold">LAUNCHLY ACCESS</p>
            <h2>
              Create. Download.
              <br />
              Post.
            </h2>
            <p className="lz-access-sub">
              Start creating TikTok Shop ads today for <span>GBP 5/month</span>
            </p>
            <p className="lz-access-ai">Bring your own AI keys when you want to generate.</p>
            <div
              ref={unlockRef}
              className={`lz-unlock${slideGreen ? ' is-green' : ''}${unlockDragActive ? ' is-dragging' : ''}`}
              role="slider"
              aria-label="Slide Get access left to open inside page"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((1 - slideT) * 100)}
              onPointerEnter={() => setUnlockHover(true)}
              onPointerLeave={() => setUnlockHover(false)}
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
            <p className="lz-access-hint">SLIDE LEFT - OPEN INSIDE</p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}


const styles = `
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800;900&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,300;1,9..144,500&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
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
.lz-gate{position:fixed;inset:0;z-index:80;display:grid;place-items:center;cursor:crosshair;touch-action:none;user-select:none;background:radial-gradient(ellipse at 50% 42%,#8ea89a 0%,#6d8a7d 46%,#4f6d61 100%);opacity:1;filter:blur(0);transform:scale(1);transform-origin:center;transition:opacity 1.1s ease,filter 1.1s ease,transform 1.1s cubic-bezier(.16,1,.3,1),visibility 1.1s}
.lz-gate.is-peel{opacity:0;filter:blur(10px);transform:scale(1.055);visibility:hidden;pointer-events:none}
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
.lz-access{position:relative;min-height:100svh;display:grid;place-items:center;padding:64px clamp(18px,4vw,48px) 76px;text-align:center;overflow:clip}
.lz-access-copy{position:relative;z-index:2;width:min(620px,100%);transform:scale(var(--access-zoom,1));transform-origin:center;transition:transform .08s linear;will-change:transform}
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
.lz.is-open{background:#f3f4ef;color:#1b2422}
.lz.is-open .lz-wash{position:fixed;inset:-10%;background:
  radial-gradient(ellipse at 18% 12%,rgba(255,246,232,.9),transparent 34%),
  radial-gradient(ellipse at 84% 8%,rgba(214,232,238,.78),transparent 38%),
  radial-gradient(ellipse at 72% 68%,rgba(199,217,215,.52),transparent 44%),
  radial-gradient(ellipse at 14% 78%,rgba(255,255,255,.72),transparent 36%),
  linear-gradient(135deg,#f8f6ef 0%,#edf3f2 44%,#f7f0e7 100%);
  animation:lz-atmosphere 18s ease-in-out infinite alternate}
.lz.is-open .lz-wash:before{content:"";position:absolute;inset:-12%;background:
  linear-gradient(112deg,transparent 0 14%,rgba(255,255,255,.34) 14.2% 14.8%,transparent 15% 100%),
  linear-gradient(74deg,transparent 0 46%,rgba(180,206,214,.22) 46.3% 47%,transparent 47.2% 100%),
  radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.72),transparent 42%);
  filter:blur(.2px);opacity:.8}
.lz.is-open .lz-wash:after{content:"";position:absolute;inset:0;background-image:radial-gradient(circle at 24% 22%,rgba(255,255,255,.42) 0 1px,transparent 1.4px),radial-gradient(circle at 72% 62%,rgba(120,150,156,.09) 0 1px,transparent 1.6px);background-size:34px 34px,52px 52px;opacity:.32}
.lz.is-open .lz-film{position:fixed;background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(190,205,206,.16)),radial-gradient(ellipse at 50% 42%,transparent 0 56%,rgba(89,108,110,.12) 100%)}
.lz-doc{position:relative;z-index:2;isolation:isolate;animation:lz-intro-in .8s cubic-bezier(.16,1,.3,1) both}
.lz-doc:before,.lz-doc:after{content:"";position:fixed;pointer-events:none;z-index:-1}
.lz-doc:before{inset:9vh 7vw 11vh;border:1px solid rgba(255,255,255,.42);border-radius:24px;background:linear-gradient(118deg,rgba(255,255,255,.16),rgba(255,255,255,.05) 46%,rgba(155,185,195,.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 34px 120px rgba(64,82,86,.08);backdrop-filter:blur(3px)}
.lz-doc:after{inset:0;background:linear-gradient(105deg,transparent 0 37%,rgba(255,255,255,.32) 37.3% 38.1%,transparent 38.5% 100%);opacity:.36;transform:translateX(var(--mx,0))}
.lz-doc .lz-hero:before,.lz-doc .lz-showcase:after,.lz-doc .lz-work:before{content:"";position:absolute;pointer-events:none;border-radius:999px;background:radial-gradient(circle,rgba(255,255,255,.62),rgba(188,213,219,.16) 46%,transparent 68%);filter:blur(18px);opacity:.72}
.lz-doc .lz-hero:before{width:42vw;height:42vw;right:-10vw;top:4vh}
.lz-doc .lz-showcase:after{width:34vw;height:34vw;left:-9vw;bottom:-6vw}
.lz-doc .lz-work{position:relative}
.lz-doc .lz-work:before{width:30vw;height:30vw;right:2vw;top:-10vw}
.lz-chrome{backdrop-filter:blur(18px);background:linear-gradient(180deg,rgba(250,249,244,.84),rgba(250,249,244,.2));border-bottom:1px solid rgba(255,255,255,.54)}
.lz-hero{position:relative;min-height:100svh;display:grid;grid-template-columns:minmax(0,.92fr) minmax(360px,1.08fr);gap:clamp(28px,6vw,86px);align-items:center;justify-content:center;padding:clamp(96px,11vh,148px) clamp(22px,6vw,92px) clamp(72px,9vh,118px);text-align:left;overflow:hidden}
.lz-hero-copy{position:relative;z-index:3;max-width:620px}
.lz-hero-copy .lz-kicker{color:rgba(142,96,19,.78)}
.lz-hero h1{margin:14px 0 0;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-weight:400;font-size:clamp(60px,8.2vw,126px);line-height:.9;letter-spacing:-.03em;color:#1b2422;text-wrap:balance}
.lz-hero-lead{margin:24px 0 0;max-width:34rem;font-size:clamp(17px,1.45vw,21px);line-height:1.55;color:rgba(27,36,34,.65)}
.lz-hero-actions{display:flex;align-items:center;gap:12px;margin-top:32px;flex-wrap:wrap}
.lz-primary,.lz-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:46px;border-radius:999px;padding:0 22px;font-weight:750;font-size:14px;text-decoration:none;transition:transform .25s ease,box-shadow .25s ease,background .25s ease}
.lz-primary{background:#d7a243;color:#191000;box-shadow:0 16px 34px rgba(183,129,36,.22),inset 0 1px 0 rgba(255,255,255,.42)}
.lz-secondary{color:#24302c;background:rgba(255,255,255,.42);border:1px solid rgba(255,255,255,.66);backdrop-filter:blur(14px)}
.lz-primary:hover,.lz-secondary:hover{transform:translateY(-2px)}
.lz-hero-ribbon{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:26px;width:max-content;max-width:100%;padding:9px 12px;border-radius:999px;background:rgba(255,255,255,.48);border:1px solid rgba(255,255,255,.74);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 18px 42px rgba(57,72,74,.08);backdrop-filter:blur(16px)}
.lz-hero-ribbon span{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:rgba(27,36,34,.58)}
.lz-hero-ribbon i{display:block;width:26px;height:1px;background:linear-gradient(90deg,rgba(215,162,67,.82),rgba(128,165,171,.2))}
.lz-glass{position:relative;width:min(720px,94vw);height:clamp(420px,58vw,660px);display:grid;place-items:center;margin:0;perspective:1200px}
.lz-glass:before{content:"";position:absolute;inset:8% 2% 4% 12%;border-radius:30px;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 38px 90px rgba(60,76,78,.13);transform:rotateY(-11deg) rotateX(5deg);backdrop-filter:blur(18px)}
.lz-glass-light{filter:blur(56px);opacity:.62}
.lz-glass-light-a{background:rgba(255,247,230,.74)}
.lz-glass-light-b{background:rgba(186,220,229,.52)}
.lz-glass-light-c{background:rgba(210,183,123,.24)}
.lz-glass-plate{position:absolute;inset:auto 8% 5%;padding:0;border:0;background:transparent;box-shadow:none;backdrop-filter:none;opacity:.18}
.lz-glass-word{font-size:clamp(48px,8vw,102px);color:rgba(255,255,255,.72);background:none;-webkit-background-clip:initial;background-clip:initial;text-shadow:0 1px 0 rgba(255,255,255,.8)}
.lz-product-window{position:relative;z-index:2;width:min(580px,88vw);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.76),rgba(239,247,248,.36));border:1px solid rgba(255,255,255,.72);box-shadow:0 34px 90px rgba(48,66,70,.16),inset 0 1px 0 rgba(255,255,255,.92);backdrop-filter:blur(22px) saturate(1.16);transform:rotateY(-8deg) rotateX(4deg);overflow:hidden}
.lz-window-bar{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid rgba(48,66,70,.08);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.12em;color:rgba(28,36,34,.52)}
.lz-window-bar b{color:#2c6d57;font-size:10px;text-transform:uppercase}
.lz-product-grid-preview{display:grid;grid-template-columns:1.18fr .82fr;gap:14px;padding:18px}
.lz-preview-main{min-height:232px;border-radius:18px;padding:22px;background:linear-gradient(160deg,rgba(255,255,255,.72),rgba(218,235,237,.38));border:1px solid rgba(255,255,255,.62)}
.lz-preview-main small,.lz-preview-list span{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.14em;color:rgba(28,36,34,.46);text-transform:uppercase}
.lz-preview-main strong{display:block;margin-top:42px;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-size:34px;line-height:1;letter-spacing:-.03em;font-weight:400}
.lz-preview-main p{margin:14px 0 0;color:rgba(28,36,34,.58);line-height:1.45}
.lz-preview-shot{min-height:232px;border-radius:18px;background:linear-gradient(180deg,rgba(33,44,42,.86),rgba(111,137,134,.38)),radial-gradient(ellipse at 55% 20%,rgba(255,255,255,.42),transparent 34%);display:grid;place-items:end center;padding:16px;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
.lz-preview-shot span{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.18em}
.lz-preview-list{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.lz-preview-list span{padding:12px;border-radius:14px;background:rgba(255,255,255,.52);border:1px solid rgba(255,255,255,.62)}
.lz-floating-panel{position:absolute;z-index:4;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.56);border:1px solid rgba(255,255,255,.72);box-shadow:0 18px 40px rgba(50,66,68,.12);backdrop-filter:blur(16px);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.12em;color:rgba(28,36,34,.62)}
.lz-floating-a{right:2%;top:18%;animation:lz-float 6s ease-in-out infinite}
.lz-floating-b{left:5%;bottom:19%;animation:lz-float 7s ease-in-out infinite reverse}
.lz-floating-c{right:8%;bottom:7%;animation:lz-float 8s ease-in-out infinite}
.lz-hero>.lz-statement{grid-column:1/-1;max-width:900px;margin:-20px auto 0;text-align:center;font-size:clamp(18px,2vw,28px);color:rgba(27,36,34,.72)}
.lz-hero>.lz-statement-sub{grid-column:1/-1;margin:0 auto;text-align:center;color:rgba(27,36,34,.46)}
.lz-hero>.lz-statement,.lz-hero>.lz-statement-sub{display:none!important}
.lz-hero-proof{grid-column:1/-1;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;width:min(820px,100%);margin:4px auto 0;padding:10px;border-radius:999px;background:rgba(255,255,255,.34);border:1px solid rgba(255,255,255,.64);box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 18px 50px rgba(52,70,73,.08);backdrop-filter:blur(16px)}
.lz-hero-proof span,.lz-hero-proof b{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 14px;border-radius:999px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(28,36,34,.55);background:rgba(255,255,255,.32)}
.lz-hero-proof b{color:#1b2422;background:rgba(215,162,67,.28)}
.lz-showcase{position:relative;display:grid;grid-template-columns:minmax(280px,.78fr) minmax(420px,1.22fr);gap:clamp(28px,6vw,82px);align-items:center;padding:clamp(70px,10vw,134px) clamp(22px,6vw,92px);overflow:hidden}
.lz-showcase:before{content:"";position:absolute;inset:8% 4%;border-radius:32px;background:linear-gradient(140deg,rgba(255,255,255,.26),rgba(214,231,235,.12));border:1px solid rgba(255,255,255,.48);box-shadow:inset 0 1px 0 rgba(255,255,255,.72);backdrop-filter:blur(7px);pointer-events:none}
.lz-showcase-copy{position:relative;z-index:2;max-width:520px}
.lz-showcase-copy h2{margin:12px 0 0;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-weight:400;font-size:clamp(42px,5.5vw,82px);line-height:.97;letter-spacing:-.032em;color:#1b2422}
.lz-showcase-copy p:not(.lz-kicker){margin:22px 0 0;font-size:clamp(16px,1.35vw,19px);line-height:1.58;color:rgba(27,36,34,.62)}
.lz-studio-board{position:relative;z-index:2;min-height:520px;border-radius:30px;background:linear-gradient(135deg,rgba(255,255,255,.62),rgba(238,247,249,.24));border:1px solid rgba(255,255,255,.72);box-shadow:0 36px 110px rgba(47,66,71,.14),inset 0 1px 0 rgba(255,255,255,.86);backdrop-filter:blur(22px);overflow:hidden}
.lz-studio-board:before{content:"";position:absolute;inset:-20% -10% auto;height:60%;background:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.82),transparent 62%);opacity:.82}
.lz-board-panel{position:absolute;border-radius:20px;background:rgba(255,255,255,.52);border:1px solid rgba(255,255,255,.68);box-shadow:0 22px 54px rgba(55,73,77,.12);backdrop-filter:blur(18px);padding:20px;color:#1b2422}
.lz-board-panel span{display:block;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(28,36,34,.42);margin-bottom:12px}
.lz-board-panel strong,.lz-board-panel b{display:block;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-weight:400;font-size:clamp(26px,3vw,44px);line-height:1;letter-spacing:-.03em}
.lz-board-panel p{margin:12px 0 0;color:rgba(28,36,34,.58);font-size:14px;line-height:1.45}
.lz-board-panel-main{left:7%;top:10%;right:18%;min-height:260px;background:linear-gradient(155deg,rgba(255,255,255,.72),rgba(222,239,242,.35))}
.lz-board-script{left:12%;bottom:10%;width:38%}
.lz-board-export{right:7%;bottom:16%;width:36%;transform:translateY(-12px)}
.lz-board-bars{position:absolute;left:20px;right:20px;bottom:24px;display:grid;gap:10px}
.lz-board-bars i{display:block;height:12px;border-radius:999px;background:linear-gradient(90deg,rgba(215,162,67,.62),rgba(180,210,214,.24))}
.lz-board-bars i:nth-child(2){width:72%}
.lz-board-bars i:nth-child(3){width:48%}
.lz-work{padding:clamp(70px,10vw,140px) clamp(18px,5vw,72px) clamp(60px,8vw,110px)}
.lz-work-head{max-width:1180px;margin:0 auto 28px;display:grid;grid-template-columns:minmax(260px,.9fr) minmax(320px,1.1fr);gap:clamp(18px,4vw,54px);align-items:end}
.lz-work-head h2{margin:8px 0 0;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-weight:400;font-size:clamp(40px,5.8vw,76px);line-height:.98;letter-spacing:-.03em;color:#1b2422}
.lz-grid{max-width:1180px;margin:0 auto;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}
.lz-card{border-radius:22px;background:linear-gradient(150deg,rgba(255,255,255,.66),rgba(238,247,248,.3));border:1px solid rgba(255,255,255,.72);box-shadow:0 24px 60px rgba(48,66,70,.08),inset 0 1px 0 rgba(255,255,255,.78);backdrop-filter:blur(18px);min-height:230px;transition:transform .3s ease,box-shadow .3s ease}
.lz-card:nth-child(1){grid-column:span 3;min-height:300px}
.lz-card:nth-child(2){grid-column:span 3}
.lz-card:nth-child(3){grid-column:span 2}
.lz-card:nth-child(4){grid-column:span 4}
.lz-card:hover,.lz-card.is-on{transform:translateY(-4px);box-shadow:0 30px 80px rgba(48,66,70,.12),inset 0 1px 0 rgba(255,255,255,.86)}
.lz-steps{max-width:1180px;margin:0 auto;padding:clamp(50px,8vw,96px) clamp(18px,5vw,72px) clamp(70px,9vw,118px)}
.lz-steps ol{position:relative;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.lz-steps li{position:relative;padding:22px 18px 20px;border:1px solid rgba(255,255,255,.68);border-radius:20px;background:rgba(255,255,255,.38);backdrop-filter:blur(16px)}
.lz-steps li:not(:last-child):after{content:"";position:absolute;right:-18px;top:50%;width:20px;height:1px;background:linear-gradient(90deg,rgba(142,96,19,.42),transparent)}
.lz-access{background:radial-gradient(ellipse at 50% 34%,rgba(255,255,255,.58),transparent 50%);border-top:1px solid rgba(255,255,255,.54)}
.lz-access-copy{filter:drop-shadow(0 26px 54px rgba(58,70,70,.1))}
@keyframes lz-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.03);opacity:.86}}
@keyframes lz-drift{from{transform:translate3d(-1%,-.8%,0)}to{transform:translate3d(1.6%,1%,0)}}
@keyframes lz-atmosphere{from{transform:translate3d(-1%,-.6%,0) scale(1.01)}to{transform:translate3d(1.4%,.8%,0) scale(1.035)}}
@keyframes lz-float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-10px,0)}}
@media(max-width:800px){
  .lz-doc:before{inset:7vh 12px 9vh;border-radius:18px}
  .lz-hero{grid-template-columns:1fr;gap:28px;text-align:center;padding:92px 18px 58px}
  .lz-hero-copy{margin:0 auto}
  .lz-hero h1{font-size:clamp(50px,16vw,76px)}
  .lz-hero-lead{margin-left:auto;margin-right:auto}
  .lz-hero-actions{justify-content:center}
  .lz-glass{width:100%;height:auto;min-height:430px}
  .lz-product-window{width:min(100%,440px);transform:none}
  .lz-product-grid-preview{grid-template-columns:1fr}
  .lz-preview-list{grid-template-columns:1fr}
  .lz-floating-panel{display:none}
  .lz-showcase{grid-template-columns:1fr;padding:70px 18px}
  .lz-showcase:before{inset:3% 10px;border-radius:22px}
  .lz-studio-board{min-height:560px;border-radius:24px}
  .lz-board-panel-main{left:16px;right:16px;top:18px}
  .lz-board-script,.lz-board-export{left:16px;right:16px;width:auto}
  .lz-board-script{bottom:160px}
  .lz-board-export{bottom:22px;transform:none}
  .lz-work-head{grid-template-columns:1fr;text-align:left}
  .lz-grid,.lz-steps ol{grid-template-columns:1fr}
  .lz-card:nth-child(n){grid-column:auto;min-height:210px}
  .lz-steps li:not(:last-child):after{display:none}
  .lz-chrome{grid-template-columns:1fr auto}
  .lz-chrome-xy{display:none}
}
@media(prefers-reduced-motion:reduce){
  .lz-gate-mist,.lz-gate-ring,.lz-intro-scroll i,.lz.is-open .lz-wash,.lz-floating-panel{animation:none}
  .lz-card-reveal,.lz-intro,.lz-intro-line,.lz-intro-sub,.lz-doc{transition:none;animation:none}
}

/* 2026 front page art direction: force the open page away from the old centered card stack. */
.lz.is-open{background:#f6f7f3}
.lz.is-open .lz-wash{background:
  linear-gradient(112deg,transparent 0 22%,rgba(255,255,255,.52) 22.1% 22.55%,transparent 22.8% 100%),
  linear-gradient(72deg,transparent 0 71%,rgba(175,201,207,.2) 71.2% 71.7%,transparent 72% 100%),
  radial-gradient(ellipse at 76% 18%,rgba(205,224,228,.72),transparent 42%),
  radial-gradient(ellipse at 16% 14%,rgba(255,247,232,.82),transparent 38%),
  radial-gradient(ellipse at 54% 86%,rgba(220,229,225,.66),transparent 46%),
  linear-gradient(135deg,#fbfaf6 0%,#f0f5f4 52%,#f7f1e8 100%)}
.lz.is-open .lz-film{background:
  linear-gradient(90deg,rgba(255,255,255,.34),transparent 24% 76%,rgba(255,255,255,.22)),
  radial-gradient(ellipse at 50% 44%,transparent 0 64%,rgba(45,65,70,.1) 100%)}
.lz.is-open .lz-doc{overflow:hidden}
.lz.is-open .lz-chrome{background:rgba(250,250,246,.76);border-bottom:1px solid rgba(255,255,255,.76);box-shadow:0 18px 50px rgba(53,70,75,.06)}
.lz.is-open .lz-hero{grid-template-columns:minmax(340px,.82fr) minmax(560px,1.18fr);min-height:calc(100svh - 48px);padding:clamp(90px,10vh,132px) clamp(34px,7vw,120px) clamp(66px,8vh,104px);background:linear-gradient(180deg,rgba(255,255,255,.26),rgba(255,255,255,0));border-bottom:1px solid rgba(255,255,255,.58)}
.lz.is-open .lz-hero:after{content:"";position:absolute;inset:8% clamp(18px,4vw,56px);border-radius:28px;background:linear-gradient(125deg,rgba(255,255,255,.18),rgba(180,206,213,.07));border:1px solid rgba(255,255,255,.54);box-shadow:inset 0 1px 0 rgba(255,255,255,.82);backdrop-filter:blur(5px);pointer-events:none;z-index:0}
.lz.is-open .lz-hero-copy{z-index:2}
.lz.is-open .lz-hero h1{font-size:clamp(68px,8.8vw,138px);line-height:.88;max-width:8.5em;letter-spacing:-.025em}
.lz.is-open .lz-hero-lead{font-size:clamp(18px,1.5vw,22px);max-width:31em}
.lz.is-open .lz-hero-ribbon,.lz.is-open .lz-hero-proof,.lz.is-open .lz-floating-panel{display:none!important}
.lz.is-open .lz-glass{z-index:2;width:min(780px,92vw);height:clamp(540px,56vw,720px)}
.lz.is-open .lz-glass:before{inset:4% 0 2% 10%;border-radius:26px;transform:rotateY(-8deg) rotateX(4deg);background:rgba(255,255,255,.2)}
.lz.is-open .lz-glass-plate{display:none}
.lz.is-open .lz-product-window{width:min(700px,90vw);transform:rotateY(-9deg) rotateX(5deg) translateZ(0);border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.88),rgba(231,241,243,.38));box-shadow:0 42px 118px rgba(45,64,70,.2),inset 0 1px 0 rgba(255,255,255,.98)}
.lz.is-open .lz-product-window:before{content:"";position:absolute;inset:62px 18px auto;height:1px;background:linear-gradient(90deg,transparent,rgba(27,36,34,.16),transparent)}
.lz.is-open .lz-preview-main{min-height:310px}
.lz.is-open .lz-preview-main strong{font-size:clamp(34px,3.7vw,54px);max-width:10em}
.lz.is-open .lz-preview-shot{min-height:310px;background:
  linear-gradient(180deg,rgba(28,39,38,.9),rgba(93,129,128,.54)),
  radial-gradient(ellipse at 50% 18%,rgba(255,255,255,.48),transparent 35%)}
.lz.is-open .lz-showcase{min-height:86svh}
.lz.is-open .lz-work{background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.42))}
.lz.is-open .lz-grid{gap:18px}
.lz.is-open .lz-card{background:linear-gradient(150deg,rgba(255,255,255,.8),rgba(229,242,244,.32));border-radius:26px}
.lz.is-open .lz-steps ol{gap:18px}
.lz.is-open .lz-steps li{box-shadow:0 22px 64px rgba(51,68,72,.08)}
@media(max-width:900px){
  .lz.is-open .lz-hero{grid-template-columns:1fr;padding:86px 18px 54px;text-align:center}
  .lz.is-open .lz-hero:after{inset:5% 10px;border-radius:24px}
  .lz.is-open .lz-hero h1{margin-left:auto;margin-right:auto;font-size:clamp(54px,16vw,88px)}
  .lz.is-open .lz-product-window{transform:none}
}

/* Match the intro style: cinematic, quiet, spacious, and editorial. */
.lz.is-open{background:#f4efe6;color:#1c2422}
.lz.is-open .lz-wash{background:
  radial-gradient(ellipse at 28% 32%,rgba(196,214,190,.48),transparent 52%),
  radial-gradient(ellipse at 78% 24%,rgba(255,236,210,.38),transparent 48%),
  radial-gradient(ellipse at 55% 78%,rgba(210,228,220,.34),transparent 50%),
  linear-gradient(180deg,#f6f1e8 0%,#ebe6db 100%)!important}
.lz.is-open .lz-wash:before{content:"";position:absolute;inset:-8%;background:repeating-linear-gradient(118deg,transparent 0 22px,rgba(255,255,255,.034) 22px 24px);opacity:.88}
.lz.is-open .lz-film{background:radial-gradient(ellipse at 50% 35%,transparent 0 48%,rgba(40,50,45,.055) 100%)!important}
.lz.is-open .lz-doc{overflow:visible}
.lz.is-open .lz-doc:before,.lz.is-open .lz-doc:after{display:none!important}
.lz.is-open .lz-chrome{position:absolute;inset:0 0 auto;z-index:30;background:transparent!important;border:0!important;box-shadow:none!important;padding:18px clamp(20px,3vw,42px);color:rgba(28,36,34,.46)}
.lz.is-open .lz-hero{min-height:100svh;display:grid;grid-template-columns:1fr;place-items:center;text-align:center;padding:clamp(70px,10vh,112px) clamp(18px,6vw,72px) clamp(54px,8vh,86px);border:0!important;background:transparent!important}
.lz.is-open .lz-hero:before,.lz.is-open .lz-hero:after{display:none!important}
.lz.is-open .lz-hero-copy{max-width:820px;margin:0 auto;z-index:3}
.lz.is-open .lz-hero h1{margin:20px auto 0;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-style:italic;font-weight:400;font-size:clamp(58px,10vw,122px);line-height:.98;letter-spacing:-.035em;color:#1c2422;max-width:8.2em}
.lz.is-open .lz-hero-lead{margin:18px auto 0;max-width:34em;font-size:clamp(16px,2vw,20px);line-height:1.5;color:rgba(28,36,34,.58)}
.lz.is-open .lz-hero-actions{justify-content:center;margin-top:30px}
.lz.is-open .lz-primary,.lz.is-open .lz-secondary{min-height:42px;border-radius:999px;padding:0 20px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase}
.lz.is-open .lz-primary{background:#d7a243;color:#1a1200;box-shadow:0 10px 30px rgba(180,130,40,.18)}
.lz.is-open .lz-secondary{background:rgba(255,255,255,.18);border:1px solid rgba(28,36,34,.16);color:rgba(28,36,34,.56)}
.lz.is-open .lz-glass{width:min(580px,88vw);height:auto;margin:44px auto 0;perspective:none}
.lz.is-open .lz-glass:before,.lz.is-open .lz-glass-light,.lz.is-open .lz-glass-plate,.lz.is-open .lz-floating-panel,.lz.is-open .lz-hero-proof,.lz.is-open .lz-hero-ribbon,.lz.is-open .lz-statement,.lz.is-open .lz-statement-sub{display:none!important}
.lz.is-open .lz-product-window{width:min(560px,90vw);transform:none!important;border-radius:26px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.46);box-shadow:0 22px 70px rgba(40,50,45,.07),inset 0 1px 0 rgba(255,255,255,.58);backdrop-filter:blur(18px)}
.lz.is-open .lz-product-window:before,.lz.is-open .lz-product-window:after{display:none!important}
.lz.is-open .lz-window-bar{height:42px;color:rgba(28,36,34,.42)}
.lz.is-open .lz-product-grid-preview{grid-template-columns:1fr 150px;gap:10px;padding:14px}
.lz.is-open .lz-preview-main{min-height:178px;text-align:left;background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.36)}
.lz.is-open .lz-preview-main strong{margin-top:24px;font-size:clamp(28px,4.4vw,44px);line-height:1}
.lz.is-open .lz-preview-shot{min-height:178px;background:linear-gradient(180deg,rgba(28,36,34,.72),rgba(108,132,124,.38));color:rgba(255,255,255,.78)}
.lz.is-open .lz-preview-list span{background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.34)}
.lz.is-open .lz-showcase,.lz.is-open .lz-work,.lz.is-open .lz-steps{padding:clamp(72px,12vw,150px) clamp(18px,6vw,72px);background:transparent!important}
.lz.is-open .lz-showcase{grid-template-columns:1fr;min-height:auto;text-align:center}
.lz.is-open .lz-showcase:before{inset:12% 8%;border-radius:24px;background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.32);box-shadow:none}
.lz.is-open .lz-showcase-copy{max-width:760px;margin:0 auto}
.lz.is-open .lz-showcase-copy h2,.lz.is-open .lz-work-head h2{font-family:"Instrument Serif",Fraunces,Georgia,serif;font-style:italic;font-weight:400;font-size:clamp(46px,8vw,94px);line-height:1;letter-spacing:-.035em}
.lz.is-open .lz-studio-board{margin:42px auto 0;width:min(840px,100%);min-height:360px;border-radius:24px;background:rgba(255,255,255,.16);box-shadow:0 20px 80px rgba(40,50,45,.06),inset 0 1px 0 rgba(255,255,255,.48)}
.lz.is-open .lz-board-panel{background:rgba(255,255,255,.24);border-color:rgba(255,255,255,.38);box-shadow:none}
.lz.is-open .lz-work-head{grid-template-columns:1fr;max-width:900px;text-align:center;justify-items:center;margin-bottom:38px}
.lz.is-open .lz-grid{grid-template-columns:repeat(3,minmax(0,1fr));max-width:1040px;gap:14px}
.lz.is-open .lz-card:nth-child(n){grid-column:auto;min-height:230px}
.lz.is-open .lz-card{border-radius:8px;background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.42);box-shadow:none}
.lz.is-open .lz-steps{max-width:1040px;text-align:center}
.lz.is-open .lz-steps ol{grid-template-columns:repeat(4,minmax(0,1fr))}
.lz.is-open .lz-steps li{border-radius:0;border:0;border-top:1px solid rgba(28,36,34,.12);background:transparent;box-shadow:none;backdrop-filter:none}
.lz.is-open .lz-access{background:
  radial-gradient(circle at 50% 24%,rgba(255,255,255,.22),transparent 30%),
  radial-gradient(circle at 18% 80%,rgba(255,199,93,.18),transparent 34%),
  linear-gradient(145deg,#161118 0%,#372032 46%,#69435c 100%)!important;border-top:1px solid rgba(255,255,255,.22);color:#fff8ee}
.lz.is-open .lz-access-sub{color:rgba(255,248,238,.74)}
.lz.is-open .lz-access-ai{color:rgba(255,248,238,.54)}
.lz.is-open .lz-access-hint{color:#ffd47a}
.lz.is-open .lz-access .lz-kicker-gold{display:inline-flex;align-items:center;justify-content:center;width:auto;margin:0 auto 18px;padding:8px 14px;border:1px solid rgba(255,212,122,.48);border-radius:999px;background:rgba(255,212,122,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 12px 34px rgba(0,0,0,.12);font-size:10px;letter-spacing:.34em;color:#ffd47a!important;text-shadow:0 1px 0 rgba(0,0,0,.28);backdrop-filter:blur(12px)}
@media(max-width:900px){
  .lz.is-open .lz-product-grid-preview{grid-template-columns:1fr}
  .lz.is-open .lz-grid,.lz.is-open .lz-steps ol{grid-template-columns:1fr}
}

/* Top-page interactive typography requested from the Brik reference. */
.lz.is-open .lz-chrome{grid-template-columns:1fr auto 1fr!important;align-items:start}
.lz.is-open .lz-chrome-clock,.lz.is-open .lz-chrome-xy{display:none!important}
.lz-top-logo{justify-self:center;margin-top:0;font-family:Fraunces,"Instrument Serif",Georgia,serif;font-size:clamp(30px,4.4vw,56px);font-weight:500;font-style:italic;color:rgba(28,36,34,.54);letter-spacing:-.04em;text-decoration:none;line-height:.8;pointer-events:auto;-webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='discrete' tableValues='0 0 0 1 1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='discrete' tableValues='0 0 0 1 1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");-webkit-mask-size:cover;mask-size:cover}
.lz-top-access{justify-self:end;display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 14px;border-radius:999px;border:1px solid rgba(28,36,34,.18);background:rgba(255,255,255,.16);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:rgba(28,36,34,.62);text-decoration:none;backdrop-filter:blur(10px);pointer-events:auto}
.lz.is-open .lz-hero{display:flex!important;flex-direction:column;justify-content:center;gap:0}
.lz.is-open .lz-hero-copy{order:2;max-width:720px}
.lz.is-open .lz-hero h1{font-size:clamp(34px,5.5vw,68px);margin-top:24px}
.lz.is-open .lz-hero-lead{font-size:clamp(14px,1.8vw,18px);max-width:32em}
.lz.is-open .lz-hero-actions{margin-top:22px}
.lz.is-open .lz-hero .lz-glass{display:none!important}
.lz-reactive-word{order:1;display:flex;align-items:center;justify-content:center;gap:clamp(1px,.7vw,10px);width:min(1120px,94vw);min-height:clamp(120px,20vw,240px);margin:0 auto 8px;touch-action:none;user-select:none;perspective:900px}
.lz-reactive-letter{display:inline-block;font-family:"Instrument Serif",Fraunces,Georgia,serif;font-style:italic;font-weight:400;font-size:clamp(58px,15vw,210px);line-height:.78;letter-spacing:-.075em;color:rgba(28,36,34,.78);transform:translate3d(var(--tx,0px),var(--ty,0px),0) rotate(calc(var(--tx,0px) * .025deg));transition:transform .7s cubic-bezier(.16,1,.3,1),color .35s ease,text-shadow .35s ease;cursor:grab;text-shadow:0 18px 52px rgba(40,50,45,.08)}
.lz-reactive-letter.is-active{color:#1c2422;transition:transform .06s linear,color .2s ease;text-shadow:0 22px 64px rgba(40,50,45,.16);cursor:grabbing}
.lz-reactive-word:hover .lz-reactive-letter:not(.is-active){color:rgba(28,36,34,.64)}
@media(max-width:720px){
  .lz.is-open .lz-chrome{grid-template-columns:1fr auto!important}
  .lz-top-logo{justify-self:start;font-size:34px}
  .lz-chrome-brand{display:none}
  .lz-reactive-word{min-height:110px}
}

/* Brik-style top page: blue collider room with draggable type. */
.lz.is-open .lz-wash{background:
  radial-gradient(ellipse at 18% 12%,rgba(255,255,255,.72),transparent 42%),
  radial-gradient(ellipse at 78% 18%,rgba(186,220,255,.55),transparent 46%),
  radial-gradient(ellipse at 52% 48%,rgba(255,255,255,.38),transparent 52%),
  radial-gradient(ellipse at 28% 78%,rgba(150,200,245,.42),transparent 44%),
  radial-gradient(ellipse at 88% 72%,rgba(210,235,255,.48),transparent 40%),
  linear-gradient(165deg,#c8e4f8 0%,#a8d0f0 32%,#d6ebfa 62%,#eaf5fc 100%)!important;
  filter:blur(0);animation:lz-atmosphere 22s ease-in-out infinite alternate}
.lz.is-open .lz-wash:before{content:"";position:absolute;inset:-14%;background:
  radial-gradient(ellipse at 32% 28%,rgba(255,255,255,.55),transparent 36%),
  radial-gradient(ellipse at 70% 40%,rgba(255,255,255,.42),transparent 34%),
  radial-gradient(ellipse at 48% 70%,rgba(255,255,255,.35),transparent 40%);
  filter:blur(28px);opacity:.9;pointer-events:none}
.lz.is-open .lz-wash:after{content:"";position:absolute;inset:0;background-image:
  radial-gradient(circle at 22% 24%,rgba(255,255,255,.5) 0 1.2px,transparent 1.8px),
  radial-gradient(circle at 68% 58%,rgba(120,170,220,.12) 0 1px,transparent 1.6px);
  background-size:42px 42px,58px 58px;opacity:.28;pointer-events:none}
.lz.is-open .lz-film{background:
  linear-gradient(180deg,rgba(255,255,255,.34),rgba(190,220,245,.12) 48%,rgba(160,200,235,.16)),
  radial-gradient(ellipse at 50% 40%,transparent 0 52%,rgba(60,100,140,.1) 100%)!important;
  backdrop-filter:blur(10px) saturate(1.15);-webkit-backdrop-filter:blur(10px) saturate(1.15);opacity:1}
.lz.is-open .lz-doc{position:relative;animation:none;transform:none;filter:none}
.lz.is-open .lz-doc:before{display:block!important;inset:0!important;border:0!important;border-radius:0!important;background:
  radial-gradient(ellipse at 25% 20%,rgba(255,255,255,.45),transparent 38%),
  radial-gradient(ellipse at 75% 30%,rgba(200,230,255,.35),transparent 42%),
  radial-gradient(ellipse at 40% 75%,rgba(255,255,255,.28),transparent 46%),
  linear-gradient(145deg,rgba(210,232,250,.55),rgba(180,215,245,.35) 45%,rgba(230,243,252,.5))!important;
  box-shadow:none!important;backdrop-filter:blur(18px) saturate(1.2)!important;-webkit-backdrop-filter:blur(18px) saturate(1.2)!important;z-index:-1!important}
.lz.is-open .lz-chrome{grid-template-columns:1fr auto 1fr!important;align-items:start;padding:26px 36px;color:#0b1a28}
.lz.is-open .lz-chrome{position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:auto!important}
.lz.is-open,.lz.is-open *{cursor:url("data:image/svg+xml,%3Csvg width='58' height='70' viewBox='0 0 58 70' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 4 48 44 30 47 41 65 31 69 20 51 8 64Z' fill='%23ffffff' stroke='%23050505' stroke-width='4' stroke-linejoin='round'/%3E%3Cpath d='M6 4 48 44 30 47 41 65 31 69 20 51 8 64Z' fill='%23ffffff' stroke='%23ffffff' stroke-width='1.2' stroke-linejoin='round'/%3E%3C/svg%3E") 6 4, auto!important}
.lz.is-open .lz-doc{min-height:100svh;cursor:none;background:
  radial-gradient(ellipse at 20% 15%,rgba(255,255,255,.65),transparent 40%),
  radial-gradient(ellipse at 82% 22%,rgba(170,210,250,.5),transparent 44%),
  radial-gradient(ellipse at 55% 68%,rgba(255,255,255,.4),transparent 48%),
  radial-gradient(ellipse at 12% 82%,rgba(140,190,240,.38),transparent 42%),
  linear-gradient(155deg,#d2e8f8 0%,#b5d6f2 28%,#cfe6f9 58%,#e8f3fc 100%)!important}
.lz.is-open{background:#17120c!important;color:#fff8e8}
.lz.is-open .lz-doc{background:
  radial-gradient(circle at 52% 30%,rgba(255,215,100,.42),rgba(255,215,100,0) 28%),
  radial-gradient(circle at 15% 76%,rgba(255,102,64,.24),rgba(255,102,64,0) 34%),
  linear-gradient(145deg,#2a1b11 0%,#7d3f1d 44%,#d89335 100%)!important}
.lz.is-open .lz-doc,.lz.is-open .lz-doc *{cursor:url("data:image/svg+xml,%3Csvg width='58' height='70' viewBox='0 0 58 70' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 4 48 44 30 47 41 65 31 69 20 51 8 64Z' fill='%23ffffff' stroke='%23050505' stroke-width='4' stroke-linejoin='round'/%3E%3Cpath d='M6 4 48 44 30 47 41 65 31 69 20 51 8 64Z' fill='%23ffffff' stroke='%23ffffff' stroke-width='1.2' stroke-linejoin='round'/%3E%3C/svg%3E") 6 4, auto!important}
.lz.is-open .lz-doc .lz-unlock,.lz.is-open .lz-doc .lz-unlock *{cursor:grab!important}
.lz.is-open .lz-doc .lz-unlock.is-dragging,.lz.is-open .lz-doc .lz-unlock.is-dragging *{cursor:grabbing!important}
.lz.is-unlock-hover .lz-page-cursor,.lz.is-unlock-dragging .lz-page-cursor{display:none!important;opacity:0!important}
.lz-unlock.is-dragging .lz-unlock-knob{transition:none}
.lz-page-cursor{display:none!important}
.lz-top-logo{color:#fff8e8!important;opacity:.9}
.lz-top-tools{justify-self:end;display:flex;align-items:center;overflow:hidden;border:1px solid rgba(0,0,0,.42);border-radius:13px;background:rgba(255,255,255,.9);box-shadow:0 3px 0 rgba(0,0,0,.2),0 14px 28px rgba(0,150,255,.14);pointer-events:auto}
.lz-top-tools a{display:grid;place-items:center;height:34px;padding:0 14px;border-right:1px solid rgba(0,0,0,.2);background:transparent;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#050505;text-decoration:none;cursor:pointer}
.lz-top-tools a:last-child{border-right:0}
.lz.is-open .lz-hero{position:relative;min-height:100svh;align-items:center!important;justify-content:center!important;padding:clamp(92px,12vh,130px) clamp(28px,7vw,96px) 78px!important;text-align:center!important;overflow:hidden!important;cursor:none;background:transparent!important}
.lz.is-open .lz-hero:before{display:none!important}
.lz.is-open .lz-hero-copy{order:3;margin:24px auto 0!important;max-width:820px!important;text-align:center!important}
.lz.is-open .lz-kicker{color:#0b1a28!important}
.lz.is-open .lz-hero h1{font-family:Inter,ui-sans-serif,system-ui,sans-serif!important;font-style:normal!important;font-weight:600!important;font-size:clamp(24px,3.6vw,48px)!important;line-height:1!important;letter-spacing:-.04em!important;margin:18px 0 0!important;max-width:16em!important;color:#080604!important}
.lz.is-open .lz-hero-lead{margin:0 auto!important;max-width:44em!important;font-size:clamp(17px,1.55vw,23px)!important;line-height:1.35!important;font-weight:800!important;color:rgba(255,248,232,.78)!important}
.lz.is-open .lz-hero-actions{justify-content:flex-start!important}
.lz.is-open .lz-primary,.lz.is-open .lz-secondary{background:#fff!important;color:#050505!important;border:1px solid rgba(0,0,0,.28)!important;box-shadow:0 3px 0 rgba(0,0,0,.12)!important}
.lz-reactive-word{order:2!important;position:relative;z-index:3;display:grid!important;justify-content:center!important;align-content:center!important;width:min(1180px,94vw)!important;min-height:auto!important;margin:0 auto!important;gap:clamp(8px,1.2vw,18px)!important;row-gap:clamp(8px,1.2vw,18px)!important;cursor:none!important;isolation:isolate}
.lz-reactive-line{display:flex;align-items:center;justify-content:center;height:auto;min-height:1.04em;line-height:1.04;white-space:nowrap;overflow:visible}
.lz-reactive-line[data-long="true"] .lz-reactive-letter{font-size:clamp(24px,3.15vw,48px)!important;letter-spacing:0!important;text-shadow:2px 0 0 #17120c,0 2px 0 #17120c,2px 2px 0 #17120c,5px 5px 0 rgba(0,0,0,.16)!important}
.lz-reactive-word:before{display:none!important}
.lz-reactive-word:after{display:none!important}
.lz-hero-burst{display:none!important}
.lz-custom-cursor{display:none!important}
.lz-reactive-letter{font-family:"Courier New","IBM Plex Mono",ui-monospace,monospace!important;font-style:normal!important;font-weight:900!important;font-size:clamp(42px,6.7vw,104px)!important;line-height:1.04!important;letter-spacing:.005em!important;color:#fff8e8!important;text-shadow:4px 0 0 #17120c,0 4px 0 #17120c,4px 4px 0 #17120c,8px 8px 0 rgba(0,0,0,.18)!important;will-change:transform;transition:transform .72s cubic-bezier(.16,1,.3,1)!important;transform:translate3d(var(--tx,0px),var(--ty,0px),0) rotate(calc(var(--tx,0px) * .006deg))!important}
.lz-reactive-letter.is-active{color:#fff8e8!important;filter:none!important;transition:transform .07s linear!important}
.lz.is-open .lz-hero .lz-glass{display:none!important}
.lz-export-controls{display:none!important}
.lz-export-controls span{font-size:12px;font-weight:800}
.lz-export-controls b,.lz-export-controls em{height:30px;display:grid;place-items:center;padding:0 18px;border:1px solid rgba(0,0,0,.12);border-radius:6px;background:#fff;font-size:12px;font-style:normal;font-weight:600}
.lz-export-controls em{min-width:90px;color:#333;background:#f1f1f1}
@media(max-width:800px){
  .lz.is-open .lz-hero{padding:118px 24px 70px!important}
  .lz-reactive-word{width:92vw!important}
  .lz-reactive-word:before{left:0;top:-52px}
  .lz-reactive-word:after,.lz-hero-burst,.lz-custom-cursor{display:none!important}
  .lz-top-tools a{height:30px;padding:0 8px;font-size:8px}
  .lz-export-controls{display:none}
}

/* Feedback + earn story blocks on blue glass */
.lz-feedback-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;max-width:1040px}
.lz-feedback-grid .lz-card:nth-child(n){grid-column:auto!important;min-height:250px}
.lz.is-open .lz-feedback{position:relative;overflow:hidden;background:
  radial-gradient(circle at 18% 16%,rgba(255,189,72,.42),transparent 28%),
  radial-gradient(circle at 86% 76%,rgba(75,169,255,.18),transparent 30%),
  linear-gradient(135deg,#fff7ef 0%,#f8e7d4 48%,#f3d59a 100%)!important;color:#101928}
.lz.is-open .lz-feedback:before{content:"FEEDBACK";position:absolute;left:50%;top:38px;transform:translateX(-50%);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:clamp(78px,14vw,190px);font-weight:900;letter-spacing:-.08em;color:rgba(16,25,40,.045);pointer-events:none;white-space:nowrap}
.lz.is-open .lz-feedback .lz-work-head{position:relative;z-index:2;max-width:980px!important;margin:0 auto 54px!important;text-align:center!important;display:block!important}
.lz.is-open .lz-feedback .lz-work-head h2{font-family:Inter,ui-sans-serif,system-ui,sans-serif!important;font-style:normal!important;font-weight:900!important;font-size:clamp(72px,11vw,150px)!important;line-height:.82!important;letter-spacing:-.075em!important;color:#101928!important;margin:0!important;text-shadow:5px 5px 0 rgba(255,255,255,.64)}
.lz.is-open .lz-feedback .lz-work-note{margin:22px auto 0!important;max-width:650px!important;font-size:clamp(17px,1.7vw,24px)!important;line-height:1.35!important;font-weight:800!important;color:rgba(16,25,40,.66)!important}
.lz-feedback-cards{position:relative;z-index:2;list-style:none;margin:0 auto;padding:0;max-width:1160px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(20px,3vw,38px);align-items:center}
.lz-feedback-card{min-height:360px;padding:30px 28px 24px;border:3px solid #101928;border-radius:18px;background:#fffdf8;box-shadow:8px 8px 0 #101928,0 22px 50px rgba(16,25,40,.12);display:flex;flex-direction:column;justify-content:space-between;text-align:left;transform:rotate(-2deg)}
.lz-feedback-card:nth-child(3){transform:rotate(2deg)}
.lz-feedback-card.is-featured{min-height:430px;padding:38px 34px 30px;background:#101928;color:#fffdf8;transform:translateY(-24px) rotate(1deg);box-shadow:8px 8px 0 #ffb12d,0 30px 70px rgba(16,25,40,.22)}
.lz-feedback-person{display:flex;align-items:center;gap:16px}
.lz-feedback-avatar{display:grid;place-items:center;flex:0 0 auto;width:64px;height:64px;border-radius:18px;background:linear-gradient(145deg,#ffb12d 0%,#ffd985 100%);border:3px solid #101928;color:#101928;box-shadow:4px 4px 0 rgba(16,25,40,.22)}
.lz-feedback-avatar svg{display:block;filter:drop-shadow(1px 1px 0 rgba(255,255,255,.65))}
.lz-feedback-card.is-featured .lz-feedback-avatar{background:#fffdf8}
.lz-feedback-person h3{margin:0;font-size:16px;font-weight:900;color:inherit}
.lz-feedback-person p,.lz-feedback-person small{display:block;margin:3px 0 0;font-size:11px;color:currentColor;opacity:.68}
.lz-feedback-quote{margin:34px 0 28px;font-size:clamp(16px,1.6vw,22px);line-height:1.42;font-weight:800;color:inherit}
.lz-feedback-quote:before{content:"“";font-family:Georgia,serif;font-size:52px;line-height:0;color:#ff8a1f;vertical-align:-18px;margin-right:4px}
.lz-feedback-stars{margin-top:auto;text-align:center;font-size:20px;letter-spacing:.16em;color:inherit}
.lz-feedback-stars span{color:currentColor;opacity:.22}
.lz-feedback-cards{gap:clamp(18px,3vw,34px);align-items:stretch}
.lz-feedback-card{position:relative;isolation:isolate;overflow:hidden;min-height:390px;padding:28px!important;border-radius:22px;background:#fffdf8;box-shadow:7px 7px 0 #101928,0 24px 54px rgba(16,25,40,.12);justify-content:flex-start;transform:rotate(-1.2deg)}
.lz-feedback-card:before{content:"";position:absolute;inset:0 0 auto;height:82px;z-index:-1;background:linear-gradient(135deg,#ffb12d,#ffe1a4)}
.lz-feedback-card:after{content:"AI CREATOR";position:absolute;right:18px;top:18px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9px;font-weight:900;letter-spacing:.18em;color:rgba(16,25,40,.58)}
.lz-feedback-card:nth-child(2):before{background:linear-gradient(135deg,#9df2c4,#d7fff0)}
.lz-feedback-card:nth-child(3){transform:rotate(1.2deg)}
.lz-feedback-card:nth-child(3):before{background:linear-gradient(135deg,#b9c8ff,#f0e8ff)}
.lz-feedback-card.is-featured{min-height:430px;padding:34px!important;transform:translateY(-22px);box-shadow:7px 7px 0 #ffb12d,0 32px 74px rgba(16,25,40,.24)}
.lz-feedback-card.is-featured:before{height:98px;background:linear-gradient(135deg,#ffb12d,#fff1bd)}
.lz-feedback-card.is-featured:after{color:rgba(255,253,248,.72)}
.lz-feedback-person{position:relative;z-index:1;min-height:74px}
.lz-feedback-avatar{width:68px;height:68px;border-radius:22px;background:#fffdf8}
.lz-feedback-card.is-featured .lz-feedback-avatar{box-shadow:4px 4px 0 rgba(255,177,45,.45)}
.lz-feedback-person h3{font-size:17px;font-weight:950;letter-spacing:-.02em}
.lz-feedback-person p,.lz-feedback-person small{font-weight:800;opacity:.72}
.lz-feedback-quote{margin:44px 0 28px;font-size:clamp(17px,1.7vw,23px);line-height:1.32;font-weight:900;letter-spacing:-.025em}
.lz-feedback-quote:before{content:"";display:block;width:42px;height:5px;margin:0 0 22px;border-radius:999px;background:#ff8a1f;box-shadow:18px 0 0 rgba(255,138,31,.32);vertical-align:initial}
.lz-feedback-card.is-featured .lz-feedback-quote:before{background:#ffb12d;box-shadow:18px 0 0 rgba(255,177,45,.32)}
.lz-feedback-stars{margin-top:auto;padding-top:18px;border-top:2px solid rgba(16,25,40,.12);text-align:left;font-size:18px;letter-spacing:.12em}
.lz-feedback-card.is-featured .lz-feedback-stars{border-top-color:rgba(255,255,255,.18)}
.lz-earn-title{margin:14px auto 0;max-width:18em;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-style:normal;font-weight:800;font-size:clamp(44px,7vw,88px);line-height:1;letter-spacing:-.06em;color:#171b1e;text-align:left}
.lz-earn-lead{margin:18px auto 0;max-width:42em;font-size:clamp(16px,1.45vw,20px);line-height:1.55;color:rgba(23,27,30,.66);text-align:left}
.lz.is-open .lz-earn{text-align:center;max-width:none!important;width:100%!important;margin:0!important;box-sizing:border-box}
.lz.is-open .lz-earn ol{margin-top:34px}
.lz.is-open .lz-feedback,.lz.is-open .lz-earn{padding:clamp(72px,12vw,150px) clamp(18px,6vw,72px)}
.lz.is-open .lz-earn{background:
  radial-gradient(circle at 78% 18%,rgba(197,255,188,.5),transparent 20%),
  radial-gradient(circle at 66% 78%,rgba(198,180,255,.34),transparent 24%),
  linear-gradient(180deg,#fbfcf8 0%,#f2f5ee 100%)!important;color:#171b1e}
.lz.is-open .lz-earn > *{max-width:1120px;margin-left:auto;margin-right:auto}
.lz.is-open .lz-earn .lz-kicker{text-align:left;color:rgba(23,27,30,.5)!important}
.lz-earn-flow{position:relative;height:250px;margin:56px auto 42px!important;max-width:980px!important}
.lz-flow-node{position:absolute;z-index:2;display:grid;place-items:center;min-width:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:#171b1e;text-align:center;animation:lz-float-logo 3.8s ease-in-out infinite}
.lz-flow-node svg{display:block;width:76px;height:76px;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;stroke-width:1.8;filter:drop-shadow(5px 7px 0 rgba(23,27,30,.14))}
.lz-flow-node-b{animation-delay:.35s}
.lz-flow-node-c{animation-delay:.7s}
.lz-flow-node-d{animation-delay:1.05s}
.lz-flow-node-a{left:0;top:26px}
.lz-flow-node-a svg{color:#111820}
.lz-flow-node-b{left:32%;top:140px}
.lz-flow-node-b svg{color:#1f8d45}
.lz-flow-node-c{left:58%;top:26px}
.lz-flow-node-c svg{color:#6a50d8}
.lz-flow-node-d{right:0;top:140px}
.lz-flow-node-d svg{color:#c87900}
.lz-flow-line{position:absolute;z-index:1;height:2px;background:#171b1e;transform-origin:left center}
.lz-flow-line:after{content:"";position:absolute;right:-5px;top:-4px;width:9px;height:9px;border-top:2px solid #171b1e;border-right:2px solid #171b1e;transform:rotate(45deg);background:transparent}
.lz-flow-line-a{left:14%;top:82px;width:150px;transform:rotate(24deg)}
.lz-flow-line-b{left:43%;top:138px;width:122px;transform:rotate(-28deg)}
.lz-flow-line-c{left:68%;top:82px;width:108px;transform:rotate(28deg)}
.lz-flow-line-d{display:none}
@keyframes lz-float-logo{
  0%,100%{transform:translateY(0) rotate(-1deg)}
  50%{transform:translateY(-12px) rotate(1deg)}
}
.lz.is-open .lz-earn ol{max-width:1120px!important;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-top:18px!important}
.lz.is-open .lz-earn li{background:#fff!important;border:2px solid #171b1e!important;border-radius:12px!important;box-shadow:6px 6px 0 #171b1e!important;padding:24px 18px!important;text-align:left!important}
.lz.is-open .lz-earn li:after{display:none!important}
.lz.is-open .lz-earn li span{color:rgba(23,27,30,.48)!important}
.lz.is-open .lz-earn li em{font-family:Inter,ui-sans-serif,system-ui,sans-serif!important;font-style:normal!important;font-weight:900!important;font-size:clamp(22px,2.4vw,34px)!important;color:#171b1e!important}
.lz.is-open .lz-earn li b{color:rgba(23,27,30,.68)!important}
@media(max-width:900px){
  .lz-feedback-grid{grid-template-columns:1fr!important}
  .lz-feedback-cards{grid-template-columns:1fr;gap:18px}
  .lz-feedback-card,.lz-feedback-card.is-featured{min-height:auto;transform:none;padding:24px}
  .lz-earn-title,.lz-earn-lead,.lz.is-open .lz-earn .lz-kicker{text-align:center}
  .lz-earn-flow{height:auto;display:grid;gap:12px;margin:34px auto!important}
  .lz-flow-node{position:relative;left:auto!important;right:auto!important;top:auto!important;width:100%;animation:none}
  .lz-flow-line{display:none}
  .lz.is-open .lz-earn ol{grid-template-columns:1fr!important}
}
.lz.is-open .lz-reveal{opacity:0;transform:translateY(46px) scale(.985);filter:blur(10px);transition:opacity .9s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1),filter .9s cubic-bezier(.16,1,.3,1)}
.lz.is-open .lz-reveal.is-visible{opacity:1;transform:none;filter:none}
.lz.is-open .lz-reveal .lz-feedback-card,.lz.is-open .lz-reveal .lz-flow-node,.lz.is-open .lz-reveal .lz-flow-line,.lz.is-open .lz-reveal .lz-earn li,.lz.is-open .lz-reveal .lz-access-copy{opacity:0;transition:opacity .75s cubic-bezier(.16,1,.3,1)}
.lz.is-open .lz-reveal.is-visible .lz-feedback-card,.lz.is-open .lz-reveal.is-visible .lz-flow-node,.lz.is-open .lz-reveal.is-visible .lz-flow-line,.lz.is-open .lz-reveal.is-visible .lz-earn li,.lz.is-open .lz-reveal.is-visible .lz-access-copy{opacity:1}
.lz.is-open .lz-reveal.is-visible .lz-feedback-card:nth-child(1){transition-delay:.08s}
.lz.is-open .lz-reveal.is-visible .lz-feedback-card:nth-child(2){transition-delay:.18s}
.lz.is-open .lz-reveal.is-visible .lz-feedback-card:nth-child(3){transition-delay:.28s}
.lz.is-open .lz-reveal.is-visible .lz-flow-node-a,.lz.is-open .lz-reveal.is-visible .lz-flow-line-a,.lz.is-open .lz-reveal.is-visible .lz-earn li:nth-child(1){transition-delay:.08s}
.lz.is-open .lz-reveal.is-visible .lz-flow-node-b,.lz.is-open .lz-reveal.is-visible .lz-flow-line-b,.lz.is-open .lz-reveal.is-visible .lz-earn li:nth-child(2){transition-delay:.18s}
.lz.is-open .lz-reveal.is-visible .lz-flow-node-c,.lz.is-open .lz-reveal.is-visible .lz-flow-line-c,.lz.is-open .lz-reveal.is-visible .lz-earn li:nth-child(3){transition-delay:.28s}
.lz.is-open .lz-reveal.is-visible .lz-flow-node-d,.lz.is-open .lz-reveal.is-visible .lz-flow-line-d,.lz.is-open .lz-reveal.is-visible .lz-earn li:nth-child(4){transition-delay:.38s}
.lz.is-open .lz-reveal.is-visible .lz-access-copy{transition-delay:.12s}
@media(prefers-reduced-motion:reduce){
  .lz.is-open .lz-reveal,.lz.is-open .lz-reveal .lz-feedback-card,.lz.is-open .lz-reveal .lz-flow-node,.lz.is-open .lz-reveal .lz-flow-line,.lz.is-open .lz-reveal .lz-earn li,.lz.is-open .lz-reveal .lz-access-copy{opacity:1;transform:none;filter:none;transition:none}
}
.lz.is-open .lz-feedback{background:
  radial-gradient(circle at 22% 28%,rgba(255,160,185,.22),transparent 24%),
  radial-gradient(circle at 48% 44%,rgba(112,220,255,.2),transparent 28%),
  radial-gradient(circle at 72% 24%,rgba(255,207,110,.24),transparent 24%),
  linear-gradient(135deg,#fff7ef 0%,#f8e7d4 48%,#f3d59a 100%)!important}
.lz.is-open .lz-feedback .lz-work-head h2{font-size:clamp(42px,5.8vw,76px)!important;letter-spacing:-.055em!important;text-shadow:none!important}
.lz.is-open .lz-feedback .lz-work-note{font-size:clamp(14px,1.15vw,17px)!important;font-weight:600!important;color:rgba(16,25,40,.48)!important}
.lz-feedback-cards{min-height:590px;max-width:1020px!important;display:block!important;position:relative!important;margin-top:18px!important}
.lz-feedback-cards:before{content:"";position:absolute;inset:34px 16px 54px;border-radius:42px;background:
  radial-gradient(circle at 11% 37%,rgba(255,156,190,.24),transparent 18%),
  radial-gradient(circle at 30% 16%,rgba(160,174,255,.22),transparent 18%),
  radial-gradient(circle at 50% 50%,rgba(91,222,255,.22),transparent 24%),
  radial-gradient(circle at 58% 12%,rgba(255,208,103,.25),transparent 19%),
  radial-gradient(circle at 78% 32%,rgba(198,159,255,.2),transparent 18%),
  radial-gradient(circle at 24% 82%,rgba(255,197,103,.24),transparent 20%),
  radial-gradient(circle at 75% 82%,rgba(144,196,255,.22),transparent 18%);
  filter:blur(22px);opacity:.86;pointer-events:none}
.lz-feedback-card{position:absolute!important;width:220px;min-height:0!important;padding:22px 16px 18px!important;border:1px solid rgba(255,255,255,.76)!important;border-radius:24px!important;background:linear-gradient(180deg,rgba(255,255,255,.58),rgba(255,255,255,.32))!important;box-shadow:0 18px 40px rgba(16,25,40,.09),0 8px 18px rgba(16,25,40,.055),inset 0 1px 0 rgba(255,255,255,.9)!important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);display:grid!important;justify-items:center;text-align:center!important;transform:none!important}
.lz-feedback-card:before{content:"";position:absolute;inset:-18px;border-radius:30px;background:radial-gradient(circle at 50% 0,rgba(255,255,255,.62),transparent 56%);z-index:-1;filter:blur(10px);opacity:.9}
.lz-feedback-card:after{display:none!important}
.lz-feedback-card-1{left:2%;top:160px}
.lz-feedback-card-2{left:27%;top:54px}
.lz-feedback-card-3{left:52%;top:54px;width:220px;transform:none!important}
.lz-feedback-card-4{right:2%;top:160px}
.lz-feedback-card-5{left:18%;bottom:0}
.lz-feedback-card-6{right:18%;bottom:0}
.lz-feedback-card.is-featured{min-height:0!important;padding:24px 18px 20px!important;color:#101928!important;background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.34))!important;box-shadow:0 26px 58px rgba(16,25,40,.13),0 10px 22px rgba(16,25,40,.08),inset 0 1px 0 rgba(255,255,255,.9)!important}
.lz-feedback-person{display:grid!important;justify-items:center;gap:9px!important;min-height:0!important}
.lz-feedback-avatar{position:relative;width:58px!important;height:58px!important;border-radius:50%!important;border:3px solid rgba(255,255,255,.95)!important;background:
  radial-gradient(circle at 50% 36%,#f7d2ae 0 17%,transparent 18%),
  linear-gradient(180deg,transparent 0 42%,#293143 43% 100%),
  linear-gradient(145deg,#f0c9a8,#b77756)!important;color:#fffdf8!important;box-shadow:0 12px 24px rgba(16,25,40,.14)!important;overflow:hidden}
.lz-feedback-avatar:before{content:"";position:absolute;left:50%;top:15px;width:26px;height:18px;border-radius:16px 16px 10px 10px;background:
  radial-gradient(circle at 34% 56%,#101928 0 1.5px,transparent 2px),
  radial-gradient(circle at 66% 56%,#101928 0 1.5px,transparent 2px),
  linear-gradient(#2b211f,#2b211f);transform:translateX(-50%);box-shadow:0 18px 0 12px rgba(38,45,63,.96)}
.lz-feedback-avatar .lz-ai-face{display:none}
.lz-feedback-avatar:after{display:none!important}
.lz-feedback-avatar svg{display:none!important}
.lz-feedback-card-2 .lz-feedback-avatar{background:radial-gradient(circle at 50% 36%,#efc39d 0 17%,transparent 18%),linear-gradient(180deg,transparent 0 42%,#1d2939 43% 100%),linear-gradient(145deg,#d9a47e,#7b4b37)!important}
.lz-feedback-card-3 .lz-feedback-avatar{background:radial-gradient(circle at 50% 36%,#f6d0ad 0 17%,transparent 18%),linear-gradient(180deg,transparent 0 42%,#412e3a 43% 100%),linear-gradient(145deg,#ddb18b,#9a6249)!important}
.lz-feedback-card-4 .lz-feedback-avatar{background:radial-gradient(circle at 50% 36%,#eec59f 0 17%,transparent 18%),linear-gradient(180deg,transparent 0 42%,#323046 43% 100%),linear-gradient(145deg,#d5a37b,#6e4a39)!important}
.lz-feedback-card-5 .lz-feedback-avatar{background:radial-gradient(circle at 50% 36%,#f8d9b8 0 17%,transparent 18%),linear-gradient(180deg,transparent 0 42%,#243042 43% 100%),linear-gradient(145deg,#e2b891,#9a6b4e)!important}
.lz-feedback-card-6 .lz-feedback-avatar{background:radial-gradient(circle at 50% 36%,#eabf99 0 17%,transparent 18%),linear-gradient(180deg,transparent 0 42%,#2f3442 43% 100%),linear-gradient(145deg,#c9906d,#704532)!important}
.lz-feedback-person h3{margin-top:2px!important;font-size:12px!important;font-weight:900!important;letter-spacing:-.01em!important}
.lz-feedback-rating{display:flex;justify-content:center;gap:3px;margin:5px 0 6px}
.lz-feedback-rating i{width:9px;height:9px;background:linear-gradient(145deg,#2f80ff,#8dc5ff);clip-path:polygon(50% 0,61% 34%,98% 35%,68% 56%,79% 91%,50% 70%,21% 91%,32% 56%,2% 35%,39% 34%);filter:drop-shadow(0 1px 2px rgba(47,128,255,.22))}
.lz-feedback-person p,.lz-feedback-person small{margin:2px 0 0!important;font-size:8px!important;line-height:1.2!important;font-weight:900!important;letter-spacing:.16em!important;text-transform:uppercase!important;opacity:.55!important}
.lz-feedback-quote{position:relative;margin:18px 0 0!important;padding:17px 16px!important;border-radius:16px!important;background:rgba(255,255,255,.78)!important;box-shadow:0 10px 18px rgba(16,25,40,.075),inset 0 1px 0 rgba(255,255,255,.92)!important;font-size:clamp(10px,.92vw,12px)!important;line-height:1.42!important;font-weight:800!important;font-style:italic!important;letter-spacing:-.01em!important;color:#101928!important}
.lz-feedback-quote:before{display:none!important}
.lz-feedback-card > .lz-feedback-stars{display:none!important}
@media(max-width:900px){
  .lz-feedback-cards{min-height:auto;display:grid!important;grid-template-columns:1fr!important;gap:18px!important}
  .lz-feedback-card{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%!important}
}

/* Final opened-page composition */
.lz.is-open{font-family:"Inter Tight",Inter,ui-sans-serif,system-ui,sans-serif!important;color:#17212b!important;background:#eef5fb!important;overflow-x:hidden!important}
.lz.is-open .lz-doc{position:relative;overflow:hidden;background:
  radial-gradient(circle at 18% 10%,rgba(210,231,255,.86),transparent 26%),
  radial-gradient(circle at 78% 14%,rgba(230,219,255,.66),transparent 24%),
  linear-gradient(180deg,#f9fbff 0%,#eef5fb 42%,#f7f9fc 100%)!important}
.lz.is-open .lz-chrome{position:sticky!important;top:0!important;z-index:50!important;display:grid!important;grid-template-columns:auto auto 1fr auto auto auto!important;gap:18px!important;align-items:center!important;padding:14px clamp(16px,3vw,42px)!important;background:rgba(248,251,255,.66)!important;border-bottom:1px solid rgba(255,255,255,.78)!important;box-shadow:0 18px 50px rgba(41,61,84,.08)!important;backdrop-filter:blur(20px)!important;color:#223041!important}
.lz.is-open .lz-chrome-brand,.lz.is-open .lz-chrome-clock,.lz.is-open .lz-chrome-xy{font-family:"IBM Plex Mono",ui-monospace,monospace!important;font-size:10px!important;letter-spacing:.14em!important;color:rgba(34,48,65,.58)!important}
.lz.is-open .lz-top-logo{font-weight:900!important;font-size:18px!important;letter-spacing:-.03em!important;color:#111b26!important;text-decoration:none!important}
.lz-chrome-nav{display:flex;justify-content:center;gap:8px}
.lz-chrome-nav a,.lz-chrome-cta{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 14px;border-radius:999px;text-decoration:none;font-size:12px;font-weight:800;color:#273548;background:rgba(255,255,255,.42);border:1px solid rgba(255,255,255,.72)}
.lz-chrome-cta{color:#fff;background:linear-gradient(135deg,#17212b,#526173);box-shadow:0 12px 30px rgba(35,52,72,.18)}
.lz.is-open .lz-hero{position:relative!important;display:grid!important;grid-template-columns:minmax(0,.9fr) minmax(360px,1.1fr)!important;gap:clamp(28px,5vw,78px)!important;align-items:center!important;min-height:100svh!important;padding:clamp(86px,10vh,128px) clamp(18px,5.5vw,88px) 42px!important;text-align:left!important;background:transparent!important;cursor:auto!important}
.lz.is-open .lz-hero-copy{order:0!important;max-width:720px!important;margin:0!important;text-align:left!important}
.lz.is-open .lz-kicker{display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:7px 11px;border:1px solid rgba(120,145,176,.2);border-radius:999px;background:rgba(255,255,255,.56);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;font-weight:700;letter-spacing:.18em;color:#5b6f89}
.lz.is-open .lz-hero h1{margin:18px 0 0!important;max-width:760px!important;font-family:"Inter Tight",Inter,ui-sans-serif,system-ui,sans-serif!important;font-size:clamp(54px,6.8vw,98px)!important;line-height:.91!important;font-weight:900!important;letter-spacing:0!important;color:#121b25!important}
.lz-gradient-line{display:block;background:linear-gradient(100deg,#273548 0%,#7fa8cf 52%,#9b8fd6 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.lz.is-open .lz-hero-lead{margin:24px 0 0!important;max-width:36rem!important;font-size:clamp(16px,1.35vw,20px)!important;line-height:1.55!important;font-weight:600!important;color:rgba(30,43,58,.68)!important}
.lz.is-open .lz-hero-actions{justify-content:flex-start!important;margin-top:30px!important}
.lz-primary,.lz-secondary{display:inline-flex;align-items:center;gap:9px;min-height:46px;padding:0 18px;border-radius:999px;text-decoration:none;font-weight:900;font-size:14px}
.lz-primary{color:#fff;background:linear-gradient(135deg,#141f2b,#536274);box-shadow:0 18px 42px rgba(38,55,75,.22)}
.lz-secondary{color:#263647;background:rgba(255,255,255,.54);border:1px solid rgba(255,255,255,.82)}
.lz-trust-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:26px;font-size:12px;font-weight:800;color:rgba(38,52,70,.58)}
.lz-avatar-stack{display:flex}.lz-avatar-stack i{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#dfeeff,#aebee0);border:2px solid #fff;margin-left:-7px}.lz-avatar-stack i:first-child{margin-left:0}
.lz.is-open .lz-reactive-word{grid-column:1/-1;order:4!important;margin:10px auto 0!important;font-size:clamp(24px,4.5vw,62px)!important;line-height:.95!important;opacity:.12!important;pointer-events:auto!important}
.lz.is-open .lz-glass{display:block!important;position:relative!important;min-height:560px!important;perspective:1100px}
.lz-product-window{position:relative!important;display:block!important;width:min(620px,100%)!important;margin:0 auto!important;min-height:440px!important;border-radius:24px!important;background:linear-gradient(150deg,rgba(255,255,255,.78),rgba(235,244,255,.38))!important;border:1px solid rgba(255,255,255,.86)!important;box-shadow:0 34px 88px rgba(50,70,95,.18),inset 0 1px 0 rgba(255,255,255,.96)!important;transform:rotateY(-10deg) rotateX(5deg);overflow:hidden!important}
.lz-product-window:after{content:"";position:absolute;left:9%;right:9%;bottom:-34px;height:42px;border-radius:50%;background:rgba(80,100,130,.2);filter:blur(18px)}
.lz-window-bar{display:flex!important;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid rgba(132,154,180,.18);font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.14em;color:#5a6b7e}
.lz-product-grid-preview{display:grid!important;grid-template-columns:1.1fr .75fr!important;gap:14px!important;padding:18px!important}
.lz-preview-main,.lz-preview-shot,.lz-preview-list{border-radius:18px!important;background:rgba(255,255,255,.58)!important;border:1px solid rgba(255,255,255,.82)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
.lz-preview-main{min-height:250px!important;padding:22px!important}.lz-preview-main small{font-family:"IBM Plex Mono";font-size:10px;letter-spacing:.16em;color:#7890aa}.lz-preview-main strong{display:block;margin-top:38px;font-size:30px;line-height:1;font-weight:900;color:#15212e}.lz-preview-main p{font-size:14px;line-height:1.45;color:#617187}
.lz-preview-shot{aspect-ratio:9/16!important;display:grid;place-items:end center;padding:16px;background:linear-gradient(160deg,#1d2a38,#54677d)!important;color:#fff!important}.lz-preview-shot span{font-family:"IBM Plex Mono";font-size:11px;letter-spacing:.2em}
.lz-preview-list{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px}.lz-preview-list span{padding:14px 10px;border-radius:14px;background:rgba(238,246,255,.8);font-size:12px;font-weight:900;color:#33465e;text-align:center}
.lz-window-sheen{position:absolute;inset:0;background:linear-gradient(120deg,transparent 12%,rgba(255,255,255,.52) 36%,transparent 58%);mix-blend-mode:screen;pointer-events:none}
.lz-floating-panel{position:absolute;display:grid;gap:3px;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.9);box-shadow:0 18px 48px rgba(40,60,82,.14);backdrop-filter:blur(18px)}.lz-floating-panel b{font-size:24px}.lz-floating-panel span{font-size:10px;font-family:"IBM Plex Mono";letter-spacing:.16em;text-transform:uppercase;color:#6a7d92}.lz-float-a{left:0;top:78px}.lz-float-b{right:10px;bottom:76px}
.lz-metrics-band{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:min(980px,100%);margin:10px auto 0}.lz-metrics-band span{padding:18px;border-radius:20px;background:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.82);box-shadow:0 16px 42px rgba(44,61,82,.08)}.lz-metrics-band b{display:block;font-size:26px}.lz-metrics-band em{display:block;margin-top:4px;font-style:normal;font-family:"IBM Plex Mono";font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6d7e92}
.lz-showcase,.lz-spotlight,.lz-work,.lz-steps{position:relative!important;max-width:1200px!important;margin:0 auto!important;padding:clamp(70px,9vw,124px) clamp(18px,4vw,48px)!important;background:transparent!important}
.lz-showcase-head h2,.lz-spotlight h2,.lz-work-head h2,.lz-earn-title{margin:14px 0 0!important;font-family:"Inter Tight",Inter,sans-serif!important;font-size:clamp(38px,5.4vw,76px)!important;line-height:.96!important;font-weight:900!important;letter-spacing:0!important;color:#17212b!important}
.lz-browser-frame{margin-top:30px;border-radius:28px;background:rgba(255,255,255,.58);border:1px solid rgba(255,255,255,.88);box-shadow:0 28px 80px rgba(43,64,88,.14);overflow:hidden;backdrop-filter:blur(18px)}
.lz-browser-bar{display:flex;align-items:center;gap:8px;padding:16px 18px;border-bottom:1px solid rgba(124,146,172,.18)}.lz-browser-bar span{width:10px;height:10px;border-radius:50%;background:#b8cbe0}.lz-browser-bar b{margin-left:12px;font-family:"IBM Plex Mono";font-size:11px;color:#64778d}
.lz-browser-body{display:grid;grid-template-columns:170px 1fr;min-height:440px}.lz-rail{display:grid;align-content:start;gap:10px;padding:18px;border-right:1px solid rgba(124,146,172,.16)}.lz-rail span{padding:12px;border-radius:14px;background:rgba(240,247,255,.74);font-size:12px;font-weight:900;color:#44566d}
.lz-bento-canvas{display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:14px;padding:18px}.lz-bento-canvas article{border-radius:20px;border:1px solid rgba(255,255,255,.84);background:rgba(255,255,255,.56);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}.lz-bento-wide{grid-column:span 2;padding:24px}.lz-bento-wide small{font-family:"IBM Plex Mono";letter-spacing:.18em;color:#7890aa}.lz-bento-wide strong{display:block;margin-top:52px;font-size:34px;line-height:1;font-weight:900;color:#17212b}.lz-media-tile{display:flex;align-items:end;min-height:180px;padding:16px;background:linear-gradient(145deg,#162230,#60758c)!important;color:#fff}.lz-media-tile.is-alt{background:linear-gradient(145deg,#283043,#9a91c8)!important}.lz-export-queue{grid-column:span 2;padding:20px}.lz-export-queue b{display:block;margin-bottom:18px}.lz-export-queue span{display:block;margin:11px 0;font-size:12px;font-weight:800;color:#40536a}.lz-export-queue i{display:block;height:7px;margin:7px 0;border-radius:999px;background:linear-gradient(90deg,#83acd2,#a79ce0)}
.lz-spotlight{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:center}.lz-spotlight p:not(.lz-kicker){font-size:17px;line-height:1.55;color:#66778b}.lz-spotlight-panel{min-height:280px;border-radius:26px;padding:26px;background:linear-gradient(150deg,rgba(255,255,255,.7),rgba(232,242,255,.42));border:1px solid rgba(255,255,255,.88);box-shadow:0 26px 74px rgba(44,64,88,.13);display:grid;align-content:end}.lz-spotlight-panel span{font-family:"IBM Plex Mono";letter-spacing:.16em;text-transform:uppercase;color:#71849a}.lz-spotlight-panel b{font-size:44px;line-height:1}.lz-spotlight-panel i{height:9px;width:72%;margin-top:20px;border-radius:999px;background:linear-gradient(90deg,#92b9df,#a99ee4)}
.lz-grid{list-style:none;margin:34px 0 0;padding:0;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:16px}.lz-card{position:relative;min-height:280px;padding:24px;border-radius:22px;background:rgba(255,255,255,.56);border:1px solid rgba(255,255,255,.86);box-shadow:0 20px 58px rgba(45,65,88,.1);overflow:hidden}.lz-card-1,.lz-card-2{grid-column:span 3}.lz-card-3{grid-column:span 2}.lz-card-4{grid-column:span 4}.lz-card-5{grid-column:span 4}.lz-card-6{grid-column:span 2}.lz-card span{font-family:"IBM Plex Mono";letter-spacing:.16em;color:#7890aa}.lz-card h3{margin:38px 0 0;font-size:32px;line-height:1;font-weight:900;color:#17212b}.lz-card p{font-size:15px;line-height:1.5;color:#62748a}.lz-card em{position:absolute;left:22px;bottom:18px;font-style:normal;font-family:"IBM Plex Mono";font-size:10px;letter-spacing:.18em;color:#6d8298}.lz-card-reveal{position:absolute;inset:auto 12px 12px 12px;min-height:92px;padding:16px;border-radius:18px;background:rgba(22,33,45,.88);color:#fff;font-size:13px;line-height:1.45;clip-path:inset(100% 0 0 0 round 18px);transition:clip-path .45s cubic-bezier(.16,1,.3,1)}.lz-card.is-on .lz-card-reveal,.lz-card:hover .lz-card-reveal{clip-path:inset(0 0 0 0 round 18px)}
.lz.is-open .lz-steps{text-align:center!important}.lz-workflow-line{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:0;width:75%;margin:34px auto -16px}.lz-workflow-line i{height:2px;background:linear-gradient(90deg,#9bbfe1,#aaa0df);position:relative}.lz-workflow-line i:after{content:"";position:absolute;right:-7px;top:-5px;width:12px;height:12px;border-top:2px solid #9eacd8;border-right:2px solid #9eacd8;transform:rotate(45deg);animation:lz-chevron 1.8s ease-in-out infinite}.lz.is-open .lz-steps ol{list-style:none;margin:0;padding:0;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:16px}.lz.is-open .lz-steps li{position:relative;min-height:250px;padding:28px 20px 22px!important;border-radius:22px!important;background:rgba(255,255,255,.58)!important;border:1px solid rgba(255,255,255,.86)!important;box-shadow:0 20px 58px rgba(45,65,88,.1)!important}.lz-step-bars{position:absolute;left:20px;right:20px;bottom:18px;display:grid;gap:7px}.lz-step-bars i{display:block;height:7px;border-radius:999px;background:linear-gradient(90deg,#8bb7dc,#aea3e4)}
@keyframes lz-chevron{0%,100%{opacity:.35;transform:translateX(0) rotate(45deg)}50%{opacity:1;transform:translateX(8px) rotate(45deg)}}
@media(max-width:1080px){.lz-chrome-nav{display:none}.lz.is-open .lz-chrome{grid-template-columns:auto 1fr auto auto auto!important}.lz.is-open .lz-hero{grid-template-columns:1fr!important;text-align:center!important}.lz.is-open .lz-hero-copy{text-align:center!important;margin:0 auto!important}.lz.is-open .lz-hero-actions,.lz-trust-row{justify-content:center!important}.lz.is-open .lz-glass{min-height:auto!important}.lz-product-window{transform:none}.lz-spotlight,.lz-browser-body{grid-template-columns:1fr}.lz-rail{display:none}.lz-bento-canvas{grid-template-columns:1fr 1fr}.lz-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.lz-card{grid-column:auto!important}.lz.is-open .lz-steps ol{grid-template-columns:repeat(2,minmax(0,1fr))!important}.lz-workflow-line{display:none}}
@media(max-width:800px){.lz.is-open .lz-chrome-clock,.lz.is-open .lz-chrome-xy{display:none!important}.lz.is-open .lz-chrome{grid-template-columns:auto 1fr auto!important}.lz-chrome-brand{display:none}.lz.is-open .lz-hero{padding-left:16px!important;padding-right:16px!important}.lz.is-open .lz-hero h1{font-size:clamp(44px,15vw,66px)!important}.lz-product-grid-preview,.lz-preview-list,.lz-bento-canvas,.lz-metrics-band,.lz-grid,.lz.is-open .lz-steps ol{grid-template-columns:1fr!important}.lz-showcase,.lz-spotlight,.lz-work,.lz-steps{padding-left:16px!important;padding-right:16px!important}.lz-card{min-height:260px}.lz-card-reveal{clip-path:inset(0 0 0 0 round 18px);position:relative;inset:auto;margin-top:18px}.lz-floating-panel{position:relative;left:auto;right:auto;top:auto;bottom:auto;margin:12px auto}.lz-browser-bar b{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
`;
