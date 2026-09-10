import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowLeft,
    ArrowRight,
  Check,
  Crown,
  Eye,
  Ghost,
  Image as ImageIcon,
  Layers,
  Loader2,
  LockKeyhole,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { useSubscription } from 'src/useSubscription';
import { useAuthStore } from 'src/auth-store';
import { useStore } from 'src/store';

const clamp = (n: number) => Math.max(0, Math.min(1, n));

const rocks = [
  { x: -9, y: 18, size: 155, duration: 49, delay: -16, spin: 71 },
  { x: 82, y: 66, size: 185, duration: 62, delay: -28, spin: 93 },
  { x: 68, y: 8, size: 65, duration: 83, delay: -43, spin: 117 },
  { x: 14, y: 72, size: 82, duration: 69, delay: -11, spin: 83 },
  { x: 44, y: 14, size: 27, duration: 104, delay: -61, spin: 131 },
  { x: 92, y: 34, size: 51, duration: 91, delay: -35, spin: 99 },
  { x: 33, y: 88, size: 35, duration: 113, delay: -83, spin: 143 },
  { x: 4, y: 43, size: 43, duration: 97, delay: -54, spin: 109 },
];

function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0;
    let height = 0;
    let frame = 0;
    let elapsed = 0;
    let lastTime = 0;

    // Stable positions: resizing does not randomise the sky.
    const stars = Array.from({ length: 220 }, (_, index) => {
      const random = (seed: number) => {
        const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
        return value - Math.floor(value);
      };
      return {
        x: random(index + 1),
        y: random(index + 501),
        radius: 0.35 + random(index + 901) * 1.1,
        alpha: 0.2 + random(index + 1401) * 0.65,
        phase: random(index + 1901) * Math.PI * 2,
      };
    });

    const draw = () => {
      context.clearRect(0, 0, width, height);
      stars.forEach((star, index) => {
        const drift = reduced.matches ? 0 : elapsed * 0.0007;
        const x = (star.x * width + drift * (index % 3 + 1)) % width;
        const twinkle =
          reduced.matches || index % 8 !== 0
            ? 1
            : 0.8 + Math.sin(elapsed * 0.0004 + star.phase) * 0.2;

        context.beginPath();
        context.fillStyle = `rgba(255,210,149,${star.alpha * twinkle * 0.72})`;
        context.arc(x, star.y * height, star.radius, 0, Math.PI * 2);
        context.fill();

        if (index % 37 === 0) {
          context.fillStyle = 'rgba(125,211,252,0.12)';
          context.fillRect(x - 4, star.y * height - 0.35, 8, 0.7);
          context.fillRect(x - 0.35, star.y * height - 4, 0.7, 8);
        }
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    };

    const tick = (time: number) => {
      elapsed += lastTime ? Math.min(time - lastTime, 50) : 0;
      lastTime = time;
      draw();
      frame = requestAnimationFrame(tick);
    };

    const restart = () => {
      cancelAnimationFrame(frame);
      lastTime = 0;
      if (!document.hidden && !reduced.matches) {
        frame = requestAnimationFrame(tick);
      } else {
        draw();
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    restart();
    document.addEventListener('visibilitychange', restart);
    reduced.addEventListener('change', restart);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', restart);
      reduced.removeEventListener('change', restart);
    };
  }, []);

  return (
    <div className="lx-space" aria-hidden="true">
      <div className="lx-nebula lx-nebula-one" />
      <div className="lx-nebula lx-nebula-two" />
      <canvas ref={canvasRef} className="lx-stars" />
      <div className="lx-planet">
        <div className="lx-planet-surface" />
      </div>

      <div className="lx-rock-field">
        {rocks.map((rock, index) => (
          <div
            className={`lx-rock-path lx-rock-${index}`}
            key={index}
            style={{
              left: `${rock.x}%`,
              top: `${rock.y}%`,
              width: rock.size,
              height: rock.size,
              '--travel': `${rock.duration}s`,
              '--delay': `${rock.delay}s`,
              '--spin': `${rock.spin}s`,
            } as CSSProperties}
          >
            <svg viewBox="0 0 120 120" className="lx-rock">
              <defs>
                <linearGradient
                  id={`lx-rock-light-${index}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0" stopColor="#9a9eaf" />
                  <stop offset=".28" stopColor="#545766" />
                  <stop offset=".65" stopColor="#292c38" />
                  <stop offset="1" stopColor="#0b0d15" />
                </linearGradient>
              </defs>
              <path
                d="M26 13 53 5 78 15 101 35 111 63 97 91 73 110 43 105 17 88 7 59 14 32Z"
                fill={`url(#lx-rock-light-${index})`}
                stroke="#a4aec1"
                strokeOpacity=".23"
              />
              <path
                d="M26 13 38 39 14 32M38 39 53 5M38 39 74 30 78 15M74 30 91 56 101 35M91 56 70 80 97 91M70 80 43 105 39 72 17 88M39 72 38 39 64 54 74 30M64 54 70 80"
                fill="none"
                stroke="#d4def7"
                strokeOpacity=".11"
              />
              <path
                d="m38 39 26 15-25 18Zm36-9 17 26-27-2ZM70 80l27 11-24 19Z"
                fill="#050710"
                opacity=".28"
              />
              <ellipse cx="39" cy="49" rx="10" ry="8" fill="#10131d" opacity=".48" />
              <path d="M29 49q10-14 20 0" fill="none" stroke="#b7bac8" strokeOpacity=".22" />
              <ellipse cx="76" cy="69" rx="12" ry="9" fill="#10131d" opacity=".52" />
              <path d="M64 69q12-15 24 0" fill="none" stroke="#b7bac8" strokeOpacity=".19" />
              <ellipse cx="52" cy="87" rx="5" ry="4" fill="#090c14" opacity=".45" />
              <ellipse cx="68" cy="37" rx="4" ry="3" fill="#090c14" opacity=".42" />
            </svg>
          </div>
        ))}
      </div>
      <div className="lx-vignette" />
    </div>
  );
}

function PlanArtwork({ kind }: { kind: 'ghost' | 'creator' | 'studio' }) {
  if (kind === 'ghost') {
    return (
      <div className="lx-art lx-art-ghost" aria-hidden="true">
        <div className="lx-mini-dashboard">
          <div className="lx-mini-nav"><i /><i /><i /></div>
          <div className="lx-mini-body">
            <div className="lx-mini-sidebar"><i /><i /><i /></div>
            <div className="lx-mini-output"><LockKeyhole size={18} /></div>
          </div>
        </div>
        <div className="lx-ghost-orb"><Ghost size={35} strokeWidth={1.3} /></div>
        <span className="lx-art-caption">A glimpse inside</span>
      </div>
    );
  }

  if (kind === 'creator') {
    return (
      <div className="lx-art lx-art-creator" aria-hidden="true">
        <div className="lx-creative lx-creative-back">
          <Video size={13} />
          <div className="lx-product-bottle" />
        </div>
        <div className="lx-creative lx-creative-front">
          <span>FORM / 01</span>
          <div className="lx-product-bottle" />
          <small>EVERYDAY, ELEVATED.</small>
        </div>
        <span className="lx-prompt-chip"><Sparkles size={11} /> Your idea, brought to life</span>
        <span className="lx-art-caption">Example creative</span>
      </div>
    );
  }

  return (
    <div className="lx-art lx-art-studio" aria-hidden="true">
      <div className="lx-campaign-source"><Layers size={23} /><span>PRODUCT</span></div>
      <svg className="lx-connections" viewBox="0 0 260 130">
        <path d="M72 65H130M130 65V25H190M130 65H190M130 65V105H190" />
      </svg>
      <div className="lx-campaign-outputs">
        <span><ImageIcon size={13} /> Image</span>
        <span><Video size={13} /> Video</span>
        <span><Sparkles size={13} /> Hook</span>
      </div>
      <span className="lx-art-caption">Campaign Studio Â· Concept preview</span>
    </div>
  );
}

function PlanObject({ kind }: { kind: 'ghost' | 'creator' | 'studio' }) {
  const ghostRef = useRef<HTMLDivElement>(null);

  const updateGhostZip = (event: ReactPointerEvent<HTMLDivElement>) => {
    const ghost = ghostRef.current;
    if (!ghost) return;

    const rect = ghost.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const onRightSkin = x >= 0.52 && x <= 0.96 && y >= 0.08 && y <= 0.92;

    if (!onRightSkin) {
      ghost.style.setProperty('--ghost-zip', '0');
      ghost.style.setProperty('--ghost-open', '0');
      return;
    }

    ghost.style.setProperty('--ghost-zip', '1');
    ghost.style.setProperty('--ghost-open', String(clamp((y - 0.16) / 0.68)));
  };

  const closeGhostZip = () => {
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.style.setProperty('--ghost-zip', '0');
    ghost.style.setProperty('--ghost-open', '0');
  };

  if (kind === 'ghost') {
    return (
      <div
        className="lx-object lx-object-ghost"
        ref={ghostRef}
        onPointerMove={updateGhostZip}
        onPointerLeave={closeGhostZip}
        style={{ '--ghost-zip': 0, '--ghost-open': 0 } as CSSProperties}
      >
        <svg className="lx-ghost-shape" viewBox="0 0 260 240">
          <defs>
            <radialGradient id="ghostGlow" cx="50%" cy="36%" r="64%">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".64" />
              <stop offset=".56" stopColor="#c8d3ff" stopOpacity=".22" />
              <stop offset="1" stopColor="#9faeff" stopOpacity=".06" />
            </radialGradient>
          </defs>
          <path className="lx-ghost-body" d="M55 209V97C55 49 88 22 130 22s75 27 75 75v112l-19-17-20 21-21-20-18 19-21-20-18 21-17-20Z" fill="url(#ghostGlow)" />
          <path className="lx-ghost-under" d="M151 51c28 16 45 43 45 80v70l-12-11-19 20-20-19-18 18 4-79c2-37 8-62 20-79Z" />
          <path className="lx-ghost-skin-open" d="M146 47c33 14 52 43 52 84v70l-14-11-19 20-20-19-18 18 8-82c3-38 7-61 11-80Z" />
          <path className="lx-ghost-zip-open" d="M151 52c17 21 22 49 18 83-4 31-15 55-33 72" />
          <path className="lx-ghost-zip-track" d="M154 50c15 22 19 50 15 83-4 31-14 55-32 74" />
          <g className="lx-ghost-zip-teeth">
            <path d="M158 61l-10 4M163 78l-11 3M166 96l-12 2M167 114h-12M165 132l-12-1M161 150l-11-4M155 166l-10-6M147 182l-9-8M137 196l-7-9" />
          </g>
          <path className="lx-ghost-zip-pull" d="M152 45l15 4-3 16-15-4Z" />
          <g className="lx-ghost-face">
            <ellipse cx="108" cy="104" rx="16" ry="21" />
            <ellipse cx="152" cy="104" rx="16" ry="21" />
            <circle className="lx-ghost-pupil lx-ghost-pupil-left" cx="111" cy="108" r="5" />
            <circle className="lx-ghost-pupil lx-ghost-pupil-right" cx="155" cy="108" r="5" />
            <path className="lx-ghost-mouth lx-ghost-mouth-soft" d="M113 148q17 14 34 0" />
            <path className="lx-ghost-mouth lx-ghost-mouth-grin" d="M102 143q28 30 58 0l-10 22-12-10-10 12-10-12-12 10Z" />
          </g>
        </svg>
        <span className="lx-mini-ghost lx-mini-ghost-a"><Ghost size={25} /></span>
        <span className="lx-mini-ghost lx-mini-ghost-b"><Ghost size={18} /></span>
        <button className="lx-hotspot lx-hotspot-one" type="button" aria-label="Explore dashboard" />
        <span className="lx-bubble lx-bubble-one">Explore dashboard</span>
        <button className="lx-hotspot lx-hotspot-two" type="button" aria-label="View examples" />
        <span className="lx-bubble lx-bubble-two">View examples</span>
        <button className="lx-hotspot lx-hotspot-three" type="button" aria-label="Creation locked" />
        <span className="lx-bubble lx-bubble-three">Creation locked</span>
      </div>
    );
  }

  if (kind === 'creator') {
    return (
      <div className="lx-object lx-object-creator">
        <svg className="lx-engine" viewBox="0 0 280 230">
          <defs>
            <linearGradient id="engineBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffc27a" />
              <stop offset=".48" stopColor="#d8893f" />
              <stop offset="1" stopColor="#5f321b" />
            </linearGradient>
          </defs>
          <path className="lx-engine-wing lx-engine-wing-left" d="M52 92 116 58 107 123 48 139Z" />
          <path className="lx-engine-wing lx-engine-wing-right" d="M228 92 164 58 173 123 232 139Z" />
          <path className="lx-engine-core" d="M92 76h96l35 50-35 50H92l-35-50Z" fill="url(#engineBody)" />
          <path className="lx-engine-rim" d="M98 84h84l29 42-29 42H98l-29-42Z" />
          <circle className="lx-engine-lens" cx="140" cy="126" r="34" />
          <path className="lx-engine-aperture" d="M128 108h25l15 18-15 18h-25l-15-18Z" />
          <path className="lx-engine-beam" d="M140 127 95 210h90Z" />
        </svg>
        <div className="lx-frame lx-frame-image"><ImageIcon size={16} /><span>Image</span></div>
        <div className="lx-frame lx-frame-video"><Video size={16} /><span>Video</span></div>
        <button className="lx-hotspot lx-hotspot-one" type="button" aria-label="Generate images" />
        <span className="lx-bubble lx-bubble-one">Generate images</span>
        <button className="lx-hotspot lx-hotspot-two" type="button" aria-label="Generate videos" />
        <span className="lx-bubble lx-bubble-two">Generate videos</span>
        <button className="lx-hotspot lx-hotspot-three" type="button" aria-label="Choose styles" />
        <span className="lx-bubble lx-bubble-three">Choose styles</span>
        <button className="lx-hotspot lx-hotspot-four" type="button" aria-label="Download content" />
        <span className="lx-bubble lx-bubble-four">Download content</span>
      </div>
    );
  }

  return (
    <div className="lx-object lx-object-studio">
      <svg className="lx-crystal" viewBox="0 0 270 230">
        <defs>
          <linearGradient id="crystalFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eadcff" />
            <stop offset=".45" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#3b1c72" />
          </linearGradient>
        </defs>
        <path className="lx-crystal-core" d="M136 18 206 82 181 187 136 215 89 187 64 82Z" fill="url(#crystalFill)" />
        <path className="lx-crystal-face lx-crystal-face-left" d="M136 18 64 82l72 133Z" />
        <path className="lx-crystal-face lx-crystal-face-right" d="M136 18 206 82l-70 133Z" />
        <path className="lx-crystal-lines" d="M136 18v197M64 82h142M89 187l47-105 45 105" />
      </svg>
      <div className="lx-campaign-outputs">
        <span><ImageIcon size={13} /> Image</span>
        <span><Video size={13} /> Video</span>
        <span><Sparkles size={13} /> Hook</span>
      </div>
      <button className="lx-hotspot lx-hotspot-one" type="button" aria-label="Campaign Studio" />
      <span className="lx-bubble lx-bubble-one">Campaign Studio</span>
      <button className="lx-hotspot lx-hotspot-two" type="button" aria-label="Brand presets" />
      <span className="lx-bubble lx-bubble-two">Brand presets</span>
      <button className="lx-hotspot lx-hotspot-three" type="button" aria-label="Creative variations" />
      <span className="lx-bubble lx-bubble-three">Creative variations</span>
    </div>
  );
}

function LaunchlyIntroScene() {
  return (
    <div className="lx-intro-scene" aria-hidden="true">
      <div className="lx-particle-orbit lx-particle-orbit-a" />
      <div className="lx-particle-orbit lx-particle-orbit-b" />
      <div className="lx-product-stage">
        <div className="lx-stage-glass" />
        <div className="lx-stage-product"><span className="lx-stage-cap" /><span className="lx-stage-label">LAUNCHLY<br /><small>CREATIVE</small></span></div>
        <div className="lx-stage-reflection" />
      </div>
      <div className="lx-prompt-card">
        <span>AI CREATIVE DIRECTION</span>
        <strong>Soft light Â· 9:16 Â· Product focus</strong>
        <i /><i /><i />
      </div>
      <div className="lx-scene-tag">PRODUCT â†’ AD</div>
    </div>
  );
}

export function PricingPage() {
  const signOut = useAuthStore((s) => s.signOut);
  const resetUserState = useStore((s) => s.resetUserState);
  const {
    createCheckout,
    manageSubscription,
    checkoutLoading,
    isActive,
    loading,
    refresh,
  } = useSubscription();

  const rootRef = useRef<HTMLElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const targetRef = useRef(0);
  const activeRef = useRef(isActive);
  const refreshRef = useRef(refresh);

  const [plansOpen, setPlansOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [activationPending, setActivationPending] = useState(false);
  const [backLoading, setBackLoading] = useState(false);

  activeRef.current = isActive;
  refreshRef.current = refresh;

  const goTo = (value: number) => {
    targetRef.current = value;
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previousTime = 0;
    let open = false;

    const tick = (time: number) => {
      const dt = Math.min(previousTime ? time - previousTime : 16, 50);
      previousTime = time;

      const current = progressRef.current;
      const zoomingOut = targetRef.current < current;
      const responseMs = zoomingOut ? 42 : 92;
      const next = reduced.matches
        ? targetRef.current
        : current + (targetRef.current - current) * (1 - Math.exp(-dt / responseMs));

      progressRef.current =
        Math.abs(next - targetRef.current) < 0.0005 ? targetRef.current : next;

      const p = progressRef.current;
      const reveal = clamp((p - 0.36) / 0.44);
      root.style.setProperty('--zoom', String(p));
      root.style.setProperty('--reveal', String(reveal));
      root.style.setProperty('--intro', String(clamp(1 - p / 0.34)));
      root.dataset.stage = p < 0.34 ? 'intro' : p < 0.64 ? 'fire' : 'ocean';

      const nextOpen = p > 0.57;
      if (nextOpen !== open) {
        open = nextOpen;
        setPlansOpen(open);
      }

      frame = requestAnimationFrame(tick);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;

      const target = event.target;
      if (target instanceof Element && target.closest('.lx-preview-dialog')) return;

      const panel = panelRef.current;
      if (
        panel &&
        target instanceof Node &&
        panel.contains(target) &&
        panel.scrollHeight > panel.clientHeight + 2 &&
        progressRef.current > 0.57
      ) {
        return;
      }

      event.preventDefault();
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = Math.max(-150, Math.min(150, event.deltaY * multiplier));
      const sensitivity = delta < 0 ? 0.0024 : 0.0017;

      targetRef.current = clamp(targetRef.current + delta * sensitivity);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (reduced.matches || event.pointerType !== 'mouse') return;
      root.style.setProperty('--mx', `${(event.clientX / window.innerWidth - 0.5) * 12}px`);
      root.style.setProperty('--my', `${(event.clientY / window.innerHeight - 0.5) * 10}px`);
    };

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      root.classList.toggle('lx-paused', document.hidden);
      previousTime = 0;
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointermove', onPointerMove);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    introRef.current?.toggleAttribute('inert', plansOpen);
    panelRef.current?.toggleAttribute('inert', !plansOpen);

    const focused = document.activeElement;
    if (plansOpen && focused && introRef.current?.contains(focused)) {
      panelRef.current?.focus({ preventScroll: true });
    }
    if (!plansOpen && focused && panelRef.current?.contains(focused)) {
      introRef.current?.querySelector('button')?.focus({ preventScroll: true });
    }
  }, [plansOpen]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get('subscription');

    if (status !== 'success' && status !== 'cancelled') return;

    url.searchParams.delete('subscription');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    targetRef.current = 1;

    if (status === 'cancelled') {
      setNotice('Checkout cancelled. You have not been upgraded.');
    } else {
      setNotice('Confirming your subscriptionâ€¦');
      setActivationPending(true);
    }
  }, []);

  useEffect(() => {
    if (!activationPending) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      if (activeRef.current) {
        setNotice('Your Creator subscription is active.');
        setActivationPending(false);
        return;
      }

      try {
        await refreshRef.current();
      } catch {
        // Retry transient failures; never assume payment is confirmed.
      }

      if (cancelled) return;
      attempts += 1;
      if (attempts >= 15) {
        setNotice('Confirmation is taking longer than expected. Refresh shortly to check your subscription.');
        setActivationPending(false);
        return;
      }
      timer = setTimeout(poll, 2000);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activationPending]);

  useEffect(() => {
    if (activationPending && isActive) {
      setNotice('Your Creator subscription is active.');
      setActivationPending(false);
    }
  }, [isActive, activationPending]);

  const checkout = async () => {
    try {
      await (isActive ? manageSubscription() : createCheckout());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not open checkout. Please try again.');
    }
  };

  const backToPublicFrontPage = async () => {
    if (backLoading) return;
    setBackLoading(true);
    setNotice('');

    const { error } = await signOut();
    if (error) {
      setNotice(`Could not sign out: ${error.message}`);
      setBackLoading(false);
      return;
    }

    resetUserState();
    window.history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <main className="lx" ref={rootRef}>
      <style>{styles}</style>
      <SpaceBackground />

      <header className="lx-header">
        <a className="lx-brand" href="/" aria-label="Launchly home">
          <span><Sparkles size={17} /></span> launchly
        </a>
        <nav className="lx-header-actions" aria-label="Launchly updates">
          <button type="button">Feedback</button>
          <button type="button">News</button>
          <button type="button">Update coming</button>
        </nav>
      </header>

      {notice && (
        <div className="lx-notice" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="lx-intro" ref={introRef} aria-hidden={plansOpen}>
        <LaunchlyIntroScene />
        <div className="lx-intro-label"><span /> CREATE CONTENT. EARN COMMISSIONS.</div>
        <h1>Turn a product<br /><em>into a reason to stop.</em></h1>
        <p>Create AI prompts, product images and video ads for TikTok Shop.<br />Make the creative. Download it. Post it your way.</p>
        <button className="lx-enter" onClick={() => goTo(1)}>
          Explore the plans <ArrowRight size={17} />
        </button>
        <span className="lx-scroll-hint"><span className="lx-mouse"><i /></span> Scroll to reveal access</span>
      </div>

      <div className="lx-plan-layer">
        <div
          className="lx-plan-panel"
          ref={panelRef}
          tabIndex={-1}
          aria-hidden={!plansOpen}
          aria-label="Subscription plans"
        >
          <div className="lx-plan-heading">
            <div>
              <span className="lx-kicker">CHOOSE YOUR ACCESS</span>
              <h2>Pick your creator plan.</h2>
            </div>
          </div>

          <div className="lx-plans">
            <article className="lx-plan lx-ghost-plan" tabIndex={0}>
              <div className="lx-plan-top"><span>01 / PREVIEW</span><Eye size={17} /></div>
              <PlanObject kind="ghost" />
              <h3>Preview</h3>
              <p className="lx-description">View the Launchly workspace, examples, and dashboard without editing or generating.</p>
              <div className="lx-price">Free <small>preview</small></div>
              <div className="lx-divider" />
              <ul>
                <li><Eye /> View the dashboard</li>
                <li><Eye /> See example creations</li>
                <li><Eye /> Read-only access</li>
              </ul>
              <div className="lx-inset"><LockKeyhole size={15} /><span>Preview only. Upgrade to create, edit, save and export.</span></div>
              <div className="lx-plan-bottom">
                <button className="lx-button lx-ghost-button" onClick={() => setPreviewOpen(true)}>
                  Preview <ArrowRight size={15} />
                </button>
                <small>View only. No generation access.</small>
              </div>
            </article>

            <article className="lx-plan lx-creator-plan" tabIndex={0}>
              <div className="lx-plan-top"><span>02 / CREATE</span><span className="lx-pick"><Crown size={12} /> Creator pick</span></div>
              <PlanObject kind="creator" />
              <h3>Creator</h3>
              <p className="lx-description">Start creating TikTok Shop product content with image and video generation.</p>
              <div className="lx-price">Â£5 <small>/ month</small></div>
              <div className="lx-divider" />
              <ul>
                <li><Check /> Access the Launchly dashboard</li>
                <li><Check /> Generate product images</li>
                <li><Check /> Generate short videos</li>
                <li><Check /> Download your content</li>
              </ul>
              <div className="lx-plan-bottom">
                <button
                  className="lx-button lx-creator-button"
                  disabled={checkoutLoading || loading}
                  onClick={() => void checkout()}
                >
                  {checkoutLoading ? <><Loader2 className="lx-spin" size={17} /> Openingâ€¦</> :
                    <>{isActive ? 'Manage subscription' : 'Get Creator Access'}<ArrowRight size={16} /></>}
                </button>
                <small>Provider API usage is billed separately.</small>
              </div>
            </article>

            <article className="lx-plan lx-studio-plan" tabIndex={0}>
              <div className="lx-plan-top"><span>03 / EXPAND</span><span className="lx-studio-badge"><Layers size={15} /></span></div>
              <PlanObject kind="studio" />
              <h3>Studio</h3>
              <p className="lx-description">Plan campaigns, test hooks, save brand presets, and unlock every creator tool.</p>
              <div className="lx-price lx-soon">All tools <small>coming soon</small></div>
              <div className="lx-divider" />
              <span className="lx-planned">PLANNED FOR STUDIO</span>
              <ul>
                <li><Check /> Everything in Creator</li>
                <li><Check /> Campaign and hook tools</li>
                <li><Check /> Brand presets</li>
                <li><Check /> More tools and beta features</li>
              </ul>
              <div className="lx-inset lx-studio-inset"><Layers size={18} /><span><strong>Campaign Studio</strong>One product. A coordinated set of creatives.</span></div>
              <div className="lx-plan-bottom">
                <button className="lx-button" disabled>Coming soon <LockKeyhole size={14} /></button>
                <small>Your complete workspace. In development.</small>
              </div>
            </article>
          </div>
          <p className="lx-footer-note">Scroll up to return to space Â· Creator subscriptions can be cancelled through billing</p>
        </div>
      </div>

      {previewOpen && (
        <GhostPreview onClose={() => setPreviewOpen(false)} />
      )}

      <button
        className="lx-back-public"
        type="button"
        onClick={() => void backToPublicFrontPage()}
        disabled={backLoading}
      >
        {backLoading ? (
          <>
            <Loader2 className="lx-spin" size={15} /> Signing out
          </>
        ) : (
          <>
            <ArrowLeft size={15} /> Back
          </>
        )}
      </button>
    </main>
  );
}

function GhostPreview({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);

  return (
    <dialog
      className="lx-preview-dialog"
      ref={dialogRef}
      onCancel={onClose}
      aria-labelledby="lx-preview-title"
    >
      <div className="lx-preview-top">
        <span><Ghost size={20} /> Ghost Mode <small>READ-ONLY DEMO</small></span>
        <button onClick={onClose} aria-label="Close preview"><X size={20} /></button>
      </div>
      <h2 id="lx-preview-title">Meet your creative workspace.</h2>
      <p>This is sample content. Generation, editing, saving and export are locked.</p>
      <div className="lx-preview-grid">
        <div className="lx-preview-controls">
          <span className="lx-kicker">YOUR PROMPT</span>
          <textarea disabled value="Create a premium product image with warm studio lightingâ€¦" readOnly />
          <div className="lx-preview-tags"><span>Image</span><span>9:16</span><span>Studio light</span></div>
          <button className="lx-button" disabled><LockKeyhole size={15} /> Generation locked</button>
        </div>
        <div className="lx-preview-output">
          <PlanArtwork kind="creator" />
          <span>Example output Â· Not a generated project</span>
        </div>
      </div>
      <button className="lx-button lx-creator-button" onClick={onClose}>Return to plans <ArrowRight size={16} /></button>
    </dialog>
  );
}

const styles = `
.lx{
  --zoom:0;--reveal:0;--intro:1;--mx:0px;--my:0px;
  position:fixed;inset:0;isolation:isolate;overflow:hidden;
  background:#050710;color:#f1f2f8;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  overscroll-behavior:none;color-scheme:dark;
}
.lx:before{content:"";position:absolute;inset:-28%;z-index:-1;pointer-events:none;opacity:var(--reveal);
  background:
    radial-gradient(ellipse at 14% 18%,#60a5fa78 0 11%,transparent 33%),
    radial-gradient(ellipse at 84% 13%,#c084fc78 0 13%,transparent 35%),
    radial-gradient(ellipse at 20% 86%,#2dd4bf70 0 12%,transparent 34%),
    radial-gradient(ellipse at 78% 78%,#f0abfc55 0 12%,transparent 36%),
    radial-gradient(ellipse at 50% 50%,#38bdf84d 0 16%,transparent 42%),
    linear-gradient(135deg,#07111f 0%,#151d31 38%,#281f38 72%,#090911 100%);
  filter:blur(42px) saturate(1.45);transform:translate(calc(var(--reveal)*-18px),calc(var(--reveal)*10px)) scale(1.12);
  animation:lx-watercolor-flow 16s ease-in-out infinite alternate;transition:opacity .2s ease}
.lx:after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:var(--reveal);
  background:linear-gradient(135deg,#ffffff30,#ffffff08 30%,#ffffff1b 46%,#ffffff06 74%),repeating-linear-gradient(110deg,#ffffff0b 0 1px,transparent 1px 18px),radial-gradient(circle at 50% 18%,#ffffff24,transparent 40%);
  backdrop-filter:blur(20px) saturate(1.2);border-top:1px solid #ffffff2b;transition:opacity .2s ease}
.lx *,.lx *::before,.lx *::after{box-sizing:border-box}
.lx button,.lx a{-webkit-tap-highlight-color:transparent}
.lx button{font:inherit;cursor:pointer}
.lx button:disabled{cursor:not-allowed}
.lx button:focus-visible,.lx a:focus-visible{outline:2px solid #ffbe78;outline-offset:5px}
.lx button{color:inherit}
.lx-space{position:absolute;inset:-5%;z-index:-2;pointer-events:none;overflow:hidden;
  transform:translate(var(--mx),var(--my)) scale(calc(1 + var(--zoom)*.19));
  opacity:calc(1 - var(--reveal)*.24);background:#050710}
.lx-stars{position:absolute;width:100%;height:100%;inset:0}
.lx-nebula{position:absolute;filter:blur(45px);border-radius:50%;opacity:.5}
.lx-nebula-one{width:95%;height:60%;left:-12%;top:-5%;
  background:radial-gradient(ellipse,#30305455,transparent 65%),radial-gradient(ellipse at 65% 60%,#3b4b7a55,transparent 60%);
  transform:rotate(-28deg);animation:lx-cloud 65s ease-in-out infinite alternate}
.lx-nebula-two{width:65%;height:70%;right:-20%;bottom:-22%;
  background:radial-gradient(ellipse,#43245250,transparent 65%);
  animation:lx-cloud 83s ease-in-out infinite alternate-reverse}
.lx-planet{position:absolute;right:5%;top:9%;width:clamp(140px,22vw,330px);aspect-ratio:1;border-radius:50%;
  background:radial-gradient(circle at 29% 22%,#7f88a0 0%,#34394d 22%,#111524 49%,#04060d 72%);
  box-shadow:-3px -2px 3px #aabfe060,-10px -7px 32px #6375a31a,inset 5px 4px 12px #bac4ed17;
  transform:translate(calc(var(--zoom)*30px),calc(var(--zoom)*-20px));overflow:hidden;opacity:.7}
.lx-planet-surface{position:absolute;inset:0;border-radius:inherit;opacity:.26;
  background:repeating-linear-gradient(155deg,transparent 0 13px,#8b96ad17 14px 18px,transparent 21px 35px);
  box-shadow:inset -55px -28px 65px #000}
.lx-rock-field{position:absolute;inset:0;transform:scale(calc(1 + var(--zoom)*.3));opacity:calc(1 - var(--reveal)*.45)}
.lx-rock-path{position:absolute;animation:lx-travel var(--travel) ease-in-out var(--delay) infinite alternate}
.lx-rock{width:100%;height:100%;filter:drop-shadow(12px 20px 16px #0008);animation:lx-rotate var(--spin) linear var(--delay) infinite}
.lx-rock-0,.lx-rock-1{opacity:.85}
.lx-rock-4,.lx-rock-6{opacity:.4}
.lx-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 15%,#03040b55 65%,#03040bbf 100%),linear-gradient(0deg,#04060cbf,transparent 30%)}
.lx-header{position:absolute;left:0;right:0;top:0;padding:27px 42px;display:flex;align-items:center;justify-content:flex-end;z-index:5}
.lx-brand{position:absolute;left:50%;top:34px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;text-decoration:none;color:#f3f4fb;font-size:23px;font-weight:650;letter-spacing:-1px}
.lx-brand>span{display:grid;place-items:center;width:32px;height:32px;border:1px solid #ffffff26;border-radius:10px;background:#ffffff08;color:#ffd5a1}
.lx-header-actions{display:flex;align-items:center;gap:0;padding:4px;border:1px solid #ffffff1a;border-radius:14px;background:#ffffff08;backdrop-filter:blur(14px);box-shadow:0 16px 35px #0005}
.lx-header-actions button{min-height:30px;padding:0 13px;border:0;border-left:1px solid #ffffff14;background:transparent;color:#aeb5c7;font-size:11px!important;font-weight:600!important;border-radius:10px;transition:color .15s,background .15s}
.lx-header-actions button:first-child{border-left:0}
.lx-header-actions button:hover{color:#fff;background:#ffffff0d}
.lx-intro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:90px 24px;text-align:center;
  opacity:var(--intro);transform:scale(calc(1 + var(--zoom)*.12));pointer-events:none;transition:color .6s ease}
.lx-intro-scene{position:absolute;left:50%;top:50%;width:min(680px,72vw);height:min(540px,68vh);transform:translate(-76%,-50%) rotate(-7deg);opacity:.9;filter:drop-shadow(0 35px 55px #0008);z-index:-1}
.lx-product-stage{position:absolute;left:18%;top:11%;width:44%;height:72%;transform:perspective(900px) rotateY(20deg) rotateX(5deg);transform-style:preserve-3d;animation:lx-stage-float 6s ease-in-out infinite}
.lx-stage-glass{position:absolute;inset:-8%;border:1px solid #ffffff35;border-radius:28px;background:linear-gradient(135deg,#ffffff14,#ffffff02 45%,#8bc6ff10);box-shadow:inset 1px 1px #ffffff65,0 35px 70px #0007;backdrop-filter:blur(9px);transform:translateZ(-20px)}
.lx-stage-product{position:absolute;left:34%;top:19%;width:32%;height:56%;border-radius:13px 13px 20px 20px;background:linear-gradient(90deg,#151822 0%,#79869b 18%,#f7fbff 47%,#8290a3 76%,#171a24);box-shadow:inset 6px 0 8px #fff8,inset -8px 0 15px #0008,0 32px 35px #0008;transform:translateZ(50px);overflow:visible}
.lx-stage-cap{position:absolute;left:25%;top:-13%;width:50%;height:16%;border-radius:5px 5px 2px 2px;background:linear-gradient(90deg,#1a1e29,#e6edf5 48%,#505a68);box-shadow:0 -2px 8px #fff8}
.lx-stage-label{position:absolute;left:10%;right:10%;top:42%;padding:10px 3px;text-align:center;background:#f7f4ec;color:#1a2030;font-size:8px;font-weight:800;letter-spacing:1.4px;line-height:1.4;box-shadow:0 2px 8px #0003}
.lx-stage-label small{font-size:5px;letter-spacing:2px;font-weight:600}
.lx-stage-reflection{position:absolute;left:20%;right:5%;bottom:-15%;height:18%;background:linear-gradient(100deg,#ffffff55,transparent 65%);filter:blur(10px);transform:skewX(-22deg) translateZ(8px);opacity:.65}
.lx-prompt-card{position:absolute;right:0;bottom:11%;width:245px;padding:17px 19px;text-align:left;border:1px solid #ffffff3b;border-radius:16px;background:#0d1220b8;backdrop-filter:blur(18px);box-shadow:0 22px 45px #0008, inset 1px 1px #fff4;transform:translateZ(75px) rotate(5deg);animation:lx-card-flow 5.5s ease-in-out infinite}
.lx-prompt-card span,.lx-scene-tag{display:block;font-size:8px;letter-spacing:2px;color:#8dff9b}
.lx-prompt-card strong{display:block;margin-top:10px;color:#f5f7fb;font-size:12px;font-weight:600;line-height:1.5}
.lx-prompt-card i{display:inline-block;width:28%;height:3px;margin:14px 5% 0 0;border-radius:8px;background:#ffffff28}.lx-prompt-card i:first-of-type{background:#8dff9b}
.lx-scene-tag{position:absolute;left:7%;bottom:0;color:#aeb8cf;font-size:9px;letter-spacing:2.4px}
.lx-particle-orbit{position:absolute;border:1px solid #78a7ff44;border-radius:50%;transform-style:preserve-3d;animation:lx-orbit 9s linear infinite}
.lx-particle-orbit-a{inset:2% 12% 18% 4%;transform:rotateX(63deg) rotateZ(18deg)}.lx-particle-orbit-b{inset:15% 0 5% 22%;transform:rotateY(64deg) rotateZ(-18deg);animation-duration:13s;border-color:#ffc56b55}
.lx[data-stage="fire"] .lx-particle-orbit{border-color:#ff9b454d}.lx[data-stage="fire"] .lx-stage-glass{box-shadow:inset 1px 1px #fff6,0 35px 70px #0008,0 0 60px #ff6b2a38}.lx[data-stage="fire"] .lx-prompt-card{border-color:#ff9f5c80}.lx[data-stage="fire"] .lx-intro-scene:after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 42% 54%,#ff612e33,transparent 42%);mix-blend-mode:screen;animation:lx-fire-breathe 1.8s ease-in-out infinite alternate}
.lx[data-stage="ocean"] .lx-particle-orbit{border-color:#5bd7ff55}.lx[data-stage="ocean"] .lx-stage-glass{box-shadow:inset 1px 1px #fff6,0 35px 70px #0008,0 0 60px #35c7ff32}
.lx-intro:not([aria-hidden="true"]) button{pointer-events:auto}
.lx-intro-label{font-size:10px;letter-spacing:3px;color:#aeb6ce;display:flex;align-items:center;gap:10px;margin-bottom:26px}
.lx-intro-label>span{height:1px;width:25px;background:#aeb6ce}
.lx-intro h1{font-size:clamp(42px,6.7vw,94px);line-height:1.07;letter-spacing:-.065em;font-weight:500;margin:0;max-width:1000px}
.lx-intro h1 em{font-family:Georgia,serif;font-weight:400;color:#c6cbe1;letter-spacing:-.065em}
.lx-intro>p{color:#a0a7bc;font-size:15px;line-height:1.8;margin:26px 0 30px}
.lx-enter{display:flex;align-items:center;gap:24px;border:1px solid #ffffff35;border-radius:100px;padding:15px 23px;background:#ffffff09;backdrop-filter:blur(14px);font-size:13px!important;transition:background .2s,border-color .2s}
.lx-enter:hover{background:#ffffff16;border-color:#ffffff65}
.lx-scroll-hint{position:absolute;bottom:36px;display:flex;gap:10px;align-items:center;font-size:10px;letter-spacing:1px;color:#8d95af}
.lx-mouse{display:block;width:15px;height:23px;border:1px solid #939db366;border-radius:10px}
.lx-mouse i{display:block;width:2px;height:5px;margin:5px auto;background:#d1d5e4;animation:lx-wheel 1.8s ease-in-out infinite}
.lx-plan-layer{position:absolute;inset:0;display:grid;place-items:stretch;pointer-events:none;overflow:visible}
.lx-plan-panel{width:100%;height:100%;max-height:none;overflow:auto;padding:132px clamp(28px,4vw,56px) 30px;overscroll-behavior:contain;border-radius:0;
  background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.07));border:1px solid #ffffff2b;box-shadow:0 30px 100px #0008,0 0 90px #ffca8030;backdrop-filter:blur(22px);
  opacity:var(--reveal);transform:scale(calc(.94 + var(--reveal)*.06));scrollbar-width:thin;scrollbar-color:#ffffff25 transparent;outline:none}
.lx-plan-panel[aria-hidden="false"]{pointer-events:auto}
.lx-plan-heading{display:flex;align-items:center;justify-content:center;text-align:center;gap:16px;margin-bottom:25px}
.lx-kicker{font-size:9px;letter-spacing:2.3px;color:#ffd7a4}
.lx-plan-heading h2{font-size:clamp(24px,2.7vw,34px);font-weight:700;letter-spacing:-1px;margin:8px 0 0;color:#fff}
.lx-plans{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;align-items:stretch;padding:8px 0 0;max-width:1100px;margin:0 auto}
.lx-plan{--tint:180,188,210;position:relative;display:grid;grid-template-rows:auto auto 1fr auto auto;min-height:370px;padding:24px;
  background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(246,247,255,.88));border:1px solid rgba(255,255,255,.72);border-radius:20px;box-shadow:0 24px 60px #0004;backdrop-filter:blur(10px);text-align:left;min-width:0;outline:none;isolation:isolate;
  transition:transform .28s ease,filter .28s ease}
.lx-plan:hover,.lx-plan:focus-within,.lx-plan:focus{transform:translateY(-8px);filter:drop-shadow(0 28px 44px rgba(var(--tint),.13))}
.lx-plan:focus-visible{outline:2px solid rgba(var(--tint),.72);outline-offset:10px;border-radius:32px}
.lx-ghost-plan{--tint:203,214,255}
.lx-creator-plan{--tint:255,182,89;background:linear-gradient(180deg,#fffdf8,#fff3df);border-color:#ffc772;box-shadow:0 30px 80px #ffb25938,0 0 0 2px #ffbd62}
.lx-studio-plan{--tint:181,136,255}
.lx-plan-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:18px;font-size:9px;font-weight:800;letter-spacing:1.65px;color:#69708c}
.lx-pick{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:#fff0d8;color:#9a5b05;font-size:9px;letter-spacing:0}
.lx-studio-badge{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:linear-gradient(180deg,#f1e9ff,#ddd0ff);color:#7b4ee6;box-shadow:inset 0 1px #fff,0 8px 18px #7b4ee62b}
.lx-plan h3{font-size:26px;font-weight:800;letter-spacing:-.9px;margin:20px 0 8px;color:#171925}
.lx-description{font-size:13px;line-height:1.55;color:#596074;min-height:62px;margin:0 0 18px}
.lx-price{display:flex;align-items:baseline;justify-content:flex-start;gap:9px;font-size:23px;letter-spacing:-.5px;font-weight:850;min-height:31px;color:#171925}
.lx-price small{font-size:12px;font-weight:700;color:#8a627d;letter-spacing:0}
.lx-soon{font-size:18px;align-items:center;letter-spacing:-.3px}
.lx-divider{height:1px;background:linear-gradient(90deg,rgba(var(--tint),.23),rgba(var(--tint),.03));margin:20px 0}
.lx-plan ul{display:flex;flex-direction:column;gap:12px;padding:0;margin:0 0 20px;list-style:none}
.lx-plan li{display:flex;align-items:flex-start;gap:9px;font-size:12px;line-height:1.5;color:#2b3040}
.lx-plan li svg{width:14px;height:14px;flex-shrink:0;margin-top:1px;color:rgb(var(--tint));stroke-width:1.6}
.lx-inset{display:flex;gap:10px;align-items:flex-start;background:rgba(var(--tint),.04);border:1px solid rgba(var(--tint),.09);border-radius:11px;padding:12px;color:#a0a6b9;font-size:10px;line-height:1.6;margin:1px 0 20px}
.lx-inset svg{flex-shrink:0;margin-top:2px}
.lx-inset strong{display:block;color:#d8c8f7;font-size:11px;margin-bottom:3px;font-weight:500}
.lx-planned{font-size:8px;letter-spacing:1.5px;color:#948aa9;margin:-3px 0 13px}
.lx-plan>.lx-divider,.lx-plan>.lx-inset,.lx-plan>.lx-planned{display:none}
.lx-plan-bottom{margin-top:auto;padding-top:16px}
.lx-button{width:100%;min-height:48px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid rgba(var(--tint),.24);border-radius:14px;background:#171925;color:#fff;font-size:12px!important;font-weight:750!important;transition:background .2s,box-shadow .2s,border-color .2s}
.lx-button svg{flex-shrink:0}
.lx-button:not(:disabled):hover{background:#25293a;border-color:rgba(var(--tint),.46)}
.lx-button:disabled{color:#8a8392;background:#edeaf4;border-color:#d8d2e5}
.lx-ghost-button{background:#f1f4ff!important;color:#05070d!important;border-color:#d7def8}
.lx-creator-button{position:relative;overflow:hidden;background:linear-gradient(180deg,#ffd295,#ffad4f)!important;color:#231204!important;border-color:#ffe0b670;box-shadow:inset 0 1px #fff0d7a8,0 9px 28px #ffab4322,0 0 0 1px #ffcc8420;font-size:13px!important}
.lx-creator-button:before{content:"";position:absolute;inset:-1px;transform:translateX(-120%);background:linear-gradient(105deg,transparent 25%,#fff3d970 50%,transparent 72%);transition:transform .55s ease}
.lx-creator-button:hover:not(:disabled){box-shadow:inset 0 1px #fff0d7a8,0 12px 35px #ffab4342,0 0 0 1px #ffcc8438}
.lx-creator-button:hover:not(:disabled):before{transform:translateX(120%)}
.lx-creator-button>*{position:relative;z-index:1}
.lx-creator-button:disabled{opacity:.6}
.lx-plan-bottom>small{display:block;text-align:center;font-size:9px;line-height:1.6;color:#6f7484;margin-top:11px}
.lx-footer-note{text-align:center;color:#d7dbea;font-size:10px;margin:21px 0 0}
.lx-back-public{position:absolute;right:clamp(18px,3vw,38px);bottom:clamp(18px,3vw,34px);z-index:30;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 15px;border:1px solid #ffffff24;border-radius:999px;background:#ffffff12;color:#f8f4ea;font-size:12px!important;font-weight:750!important;box-shadow:0 16px 44px #0008;backdrop-filter:blur(16px);transition:background .18s,border-color .18s,transform .18s,opacity .18s}
.lx-back-public:hover:not(:disabled){background:#ffffff1f;border-color:#ffffff3a;transform:translateY(-1px)}
.lx-back-public:disabled{opacity:.72;cursor:wait}
.lx-object{display:none!important}
.lx-object svg{width:100%;height:100%;overflow:visible}
.lx-object-ghost:before{content:"";position:absolute;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,#ffffff24,transparent 62%);filter:blur(18px);opacity:.75}
.lx-object-ghost:after{content:"";position:absolute;left:28px;right:28px;bottom:25px;height:26px;background:radial-gradient(ellipse,#b8c7ff29,transparent 72%);filter:blur(10px);opacity:.55}
.lx-ghost-shape{width:278px;height:290px;filter:drop-shadow(0 0 34px #cbd7ff30) drop-shadow(0 22px 38px #0008);animation:lx-float 6.4s ease-in-out infinite}
.lx-ghost-body{fill:url(#ghostGlow);stroke:#eef3ff75;stroke-width:1.6}
.lx-ghost-under{fill:#050711;opacity:calc(var(--ghost-open) * .62);filter:drop-shadow(0 0 18px #ffb25926);transition:opacity .18s ease}
.lx-ghost-skin-open{fill:#e8eeff42;stroke:#f5f7ff70;stroke-width:1.1;opacity:var(--ghost-open);transform-box:fill-box;transform-origin:151px 52px;
  transform:translate(calc(var(--ghost-open) * 18px),calc(var(--ghost-open) * 3px)) rotate(calc(var(--ghost-open) * 10deg));transition:opacity .16s ease,transform .16s ease}
.lx-ghost-zip-open{fill:none;stroke:#050711;stroke-width:calc(var(--ghost-open) * 17);stroke-linecap:round;opacity:calc(var(--ghost-open) * .5);transition:stroke-width .14s ease,opacity .14s ease}
.lx-ghost-zip-track{fill:none;stroke:#ffb259;stroke-width:2.2;stroke-linecap:round;stroke-dasharray:4 7;filter:drop-shadow(0 0 8px #ffb25980);opacity:var(--ghost-zip);transition:opacity .14s ease}
.lx-ghost-zip-teeth path{fill:none;stroke:#f8d6a4;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;opacity:var(--ghost-zip);transition:opacity .14s ease}
.lx-ghost-zip-pull{fill:#ffb259;stroke:#ffe2b5;stroke-width:1;filter:drop-shadow(0 0 9px #ffb25980);opacity:var(--ghost-zip);
  transform:translate(calc(var(--ghost-open) * -13px),calc(var(--ghost-open) * 114px)) rotate(calc(var(--ghost-open) * -18deg));transition:transform .12s ease,opacity .14s ease}
.lx-ghost-face ellipse{fill:#070914;filter:drop-shadow(0 0 13px #ffb259b5)}
.lx-ghost-pupil-left,.lx-ghost-pupil-right{fill:#ffb259;transform:translate(calc(var(--mx)*.12px),calc(var(--my)*.12px));transition:transform .16s ease}
.lx-ghost-mouth-soft{fill:none;stroke:#070914;stroke-width:8;stroke-linecap:round;transition:opacity .16s}
.lx-ghost-mouth-grin{fill:#0b0d17;opacity:0;transition:opacity .16s}
.lx-ghost-mouth-grin{display:none}
.lx-mini-ghost{position:absolute;display:grid;place-items:center;color:#e9eeff;width:44px;height:54px;border-radius:22px 22px 16px 16px;background:linear-gradient(180deg,#ffffff2e,#b8c9ff12);border:1px solid #ffffff32;box-shadow:0 0 24px #b9c7ff28;animation:lx-float 5s ease-in-out infinite}
.lx-mini-ghost:before,.lx-mini-ghost:after{content:"";position:absolute;top:20px;width:5px;height:6px;border-radius:50%;background:#0a0d17}
.lx-mini-ghost:before{left:14px}.lx-mini-ghost:after{right:14px}
.lx-mini-ghost-a{left:-4px;top:74px;animation-delay:-1.4s}.lx-mini-ghost-b{right:5px;top:32px;width:35px;height:43px;animation-delay:-2.6s}
.lx-engine,.lx-frame,.lx-crystal{transition:transform .28s cubic-bezier(.4,0,.2,1),filter .28s}
.lx-engine-body{fill:url(#engineBody);stroke:#ffd09a73;stroke-width:1.4}
.lx-engine-wing-left,.lx-engine-wing-right{fill:#ffb25926;stroke:#ffcb8e5f;stroke-width:1.2;transform-box:fill-box;transform-origin:center}
.lx-engine-core{fill:#0b0d17;stroke:#ffd79d75;stroke-width:1.1;filter:drop-shadow(0 0 20px #ffb25972)}
.lx-engine-rim{fill:none;stroke:#ffcf9366;stroke-width:1.1}
.lx-engine-lens{fill:#02030a;filter:drop-shadow(0 0 22px #ffb2594d)}
.lx-engine-aperture{fill:#ffcc8d1f;stroke:#ffd19652}
.lx-engine-beam{fill:url(#engineBody);opacity:.12;filter:blur(8px);transform-origin:140px 126px;transform:scaleY(.7)}
.lx-engine-spark{fill:#ffb259}
.lx-frame{position:absolute;width:94px;height:116px;border:1px solid #ffd8a642;border-radius:11px;background:linear-gradient(160deg,#ffffff18,#ffffff04);box-shadow:0 18px 28px #0008,0 0 22px #ffb25917;display:grid;place-items:center;color:#ffe0ba;font-weight:650}
.lx-frame-image{left:8px;top:22px;transform:rotate(-12deg)}.lx-frame-video{right:8px;top:47px;transform:rotate(12deg)}
.lx-object-creator:hover .lx-engine,.lx-creator-plan:focus .lx-engine,.lx-creator-plan:focus-within .lx-engine{filter:drop-shadow(0 0 38px #ffb25948)}
.lx-object-creator:hover .lx-engine-wing-left,.lx-creator-plan:focus .lx-engine-wing-left,.lx-creator-plan:focus-within .lx-engine-wing-left{transform:translate(-16px,-7px) rotate(-7deg)}
.lx-object-creator:hover .lx-engine-wing-right,.lx-creator-plan:focus .lx-engine-wing-right,.lx-creator-plan:focus-within .lx-engine-wing-right{transform:translate(16px,7px) rotate(7deg)}
.lx-object-creator:hover .lx-frame-image,.lx-creator-plan:focus .lx-frame-image,.lx-creator-plan:focus-within .lx-frame-image{transform:translate(-15px,-11px) rotate(-16deg)}
.lx-object-creator:hover .lx-frame-video,.lx-creator-plan:focus .lx-frame-video,.lx-creator-plan:focus-within .lx-frame-video{transform:translate(16px,10px) rotate(16deg)}
.lx-crystal-shell{fill:url(#crystalFill);stroke:#cab0ff71;stroke-width:1.4}
.lx-crystal{filter:drop-shadow(0 0 30px #a98aff25) drop-shadow(0 24px 40px #0009)}
.lx-crystal-core{fill:url(#crystalFill);filter:drop-shadow(0 0 24px #a98aff7a);animation:lx-pulse 3.8s ease-in-out infinite}
.lx-crystal-face{opacity:.2}.lx-crystal-face-left{fill:#ffffff}.lx-crystal-face-right{fill:#1d0f39}
.lx-crystal-lines{fill:none;stroke:#d6c4ff70;stroke-width:1}
.lx-satellite text{font-size:8px;letter-spacing:1px;fill:#cdbbff}
.lx-satellite rect{fill:#b58cff14;stroke:#c4a8ff45}
.lx-satellite path{stroke:#9f86d9;stroke-width:1.1}
.lx-object-studio line{stroke:#bda5ee55;stroke-width:1}
.lx-hotspot{position:absolute;z-index:4;border:0;background:transparent;border-radius:999px;padding:0;cursor:help}
.lx-hotspot:focus-visible{outline:2px solid rgba(var(--tint),.8);outline-offset:3px}
.lx-hotspot-one{left:20px;top:34px;width:105px;height:92px}
.lx-hotspot-two{right:18px;top:56px;width:110px;height:104px}
.lx-hotspot-three{left:62px;bottom:38px;width:142px;height:82px}
.lx-hotspot-four{right:44px;bottom:40px;width:118px;height:74px}
.lx-bubble{position:absolute;z-index:5;max-width:150px;padding:9px 12px;border:1px solid rgba(var(--tint),.32);background:rgba(11,13,23,.8);backdrop-filter:blur(14px);
  color:#eef2ff;font-size:10px;line-height:1.25;border-radius:24px 16px 22px 18px;box-shadow:0 13px 28px #0008,0 0 24px rgba(var(--tint),.13);
  opacity:0;transform:translateY(10px) scale(.92);transition:opacity .2s ease,transform .2s ease,border-color .2s ease;pointer-events:none}
.lx-bubble-one{left:-12px;top:22px}.lx-bubble-two{right:-18px;top:112px;border-radius:16px 24px 18px 24px}
.lx-bubble-three{left:20px;bottom:18px;border-radius:26px 16px 20px 20px}.lx-bubble-four{right:8px;bottom:34px}
.lx-hotspot:hover + .lx-bubble,.lx-hotspot:focus + .lx-bubble{opacity:1;transform:none}
.lx-object-creator .lx-hotspot-one{left:5px;top:18px}.lx-object-creator .lx-hotspot-two{right:6px;top:43px}
.lx-object-creator .lx-hotspot-three{left:87px;bottom:72px}.lx-object-creator .lx-hotspot-four{right:54px;bottom:18px}
.lx-object-studio .lx-hotspot-one{left:58px;top:44px}.lx-object-studio .lx-hotspot-two{right:14px;top:52px}
.lx-object-studio .lx-hotspot-three{left:88px;bottom:44px}
.lx-object-ghost .lx-hotspot-one{left:-8px;top:118px;width:64px;height:70px}
.lx-object-ghost .lx-hotspot-two{right:-6px;top:104px;width:62px;height:74px}
.lx-object-ghost .lx-hotspot-three{left:112px;bottom:0;width:88px;height:44px}
.lx-object-ghost .lx-bubble-one{left:-20px;top:82px}
.lx-object-ghost .lx-bubble-two{right:-22px;top:92px}
.lx-object-ghost .lx-bubble-three{left:96px;bottom:46px}
.lx-art{height:145px;position:relative;margin-top:18px;border-radius:13px;overflow:hidden;border:1px solid rgba(var(--tint),.08);background:radial-gradient(ellipse at center,rgba(var(--tint),.065),transparent 75%)}
.lx-art-caption{position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:7px;letter-spacing:.8px;color:#9298ac}
.lx-mini-dashboard{position:absolute;left:15%;top:21px;width:70%;height:88px;border:1px solid #d1dbf02b;border-radius:7px;background:#c3cce407;transform:perspective(400px) rotateY(-13deg) rotateX(8deg)}
.lx-mini-nav{display:flex;gap:3px;padding:7px;border-bottom:1px solid #ffffff0d}
.lx-mini-nav i{width:3px;height:3px;border-radius:50%;background:#c2cce960}
.lx-mini-body{display:flex;gap:8px;padding:8px}
.lx-mini-sidebar{width:25%;display:flex;flex-direction:column;gap:6px}
.lx-mini-sidebar i{height:3px;width:90%;background:#d9e0f32b;border-radius:2px}
.lx-mini-output{display:grid;place-items:center;width:75%;height:46px;background:#c0cde70a;border:1px solid #c8d2e919;border-radius:4px;color:#8a94af}
.lx-ghost-orb{position:absolute;left:calc(50% - 25px);top:36px;width:50px;height:58px;display:grid;place-items:center;color:#e0e4f4;background:#aab6d014;border-radius:50%;backdrop-filter:blur(3px);filter:drop-shadow(0 0 14px #b7c4ee40);animation:lx-ghost 5s ease-in-out infinite}
.lx-creative{position:absolute;width:75px;height:98px;border-radius:5px;overflow:hidden;border:1px solid #ffffff20;transition:transform .4s}
.lx-creative-back{left:51%;top:13px;transform:rotate(11deg);background:linear-gradient(140deg,#2c3045,#6b5b60);padding:6px;color:#e9dbd1}
.lx-creative-front{left:27%;top:9px;transform:rotate(-8deg);background:radial-gradient(ellipse at center,#cf9f70,#71513d);box-shadow:8px 8px 18px #0005;text-align:center}
.lx-creative-front>span{display:block;font-size:6px;letter-spacing:2px;color:#35291f;margin-top:8px}
.lx-creative-front>small{position:absolute;bottom:7px;left:0;right:0;font-size:4px;letter-spacing:.7px;color:#f1d9c0}
.lx-product-bottle{position:absolute;left:calc(50% - 13px);top:30px;width:26px;height:43px;background:linear-gradient(90deg,#624320,#c29252 28%,#dbb472 46%,#866133);border-radius:5px 5px 7px 7px;box-shadow:6px 9px 9px #24170966}
.lx-product-bottle:before{content:"";position:absolute;width:17px;height:9px;background:linear-gradient(90deg,#26211e,#51453b,#211c19);top:-8px;left:4px;border-radius:2px}
.lx-product-bottle:after{content:"FORM";position:absolute;left:3px;right:3px;top:17px;text-align:center;background:#ede1c5d9;color:#433a2b;font-size:4px;letter-spacing:1px;padding:5px 0}
.lx-prompt-chip{position:absolute;bottom:23px;left:9%;right:9%;display:flex;justify-content:center;align-items:center;gap:6px;padding:7px 4px;border:1px solid #ffd3a326;border-radius:6px;background:#17151bf2;color:#d9bda0;font-size:7px}
.lx-creator-plan:hover .lx-creative-back{transform:translate(5px,-2px) rotate(15deg)}
.lx-creator-plan:hover .lx-creative-front{transform:translate(-4px,-2px) rotate(-11deg)}
.lx-campaign-source{position:absolute;left:10%;top:41px;width:51px;height:51px;border:1px solid #c5a4f838;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:#b596e810;color:#c7b4ec}
.lx-campaign-source span{font-size:5px;letter-spacing:1px}
.lx-connections{position:absolute;inset:0;width:100%;height:130px}
.lx-connections path{fill:none;stroke:#b29ad05c;stroke-width:1;transition:stroke .4s}
.lx-studio-plan:hover .lx-connections path{stroke:#d0b6ff}
.lx-campaign-outputs{position:absolute;right:7%;top:15px;display:flex;flex-direction:column;gap:8px}
.lx-campaign-outputs>span{display:flex;align-items:center;gap:7px;width:68px;height:25px;padding:0 8px;border:1px solid #bfa3ed25;background:#1c192a;border-radius:5px;font-size:8px;color:#b9adce}
.lx-notice{position:absolute;z-index:20;top:77px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:15px;max-width:calc(100% - 30px);width:max-content;background:#181c2af5;border:1px solid #ffffff25;border-radius:12px;padding:12px 16px;font-size:12px;box-shadow:0 10px 40px #0007}
.lx-notice button,.lx-preview-top button{background:none;border:0;display:grid;place-items:center;padding:4px}
.lx-preview-dialog{color:#f1f2f8;background:#10131e;border:1px solid #b4bdd433;border-radius:22px;width:min(740px,calc(100% - 32px));max-height:85dvh;overflow:auto;padding:28px;box-shadow:0 35px 140px #000b}
.lx-preview-dialog::backdrop{background:#030510ba;backdrop-filter:blur(10px)}
.lx-preview-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.lx-preview-top>span{display:flex;align-items:center;gap:9px;font-size:13px}
.lx-preview-top small{font-size:8px;letter-spacing:1px;color:#99a5bf}
.lx-preview-dialog h2{font-size:26px;font-weight:500;letter-spacing:-1px;margin:28px 0 10px}
.lx-preview-dialog>p{font-size:12px;color:#9da6bd;line-height:1.7}
.lx-preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:25px 0}
.lx-preview-controls textarea{display:block;width:100%;height:110px;resize:none;background:#ffffff04;color:#919bb1;border:1px solid #ffffff14;border-radius:10px;padding:12px;font:inherit;font-size:12px;line-height:1.6;margin:12px 0}
.lx-preview-tags{display:flex;gap:5px;margin-bottom:16px}
.lx-preview-tags span{font-size:9px;border:1px solid #ffffff16;border-radius:5px;padding:5px 8px;color:#a6b0c4}
.lx-preview-output{--tint:255,182,102;display:flex;flex-direction:column;justify-content:center;border:1px solid #ffffff12;border-radius:12px;background:#ffffff03}
.lx-preview-output .lx-art{border:0;margin:0;height:170px}
.lx-preview-output>span{text-align:center;font-size:9px;color:#929ab0;padding:8px}
.lx-spin{animation:lx-rotate 1s linear infinite}
.lx-paused *{animation-play-state:paused!important}
@keyframes lx-travel{from{transform:translate3d(-35px,-35px,0)}to{transform:translate3d(80px,75px,0)}}
@keyframes lx-rotate{to{transform:rotate(360deg)}}
@keyframes lx-cloud{to{transform:translate(45px,25px) rotate(-18deg)}}
@keyframes lx-ghost{50%{transform:translateY(-4px)}}
@keyframes lx-float{50%{transform:translateY(-10px) rotate(1deg)}}
@keyframes lx-pulse{50%{opacity:.65;transform:scale(1.05)}}
@keyframes lx-card-flow{50%{transform:translateY(-18px) rotate(3deg);opacity:.82}}
@keyframes lx-watercolor-flow{0%{transform:translate(-4%,-2%) scale(1.12) rotate(0deg)}35%{transform:translate(3%,-1%) scale(1.18) rotate(3deg)}70%{transform:translate(1%,4%) scale(1.15) rotate(-2deg)}100%{transform:translate(-2%,2%) scale(1.2) rotate(2deg)}}
@keyframes lx-wheel{50%{transform:translateY(6px);opacity:.3}}
@keyframes lx-stage-float{50%{transform:perspective(900px) rotateY(14deg) rotateX(2deg) translateY(-12px)}}
@keyframes lx-orbit{to{transform:rotateX(63deg) rotateZ(378deg)}}
@keyframes lx-fire-breathe{to{opacity:.35;transform:scale(1.08)}}
@media(min-width:1000px) and (max-height:820px){
  .lx-header{padding:20px 35px}
  .lx-plan-layer{top:67px}
  .lx-plan-heading{margin-bottom:15px}
  .lx-plan{min-height:320px;padding:18px}
  .lx-creator-plan{min-height:320px;padding-top:18px}
  .lx-art{height:126px;margin-top:13px}
  .lx-plan h3{font-size:25px;margin-top:8px}
  .lx-description{margin-bottom:10px}
  .lx-divider{margin:14px 0}
  .lx-plan ul{gap:9px;margin-bottom:15px}
  .lx-inset{margin-bottom:12px;padding:9px}
}
@media(max-width:980px){
  .lx-plan-panel{width:100%;padding:34px 22px 24px}
  .lx-plans{grid-template-columns:1fr;gap:18px;padding-top:12px}
  .lx-plan{min-height:auto;padding:20px}
  .lx-creator-plan{margin-top:0}
  .lx-art{height:145px;max-width:330px;width:100%;align-self:center}
  .lx-description{min-height:0}
  .lx-plan li{font-size:13px}
  .lx-plan-bottom>small{font-size:10px}
  .lx-footer-note{display:none}
  .lx-back-public{right:16px;bottom:16px;min-height:46px;padding:0 16px}
  .lx-header-actions button{font-size:0!important;width:36px;padding:0}
  .lx-header-actions button::first-letter{font-size:11px}
  .lx-rock-4,.lx-rock-5,.lx-rock-6,.lx-rock-7{display:none}
}
@media(max-width:540px){
  .lx-header{padding:20px}
  .lx-brand{top:28px;font-size:18px}
  .lx-brand>span{width:28px;height:28px}
  .lx-plan-layer{top:0;bottom:0}
  .lx-plan-panel{width:100%;padding:104px 14px 20px}
  .lx-plan-heading{align-items:flex-start}
  .lx-plan-heading h2{font-size:21px;max-width:210px}
  .lx-intro h1{font-size:clamp(36px,10vw,54px)}
  .lx-intro>p{font-size:13px}
  .lx-intro-label{font-size:8px;letter-spacing:2px}
  .lx-intro-scene{width:105vw;height:55vh;transform:translate(-50%,-57%) rotate(-4deg);opacity:.6}
  .lx-product-stage{left:23%;top:10%;width:45%;height:65%}.lx-prompt-card{right:0;bottom:8%;width:185px;padding:12px}.lx-prompt-card strong{font-size:10px}
  .lx-preview-grid{grid-template-columns:1fr}
  .lx-preview-dialog{padding:20px}
  .lx-preview-top small{display:none}
}
@media(prefers-reduced-motion:reduce){
  .lx *,.lx *::before,.lx *::after{animation:none!important;transition:none!important}
  .lx-space{transform:none}
}
`;
