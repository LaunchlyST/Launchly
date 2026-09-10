import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
        context.fillStyle = `rgba(214,226,255,${star.alpha * twinkle})`;
        context.arc(x, star.y * height, star.radius, 0, Math.PI * 2);
        context.fill();

        if (index % 37 === 0) {
          context.fillStyle = 'rgba(195,211,255,0.12)';
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
      <span className="lx-art-caption">Campaign Studio · Concept preview</span>
    </div>
  );
}

export function InsidePage() {
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
      const next = reduced.matches
        ? targetRef.current
        : current + (targetRef.current - current) * (1 - Math.exp(-dt / 100));

      progressRef.current =
        Math.abs(next - targetRef.current) < 0.0005 ? targetRef.current : next;

      const p = progressRef.current;
      const reveal = clamp((p - 0.36) / 0.44);
      root.style.setProperty('--zoom', String(p));
      root.style.setProperty('--reveal', String(reveal));
      root.style.setProperty('--intro', String(clamp(1 - p / 0.34)));

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

      targetRef.current = clamp(targetRef.current + delta * 0.0017);
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
      setNotice('Confirming your subscription…');
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

  return (
    <main className="lx" ref={rootRef}>
      <style>{styles}</style>
      <SpaceBackground />

      <header className="lx-header">
        <a className="lx-brand" href="/" aria-label="Launchly home">
          <span><Sparkles size={17} /></span> launchly
        </a>
        <span className="lx-header-note"><i /> A universe of possibilities</span>
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
        <div className="lx-intro-label"><span /> YOUR CREATIVE UNIVERSE</div>
        <h1>Small idea.<br /><em>Infinite possibilities.</em></h1>
        <p>A new space for your next creation.<br />Choose your access. Make something worth sharing.</p>
        <button className="lx-enter" onClick={() => goTo(1)}>
          Explore the plans <ArrowRight size={17} />
        </button>
        <span className="lx-scroll-hint"><span className="lx-mouse"><i /></span> Scroll to travel closer</span>
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
              <span className="lx-kicker">CHOOSE YOUR ORBIT</span>
              <h2>Your next chapter starts here.</h2>
            </div>
            <button className="lx-back" onClick={() => goTo(0)}>
              <ArrowLeft size={15} /> Back to space
            </button>
          </div>

          <div className="lx-plans">
            <article className="lx-plan lx-ghost-plan">
              <div className="lx-plan-top"><span>01 / EXPLORE</span><Ghost size={17} /></div>
              <PlanArtwork kind="ghost" />
              <h3>Ghost Mode</h3>
              <p className="lx-description">Look around. Discover what you could create.</p>
              <div className="lx-price">Free <small>preview access</small></div>
              <div className="lx-divider" />
              <ul>
                <li><Eye /> Explore a read-only preview</li>
                <li><Eye /> View example creations</li>
                <li><Eye /> Discover the workspace</li>
              </ul>
              <div className="lx-inset"><LockKeyhole size={15} /><span>Preview only. Upgrade to create, edit, save and export.</span></div>
              <div className="lx-plan-bottom">
                <button className="lx-button lx-ghost-button" onClick={() => setPreviewOpen(true)}>
                  Enter Ghost Mode <ArrowRight size={15} />
                </button>
                <small>A look inside. No creation access.</small>
              </div>
            </article>

            <article className="lx-plan lx-creator-plan">
              <div className="lx-plan-top"><span>02 / CREATE</span><span className="lx-pick"><Crown size={12} /> Creator pick</span></div>
              <PlanArtwork kind="creator" />
              <h3>Creator</h3>
              <p className="lx-description">Turn your products into content worth sharing.</p>
              <div className="lx-price">£5 <small>/ month</small></div>
              <div className="lx-divider" />
              <ul>
                <li><Check /> Generate product images</li>
                <li><Check /> Videos with supported providers</li>
                <li><Check /> Choose supported styles and formats</li>
                <li><Check /> Download your creations</li>
                <li><Check /> Connect your own API keys</li>
              </ul>
              <div className="lx-plan-bottom">
                <button
                  className="lx-button lx-creator-button"
                  disabled={checkoutLoading || loading}
                  onClick={() => void checkout()}
                >
                  {checkoutLoading ? <><Loader2 className="lx-spin" size={17} /> Opening…</> :
                    <>{isActive ? 'Manage subscription' : 'Get Creator Access'}<ArrowRight size={16} /></>}</button>
                <small>Provider API usage is billed separately.</small>
              </div>
            </article>

            <article className="lx-plan lx-studio-plan">
              <div className="lx-plan-top"><span>03 / EXPAND</span><Layers size={17} /></div>
              <PlanArtwork kind="studio" />
              <h3>Studio</h3>
              <p className="lx-description">Bring your entire campaign together.</p>
              <div className="lx-price lx-soon">Coming soon</div>
              <div className="lx-divider" />
              <span className="lx-planned">PLANNED FOR STUDIO</span>
              <ul>
                <li><Check /> Everything in Creator</li>
                <li><Check /> Saved brand presets</li>
                <li><Check /> Multiple creative variations</li>
                <li><Check /> Early access to new tools</li>
              </ul>
              <div className="lx-inset lx-studio-inset"><Layers size={18} /><span><strong>Campaign Studio</strong>One product. A coordinated set of creatives.</span></div>
              <div className="lx-plan-bottom">
                <button className="lx-button" disabled>Coming soon <LockKeyhole size={14} /></button>
                <small>Your complete workspace. In development.</small>
              </div>
            </article>
          </div>
          <p className="lx-footer-note">Scroll up to return to space · Creator subscriptions can be cancelled through billing</p>
        </div>
      </div>

      {previewOpen && (
        <GhostPreview onClose={() => setPreviewOpen(false)} />
      )}
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
          <textarea disabled value="Create a premium product image with warm studio lighting…" readOnly />
          <div className="lx-preview-tags"><span>Image</span><span>9:16</span><span>Studio light</span></div>
          <button className="lx-button" disabled><LockKeyhole size={15} /> Generation locked</button>
        </div>
        <div className="lx-preview-output">
          <PlanArtwork kind="creator" />
          <span>Example output · Not a generated project</span>
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
.lx-header{position:absolute;left:0;right:0;top:0;padding:27px 42px;display:flex;align-items:center;justify-content:space-between;z-index:5}
.lx-brand{display:flex;gap:10px;align-items:center;text-decoration:none;color:#f3f4fb;font-size:23px;font-weight:650;letter-spacing:-1px}
.lx-brand>span{display:grid;place-items:center;width:32px;height:32px;border:1px solid #ffffff26;border-radius:10px;background:#ffffff08;color:#ffd5a1}
.lx-header-note{font-size:11px;color:#a1a7bb;display:flex;gap:9px;align-items:center}
.lx-header-note i{width:5px;height:5px;border-radius:50%;background:#afbdde;box-shadow:0 0 9px #a5b7ff80}
.lx-intro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:90px 24px;text-align:center;
  opacity:var(--intro);transform:scale(calc(1 + var(--zoom)*.12));pointer-events:none}
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
.lx-plan-layer{position:absolute;inset:86px 0 18px;display:grid;place-items:center;pointer-events:none}
.lx-plan-panel{width:min(1160px,calc(100% - 56px));max-height:100%;overflow:auto;padding:12px 12px 8px;overscroll-behavior:contain;
  opacity:var(--reveal);transform:scale(calc(.94 + var(--reveal)*.06));scrollbar-width:thin;scrollbar-color:#ffffff25 transparent;outline:none}
.lx-plan-panel[aria-hidden="false"]{pointer-events:auto}
.lx-plan-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:25px}
.lx-kicker{font-size:9px;letter-spacing:2.3px;color:#a0a8c0}
.lx-plan-heading h2{font-size:clamp(20px,2.4vw,29px);font-weight:450;letter-spacing:-1px;margin:8px 0 0}
.lx-back{display:flex;gap:8px;align-items:center;font-size:11px!important;background:#080b1480;border:1px solid #ffffff19;border-radius:100px;padding:10px 13px;white-space:nowrap}
.lx-back:hover{background:#ffffff0e}
.lx-plans{display:grid;grid-template-columns:1fr 1.055fr 1fr;gap:18px;align-items:stretch;padding-top:10px}
.lx-plan{--tint:180,188,210;position:relative;display:flex;flex-direction:column;padding:24px;border-radius:23px;
  background:linear-gradient(145deg,rgba(var(--tint),.085),rgba(var(--tint),.015) 58%),rgba(10,13,24,.88);
  border:1px solid rgba(var(--tint),.22);box-shadow:0 24px 65px #0005,inset 0 1px 0 #ffffff08;
  backdrop-filter:blur(22px);text-align:left;min-width:0;transition:border-color .25s,box-shadow .25s}
.lx-plan:hover{border-color:rgba(var(--tint),.44);box-shadow:0 28px 70px #0006,inset 0 1px 0 #ffffff12}
.lx-ghost-plan:after{content:"";position:absolute;inset:7px;border:1px dashed #d2d8ef12;border-radius:17px;pointer-events:none}
.lx-creator-plan{--tint:255,182,102;margin-top:-10px;padding-top:34px;border-color:#ffbb704d;background:radial-gradient(ellipse at 50% 0%,#ffb45a14,transparent 55%),linear-gradient(160deg,#201b22,#101019 70%);box-shadow:0 24px 70px #0005,0 -3px 26px #ffb45a08}
.lx-studio-plan{--tint:185,155,244;background:radial-gradient(ellipse at 90% 0%,#b498ed14,transparent 60%),linear-gradient(150deg,#171522ed,#0c0e19f5)}
.lx-plan-top{display:flex;align-items:center;justify-content:space-between;gap:4px;min-height:18px;font-size:9px;font-weight:600;letter-spacing:1.65px;color:rgba(var(--tint),.8)}
.lx-pick{display:inline-flex;align-items:center;gap:4px;font-size:9px;letter-spacing:0;color:#ffc585}
.lx-plan h3{font-size:28px;font-weight:550;letter-spacing:-1px;margin:14px 0 8px}
.lx-description{font-size:12px;line-height:1.7;color:#a9adbd;min-height:41px;margin:0 0 15px}
.lx-price{display:flex;align-items:baseline;gap:9px;font-size:37px;letter-spacing:-1.5px;font-weight:500;min-height:46px}
.lx-price small{font-size:11px;font-weight:400;color:#9097aa;letter-spacing:0}
.lx-soon{font-size:27px;align-items:center;letter-spacing:-.8px}
.lx-divider{height:1px;background:linear-gradient(90deg,rgba(var(--tint),.23),rgba(var(--tint),.03));margin:20px 0}
.lx-plan ul{display:flex;flex-direction:column;gap:12px;padding:0;margin:0 0 20px;list-style:none}
.lx-plan li{display:flex;align-items:flex-start;gap:9px;font-size:11px;line-height:1.5;color:#d4d6e1}
.lx-plan li svg{width:14px;height:14px;flex-shrink:0;margin-top:1px;color:rgb(var(--tint));stroke-width:1.6}
.lx-inset{display:flex;gap:10px;align-items:flex-start;background:rgba(var(--tint),.04);border:1px solid rgba(var(--tint),.09);border-radius:11px;padding:12px;color:#a0a6b9;font-size:10px;line-height:1.6;margin:1px 0 20px}
.lx-inset svg{flex-shrink:0;margin-top:2px}
.lx-inset strong{display:block;color:#d8c8f7;font-size:11px;margin-bottom:3px;font-weight:500}
.lx-planned{font-size:8px;letter-spacing:1.5px;color:#948aa7;margin:-3px 0 13px}
.lx-plan-bottom{margin-top:auto;padding-top:5px}
.lx-button{width:100%;min-height:45px;padding:12px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #ffffff18;border-radius:11px;background:#ffffff07;font-size:12px!important;font-weight:550!important;transition:background .2s,box-shadow .2s}
.lx-button svg{flex-shrink:0}
.lx-button:not(:disabled):hover{background:#ffffff12}
.lx-button:disabled{color:#827e94;background:#ffffff04}
.lx-ghost-button{background:linear-gradient(180deg,#ffffff0d,#ffffff05);border-color:#ffffff20}
.lx-creator-button{background:linear-gradient(180deg,#ffc580,#ffaf57)!important;color:#2b1708!important;border-color:#ffd39c70;box-shadow:inset 0 1px #ffe8c985,0 5px 20px #ffab4310}
.lx-creator-button:hover:not(:disabled){box-shadow:inset 0 1px #ffe8c985,0 7px 25px #ffab432b}
.lx-creator-button:disabled{opacity:.6}
.lx-plan-bottom>small{display:block;text-align:center;font-size:9px;line-height:1.6;color:#81879c;margin-top:11px}
.lx-footer-note{text-align:center;color:#747d94;font-size:10px;margin:21px 0 0}
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
@keyframes lx-wheel{50%{transform:translateY(6px);opacity:.3}}
@media(min-width:1000px) and (max-height:820px){
  .lx-header{padding:20px 35px}
  .lx-plan-layer{top:67px}
  .lx-plan-heading{margin-bottom:15px}
  .lx-plan{padding:20px}
  .lx-creator-plan{padding-top:30px}
  .lx-art{height:126px;margin-top:13px}
  .lx-plan h3{font-size:25px;margin-top:11px}
  .lx-description{margin-bottom:10px}
  .lx-divider{margin:14px 0}
  .lx-plan ul{gap:9px;margin-bottom:15px}
  .lx-inset{margin-bottom:12px;padding:9px}
}
@media(max-width:980px){
  .lx-plan-panel{width:min(760px,calc(100% - 30px))}
  .lx-plans{grid-template-columns:1fr;gap:20px}
  .lx-plan{padding:26px}
  .lx-creator-plan{margin-top:0}
  .lx-art{height:145px;max-width:330px;width:100%;align-self:center}
  .lx-description{min-height:0}
  .lx-plan li{font-size:13px}
  .lx-plan-bottom>small{font-size:10px}
  .lx-footer-note{display:none}
  .lx-header-note{display:none}
  .lx-rock-4,.lx-rock-5,.lx-rock-6,.lx-rock-7{display:none}
}
@media(max-width:540px){
  .lx-header{padding:20px}
  .lx-plan-layer{top:66px;bottom:12px}
  .lx-plan-panel{width:calc(100% - 18px);padding:8px}
  .lx-plan-heading{align-items:flex-start}
  .lx-plan-heading h2{font-size:21px;max-width:210px}
  .lx-back{font-size:0!important;padding:10px}
  .lx-back svg{width:17px;height:17px}
  .lx-intro h1{font-size:clamp(36px,10vw,54px)}
  .lx-intro>p{font-size:13px}
  .lx-intro-label{font-size:8px;letter-spacing:2px}
  .lx-preview-grid{grid-template-columns:1fr}
  .lx-preview-dialog{padding:20px}
  .lx-preview-top small{display:none}
}
@media(prefers-reduced-motion:reduce){
  .lx *,.lx *::before,.lx *::after{animation:none!important;transition:none!important}
  .lx-space{transform:none}
}
`;

