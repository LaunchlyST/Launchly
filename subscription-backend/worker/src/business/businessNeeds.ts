import type { Business, BusinessNeed, WebsiteInspection } from './businessTypes.ts';

/**
 * Rules-based *inferred* needs. Each one carries its reason and a confidence
 * so the UI never presents a guess as a fact. With only provider data (search
 * results) we infer less; once the website has been inspected we can say more.
 */
export function inferBusinessNeeds(business: Business, inspection?: WebsiteInspection | null): BusinessNeed[] {
  const needs: BusinessNeed[] = [];
  const add = (n: BusinessNeed) => {
    if (!needs.some((x) => x.type === n.type)) needs.push(n);
  };

  const socials = new Set(business.socialEvidence.map((e) => e.platform));
  inspection?.socials.forEach((s) => socials.add(s.platform));

  if (!business.website) {
    add({ type: 'website', label: 'Website', reason: 'No website listed by the data provider.', confidence: 0.7 });
  } else if (inspection) {
    if (!inspection.ok) {
      add({ type: 'website_improvement', label: 'Website improvement', reason: 'The listed website did not load.', confidence: 0.8 });
    } else {
      const problems: string[] = [];
      if (!inspection.hasViewportMeta) problems.push('no mobile viewport tag');
      if (!inspection.hasMetaDescription) problems.push('no meta description');
      if (!inspection.title) problems.push('no page title');
      if (problems.length) {
        add({
          type: 'website_improvement',
          label: 'Website improvement',
          reason: `Homepage has ${problems.join(', ')}.`,
          confidence: Math.min(0.9, 0.5 + problems.length * 0.15),
        });
      }
    }
  }

  if (socials.size === 0) {
    add({
      type: 'social_media',
      label: 'Social media',
      reason: inspection ? 'No social profiles linked from the website or provider data.' : 'No social profiles in provider data.',
      confidence: inspection ? 0.8 : 0.5,
    });
  }

  if (business.reviewCount != null && business.reviewCount < 25) {
    add({ type: 'review_growth', label: 'Review growth', reason: `Only ${business.reviewCount} reviews.`, confidence: 0.8 });
  }

  if (business.rating != null && business.rating >= 4.5 && (business.reviewCount ?? 0) >= 50 && socials.size <= 1) {
    add({
      type: 'social_media',
      label: 'Social media',
      reason: 'Strong reviews but little social presence to amplify them.',
      confidence: 0.7,
    });
  }

  if (inspection?.ok) {
    if (inspection.adSignals.length === 0) {
      add({ type: 'advertising', label: 'Ads', reason: 'No Google Ads or Meta Pixel tags found on the homepage.', confidence: 0.6 });
    }
    if (inspection.emails.length === 0 && !business.phone) {
      add({ type: 'lead_generation', label: 'Lead generation', reason: 'No visible email or phone contact route.', confidence: 0.6 });
    }
  } else if (business.website && !inspection) {
    add({ type: 'advertising', label: 'Ads', reason: 'Most local businesses under-invest in paid ads (not yet verified).', confidence: 0.35 });
  }

  return needs.sort((a, b) => b.confidence - a.confidence);
}
