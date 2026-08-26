export interface AspectRatioPreset {
  id: string;
  label: string;
  platform: string;
  ratio: string;
  width: number;
  height: number;
  icon: string;
}

export const ASPECT_RATIOS: AspectRatioPreset[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    platform: 'YouTube',
    ratio: '16:9',
    width: 1920,
    height: 1080,
    icon: '▭',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    platform: 'TikTok',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    icon: '▯',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    platform: 'Instagram',
    ratio: '1:1',
    width: 1080,
    height: 1080,
    icon: '□',
  },
];

export const DEFAULT_ASPECT_RATIO_ID = 'youtube';

export function getAspectRatioById(id: string): AspectRatioPreset | undefined {
  return ASPECT_RATIOS.find((r) => r.id === id);
}
