export interface StoreProduct {
  id: string;
  name: string;
  price: number;
  kind: 'digital' | 'custom';
  description: string;
  deliveryUrl: string;
  active: boolean;
}

export interface StoreProfile {
  handle: string;
  displayName: string;
  bio: string;
  theme: string;
  currency: string;
  paymentProvider: 'stripe' | 'paypal' | 'manual';
  paymentHandle: string;
}

export interface StoreOrder {
  id: string;
  productId: string;
  productName: string;
  amount: number;
  buyer: string;
  date: string;
}

export const STORE_THEMES = [
  { id: 'indigo', label: 'Indigo', from: '#4f46e5', to: '#7c3aed' },
  { id: 'rose', label: 'Rose', from: '#e11d48', to: '#f97316' },
  { id: 'emerald', label: 'Emerald', from: '#059669', to: '#0d9488' },
  { id: 'slate', label: 'Midnight', from: '#0f172a', to: '#334155' },
] as const;

export const CURRENCIES = ['USD', 'GBP', 'EUR'] as const;

export const STORAGE_KEY = 'launchly.creator-store';

export interface CreatorStoreState {
  profile: StoreProfile;
  products: StoreProduct[];
  orders: StoreOrder[];
}

export const defaultState: CreatorStoreState = {
  profile: {
    handle: 'yourhandle',
    displayName: 'Your Studio',
    bio: 'Digital presets, templates & custom orders — delivered instantly.',
    theme: 'indigo',
    currency: 'USD',
    paymentProvider: 'stripe',
    paymentHandle: '',
  },
  products: [
    {
      id: 'preset-pack',
      name: 'Viral TikTok Preset Pack',
      price: 19,
      kind: 'digital',
      description: '10 Lightroom presets tuned for TikTok talking-head videos.',
      deliveryUrl: 'https://example.com/presets.zip',
      active: true,
    },
    {
      id: 'custom-edit',
      name: 'Custom 1:1 Video Edit',
      price: 79,
      kind: 'custom',
      description: 'Send your clips, get a captioned edit back in 48h.',
      deliveryUrl: '',
      active: true,
    },
  ],
  orders: [],
};

export function slugifyHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

export function loadState(): CreatorStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      profile: { ...defaultState.profile, ...(parsed.profile ?? {}) },
      products: Array.isArray(parsed.products) ? parsed.products : defaultState.products,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    };
  } catch {
    return defaultState;
  }
}

export function storeUrl(handle: string): string {
  const slug = slugifyHandle(handle.trim()) || 'yourhandle';
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/s/${slug}`;
  }
  return `https://launchly.store/@${slug}`;
}

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
