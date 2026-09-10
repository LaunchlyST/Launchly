import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Flame, Waves, Crown } from 'lucide-react';

type Theme = 'signal' | 'fire' | 'ocean' | 'hood';

const CHAPTERS = [
  {
    id: 'fire',
    theme: 'fire' as Theme,
    kicker: '01 / FIRE',
    title: 'Ignite the creative.',
    body: 'Launchly turns product ideas into heat — prompts, images and video ads built for TikTok Shop affiliates who need scroll-stopping energy.',
    points: ['Prompt → image → video ad flow', 'Built for affiliate creatives', 'Download and post on your terms'],
  },
  {
    id: 'ocean',
    theme: 'ocean' as Theme,
    kicker: '02 / OCEAN',
    title: 'Go deeper on every idea.',
    body: 'Clear direction before you generate. Shape lighting, setting and camera move so every creative feels intentional — not random.',
    points: ['Guided creative controls', 'Illustrative demos you can feel', 'GBP 5/month access — AI usage separate'],
  },
  {
    id: 'hood',
    theme: 'hood' as Theme,
    kicker: '03 / HOOD',
    title: 'Make it look expensive.',
    body: 'Bold, premium, street-confident output. Create it, download it, post it — your product, your story, your feed.',
    points: ['Premium visual attitude', 'No auto-posting — you stay in control', 'Start creating in minutes'],
  },
];

const CHARS = 'Xx01$/>+*=#%@';

function mixTheme(theme: Theme, t: number) {
  if (theme === 'fire') {
    return {
      r: 255,
      g: Math.floor(40 + 140 * t),
      b: Math.floor(10 + 30 * (1 - t)),
    };
  }
  if (theme === 'ocean') {
    return {
      r: Math.floor(20 + 40 * (1 - t)),
      g: Math.floor(140 + 80 * t),
      b: Math.floor(200 + 55 * t),
    };
  }
  if (theme === 'hood') {
    return {
      r: Math.floor(180 + 60 * t),
      g: Math.floor(140 + 40 * t),
      b: Math.floor(60 + 20 * t),
    };
  }
  // signal / ascii electric blue burst
  return {
    r: Math.floor(180 + 75 * t),
    g: Math.floor(210 + 45 * t),
    b: 255,
  };
}

function AsciiField({
  theme,
  intensity,
  burst,
}: {
  theme: Theme;
  intensity: number;
  burst: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let cell = 10;
    let tick = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = Math.max(8, Math.floor(Math.min(w, h) / 72));
      cols = Math.ceil(w / cell) + 1;
      rows = Math.ceil(h / cell) + 1;
    };

    const draw = (now: number) => {
      tick = now * 0.001;
      ctx.fillStyle = '#02040a';
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5;
      const cy = h * 0.48;
      const maxR = Math.hypot(w, h) * 0.55;
      const pulse = reduced.matches ? 0.55 : 0.45 + 0.55 * Math.sin(tick * 1.6);
      const boom = Math.max(intensity, burst) * (0.75 + pulse * 0.35);

      ctx.font = `700 ${Math.floor(cell * 0.92)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = x * cell + cell * 0.5;
          const py = y * cell + cell * 0.5;
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.hypot(dx, dy) / maxR;
          const angle = Math.atan2(dy, dx);
          const ray = 0.55 + 0.45 * Math.cos(angle * 6 + tick * 2.2);
          const core = Math.exp(-dist * dist * (4.2 - boom * 1.8));
          const ripple = reduced.matches
            ? 0
            : 0.12 * Math.sin(dist * 18 - tick * 8 + angle * 3);
          let v = (core * ray + ripple) * (0.35 + boom * 0.9);
          v = Math.max(0, Math.min(1, v));
          if (v < 0.05) continue;

          const ch = CHARS[(x * 17 + y * 31 + Math.floor(tick * 10 + v * 20)) % CHARS.length];
          const c = mixTheme(theme, v);
          const a = 0.15 + v * 0.85;
          ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a})`;
          ctx.fillText(ch, px, py);
        }
      }

      // hot core
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.28);
      if (theme === 'fire') {
        g.addColorStop(0, `rgba(255,250,220,${0.35 * boom})`);
        g.addColorStop(0.35, `rgba(255,120,20,${0.18 * boom})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
      } else if (theme === 'ocean') {
        g.addColorStop(0, `rgba(220,250,255,${0.28 * boom})`);
        g.addColorStop(0.4, `rgba(40,180,255,${0.16 * boom})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
      } else if (theme === 'hood') {
        g.addColorStop(0, `rgba(255,230,170,${0.3 * boom})`);
        g.addColorStop(0.4, `rgba(180,120,40,${0.14 * boom})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        g.addColorStop(0, `rgba(255,255,255,${0.42 * boom})`);
        g.addColorStop(0.25, `rgba(170,220,255,${0.2 * boom})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [theme, intensity, burst]);

  return <canvas ref={canvasRef} className="fp2-ascii" aria-hidden="true" />;
}

export function FrontPage() {
  const rootRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [burst, setBurst] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setBurst(1), 180);
    const t2 = window.setTimeout(() => setReady(true), 900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = Math.max(1, el.scrollHeight - window.innerHeight);
        setProgress(Math.max(0, Math.min(1, window.scrollY / max)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const phase = useMemo(() => {
    if (progress < 0.12) return { theme: 'signal' as Theme, chapter: -1, local: progress / 0.12 };
    if (progress < 0.28) return { theme: 'fire' as Theme, chapter: -1, local: (progress - 0.12) / 0.16 };
    if (progress < 0.52) return { theme: 'fire' as Theme, chapter: 0, local: (progress - 0.28) / 0.24 };
    if (progress < 0.76) return { theme: 'ocean' as Theme, chapter: 1, local: (progress - 0.52) / 0.24 };
    return { theme: 'hood' as Theme, chapter: 2, local: (progress - 0.76) / 0.24 };
  }, [progress]);

  const intensity = phase.theme === 'signal' ? 0.55 + burst * 0.45 : 0.7 + phase.local * 0.25;

  return (
    <main
      ref={rootRef}
      className={`fp2 fp2-${phase.theme} ${ready ? 'is-ready' : ''}`}
      data-chapter={phase.chapter}
      style={{ ['--p' as string]: progress, ['--local' as string]: phase.local }}
    >
      <style>{styles}</style>

      <div className="fp2-stage" aria-hidden="true">
        <AsciiField theme={phase.theme} intensity={intensity} burst={burst} />
        <div className="fp2-vignette" />
        <div className="fp2-heat" />
        <div className="fp2-scan" />
      </div>

      <header className="fp2-header">
        <a className="fp2-brand" href="/">
          <span>◆</span> Launchly
        </a>
        <nav>
          <a href="#fire">Fire</a>
          <a href="#ocean">Ocean</a>
          <a href="#hood">Hood</a>
          <a href="/login">Sign in</a>
          <a className="fp2-cta" href="/signup">
            Get access <ArrowRight size={14} />
          </a>
        </nav>
      </header>

      <aside className="fp2-rail" aria-label="Story progress">
        <div className="fp2-rail-track">
          <i style={{ height: `${Math.max(8, progress * 100)}%` }} />
        </div>
        <ol>
          <li className={progress < 0.28 ? 'is-on' : ''}>
            <b>00</b>
            <span>Signal</span>
          </li>
          <li className={phase.chapter === 0 ? 'is-on' : progress >= 0.28 ? 'is-done' : ''}>
            <Flame size={12} />
            <span>Fire</span>
          </li>
          <li className={phase.chapter === 1 ? 'is-on' : progress >= 0.52 ? 'is-done' : ''}>
            <Waves size={12} />
            <span>Ocean</span>
          </li>
          <li className={phase.chapter === 2 ? 'is-on' : progress >= 0.76 ? 'is-done' : ''}>
            <Crown size={12} />
            <span>Hood</span>
          </li>
        </ol>
      </aside>

      <section className="fp2-intro" id="top">
        <p className="fp2-kicker">LAUNCHLY SIGNAL</p>
        <h1>
          A whole new
          <br />
          creative blast.
        </h1>
        <p className="fp2-lead">
          Crazy ASCII intro energy — then scroll into fire, ocean and hood worlds built for TikTok Shop creatives.
        </p>
        <div className="fp2-actions">
          <a className="fp2-primary" href="/signup">
            Start creating <ArrowRight size={16} />
          </a>
          <a className="fp2-secondary" href="#fire">
            Enter the drop
          </a>
        </div>
        <small>GBP 5/month access. AI usage charged separately.</small>
        <div className="fp2-scroll-hint">Scroll into the fire →</div>
      </section>

      <section className="fp2-bridge" aria-hidden="true">
        <div className="fp2-bridge-copy">
          <span>PART 02</span>
          <strong>Same grid. Now it burns.</strong>
        </div>
      </section>

      {CHAPTERS.map((chapter, index) => (
        <section
          key={chapter.id}
          id={chapter.id}
          className={`fp2-chapter fp2-chapter-${chapter.id}`}
        >
          <div
            className="fp2-slab"
            style={{ transform: `translate3d(${(1 - Math.min(1, Math.max(0, (progress - (0.28 + index * 0.24)) / 0.2))) * 40}px, 0, 0)` }}
          >
            <div className="fp2-box">
              <div className="fp2-box-edge" />
              <div className="fp2-box-edge fp2-box-edge-b" />
              <p className="fp2-kicker">{chapter.kicker}</p>
              <h2>{chapter.title}</h2>
              <p>{chapter.body}</p>
              <ul>
                {chapter.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <a href={index === 2 ? '/signup' : '/pricing'}>
                {index === 2 ? 'Get access — GBP 5/month' : 'See access'} <ArrowRight size={15} />
              </a>
            </div>
          </div>
          <div className="fp2-chapter-mark">{String(index + 1).padStart(2, '0')}</div>
        </section>
      ))}

      <footer className="fp2-footer">
        <div>
          <strong>Launchly</strong>
          <p>Create. Download. Post. Your affiliate creative system.</p>
        </div>
        <div className="fp2-actions">
          <a className="fp2-primary" href="/signup">
            Get access <ArrowRight size={16} />
          </a>
          <a className="fp2-secondary" href="/login">
            Sign in
          </a>
        </div>
      </footer>
    </main>
  );
}

const styles = `
.app--auth:has(.fp2),.app--inside:has(.fp2){height:auto!important;min-height:100vh;overflow:visible!important;background:#02040a!important}
.app--auth .app__main:has(.fp2),.app--inside .app__main:has(.fp2){height:auto!important;min-height:100vh;overflow:visible!important;display:block!important;padding:0!important;background:transparent!important}
.fp2{position:relative;color:#e8eef8;background:#02040a;font-family:Inter,ui-sans-serif,system-ui,sans-serif;min-height:420vh}
.fp2 *{box-sizing:border-box}
.fp2 a{color:inherit;text-decoration:none}
.fp2-stage{position:fixed;inset:0;z-index:0;pointer-events:none}
.fp2-ascii{width:100%;height:100%;display:block}
.fp2-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 10%,#02040acc 70%,#02040af2 100%)}
.fp2-heat{position:absolute;inset:0;opacity:0;transition:opacity .35s ease;background:
  radial-gradient(ellipse at 50% 60%,rgba(255,90,0,.18),transparent 45%),
  radial-gradient(ellipse at 30% 80%,rgba(255,40,0,.12),transparent 40%)}
.fp2-fire .fp2-heat{opacity:1;animation:fp2-ember 2.8s ease-in-out infinite alternate}
.fp2-ocean .fp2-heat{opacity:.7;background:radial-gradient(ellipse at 60% 70%,rgba(0,180,255,.16),transparent 50%),radial-gradient(ellipse at 20% 30%,rgba(40,255,220,.08),transparent 45%);animation:none}
.fp2-hood .fp2-heat{opacity:.75;background:radial-gradient(ellipse at 70% 40%,rgba(255,200,80,.14),transparent 45%),radial-gradient(ellipse at 20% 80%,rgba(120,60,20,.2),transparent 50%);animation:none}
.fp2-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 4px);mix-blend-mode:overlay;opacity:.35}
.fp2-header{position:fixed;top:0;left:0;right:0;z-index:30;display:flex;align-items:center;justify-content:space-between;padding:18px clamp(16px,4vw,40px);backdrop-filter:blur(10px);background:linear-gradient(#02040ae6,#02040a00)}
.fp2-brand{display:inline-flex;gap:10px;align-items:center;font-weight:800;letter-spacing:-.4px}
.fp2-brand span{color:#8ec5ff}
.fp2-fire .fp2-brand span{color:#ffb14a}
.fp2-ocean .fp2-brand span{color:#5ce1ff}
.fp2-hood .fp2-brand span{color:#f0c36a}
.fp2-header nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.fp2-header nav a{font-size:12px;font-weight:700;padding:8px 12px;border-radius:999px;color:#9aa6bc}
.fp2-header nav a:hover{color:#fff;background:#ffffff12}
.fp2-cta{display:inline-flex!important;gap:6px;align-items:center;background:#ffffff14!important;color:#fff!important;border:1px solid #ffffff22}
.fp2-rail{position:fixed;right:clamp(10px,2vw,28px);top:50%;transform:translateY(-50%);z-index:25;display:flex;gap:12px;align-items:center}
.fp2-rail-track{width:3px;height:min(42vh,320px);border-radius:99px;background:#ffffff14;overflow:hidden}
.fp2-rail-track i{display:block;width:100%;border-radius:99px;background:linear-gradient(180deg,#9ad0ff,#ffffff)}
.fp2-fire .fp2-rail-track i{background:linear-gradient(180deg,#ffb347,#ff4d00)}
.fp2-ocean .fp2-rail-track i{background:linear-gradient(180deg,#7af0ff,#1a6dff)}
.fp2-hood .fp2-rail-track i{background:linear-gradient(180deg,#ffe09a,#c48a2a)}
.fp2-rail ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.fp2-rail li{display:flex;align-items:center;gap:8px;min-height:28px;padding:6px 10px;border:1px solid #ffffff14;border-radius:12px;background:#070b14cc;color:#7f8aa0;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;backdrop-filter:blur(8px)}
.fp2-rail li.is-on{color:#fff;border-color:#ffffff35;box-shadow:0 0 24px #ffffff14}
.fp2-rail li.is-done{color:#c6d0e2}
.fp2-rail li b{font-size:9px;opacity:.7}
.fp2-intro,.fp2-bridge,.fp2-chapter,.fp2-footer{position:relative;z-index:2}
.fp2-intro{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:120px clamp(18px,6vw,80px) 80px;max-width:920px}
.fp2-kicker{font-size:11px;letter-spacing:.28em;font-weight:800;color:#9ec9ff;margin:0 0 18px}
.fp2-fire .fp2-kicker{color:#ffb14a}
.fp2-ocean .fp2-kicker{color:#6de7ff}
.fp2-hood .fp2-kicker{color:#f0c36a}
.fp2-intro h1{margin:0;font-size:clamp(48px,9vw,92px);line-height:.92;letter-spacing:-.06em;font-weight:900}
.fp2-lead{margin:22px 0 0;max-width:34rem;font-size:17px;line-height:1.6;color:#b7c0d2}
.fp2-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.fp2-primary,.fp2-secondary,.fp2-box a{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border-radius:999px;font-size:13px;font-weight:800}
.fp2-primary{background:linear-gradient(180deg,#f4f8ff,#c8d9ff);color:#071018}
.fp2-fire .fp2-primary{background:linear-gradient(180deg,#ffd39a,#ff7a18);color:#1a0a00}
.fp2-ocean .fp2-primary{background:linear-gradient(180deg,#d7f8ff,#39b7ff);color:#021018}
.fp2-hood .fp2-primary{background:linear-gradient(180deg,#ffe6ad,#d7a243);color:#1a1200}
.fp2-secondary{border:1px solid #ffffff28;background:#ffffff0d;color:#fff}
.fp2-intro small{margin-top:16px;color:#8090a8;font-size:12px}
.fp2-scroll-hint{margin-top:48px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#91a0b8;animation:fp2-nudge 1.8s ease-in-out infinite}
.fp2-bridge{min-height:70vh;display:grid;place-items:center;padding:40px 20px}
.fp2-bridge-copy{text-align:center}
.fp2-bridge-copy span{display:block;font-size:11px;letter-spacing:.3em;color:#ff9a4a;margin-bottom:12px;font-weight:800}
.fp2-bridge-copy strong{font-size:clamp(28px,5vw,48px);letter-spacing:-.04em}
.fp2-chapter{min-height:100vh;display:flex;align-items:center;padding:100px clamp(18px,5vw,72px);position:relative}
.fp2-slab{width:min(520px,100%)}
.fp2-box{position:relative;padding:28px 26px 26px;background:linear-gradient(160deg,#0b1220e8,#070b14f2);border:1px solid #ffffff1f;clip-path:polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px));box-shadow:0 30px 80px #000a, inset 0 1px #ffffff14;backdrop-filter:blur(16px)}
.fp2-box-edge{position:absolute;top:0;right:0;width:28px;height:28px;background:linear-gradient(135deg,#ffffff33,#ffffff00);clip-path:polygon(0 0,100% 0,100% 100%)}
.fp2-box-edge-b{top:auto;right:auto;left:0;bottom:0;clip-path:polygon(0 0,0 100%,100% 100%);background:linear-gradient(135deg,#ffffff00,#ffffff22)}
.fp2-box h2{margin:8px 0 14px;font-size:clamp(30px,4vw,44px);letter-spacing:-.045em;line-height:1}
.fp2-box p{margin:0;color:#b8c3d6;line-height:1.6;font-size:15px}
.fp2-box ul{margin:18px 0 22px;padding:0;list-style:none;display:grid;gap:10px}
.fp2-box li{position:relative;padding-left:18px;font-size:13px;color:#d5deee}
.fp2-box li:before{content:"";position:absolute;left:0;top:8px;width:8px;height:2px;background:currentColor;opacity:.7}
.fp2-box a{margin-top:4px;background:#ffffff12;border:1px solid #ffffff24}
.fp2-chapter-mark{position:absolute;right:clamp(70px,12vw,180px);bottom:12vh;font-size:clamp(80px,18vw,180px);font-weight:900;letter-spacing:-.08em;opacity:.08;pointer-events:none}
.fp2-footer{min-height:50vh;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end;justify-content:space-between;padding:80px clamp(18px,5vw,72px) 60px;border-top:1px solid #ffffff14;background:linear-gradient(#02040a00,#02040a)}
.fp2-footer strong{font-size:22px}
.fp2-footer p{margin:8px 0 0;color:#93a0b6;max-width:28rem}
@keyframes fp2-ember{from{filter:hue-rotate(-6deg) brightness(.95)}to{filter:hue-rotate(8deg) brightness(1.08)}}
@keyframes fp2-nudge{50%{transform:translateY(6px);opacity:.55}}
@media(max-width:860px){
  .fp2-rail{right:8px}
  .fp2-rail span{display:none}
  .fp2-header nav a:not(.fp2-cta){display:none}
  .fp2-chapter{padding-right:58px}
  .fp2-chapter-mark{right:18px;font-size:96px}
}
@media(prefers-reduced-motion:reduce){
  .fp2-scroll-hint,.fp2-fire .fp2-heat{animation:none!important}
}
`;
