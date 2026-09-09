import { useMemo } from 'react';
import { ArrowRight, Check, Minus, Sparkles } from 'lucide-react';
import { Loader, LuxeButton, ShineButton } from '../ui';
import './pricing.css';

export interface PricingViewProps {
  /** True when the signed-in account already has Pro. */
  isActive?: boolean;
  /** Checkout / billing-portal call in flight. */
  busy?: boolean;
  error?: string | null;
  /** ISO date the subscription renews (Pro only). */
  renewsOn?: string | null;
  onUnlock: () => void | Promise<void>;
  onManage?: () => void | Promise<void>;
  onBack?: () => void;
}

const PRO_FEATURES = [
  'Every model — GPT Image and Grok, side by side',
  'Unlimited generations, no daily cap',
  'Full-resolution exports with no watermark',
  'Priority queue — generations start first',
  'All styles, presets and aspect ratios',
  'Your API keys stay on your device',
];

const FREE_FEATURES = [
  'One model at a time',
  'A few generations a day',
  'Watermarked, reduced-size exports',
  'Standard queue',
];

const FREE_OFF = ['Priority queue', 'Full style library'];

const COMPARISON: Array<[string, string, string]> = [
  ['Models available', 'One', 'All'],
  ['Generations per day', 'Limited', 'Unlimited'],
  ['Export resolution', 'Reduced', 'Full'],
  ['No watermark', 'no', 'yes'],
  ['Priority queue', 'no', 'yes'],
  ['Style presets', 'Core set', 'Everything'],
  ['Cancel anytime', 'yes', 'yes'],
];

const FAQ = [
  ['Can I cancel whenever I want?', 'Yes. One click in the billing portal — Pro stays on until the end of the period you already paid for.'],
  ['How is payment handled?', 'Entirely by Stripe. Launchly never sees or stores your card details.'],
  ['Do I need my own API keys?', 'Yes — Launchly runs on your keys, which stay in your browser. Pro removes the limits around them.'],
  ['What happens to my work if I stop?', 'Nothing is deleted. You keep everything you generated; you just go back to the free limits.'],
];

/** A few drifting specks, positioned once. */
function useSparks(count = 18) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        top: `${60 + ((i * 23) % 40)}%`,
        duration: `${14 + ((i * 7) % 16)}s`,
        delay: `${(i * 1.7) % 14}s`,
      })),
    [count]
  );
}

/**
 * The pricing page.
 *
 * Laid out in normal document flow — the plans sit in the first screen at
 * default zoom and simply reflow (never clip) when the page is zoomed either
 * way, which the old fixed, viewport-locked gate did not do.
 */
export function PricingView({
  isActive = false,
  busy = false,
  error = null,
  renewsOn = null,
  onUnlock,
  onManage,
  onBack,
}: PricingViewProps) {
  const sparks = useSparks();

  const track = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const handlePrimary = async () => {
    if (busy) return;
    if (isActive) await onManage?.();
    else await onUnlock();
  };

  const renews = renewsOn
    ? new Date(renewsOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="pr">
      <div className="pr__bg" aria-hidden="true">
        <span className="pr__blob pr__blob--a" />
        <span className="pr__blob pr__blob--b" />
        <span className="pr__blob pr__blob--c" />
        <div className="pr__aurora" />
        <div className="pr__grid-lines" />
        {sparks.map((s) => (
          <span
            key={s.id}
            className="pr__spark"
            style={{ left: s.left, top: s.top, animationDuration: s.duration, animationDelay: s.delay }}
          />
        ))}
        <div className="pr__vignette" />
      </div>

      <div className="pr__inner">
        <header className="pr__head">
          <p className="pr__eyebrow pr__rise" style={{ animationDelay: '60ms' }}>
            <span className="pr__eyebrow-dot" />
            LAUNCHLY PRO
          </p>
          <h1 className="pr__title pr__rise" style={{ animationDelay: '140ms' }}>
            {isActive ? (
              <>Your plan is <em>live</em>.</>
            ) : (
              <>Create <em>without limits</em>.</>
            )}
          </h1>
          <p className="pr__sub pr__rise" style={{ animationDelay: '220ms' }}>
            {isActive
              ? `Pro is active on this account${renews ? ` and renews on ${renews}` : ''}. Every model, unlimited generations and clean exports are unlocked.`
              : 'One plan, five pounds a month, cancel any time. Everything Launchly can do, with none of the free-tier ceilings.'}
          </p>
        </header>

        <div className="pr__plans">
          {/* ---- Free ---- */}
          <div className="pr__card pr__rise" style={{ animationDelay: '300ms' }} onMouseMove={track}>
            <p className="pr__plan-name">Free</p>
            <p className="pr__plan-note">Enough to see whether Launchly fits how you work.</p>
            <div className="pr__price">
              <span className="pr__price-amount">£0</span>
              <span className="pr__price-period">forever</span>
            </div>
            <ul className="pr__list">
              {FREE_FEATURES.map((f) => (
                <li key={f}>
                  <span className="pr__tick"><Check size={12} strokeWidth={3} /></span>
                  <span>{f}</span>
                </li>
              ))}
              {FREE_OFF.map((f) => (
                <li key={f} className="is-off">
                  <span className="pr__tick"><Minus size={12} strokeWidth={3} /></span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="pr__card-foot">
              <LuxeButton type="button" block onClick={onBack}>
                {isActive ? 'Back to the editor' : 'Keep the free plan'}
              </LuxeButton>
            </div>
          </div>

          {/* ---- Pro ---- */}
          <div
            className="pr__card pr__card--featured uv-ring pr__rise"
            style={{ animationDelay: '380ms' }}
            onMouseMove={track}
          >
            <span className="pr__badge">{isActive ? 'ACTIVE' : 'MOST POPULAR'}</span>
            <p className="pr__plan-name">Pro</p>
            <p className="pr__plan-note">The whole suite, with every limit taken off.</p>
            <div className="pr__price">
              <span className="pr__price-amount">£5</span>
              <span className="pr__price-period">per month</span>
            </div>
            <ul className="pr__list">
              {PRO_FEATURES.map((f) => (
                <li key={f}>
                  <span className="pr__tick"><Check size={12} strokeWidth={3} /></span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="pr__card-foot">
              <ShineButton
                type="button"
                block
                onClick={handlePrimary}
                disabled={busy}
                icon={busy ? <Loader size="sm" onLight /> : <ArrowRight size={18} />}
              >
                {busy
                  ? isActive
                    ? 'Opening…'
                    : 'Opening Stripe…'
                  : isActive
                    ? 'Manage subscription'
                    : 'Unlock Launchly Pro'}
              </ShineButton>
              <p className="pr__micro">
                {isActive
                  ? renews
                    ? `Renews ${renews} · billed via Stripe`
                    : 'Billed monthly via Stripe'
                  : 'Cancel anytime · secure payment via Stripe'}
              </p>
            </div>
          </div>

          {/* ---- Studio ---- */}
          <div className="pr__card pr__rise" style={{ animationDelay: '460ms' }} onMouseMove={track}>
            <p className="pr__plan-name">Studio</p>
            <p className="pr__plan-note">For teams running several shops from one workspace.</p>
            <div className="pr__price">
              <span className="pr__price-amount">Soon</span>
              <span className="pr__price-period">in the works</span>
            </div>
            <ul className="pr__list">
              <li><span className="pr__tick"><Sparkles size={12} strokeWidth={2.5} /></span><span>Everything in Pro</span></li>
              <li><span className="pr__tick"><Sparkles size={12} strokeWidth={2.5} /></span><span>Shared team workspace</span></li>
              <li><span className="pr__tick"><Sparkles size={12} strokeWidth={2.5} /></span><span>Brand kits and saved presets</span></li>
              <li><span className="pr__tick"><Sparkles size={12} strokeWidth={2.5} /></span><span>One invoice for the team</span></li>
            </ul>
            <div className="pr__card-foot">
              <LuxeButton type="button" block disabled>
                Not available yet
              </LuxeButton>
            </div>
          </div>
        </div>

        {error && <p className="pr__notice" role="status">We couldn’t load subscription details right now. Please try again.</p>}

        <h2 className="pr__section-title">Free and Pro, side by side</h2>
        <div className="pr__table-wrap">
          <table className="pr__table">
            <thead>
              <tr><th>Feature</th><th>Free</th><th>Pro</th></tr>
            </thead>
            <tbody>
              {COMPARISON.map(([label, free, pro]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{cell(free)}</td>
                  <td>{cell(pro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="pr__section-title">Questions people actually ask</h2>
        <div className="pr__faq">
          {FAQ.map(([q, a]) => (
            <div className="pr__faq-item" key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </div>

        <div className="pr__foot">
          {onBack && (
            <button type="button" className="pr__ghost" onClick={onBack}>
              Back to the editor
            </button>
          )}
          {isActive && onManage && (
            <button type="button" className="pr__ghost" onClick={() => onManage()} disabled={busy}>
              Billing portal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function cell(value: string) {
  if (value === 'yes') return <Check className="pr__yes" size={16} strokeWidth={2.5} />;
  if (value === 'no') return <Minus className="pr__no" size={16} strokeWidth={2.5} />;
  return <span>{value}</span>;
}
