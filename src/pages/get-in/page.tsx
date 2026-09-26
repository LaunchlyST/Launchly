import { ArrowRight, Sparkles } from 'lucide-react';

export function GetInPage() {
  return (
    <main className="get-in-page">
      <style>{styles}</style>
      <section className="get-in-panel">
        <a className="get-in-brand" href="/" aria-label="Launchly home">
          <span><Sparkles size={18} /></span>
          Launchly
        </a>
        <p className="get-in-kicker">GET IN</p>
        <h1>Ready to unlock the creator workspace?</h1>
        <p>
          This is the step before the paywall. You can review access, then move into
          the Launchly dashboard without login or signup screens getting in the way.
        </p>
        <div className="get-in-actions">
          <a className="get-in-primary" href="/paywall">
            Continue to paywall <ArrowRight size={18} />
          </a>
          <a className="get-in-secondary" href="/">
            Back to front page
          </a>
        </div>
      </section>
    </main>
  );
}

const styles = `
.get-in-page{
  min-height:100vh;
  display:grid;
  place-items:center;
  padding:24px;
  color:#f8fafc;
  background:
    radial-gradient(circle at 18% 18%,rgba(91,94,244,.24),transparent 34%),
    radial-gradient(circle at 82% 16%,rgba(0,212,255,.14),transparent 32%),
    linear-gradient(140deg,#040711,#071018 52%,#02040a);
}
.get-in-panel{
  width:min(680px,100%);
  border:1px solid rgba(255,255,255,.16);
  border-radius:18px;
  padding:clamp(26px,6vw,56px);
  background:rgba(255,255,255,.08);
  box-shadow:0 28px 90px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.18);
  backdrop-filter:blur(18px);
}
.get-in-brand{
  display:inline-flex;
  align-items:center;
  gap:10px;
  color:#fff;
  text-decoration:none;
  font-weight:850;
  margin-bottom:34px;
}
.get-in-brand span{
  width:36px;
  height:36px;
  display:grid;
  place-items:center;
  border-radius:12px;
  background:linear-gradient(135deg,#5b5ef4,#00d4ff);
}
.get-in-kicker{
  margin:0 0 12px;
  font-size:11px;
  letter-spacing:.28em;
  color:#93c5fd;
  font-weight:900;
}
.get-in-panel h1{
  margin:0;
  font-size:clamp(38px,7vw,68px);
  line-height:.95;
  letter-spacing:-.055em;
}
.get-in-panel p:not(.get-in-kicker){
  margin:18px 0 0;
  max-width:36rem;
  color:#cbd5e1;
  font-size:16px;
  line-height:1.65;
}
.get-in-actions{
  display:flex;
  flex-wrap:wrap;
  gap:12px;
  margin-top:30px;
}
.get-in-primary,
.get-in-secondary{
  min-height:48px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:9px;
  padding:0 18px;
  border-radius:999px;
  text-decoration:none;
  font-weight:850;
}
.get-in-primary{
  background:#12b76a;
  color:#02130b;
}
.get-in-secondary{
  border:1px solid rgba(255,255,255,.2);
  color:#e2e8f0;
}
`;
