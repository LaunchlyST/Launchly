export type BlockType =
  | 'profile'
  | 'products'
  | 'links'
  | 'social'
  | 'tiktok'
  | 'video'
  | 'image'
  | 'text'
  | 'newsletter'
  | 'divider'
  | 'showcase'
  | 'support';

/** Only one of each may exist on a page (no duplicates). */
export const SINGLETON_TYPES: BlockType[] = ['profile'];

/**
 * The TikTok profile block is permanently locked at index 0. This normalizes
 * any block list (persisted, migrated, or edited) so the profile always comes
 * first and can never be overlapped by another section.
 */
export function ensureProfileFirst(blocks: Block[]): Block[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return blocks;
  const idx = blocks.findIndex((b) => b.type === 'profile');
  if (idx < 0) return blocks;
  if (idx === 0) return blocks;
  const next = [...blocks];
  const [profile] = next.splice(idx, 1);
  next.unshift(profile);
  return next;
}

export interface Block {
  id: string;
  type: BlockType;
  title: string;
  products?: Product[];
  links?: LinkItem[];
  socials?: SocialItem[];
  videos?: TiktokVideo[];
  image?: string;
  url?: string;
  caption?: string;
  heading?: string;
  body?: string;
  subtext?: string;
  buttonLabel?: string;
  placeholder?: string;
  /** Per-block text overrides (text blocks). */
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  color?: string;
  /** Divider / spacer height in px. */
  height?: number;
  /** Showcase (video preview + buy) + support + digital-file extras. */
  price?: string;
  email?: string;
  fileUrl?: string;
  fileName?: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  image: string;
  link: string;
  cta: string;
  /** Uploaded digital file (object URL / remote URL) + original name. */
  fileUrl?: string;
  fileName?: string;
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

export interface TiktokVideo {
  id: string;
  url: string;
  thumb: string;
  views: string;
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
  buttonColor: string;
  buttonStyle: ButtonStyle;
  buttonRadius: number;
  font: FontChoice;
}

export interface ThemePreset {
  name: string;
  hint: string;
  theme: Partial<ThemeSettings>;
}

export interface DesignerState {
  displayName: string;
  username: string;
  bio: string;
  avatar: string;
  avatarColor: string;
  blocks: Block[];
  theme: ThemeSettings;
}

export interface SetupState {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  username: string;
  code: string;
  verifying: boolean;
  connected: boolean;
}

/** Real TikTok identity mirrored from TikTok Login Kit + Display API.
    TikTok is the single source of truth — Launchly never invents identity. */
export interface TikTokProfile {
  /** Stable TikTok account id. Username changes never break the connection. */
  openId: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
}

/** Sync bookkeeping. Tokens live ONLY on the backend (Worker + Supabase). */
export interface TikTokSyncState {
  connected: boolean;
  openId: string | null;
  /** Last profile successfully retrieved from TikTok. */
  profile: TikTokProfile | null;
  lastSyncAt: string | null;
  syncing: boolean;
  /** Non-blocking warning — last good profile is always kept on failure. */
  syncError: string | null;
}

export interface CreatorStorePersisted {
  setup: SetupState;
  designer: DesignerState;
  publishedAt: string | null;
  ui: CreatorStoreUi;
  tiktok: TikTokSyncState;
}

export function defaultTikTokSync(): TikTokSyncState {
  return {
    connected: false,
    openId: null,
    profile: null,
    lastSyncAt: null,
    syncing: false,
    syncError: null,
  };
}

/**
 * Merge a TikTok profile into the designer. Only non-empty real values win —
 * a temporary API failure must NEVER wipe real identity with placeholders.
 */
export function applyTikTokProfile(
  designer: DesignerState,
  profile: Partial<TikTokProfile> | null | undefined
): DesignerState {
  if (!profile) return designer;
  const next = { ...designer };
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const username = text(profile.username).replace(/^@+/, '');
  const displayName = text(profile.displayName);
  const avatar = text(profile.avatar);
  const bio = typeof profile.bio === 'string' ? profile.bio : '';
  if (username) next.username = username;
  if (displayName) next.displayName = displayName;
  if (avatar) next.avatar = avatar;
  // Bio may legitimately be empty on TikTok — only overwrite when the
  // payload actually carries the field, so failures keep the last bio.
  if (profile.bio !== undefined) next.bio = bio;
  return next;
}

export type GroupId = 'design' | 'content' | 'products';

export interface CreatorStoreUi {
  open: Record<GroupId, boolean>;
  expanded: { area: 'block' | 'product'; id: string } | null;
  focusKey: string | null;
  phonePos: { x: number; y: number };
}

export function defaultUi(): CreatorStoreUi {
  return {
    open: { design: false, content: true, products: false },
    expanded: null,
    focusKey: null,
    phonePos: { x: 0, y: 0 },
  };
}

export const STORAGE_KEY = 'launchly.creator-store-v3';
const LEGACY_KEY = 'launchly.creator-store-v2';

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

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Porcelain',
    hint: 'Clean light page',
    theme: {
      bgMode: 'gradient',
      gradient: GRADIENTS[0],
      textColor: '#0f172a',
      buttonColor: '#0f172a',
      buttonStyle: 'filled',
      font: 'modern',
    },
  },
  {
    name: 'Midnight',
    hint: 'Dark cinematic page',
    theme: {
      bgMode: 'color',
      bgColor: '#0d1117',
      textColor: '#f2f4f7',
      buttonColor: '#e8eaed',
      buttonStyle: 'filled',
      font: 'modern',
    },
  },
  {
    name: 'Atelier',
    hint: 'Warm editorial page',
    theme: {
      bgMode: 'gradient',
      gradient: GRADIENTS[5],
      textColor: '#1c1917',
      buttonColor: '#1c1917',
      buttonStyle: 'filled',
      font: 'serif',
    },
  },
];

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

export function blankBlock(type: BlockType): Block {
  const base = { id: newId('block'), type, title: '' };
  switch (type) {
    case 'profile':
      return { ...base, title: 'Profile' };
    case 'products':
      return { ...base, title: 'Shop', products: [] };
    case 'links':
      return { ...base, title: 'Links', links: [] };
    case 'social':
      return { ...base, title: 'Follow me', socials: [] };
    case 'tiktok':
      return { ...base, title: 'Latest on TikTok', videos: [] };
    case 'video':
      return { ...base, title: 'Video', url: '', image: '', caption: '' };
    case 'image':
      return { ...base, title: 'Image', image: '', caption: '', url: '' };
    case 'text':
      return { ...base, title: 'Heading', heading: 'New section', body: '', fontSize: 15, align: 'center' as const };
    case 'newsletter':
      return {
        ...base,
        title: 'Newsletter',
        heading: 'Join my newsletter',
        subtext: 'Drops, templates and behind-the-scenes — once a month.',
        buttonLabel: 'Subscribe',
        placeholder: 'you@email.com',
      };
    case 'divider':
      return { ...base, title: 'Divider', height: 24 };
    case 'showcase':
      return { ...base, title: 'Product video', url: '', image: '', caption: '', price: '$19' };
    case 'support':
      return {
        ...base,
        title: 'Email support',
        heading: 'Need help with your order?',
        subtext: 'Email me about purchases, missing downloads or other problems.',
        buttonLabel: 'Email support',
        email: '',
      };
  }
}

export function defaultDesigner(username = ''): DesignerState {
  const p1: Product = {
    id: newId('product'),
    title: 'Viral Preset Pack',
    description: '10 presets tuned for talking-head videos.',
    price: '$19',
    image: '',
    link: '',
    cta: 'Get it',
  };
  const p2: Product = {
    id: newId('product'),
    title: '1:1 Video Edit',
    description: 'Send clips, get a captioned edit in 48h.',
    price: '$79',
    image: '',
    link: '',
    cta: 'Book now',
  };
  return {
    displayName: username ? `@${username}` : 'Your Studio',
    username,
    bio: 'Digital presets, templates & custom orders — delivered instantly.',
    avatar: '',
    avatarColor: '#4f46e5',
    blocks: [
      { ...blankBlock('profile'), id: newId('block') },
      { ...blankBlock('tiktok'), id: newId('block'), videos: [] },
      { ...blankBlock('products'), id: newId('block'), products: [p1, p2] },
      { ...blankBlock('links'), id: newId('block'), links: [{ id: newId('link'), label: 'My latest video', url: 'https://tiktok.com' }] },
      {
        ...blankBlock('social'),
        id: newId('block'),
        socials: [
          { id: newId('social'), network: 'instagram', url: '' },
          { id: newId('social'), network: 'youtube', url: '' },
        ],
      },
      { ...blankBlock('newsletter'), id: newId('block') },
    ],
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
      buttonColor: '#0f172a',
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
  return {
    setup: defaultSetup(),
    designer: defaultDesigner(),
    publishedAt: null,
    ui: defaultUi(),
    tiktok: defaultTikTokSync(),
  };
}

/** Best-effort upgrade of the previous persisted shape into blocks. */
function migrateV2(raw: any): CreatorStorePersisted {
  const base = defaultPersisted();
  try {
    const d = raw.designer ?? {};
    const sections: Array<{ id: string; kind: string; title: string }> = Array.isArray(d.sections) ? d.sections : [];
    const products: Product[] = Array.isArray(d.products)
      ? d.products.map((p: any) => ({ link: '', cta: 'Get it', ...p }))
      : [];
    const links = Array.isArray(d.links) ? d.links : [];
    const socials = Array.isArray(d.socials) ? d.socials : [];
    const featuredId: string | null = d.featuredProductId ?? null;
    const blocks: Block[] = [];
    for (const s of sections) {
      if (s.kind === 'profile') blocks.push({ id: s.id || newId('block'), type: 'profile', title: s.title || 'Profile' });
      else if (s.kind === 'links') blocks.push({ id: s.id || newId('block'), type: 'links', title: s.title || 'Links', links });
      else if (s.kind === 'social')
        blocks.push({ id: s.id || newId('block'), type: 'social', title: s.title || 'Follow me', socials });
      else if (s.kind === 'featured') {
        const f = products.find((p) => p.id === featuredId);
        if (f) blocks.push({ id: s.id || newId('block'), type: 'products', title: s.title || 'Featured', products: [f] });
      } else if (s.kind === 'products') {
        const rest = featuredId ? products.filter((p) => p.id !== featuredId) : products;
        blocks.push({ id: s.id || newId('block'), type: 'products', title: s.title || 'Shop', products: rest });
      }
    }
    if (!blocks.some((b) => b.type === 'profile')) blocks.unshift({ ...blankBlock('profile'), id: newId('block') });
    return {
      setup: { ...base.setup, ...(raw.setup ?? {}) },
      designer: {
        ...base.designer,
        displayName: d.displayName ?? base.designer.displayName,
        bio: d.bio ?? base.designer.bio,
        avatar: d.avatar ?? '',
        avatarColor: d.avatarColor ?? base.designer.avatarColor,
        blocks,
        theme: { ...base.designer.theme, ...(d.theme ?? {}), buttonColor: d.theme?.buttonColor ?? base.designer.theme.buttonColor },
      },
      publishedAt: raw.publishedAt ?? null,
      ui: base.ui,
      tiktok: { ...base.tiktok, ...(raw.tiktok ?? {}) },
    };
  } catch {
    return base;
  }
}

export function loadPersisted(): CreatorStorePersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = defaultPersisted();
      const ui = parsed.ui && typeof parsed.ui === 'object' ? parsed.ui : {};
      const tiktok = parsed.tiktok && typeof parsed.tiktok === 'object' ? parsed.tiktok : {};
      const rawBlocks = Array.isArray(parsed.designer?.blocks) ? parsed.designer.blocks : base.designer.blocks;
      // Permanent lock: the TikTok profile always loads first; restore it
      // if an older save deleted or reordered it.
      const blocks = rawBlocks.some((b: Block) => b.type === 'profile')
        ? ensureProfileFirst(rawBlocks)
        : [{ ...blankBlock('profile'), id: newId('block') }, ...rawBlocks];
      return {
        setup: { ...base.setup, ...(parsed.setup ?? {}) },
        designer: {
          ...base.designer,
          ...(parsed.designer ?? {}),
          blocks,
          theme: { ...base.designer.theme, ...(parsed.designer?.theme ?? {}) },
        },
        publishedAt: parsed.publishedAt ?? null,
        tiktok: {
          ...base.tiktok,
          ...tiktok,
          // Tokens are never persisted on the client.
          syncing: false,
        },
        ui: {
          ...base.ui,
          ...ui,
          open: {
            design: (ui.open as Record<string, boolean> | undefined)?.design ?? base.ui.open.design,
            content: (ui.open as Record<string, boolean> | undefined)?.content ?? base.ui.open.content,
            products: (ui.open as Record<string, boolean> | undefined)?.products ?? base.ui.open.products,
          },
          phonePos: ui.phonePos ?? base.ui.phonePos,
        },
      };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateV2(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return defaultPersisted();
  } catch {
    return defaultPersisted();
  }
}

export function storeShareUrl(username: string): string {
  const slug = username.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '') || 'yourhandle';
  return `https://launchly.store/@${slug}`;
}
