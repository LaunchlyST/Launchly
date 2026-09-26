import { Star, Store } from 'lucide-react';
import { useState } from 'react';
import type { Business, PreviewPlatform, SocialPlatform } from './businessService';
import { formatBudget, photoUrl } from './businessService';
import { PLATFORM_LABEL, PlatformIcon } from './PlatformIcon';

const SOCIAL_ORDER: SocialPlatform[] = ['instagram', 'facebook', 'youtube', 'tiktok', 'linkedin'];

/** Only platforms with a verified URL — nothing is shown for a guess. */
export function availablePlatforms(b: Business): PreviewPlatform[] {
  const out: PreviewPlatform[] = [];
  if (b.website) out.push('website');
  for (const p of SOCIAL_ORDER) if (b.socialProfiles?.[p]) out.push(p);
  return out;
}

interface Props {
  business: Business;
  selected: boolean;
  activePlatform: PreviewPlatform | null;
  onSelect(): void;
  onOpenPlatform(platform: PreviewPlatform): void;
}

export function BusinessCard({ business: b, selected, activePlatform, onSelect, onOpenPlatform }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const img = photoUrl(b.photo);
  const platforms = availablePlatforms(b);
  const meta = [b.city, b.category].filter(Boolean);
  const needs = b.needs.slice(0, 3).map((n) => n.label);

  return (
    <article
      className={`bc-card ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onSelect();
      }}
      tabIndex={0}
      aria-selected={selected}
      data-testid="business-card"
    >
      <div className="bc-card__media">
        {img && !imgFailed ? (
          <img src={img} alt="" loading="lazy" onError={() => setImgFailed(true)} />
        ) : (
          <div className="bc-card__placeholder" aria-hidden>
            <Store size={26} strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="bc-card__body">
        <h3 className="bc-card__name">{b.name}</h3>
        {meta.length > 0 && (
          <p className="bc-card__meta">
            {meta.map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </p>
        )}
        <p className="bc-card__rating">
          {b.rating != null ? (
            <>
              <Star size={14} className="bc-star" fill="currentColor" aria-hidden />
              <strong>{b.rating.toFixed(1)}</strong>
              {b.reviewCount != null && <span>({b.reviewCount.toLocaleString()} reviews)</span>}
            </>
          ) : (
            <span className="bc-muted">Rating unavailable</span>
          )}
        </p>
        {b.description && <p className="bc-card__desc">{b.description}</p>}
        {platforms.length > 0 && (
          <div className="bc-card__icons" role="group" aria-label={`${b.name} links`}>
            {platforms.map((p) => (
              <button
                key={p}
                type="button"
                className={`bc-icon-btn ${selected && activePlatform === p ? 'is-active' : ''}`}
                aria-label={`Preview ${PLATFORM_LABEL[p]}`}
                title={PLATFORM_LABEL[p]}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPlatform(p);
                }}
              >
                <PlatformIcon platform={p} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bc-card__aside">
        <div>
          <p className="bc-card__budget">{formatBudget(b.budget)}</p>
          <p className="bc-card__label" title="Rules-based estimate from industry, size and competition — not actual spend.">
            Estimated ad budget / mo
          </p>
        </div>
        {needs.length > 0 && (
          <div className="bc-card__needs">
            <p className="bc-card__label bc-card__label--strong">Needs:</p>
            <p title={b.needs.map((n) => `${n.label}: ${n.reason}`).join('\n')}>{needs.join(', ')}</p>
          </div>
        )}
      </div>
    </article>
  );
}

export function BusinessCardSkeleton() {
  return (
    <div className="bc-card bc-card--skeleton" data-testid="business-skeleton" aria-hidden>
      <div className="bc-card__media bc-shimmer" />
      <div className="bc-card__body">
        <div className="bc-line bc-shimmer" style={{ width: '46%', height: 16 }} />
        <div className="bc-line bc-shimmer" style={{ width: '32%' }} />
        <div className="bc-line bc-shimmer" style={{ width: '22%' }} />
        <div className="bc-line bc-shimmer" style={{ width: '78%' }} />
      </div>
      <div className="bc-card__aside">
        <div className="bc-line bc-shimmer" style={{ width: '70%', height: 16 }} />
        <div className="bc-line bc-shimmer" style={{ width: '90%' }} />
      </div>
    </div>
  );
}
