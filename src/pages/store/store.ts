export type SectionKind = 'profile' | 'featured' | 'products' | 'links' | 'social';

export interface StoreSection {
  id: string;
  kind: SectionKind;
  title: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  image: string;
}

export interface LinkItem {
  id: string;
  label: string;
  url: string;
}

export type SocialNetwork = 'tiktok' | 'instagram' | 'youtube' | 'x';

export interface SocialItem {
  id: string;
  network: SocialNetwork;
  url: string;
}

export type BgMode = 'color' | 'gradient' | 'image';
export type ButtonStyle = 'filled' | 'soft' | 'outline';
export type FontChoice = 'modern' | 'serif' | 'rounded';

export interface ThemeSettings {
  bgMode: BgMode;
  bgColor: string;
  gradient: string;
  bgImage: string;
  bgBlur: boolean;
  bgGlass: boolean;
  bgAnimated: boolean;
  bgSize: 'cover' | 'contain';
  bgPosition: string;
  textColor: string;
  buttonStyle: ButtonStyle;
  buttonRadius: number;
  font: FontChoice;
}

export interface DesignerState {
  displayName: string;
  bio: string;
  avatar: string;
  avatarColor: string;
  sections: StoreSection[];
  products: Product[];
  links: LinkItem[];
  socials: SocialItem[];
  featuredProductId: string | null;
  theme: ThemeSettings;
}

export interface SetupState {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  username: string;
  code: string;
  verifying: boolean;
  connected: boolean;
}

export interface CreatorStorePersisted {
  setup: SetupState;
  designer: DesignerState;
  publishedAt: string | null;
}

export const STORAGE_KEY = 'launchly.creator-store-v2';

export const STEP_LABELS = [
  'TikTok Username',
  'Get Code',
  'Add Code to Bio',
  'Verify',
  'TikTok Connected',
  'Creator Store',
];

export const GRADIENTS = [
  'linear-gradient(135deg, #eef2ff 0%, #faf5ff 50%, #fff7ed 100%)',
  'linear-gradient(135deg, #0f172a 0%, #312e81 55%, #701a75 100%)',
  'linear-gradient(135deg, #fef2f2 0%, #fff7ed 50%, #fefce8 100%)',
  'linear-gradient(135deg, #ecfdf5 0%, #eff6ff 55%, #f5f3ff 100%)',
  'linear-gradient(135deg, #fdf4ff 0%, #fce7f3 50%, #eef2ff 100%)',
  'linear-gradient(135deg, #fffbeb 0%, #fef2f2 55%, #eef2ff 100%)',
];

export const SOLID_COLORS = ['#ffffff', '#f8fafc', '#fdf2f8', '#eff6ff', '#f0fdf4', '#fffbeb', '#0f172a', '#1e1b4b'];

export const FONTS: Record<FontChoice, string> = {
  modern: "Inter, -apple-system, 'Segoe UI', sans-serif",
  serif: "Fraunces, Georgia, 'Times New Roman', serif",
  rounded: "'SF Pro Rounded', ui-rounded, 'Segoe UI', sans-serif",
};

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `LAUNCHLY-${out}`;
}

export function defaultDesigner(username = ''): DesignerState {
  const p1 = newId('product');
  const p2 = newId('product');
  return {
    displayName: username ? `@${username}` : 'Your Studio',
    bio: 'Digital presets, templates & custom orders — delivered instantly.',
    avatar: '',
    avatarColor: '#4f46e5',
    sections: [
      { id: newId('section'), kind: 'profile', title: 'Profile' },
      { id: newId('section'), kind: 'featured', title: 'Featured' },
      { id: newId('section'), kind: 'products', title: 'Shop' },
      { id: newId('section'), kind: 'links', title: 'Links' },
      { id: newId('section'), kind: 'social', title: 'Follow me' },
    ],
    products: [
      { id: p1, title: 'Viral Preset Pack', description: '10 presets tuned for talking-head videos.', price: '$19', image: '' },
      { id: p2, title: '1:1 Video Edit', description: 'Send clips, get a captioned edit in 48h.', price: '$79', image: '' },
    ],
    links: [{ id: newId('link'), label: 'My latest video', url: 'https://tiktok.com' }],
    socials: [
      { id: newId('social'), network: 'instagram', url: '' },
      { id: newId('social'), network: 'youtube', url: '' },
    ],
    featuredProductId: p1,
    theme: {
      bgMode: 'gradient',
      bgColor: '#ffffff',
      gradient: GRADIENTS[0],
      bgImage: '',
      bgBlur: false,
      bgGlass: true,
      bgAnimated: false,
      bgSize: 'cover',
      bgPosition: 'center',
      textColor: '#0f172a',
      buttonStyle: 'filled',
      buttonRadius: 14,
      font: 'modern',
    },
  };
}

export function defaultSetup(): SetupState {
  return { step: 1, username: '', code: '', verifying: false, connected: false };
}

export function defaultPersisted(): CreatorStorePersisted {
  return { setup: defaultSetup(), designer: defaultDesigner(), publishedAt: null };
}

export function loadPersisted(): CreatorStorePersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPersisted();
    const parsed = JSON.parse(raw) as Partial<CreatorStorePersisted>;
    const base = defaultPersisted();
    return {
      setup: { ...base.setup, ...(parsed.setup ?? {}) },
      designer: {
        ...base.designer,
        ...(parsed.designer ?? {}),
        theme: { ...base.designer.theme, ...(parsed.designer?.theme ?? {}) },
      },
      publishedAt: parsed.publishedAt ?? null,
    };
  } catch {
    return defaultPersisted();
  }
}

export function storeShareUrl(username: string): string {
  const slug = username.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '') || 'yourhandle';
  return `https://launchly.store/@${slug}`;
}
