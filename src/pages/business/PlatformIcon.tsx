import { Globe } from 'lucide-react';
import type { PreviewPlatform } from './businessService';

/**
 * Small platform glyphs. lucide dropped its brand icons, so these are simple
 * inline SVGs, drawn to sit on the same 24px grid as the lucide set.
 */
export function PlatformIcon({ platform, size = 18 }: { platform: PreviewPlatform; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const };
  switch (platform) {
    case 'website':
      return <Globe size={size} strokeWidth={1.8} aria-hidden />;
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="#d6336c" strokeWidth={1.9}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="0.9" fill="#d6336c" stroke="none" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="#1877f2" />
          <path d="M13.2 19v-5.6h1.9l.3-2.2h-2.2V9.8c0-.6.2-1.1 1.1-1.1h1.2V6.8c-.2 0-.9-.1-1.7-.1-1.7 0-2.9 1-2.9 3v1.5H9v2.2h1.9V19h2.3z" fill="#fff" />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0033" />
          <path d="M10 9v6l5.2-3z" fill="#fff" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common}>
          <path
            d="M16.6 3c.3 2 1.6 3.4 3.4 3.6v2.8c-1.3 0-2.5-.4-3.4-1v6.1c0 3-2.4 5.5-5.5 5.5S5.6 17.5 5.6 14.5 8 9 11.1 9c.3 0 .6 0 .9.1V12a2.7 2.7 0 1 0 1.8 2.6V3h2.8z"
            fill="#111"
          />
        </svg>
      );
    case 'linkedin':
      return (
        <svg {...common}>
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#0a66c2" />
          <path d="M7.2 10h2.3v7H7.2zM8.4 6.4a1.3 1.3 0 1 1 0 2.7 1.3 1.3 0 0 1 0-2.7zM11 10h2.2v1c.3-.6 1.1-1.2 2.3-1.2 2.4 0 2.8 1.6 2.8 3.6V17h-2.3v-3.2c0-.8 0-1.8-1.1-1.8s-1.3.9-1.3 1.8V17H11z" fill="#fff" />
        </svg>
      );
  }
}

export const PLATFORM_LABEL: Record<PreviewPlatform, string> = {
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};
