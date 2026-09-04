import React from 'react';
import { PaywallFeature } from './paywall.types';

interface PaywallProps {
  open: boolean;
  feature?: PaywallFeature | null;
  onClose: () => void;
  onUpgrade: () => void;
}

const COPY: Record<string, { title: string; desc: string }> = {
  export: { title: 'Export is a Pro feature', desc: 'Upgrade to export unlimited projects in 4K with no watermark.' },
  hd_export: { title: 'HD Export locked', desc: 'Free plan exports at 720p. Go Pro for 4K, 1080p and higher bitrates.' },
  ai_tools: { title: 'AI Tools require Pro', desc: 'Unlock AI auto-edit, captions and color grading with Pro.' },
  premium_timeline: { title: 'Premium timeline', desc: 'Unlimited tracks and extended 30-day timeline are Pro only.' },
  unlimited_projects: { title: 'Project limit reached', desc: 'Free plan allows 3 projects. Upgrade for unlimited.' },
  default: { title: 'Upgrade to Pro', desc: 'Unlock all premium features and remove limits.' },
};

export function Paywall({ open, feature, onClose, onUpgrade }: PaywallProps) {
  if (!open) return null;
  const c = COPY[feature ?? 'default'] ?? COPY.default;
  return (
    <div className="paywall-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
        <button className="paywall-close" onClick={onClose} aria-label="Close">×</button>
        <div className="paywall-badge">PRO</div>
        <h2 className="paywall-title">{c.title}</h2>
        <p className="paywall-desc">{c.desc}</p>
        <ul className="paywall-list">
          <li>Unlimited exports — 4K, 1080p, no watermark</li>
          <li>All AI tools + premium timeline</li>
          <li>Unlimited projects & cloud backup</li>
        </ul>
        <div className="paywall-actions">
          <button className="paywall-btn paywall-btn--primary" onClick={onUpgrade}>Upgrade to Pro — $12/mo</button>
          <button className="paywall-btn paywall-btn--ghost" onClick={onClose}>Maybe later</button>
        </div>
        <p className="paywall-footnote">Cancel anytime. Instant access.</p>
      </div>
    </div>
  );
}
