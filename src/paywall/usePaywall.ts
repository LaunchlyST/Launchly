import { useCallback, useState } from 'react';
import { PaywallFeature } from './paywall.types';

export function usePaywall(isPro = false) {
  const [activeFeature, setActiveFeature] = useState<PaywallFeature | null>(null);
  const [open, setOpen] = useState(false);

  const checkAccess = useCallback((feature: PaywallFeature) => {
    if (isPro) return true;
    // free user hits paywall for pro features
    const proFeatures: PaywallFeature[] = ['hd_export', 'ai_tools', 'premium_timeline'];
    if (proFeatures.includes(feature)) {
      setActiveFeature(feature);
      setOpen(true);
      return false;
    }
    return true;
  }, [isPro]);

  const trigger = useCallback((feature: PaywallFeature) => {
    setActiveFeature(feature);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return { open, activeFeature, checkAccess, trigger, close, setOpen };
}
