import React from 'react';
import { Lock } from 'lucide-react';
import { FeatureKey } from '../types/plan.types';
import { usePaywall } from '../hooks/usePaywall';
import '../styles/paywall.css';

interface LockedFeatureProps {
  feature: FeatureKey;
  /** Rendered when the plan allows the feature. */
  children: React.ReactNode;
  /**
   * How to present the locked state:
   *  - 'badge'   → children stay interactive, a small lock sits alongside
   *  - 'disable' → children are dimmed and clicks open the paywall prompt
   *  - 'hide'    → children are not rendered at all
   */
  mode?: 'badge' | 'disable' | 'hide';
}

/**
 * Wraps any control belonging to a paid plan. Ask once, here, rather than
 * scattering plan checks through feature components.
 */
export function LockedFeature({ feature, children, mode = 'disable' }: LockedFeatureProps) {
  const { canUse, requireFeature } = usePaywall();

  if (canUse(feature)) return <>{children}</>;
  if (mode === 'hide') return null;

  if (mode === 'badge') {
    return (
      <span className="locked-feature locked-feature--badge">
        {children}
        <span className="locked-feature__lock" aria-label="Requires a paid plan">
          <Lock size={10} />
        </span>
      </span>
    );
  }

  return (
    <span
      className="locked-feature locked-feature--disabled"
      // Capture the click before it reaches the disabled control underneath.
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        requireFeature(feature, () => {});
      }}
    >
      {children}
      <span className="locked-feature__lock" aria-label="Requires a paid plan">
        <Lock size={10} />
      </span>
    </span>
  );
}
