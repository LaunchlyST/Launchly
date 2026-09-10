import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Download, Image as ImageIcon, Sparkles, Video, Wand2 } from 'lucide-react';

const sceneCopies = [
  {
    label: 'FOR TIKTOK SHOP AFFILIATES',
    title: ['Your product.', 'A whole new creative.'],
    body: 'Create AI prompts, images and video ads for TikTok Shop. Download your content and make it yours.',
    action: 'Start creating',
    secondary: 'Explore the demo',
    note: 'GBP 5/month for access. AI usage charged separately.',
  },
  {
    label: 'ILLUSTRATIVE DEMO',
    title: ['Give your product', 'a direction.'],
    body: 'Turn your idea into a clear creative prompt before you make images or video ads.',
    action: 'Start creating',
    secondary: 'See the reveal',
    note: 'Lighting, setting, and camera movement are shown as example creative controls.',
  },
  {
    label: 'EXAMPLE CREATIVE',
    title: ['Make them stop.', 'Show them why.'],
    body: 'Give your next affiliate post a stronger visual story with polished product imagery.',
    action: 'Start creating',
    secondary: 'Continue',
    note: 'This preview is illustrative. Your final creative is made inside Launchly.',
  },
  {
    label: 'DOWNLOAD AND POST',
    title: ['Create it.', 'Download it.', 'Post it.'],
    body: 'Download your finished content, then post it on TikTok and add your affiliate product.',
    action: 'Start creating',
    secondary: 'See pricing',
    note: 'Launchly does not post automatically or guarantee earnings.',
  },
  {
    label: 'LAUNCHLY ACCESS',
    title: ['Your next creative', 'starts here.'],
    body: 'Launchly access is GBP 5/month. AI usage is paid separately, with no generation credits included.',
    action: 'Get access - GBP 5/month',
    secondary: 'Questions',
    note: 'Launchly Prompt AI is GBP 0.05 per successful prompt when available.',
  },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function FrontPage() {
  const pageRef = useRef<HTMLElement | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [creativeMode, setCreativeMode] = useState<'original' | 'ad'>('original');
  const copy = sceneCopies[activeScene];

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(1, page.scrollHeight - viewportHeight);
      const progress = clamp01(scrollTop / maxScroll);
      const scene = Math.min(sceneCopies.length - 1, Math.floor(progress * sceneCopies.length + 0.08));

      page.style.setProperty('--story-progress', progress.toFixed(4));
      page.style.setProperty('--scene-two', clamp01((progress - 0.18) / 0.2).toFixed(4));
      page.style.setProperty('--scene-three', clamp01((progress - 0.38) / 0.2).toFixed(4));
      page.style.setProperty('--scene-four', clamp01((progress - 0.58) / 0.2).toFixed(4));
      page.style.setProperty('--scene-five', clamp01((progress - 0.78) / 0.18).toFixed(4));
      setActiveScene(scene);
    };

    const requestUpdate = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    document.addEventListener('scroll', requestUpdate, { passive: true });
    document.documentElement.addEventListener('scroll', requestUpdate, { passive: true });
    document.body.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('wheel', requestUpdate, { passive: true });
    window.addEventListener('touchmove', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      window.removeEventListener('scroll', requestUpdate);
      document.removeEventListener('scroll', requestUpdate);
      document.documentElement.removeEventListener('scroll', requestUpdate);
      document.body.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('wheel', requestUpdate);
      window.removeEventListener('touchmove', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main
      ref={pageRef}
      className={`front-page fp-scene-${activeScene + 1}`}
      style={{
        '--story-progress': 0,
        '--scene-two': 0,
        '--scene-three': 0,
        '--scene-four': 0,
        '--scene-five': 0,
      } as CSSProperties}
    >
      <style>{frontPageStyles}</style>
      <div className="fp-page-light" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <header className="fp-header">
        <a className="fp-brand" href="/" aria-label="Launchly home">
          <span><Sparkles size={18} /></span>
          <strong>Launchly</strong>
        </a>
        <nav className="fp-nav" aria-label="Main navigation">
          <a href="#scene-2">How it works</a>
          <a href="#scene-4">Examples</a>
          <a href="#scene-5">Pricing</a>
          <a href="/login">Sign in</a>
        </nav>
      </header>

      <section className="fp-story" aria-label="Launchly product story">
        <span id="demo" className="fp-demo-anchor" aria-hidden="true" />
        <div className="fp-sticky">
          <div className={`fp-studio is-${creativeMode}`} aria-hidden="true">
            <div className="fp-curved-glass" />
            <div className="fp-water" />
            <div className="fp-stone fp-stone-a" />
            <div className="fp-stone fp-stone-b" />
            <div className="fp-vertical-frame">
              <span>9:16</span>
              <strong>Example creative</strong>
            </div>
            <div className="fp-example-strip">
              <CreativePreview kind="fashion" />
              <CreativePreview kind="perfume" />
              <CreativePreview kind="lifestyle" />
            </div>
            <div className="fp-prompt-panel">
              <span>Demo prompt</span>
              <p>Create a premium perfume ad with soft daylight, gentle reflections and a slow close-up.</p>
              <div className="fp-controls">
                <b>Lighting</b>
                <b>Setting</b>
                <b>Camera move</b>
              </div>
            </div>
            <div className="fp-output-card">
              <span><ImageIcon size={14} /> Image</span>
              <span><Video size={14} /> Video ad</span>
              <strong><Download size={16} /> Download</strong>
            </div>
            <div className="fp-pricing-panel">
              <span>Launchly access</span>
              <strong>GBP 5/month</strong>
              <p>AI usage is paid separately. No generation credits included.</p>
              <a href="/signup">Get access - GBP 5/month <ArrowRight size={16} /></a>
              <div className="fp-faq" id="faq">
                <b>What does access include?</b>
                <small>The Launchly workspace for creating prompts, images, and video ads.</small>
                <b>Are generation costs included?</b>
                <small>No. Provider AI usage is billed separately.</small>
                <b>Can I download my content?</b>
                <small>Yes. Download your content and post it yourself on TikTok.</small>
              </div>
            </div>
            <PerfumeBottle />
          </div>

          <article className="fp-copy" key={activeScene}>
            <span className="fp-label">{copy.label}</span>
            <h1>
              {copy.title.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
            <p>{copy.body}</p>
            <div className="fp-actions">
              <a className="fp-primary" href="/signup">
                {copy.action} <ArrowRight size={18} />
              </a>
              <a
                className="fp-secondary"
                href={activeScene >= 3 ? '#scene-5' : activeScene === 0 ? '#scene-2' : '#scene-3'}
              >
                <Wand2 size={16} />
                {copy.secondary}
              </a>
            </div>
            <small>{copy.note}</small>
          </article>

          <div className="fp-original-control" role="group" aria-label="Original or ad creative preview">
            <button
              type="button"
              className={creativeMode === 'original' ? 'is-active' : ''}
              onClick={() => setCreativeMode('original')}
            >
              Original
            </button>
            <button
              type="button"
              className={creativeMode === 'ad' ? 'is-active' : ''}
              onClick={() => setCreativeMode('ad')}
            >
              Ad creative
            </button>
          </div>

          <div className="fp-scene-markers" aria-label="Story progress">
            {sceneCopies.map((item, index) => (
              <a
                key={item.label}
                className={activeScene === index ? 'is-active' : ''}
                href={`#scene-${index + 1}`}
                aria-label={`Go to scene ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="fp-scroll-sections" aria-hidden="true">
          <div id="top" />
          <div id="scene-1" />
          <div id="scene-2" />
          <div id="scene-3" />
          <div id="scene-4" />
          <div id="scene-5" />
        </div>
      </section>

      <aside className="fp-dock" aria-label="Launchly story controls">
        <span>{String(activeScene + 1).padStart(2, '0')} / 05</span>
        <a href="/signup">Start creating</a>
        <i style={{ '--dock-progress': `${(activeScene + 1) / sceneCopies.length}` } as CSSProperties} />
      </aside>

      <section className="fp-footer" aria-label="Launchly summary">
        <p>Launchly is for TikTok Shop affiliates creating their own product content.</p>
        <a href="/signup">Start creating <ArrowRight size={16} /></a>
      </section>
    </main>
  );
}

function PerfumeBottle() {
  return (
    <div className="fp-bottle" aria-label="Illustrative perfume bottle">
      <div className="fp-bottle-shadow" />
      <div className="fp-cap" />
      <div className="fp-neck" />
      <div className="fp-body">
        <div className="fp-liquid" />
        <div className="fp-label-card">
          <span>Launchly</span>
          <strong>FORM 08</strong>
          <em>soft daylight</em>
        </div>
      </div>
    </div>
  );
}

function CreativePreview({ kind }: { kind: 'fashion' | 'perfume' | 'lifestyle' }) {
  return (
    <figure className={`fp-creative fp-creative--${kind}`}>
      <div>
        <span>Example creative</span>
        {kind === 'fashion' ? <b>Fashion drop</b> : kind === 'perfume' ? <b>Perfume ad</b> : <b>Lifestyle scene</b>}
      </div>
    </figure>
  );
}

const frontPageStyles = `
.front-page{
  --ivory:#fbf7ef;
  --paper:#f5f0e7;
  --ink:#1c2029;
  --muted:#667085;
  --blue:#b9daf2;
  --lime:#d9ff61;
  min-height:570vh;
  position:relative;
  overflow:clip;
  background:
    radial-gradient(circle at 12% 12%,#fff 0 8%,transparent 28%),
    linear-gradient(135deg,#fffdf8 0%,#edf4f8 42%,#f7f1e8 100%);
  color:var(--ink);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.app--auth:has(.front-page),.app--inside:has(.front-page){height:auto;min-height:100vh;overflow:visible}
.app--auth .app__main:has(.front-page),.app--inside .app__main:has(.front-page){height:auto;min-height:100vh;overflow:visible;display:block}
.front-page *,.front-page *::before,.front-page *::after{box-sizing:border-box}
.front-page a{color:inherit;text-decoration:none}
.front-page button,.front-page a{-webkit-tap-highlight-color:transparent}
.front-page :focus-visible{outline:2px solid #9fbeff;outline-offset:4px}
.fp-page-light{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.fp-page-light:before{
  content:"";position:absolute;inset:0;
  background:
    linear-gradient(90deg,#ffffff40 1px,transparent 1px),
    linear-gradient(#ffffff40 1px,transparent 1px);
  background-size:72px 72px;opacity:.28;mask-image:radial-gradient(circle at 50% 46%,#000 0 32%,transparent 76%);
}
.fp-page-light:after{
  content:"";position:absolute;inset:0;
  background:radial-gradient(circle at 50% 48%,transparent 0 48%,#d6e0e7c7 100%);
}
.fp-page-light i{position:absolute;border-radius:999px;filter:blur(70px);opacity:.72;animation:fp-light-drift 18s ease-in-out infinite alternate}
.fp-page-light i:nth-child(1){width:44vw;height:34vw;left:-8vw;top:12vh;background:#d8f0ff}
.fp-page-light i:nth-child(2){width:36vw;height:30vw;right:-10vw;top:24vh;background:#fff1c8;animation-delay:-6s}
.fp-page-light i:nth-child(3){width:48vw;height:28vw;left:30vw;bottom:-8vh;background:#f4d9ff;opacity:.44;animation-delay:-11s}
.fp-header{
  position:fixed;left:0;right:0;top:0;z-index:20;
  display:flex;align-items:center;justify-content:space-between;gap:24px;
  padding:24px clamp(20px,4vw,58px);
  background:linear-gradient(180deg,#ffffffc7,#ffffff00);
}
.fp-brand{display:inline-flex;align-items:center;gap:10px;font-size:21px;font-weight:800;letter-spacing:-.055em;color:#20242e}
.fp-brand span{display:grid;place-items:center;width:36px;height:36px;border-radius:13px;border:1px solid #1d25301c;background:#ffffffb5;box-shadow:0 16px 34px #64748b22;color:#8aa200}
.fp-nav{display:flex;align-items:center;gap:8px;padding:6px;border:1px solid #1d253014;border-radius:999px;background:#ffffffa6;box-shadow:0 18px 60px #34405414;backdrop-filter:blur(18px)}
.fp-nav a{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 14px;border-radius:999px;color:#475467;font-size:13px;font-weight:700;transition:background .16s ease,color .16s ease,box-shadow .16s ease}
.fp-nav a:hover{background:#eef4f8;color:#101828}
.fp-nav .fp-nav-cta{background:#1f2732;color:#fff;box-shadow:inset 0 1px #ffffff20,0 10px 24px #1f27321f}
.fp-story{position:relative;z-index:2;height:510vh}
.fp-sticky{position:sticky;top:0;height:100vh;min-height:720px;overflow:hidden}
.fp-demo-anchor{position:absolute;top:115vh}
.fp-studio{position:absolute;inset:0;transform-style:preserve-3d;perspective:1400px}
.fp-studio:before{
  content:"";position:absolute;left:8vw;right:8vw;bottom:8vh;height:18vh;border-radius:50%;
  background:radial-gradient(ellipse at center,#fff 0 8%,#d7e3ea8c 34%,transparent 70%);
  filter:blur(12px);transform:translateY(calc(var(--scene-three) * -18px));
}
.fp-curved-glass{
  position:absolute;left:47%;top:13%;width:min(560px,40vw);height:min(620px,62vh);
  border:1px solid #ffffffc9;border-left-color:#cfd8e3;border-radius:46% 54% 50% 50% / 18% 28% 72% 82%;
  background:linear-gradient(110deg,#ffffff4f,#dbe9f34a 36%,#ffffff12 64%,#b9daf22b);
  box-shadow:inset 22px 0 48px #fff9,inset -18px 0 44px #91b0c222,0 30px 120px #52606d24;
  transform:translate3d(calc(var(--scene-two) * -6vw),calc(var(--scene-three) * 7vh),-80px) rotateY(calc(-16deg - var(--scene-two) * 10deg));
  opacity:calc(1 - (var(--scene-three) * .45));
}
.fp-water{
  position:absolute;left:0;right:0;bottom:0;height:31vh;opacity:var(--scene-three);
  background:
    radial-gradient(ellipse at 52% 0%,#ffffffd4 0 14%,transparent 42%),
    linear-gradient(180deg,#dbeef7 0%,#b8d5e1 50%,#f8f3ea 100%);
  box-shadow:inset 0 1px #fff,inset 0 30px 80px #ffffff91;
}
.fp-water:after{
  content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(178deg,#ffffff00 0 16px,#ffffff8a 17px 18px,#ffffff00 20px 44px);
  opacity:.38;animation:fp-water 7s linear infinite;
}
.fp-stone{position:absolute;opacity:var(--scene-three);filter:drop-shadow(0 32px 40px #77838f2b)}
.fp-stone-a{left:12vw;bottom:23vh;width:28vw;height:11vh;border-radius:48% 52% 42% 58%;background:linear-gradient(135deg,#e9e2d7,#ffffff);transform:rotate(-7deg)}
.fp-stone-b{right:7vw;bottom:26vh;width:22vw;height:13vh;border-radius:55% 45% 58% 42%;background:linear-gradient(145deg,#ffffff,#ded8d0);transform:rotate(9deg)}
.fp-bottle{
  position:absolute;left:50%;top:52%;
  width:clamp(170px,19vw,270px);height:clamp(270px,31vw,440px);
  transform:
    translate(-50%,-50%)
    translateX(calc((var(--scene-two) * 13vw) - (var(--scene-three) * 8vw) + (var(--scene-four) * -8vw)))
    translateY(calc((var(--scene-two) * -2vh) + (var(--scene-three) * 7vh) + (var(--scene-five) * -8vh)))
    rotateY(calc((var(--scene-two) * -18deg) + (var(--scene-three) * 10deg)))
    scale(calc(1 + var(--scene-two) * .12 + var(--scene-three) * .24 - var(--scene-four) * .16 - var(--scene-five) * .36));
  transition:filter .2s ease;
  z-index:5;
}
.fp-bottle-shadow{position:absolute;left:2%;right:2%;bottom:-18px;height:42px;border-radius:50%;background:#5e687429;filter:blur(14px);transform:scaleX(1.3)}
.fp-cap{position:absolute;left:31%;top:0;width:38%;height:17%;border-radius:22px 22px 12px 12px;background:linear-gradient(120deg,#e9eef2,#8794a3 38%,#f9fbfc 68%,#a9b4bf);box-shadow:inset 8px 0 18px #fff9,inset -8px 0 18px #54606d4a,0 18px 30px #34405418;z-index:3}
.fp-neck{position:absolute;left:39%;top:13%;width:22%;height:16%;border-radius:12px;background:linear-gradient(90deg,#fff,#b8c3cd 45%,#eef4f7);box-shadow:inset -8px 0 16px #64748b30;z-index:2}
.fp-body{
  position:absolute;left:9%;right:9%;bottom:0;height:76%;border-radius:48% 48% 28px 28px / 20% 20% 28px 28px;
  background:
    linear-gradient(105deg,#ffffffd9 0 18%,#d8edf98a 20% 27%,#ffffff40 42%,#8fb0c744 62%,#ffffffbf 78%),
    linear-gradient(180deg,#f8fbff,#cbd9e6 54%,#aebdcb);
  border:1px solid #ffffffdf;
  box-shadow:inset 24px 0 36px #fff9,inset -24px 0 40px #5c728830,0 36px 90px #5b6b7d36;
  overflow:hidden;
}
.fp-body:before{content:"";position:absolute;left:14%;top:10%;width:16%;height:72%;border-radius:999px;background:#ffffffa6;filter:blur(4px)}
.fp-liquid{position:absolute;left:8%;right:8%;bottom:7%;height:48%;border-radius:24px;background:linear-gradient(180deg,#f5dfb9cc,#d4a764d9);box-shadow:inset 0 16px 38px #fff5}
.fp-label-card{
  position:absolute;left:17%;right:17%;bottom:18%;min-height:30%;display:grid;place-items:center;text-align:center;
  border:1px solid #ffffffc4;border-radius:20px;background:#fffaf0d9;box-shadow:0 12px 24px #6b4b2230;
}
.fp-label-card span{font-size:10px;text-transform:uppercase;letter-spacing:.22em;color:#8b7352}.fp-label-card strong{font-size:20px;letter-spacing:.04em;color:#1d2530}.fp-label-card em{font-size:11px;color:#8b7352;font-style:normal}
.fp-prompt-panel{
  position:absolute;left:clamp(20px,8vw,120px);top:28vh;width:min(420px,36vw);z-index:4;
  padding:22px;border:1px solid #ffffffb5;border-radius:26px;background:#ffffff83;box-shadow:0 30px 90px #52606d26;backdrop-filter:blur(22px);
  transform:translate3d(calc((1 - var(--scene-two)) * -100px),calc((1 - var(--scene-two)) * 20px),0) scale(calc(.92 + var(--scene-two) * .08));
  opacity:var(--scene-two);
}
.fp-prompt-panel span,.fp-output-card span:first-child{display:block;color:#667085;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.fp-prompt-panel p{margin:10px 0 0;color:#263241;font-size:19px;line-height:1.45;font-weight:700}
.fp-controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.fp-controls b{font-size:12px;color:#344054;padding:8px 10px;border-radius:999px;background:#eef5fa;border:1px solid #d6e5ee}
.fp-vertical-frame{
  position:absolute;right:9vw;top:15vh;width:min(350px,28vw);height:min(620px,68vh);z-index:3;
  border:2px solid #ffffff;outline:1px solid #9fb5c5;border-radius:34px;
  background:
    linear-gradient(180deg,#ffffff2e,#ffffff10),
    radial-gradient(circle at 52% 44%,rgba(244,218,177,.55),transparent 16%),
    linear-gradient(160deg,#f6f0e8,#dfeaf0 45%,#fbf7ef);
  box-shadow:0 40px 130px #8393a129,inset 0 0 0 10px #ffffff1a;
  transform:
    translate3d(calc((1 - var(--scene-three)) * 120px - var(--scene-four) * 8vw),calc((1 - var(--scene-three)) * 40px - var(--scene-four) * 2vh),0)
    rotateY(calc(-14deg + var(--scene-three) * 14deg + var(--scene-four) * 8deg))
    scale(calc(.86 + var(--scene-three) * .14 - var(--scene-four) * .08));
  opacity:calc(var(--scene-three) * (1 - var(--scene-five)));
  overflow:hidden;
}
.fp-vertical-frame:before{content:"";position:absolute;inset:18% 18% 24%;border-radius:42% 42% 20px 20px;background:linear-gradient(120deg,#ffffffd9,#bfd4e5 42%,#fff),linear-gradient(#f3d8ae,#d6a669);box-shadow:0 24px 50px #5b6b7d2e}
.fp-vertical-frame:after{content:"Original product";position:absolute;left:18px;top:48px;padding:8px 10px;border-radius:999px;background:#ffffffd9;color:#475467;font-size:11px;font-weight:800;opacity:calc(1 - var(--scene-three))}
.fp-studio.is-ad .fp-vertical-frame{background:linear-gradient(180deg,#eef8ff,#fff8ed 50%,#d8edf6)}
.fp-studio.is-ad .fp-vertical-frame:after{content:"Ad creative";opacity:1;background:#1f2732;color:#fff}
.fp-vertical-frame span{position:absolute;left:18px;top:18px;color:#334155;font-size:12px;font-weight:800}
.fp-vertical-frame strong{position:absolute;left:18px;right:18px;bottom:18px;padding:13px;border-radius:999px;background:#ffffffd9;color:#1d2530;text-align:center;font-size:13px;box-shadow:0 12px 30px #64748b24}
.fp-example-strip{
  position:absolute;left:50%;top:51%;z-index:4;display:flex;align-items:center;justify-content:center;gap:22px;
  width:min(900px,78vw);transform:translate(-50%,-50%) translateY(calc((1 - var(--scene-four)) * 80px)) scale(calc(.92 + var(--scene-four) * .08));
  opacity:calc(var(--scene-four) * (1 - var(--scene-five)));
  pointer-events:none;
}
.fp-creative{position:relative;margin:0;width:clamp(160px,18vw,230px);aspect-ratio:9/16;border-radius:28px;overflow:hidden;border:1px solid #fff;box-shadow:0 30px 75px #5362732b;background:#fff}
.fp-creative:nth-child(1){transform:translateY(34px) rotate(-8deg)}
.fp-creative:nth-child(2){width:clamp(190px,22vw,280px);transform:translateY(-8px);z-index:2}
.fp-creative:nth-child(3){transform:translateY(42px) rotate(7deg)}
.fp-creative:before{content:"";position:absolute;inset:0}
.fp-creative--fashion:before{background:linear-gradient(160deg,#ece7df,#9fb1bd 42%,#ffffff),radial-gradient(circle at 55% 34%,#d8ff67 0 8%,transparent 20%)}
.fp-creative--perfume:before{background:linear-gradient(180deg,#f8f1e5,#cfe9f4 50%,#fdfbf8),radial-gradient(circle at 50% 56%,#d6a669 0 11%,transparent 26%)}
.fp-creative--lifestyle:before{background:linear-gradient(150deg,#eef7fb,#f5e7d3 48%,#ffffff),radial-gradient(circle at 42% 62%,#9abfce 0 10%,transparent 28%)}
.fp-creative:after{content:"";position:absolute;left:26%;right:26%;top:22%;bottom:32%;border-radius:45% 45% 22px 22px;background:linear-gradient(120deg,#ffffffd9,#acbfd1 44%,#fff);box-shadow:0 18px 46px #3e536426}
.fp-creative div{position:absolute;left:14px;right:14px;bottom:14px;z-index:2;padding:12px;border-radius:18px;background:#ffffffd9;backdrop-filter:blur(12px);box-shadow:0 12px 26px #64748b24}
.fp-creative span{display:block;color:#667085;font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.fp-creative b{display:block;margin-top:5px;color:#1f2732;font-size:15px}
.fp-output-card{
  position:absolute;right:clamp(20px,9vw,150px);top:30vh;width:min(330px,30vw);z-index:6;
  padding:20px;border:1px solid #ffffffb8;border-radius:28px;background:#ffffffe0;box-shadow:0 30px 80px #61728224;backdrop-filter:blur(18px);
  transform:translateY(calc((1 - var(--scene-four)) * 60px)) scale(calc(.94 + var(--scene-four) * .06));
  opacity:calc(var(--scene-four) * (1 - var(--scene-five)));
}
.fp-output-card span,.fp-output-card strong{display:flex;align-items:center;gap:8px}
.fp-output-card span{margin-bottom:12px;color:#475467;font-size:13px;font-weight:800;letter-spacing:0;text-transform:none}
.fp-output-card strong{justify-content:center;margin-top:16px;min-height:46px;border-radius:999px;background:#1f2732;color:#fff;font-size:14px}
.fp-pricing-panel{
  position:absolute;left:50%;top:52%;z-index:10;width:min(510px,90vw);
  padding:28px;border:1px solid #ffffffd8;border-radius:32px;background:#ffffffd9;box-shadow:0 40px 120px #6670852b;backdrop-filter:blur(22px);
  transform:translate(-50%,-50%) translateY(calc((1 - var(--scene-five)) * 46px)) scale(calc(.95 + var(--scene-five) * .05));
  opacity:var(--scene-five);
  pointer-events:none;
}
.fp-scene-5 .fp-pricing-panel{pointer-events:auto}
.fp-pricing-panel span{display:block;color:#667085;font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
.fp-pricing-panel strong{display:block;margin-top:10px;color:#151922;font-size:38px;letter-spacing:-.05em}
.fp-pricing-panel p{margin:10px 0 0;color:#475467;line-height:1.55}
.fp-pricing-panel>a{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;min-height:50px;border-radius:999px;background:#1f2732;color:#fff;font-weight:850}
.fp-faq{display:grid;gap:6px;margin-top:22px;padding-top:20px;border-top:1px solid #d6dde5}
.fp-faq b{color:#1f2732;font-size:14px}.fp-faq small{color:#667085;line-height:1.45}
.fp-copy{
  position:absolute;left:clamp(22px,6vw,86px);top:50%;z-index:9;width:min(580px,46vw);
  transform:translateY(-50%);
  animation:fp-copy-in .42s cubic-bezier(.2,.8,.2,1) both;
}
.fp-scene-2 .fp-copy,.fp-scene-4 .fp-copy{left:auto;right:clamp(22px,6vw,86px)}
.fp-scene-3 .fp-copy{top:30%;width:min(540px,44vw)}
.fp-scene-5 .fp-copy{top:28%;left:clamp(22px,6vw,86px);width:min(520px,44vw)}
.fp-label{display:inline-flex;align-items:center;gap:12px;color:#5a6d82;font-size:11px;font-weight:900;letter-spacing:.22em;text-transform:uppercase}
.fp-label:before{content:"";width:34px;height:1px;background:#9cafbf}
.fp-copy h1{margin:18px 0 0;color:#171b24;font-size:clamp(54px,7.2vw,112px);line-height:.92;letter-spacing:-.08em;font-weight:800}
.fp-copy h1 span{display:block}
.fp-copy p{margin:24px 0 0;max-width:530px;color:#475467;font-size:clamp(17px,1.5vw,21px);line-height:1.62;font-weight:520}
.fp-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.fp-primary,.fp-secondary{
  display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:0 20px;border-radius:999px;
  font-size:14px;font-weight:800;transition:transform .16s ease,box-shadow .16s ease,background .16s ease;
}
.fp-primary{background:#1f2732;color:#fff;box-shadow:0 18px 42px #1f27322a}
.fp-secondary{border:1px solid #cad6df;background:#ffffffa6;color:#344054;backdrop-filter:blur(14px)}
.fp-primary:hover,.fp-secondary:hover{transform:translateY(-2px);box-shadow:0 18px 46px #52606d24}
.fp-copy small{display:block;margin-top:18px;color:#667085;font-size:13px;font-weight:650}
.fp-original-control{
  position:absolute;left:50%;bottom:28px;z-index:18;display:flex;gap:4px;padding:5px;border:1px solid #cad6df;border-radius:999px;background:#ffffffb5;box-shadow:0 18px 50px #6670851c;backdrop-filter:blur(18px);
  opacity:calc(var(--scene-three) * (1 - var(--scene-five)));
}
.fp-original-control button{border:0;border-radius:999px;background:transparent;color:#667085;min-height:36px;padding:0 14px;font:inherit;font-size:13px;font-weight:850;cursor:pointer}
.fp-original-control button.is-active{background:#1f2732;color:#fff}
.fp-scene-markers{position:absolute;right:26px;top:50%;z-index:12;display:grid;gap:10px;transform:translateY(-50%)}
.fp-scene-markers a{width:8px;height:28px;border-radius:999px;background:#a9b7c461;border:1px solid #ffffffd4}
.fp-scene-markers a.is-active{background:#1f2732}
.fp-scroll-sections{position:absolute;inset:0;display:grid;grid-template-rows:repeat(6,85vh);pointer-events:none}
.fp-dock{
  position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));z-index:30;display:grid;grid-template-columns:auto auto 72px;align-items:center;gap:12px;
  padding:7px 8px 7px 14px;border:1px solid #1d253014;border-radius:999px;background:#ffffffc7;box-shadow:0 20px 60px #3440541f;backdrop-filter:blur(18px);transform:translateX(-50%);
}
.fp-dock span{color:#475467;font-size:12px;font-weight:900;letter-spacing:.12em}.fp-dock a{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:999px;background:#1f2732;color:#fff;font-size:12px;font-weight:850}.fp-dock i{height:4px;border-radius:999px;background:linear-gradient(90deg,#1f2732 calc(var(--dock-progress) * 100%),#d8e1e8 0)}
.fp-footer{
  position:relative;z-index:3;min-height:60vh;display:flex;align-items:center;justify-content:center;gap:22px;flex-wrap:wrap;
  padding:80px 22px;background:linear-gradient(180deg,#ffffff00,#f8fafc 35%,#fff);
}
.fp-footer p{margin:0;color:#344054;font-size:18px;font-weight:700}
.fp-footer a{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-radius:999px;background:#1f2732;color:#fff;font-weight:800}
@keyframes fp-light-drift{to{transform:translate3d(5vw,-3vh,0) scale(1.12)}}
@keyframes fp-water{to{transform:translateX(-80px)}}
@keyframes fp-copy-in{from{opacity:0;transform:translateY(calc(-50% + 20px))}to{opacity:1;transform:translateY(-50%)}}
@media(max-width:940px){
  .front-page{min-height:570vh;overflow:clip}
  .fp-header{position:sticky;padding:16px 18px;background:#ffffffe6;backdrop-filter:blur(16px)}
  .fp-nav a:not(.fp-nav-cta){display:none}
  .fp-story{height:510vh}
  .fp-sticky{position:sticky;top:0;height:100vh;min-height:720px;overflow:hidden;padding:0}
  .fp-studio{position:absolute;inset:0;height:auto}
  .fp-curved-glass{left:36%;top:28%;width:64vw;height:380px}
  .fp-bottle{width:168px;height:282px;top:66%;transform:
    translate(-50%,-50%)
    translateX(calc((var(--scene-two) * 22vw) - (var(--scene-three) * 9vw) + (var(--scene-four) * -18vw)))
    translateY(calc((var(--scene-two) * -4vh) + (var(--scene-three) * 8vh)))
    scale(calc(.92 + var(--scene-two) * .1 + var(--scene-three) * .16 - var(--scene-four) * .06));}
  .fp-prompt-panel{left:18px;right:18px;top:43%;width:auto}
  .fp-vertical-frame{right:18px;top:36%;width:44vw;height:46vh;min-width:160px;border-radius:24px}
  .fp-output-card{right:18px;left:18px;top:53%;width:auto}
  .fp-example-strip{width:110vw;gap:10px;top:62%}
  .fp-creative{width:32vw;border-radius:22px}.fp-creative:nth-child(2){width:38vw}
  .fp-pricing-panel{top:58%;width:calc(100vw - 32px);padding:20px;border-radius:24px}
  .fp-water,.fp-stone{opacity:var(--scene-three)}
  .fp-copy,.fp-scene-2 .fp-copy,.fp-scene-3 .fp-copy,.fp-scene-4 .fp-copy,.fp-scene-5 .fp-copy{
    position:absolute;left:20px;right:20px;top:118px;width:auto;max-width:none;margin:0;text-align:left;transform:none;animation:fp-mobile-copy-in .36s ease both;
  }
  .fp-copy h1{font-size:clamp(48px,15vw,72px)}
  .fp-copy p{font-size:16px;max-width:31rem}
  .fp-scene-markers{right:12px}
  .fp-original-control{bottom:84px}
  .fp-scroll-sections{display:grid}
  .fp-footer{min-height:44vh}
}
@media(max-width:540px){
  .fp-brand{font-size:18px}.fp-brand span{width:32px;height:32px}
  .fp-nav{padding:4px}.fp-nav .fp-nav-cta{min-height:34px;padding:0 12px;font-size:12px}
  .fp-sticky{min-height:690px}
  .fp-actions{display:grid}
  .fp-primary,.fp-secondary{width:100%}
  .fp-copy small{font-size:12px}
  .fp-prompt-panel{top:48%;padding:16px;border-radius:20px}
  .fp-prompt-panel p{font-size:15px}
  .fp-controls b{font-size:10px;padding:7px 8px}
  .fp-vertical-frame{top:48%;right:16px;width:42vw;height:36vh}
  .fp-output-card{top:55%;padding:16px}
  .fp-dock{grid-template-columns:auto auto 48px;max-width:calc(100vw - 20px)}
  .fp-dock span{font-size:10px}.fp-dock a{font-size:11px;padding:0 10px}
  .fp-pricing-panel strong{font-size:28px}
}
@keyframes fp-mobile-copy-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){
  .front-page *,.front-page *::before,.front-page *::after{animation:none!important;transition:none!important}
}
`;
