import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { BusinessConnectPage } from '../BusinessConnectPage';
import type { Business, businessApi } from '../businessService';

// Test fixtures only — production renders provider results exclusively.
function fixture(partial: Partial<Business>): Business {
  return {
    id: 'osm:node:1',
    provider: 'osm',
    name: 'Fixture Dental',
    category: 'Dentist',
    description: null,
    address: null,
    city: 'Chelmsford',
    country: 'GB',
    latitude: null,
    longitude: null,
    rating: null,
    reviewCount: null,
    phone: null,
    email: null,
    website: null,
    openingHours: null,
    photo: null,
    priceLevel: null,
    socialProfiles: { instagram: null, facebook: null, youtube: null, tiktok: null, linkedin: null },
    budget: { min: 1000, max: 3500, currency: 'GBP', symbol: '£', period: 'month', estimated: true },
    needs: [{ type: 'social_media', label: 'Social media', reason: 'none', confidence: 0.5 }],
    ...partial,
  };
}

const withSite = fixture({
  id: 'osm:node:1',
  name: 'Alpha Dental',
  website: 'https://alpha.example/',
  rating: 4.7,
  reviewCount: 120,
  socialProfiles: { instagram: 'https://www.instagram.com/alpha', facebook: null, youtube: null, tiktok: 'https://www.tiktok.com/@alpha', linkedin: null },
});
const bare = fixture({ id: 'osm:node:2', name: 'Beta Dental' });

type Api = typeof businessApi;

function makeApi(over: Partial<Record<keyof Api, any>> = {}): Api {
  return {
    search: vi.fn(async () => ({ data: [withSite, bare], meta: { provider: 'osm', cached: false } })),
    social: vi.fn(async (id: string) => ({
      data: { business: id === withSite.id ? withSite : bare, socialProfiles: {}, email: id === withSite.id ? 'hello@alpha.example' : null, emailSource: null, needs: [] },
      meta: {},
    })),
    preview: vi.fn(async (_id: string, platform: string) => {
      if (platform === 'website') {
        return { data: { kind: 'website', url: 'https://alpha.example/', domain: 'alpha.example', reachable: true, embeddable: false, title: 'Alpha Dental Care', description: 'Family dentist', favicon: null, image: null, keyLinks: [] }, meta: {} };
      }
      if (platform === 'tiktok') {
        return {
          data: {
            kind: 'tiktok',
            url: 'https://www.tiktok.com/@alpha',
            embeddable: false,
            profile: { username: 'alpha', displayName: 'Alpha Dental', avatar: null, bio: 'Smiles', followers: 12300, following: 12, likes: 90000, videos: [{ id: '1', cover: null, description: 'clip', views: 4500 }] },
          },
          meta: {},
        };
      }
      return { data: { kind: 'profile', platform, url: 'https://www.instagram.com/alpha', username: 'alpha', title: 'Alpha on Instagram', description: null, image: null, embeddable: false }, meta: {} };
    }),
    save: vi.fn(async () => ({ data: { id: 'lead-1' }, meta: {} })),
    notes: vi.fn(async () => ({ data: [], meta: {} })),
    addNote: vi.fn(async (_id: string, content: string) => ({ data: { id: 'n1', content, createdAt: new Date().toISOString() }, meta: {} })),
    outreach: vi.fn(async () => ({ data: [], meta: {} })),
    addOutreach: vi.fn(async (_id: string, p: any) => ({
      data: { id: 'o1', channel: 'email', subject: p.subject ?? null, body: p.body ?? '', status: p.intent === 'follow_up' ? 'scheduled' : 'draft', scheduledFor: p.scheduledFor ?? null, createdAt: new Date().toISOString() },
      meta: {},
    })),
    emailStatus: vi.fn(async () => ({ data: { connected: false, configured: false, provider: 'gmail', account: null }, meta: {} })),
    ...over,
  } as Api;
}

async function searchNow() {
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findAllByTestId('business-card');
}

afterEach(cleanup);

describe('Business Connect', () => {
  it('starts empty — no placeholder businesses in the page', () => {
    render(<BusinessConnectPage token="t" api={makeApi()} />);
    expect(screen.queryAllByTestId('business-card')).toHaveLength(0);
    expect(screen.getByText('Search real local businesses')).toBeTruthy();
    for (const fake of ["Luna's Coffee Co.", 'Iron House Fitness', 'Bloom Beauty Bar', 'Taco Vida']) {
      expect(screen.queryByText(fake)).toBeNull();
    }
  });

  it('sends the search request with country, city and type', async () => {
    const api = makeApi();
    render(<BusinessConnectPage token="tok" api={api} />);
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Colchester' } });
    fireEvent.change(screen.getByLabelText('Business type'), { target: { value: 'gym' } });
    await searchNow();
    expect(api.search).toHaveBeenCalledWith({ q: '', country: 'GB', city: 'Colchester', type: 'gym' }, 'tok');
    expect(screen.getByText('2 businesses found')).toBeTruthy();
  });

  it('shows skeletons while loading', async () => {
    let resolve!: (v: any) => void;
    const api = makeApi({ search: vi.fn(() => new Promise((r) => (resolve = r))) });
    render(<BusinessConnectPage token="t" api={api} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getAllByTestId('business-skeleton').length).toBeGreaterThan(0);
    await act(async () => resolve({ data: [], meta: {} }));
  });

  it('shows the empty state when nothing is found', async () => {
    render(<BusinessConnectPage token="t" api={makeApi({ search: vi.fn(async () => ({ data: [], meta: {} })) })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No businesses found. Try another city or category.')).toBeTruthy();
  });

  it('shows an error with a working Retry', async () => {
    const search = vi
      .fn()
      .mockRejectedValueOnce(new Error('The business data source is unavailable. Please retry.'))
      .mockResolvedValueOnce({ data: [withSite], meta: {} });
    render(<BusinessConnectPage token="t" api={makeApi({ search })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('The business data source is unavailable. Please retry.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Alpha Dental')).toBeTruthy();
  });

  it('client filters narrow the results', async () => {
    render(<BusinessConnectPage token="t" api={makeApi()} />);
    await searchNow();
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.click(screen.getByLabelText('Has website'));
    expect(screen.getAllByTestId('business-card')).toHaveLength(1);
    expect(screen.getByText(/2 before filters/)).toBeTruthy();
  });

  it('renders only verified icons, rating as unavailable, and the estimated budget', async () => {
    render(<BusinessConnectPage token="t" api={makeApi()} />);
    await searchNow();
    const [alpha, beta] = screen.getAllByTestId('business-card');
    const a = within(alpha);
    expect(a.getByLabelText('Preview Website')).toBeTruthy();
    expect(a.getByLabelText('Preview Instagram')).toBeTruthy();
    expect(a.getByLabelText('Preview TikTok')).toBeTruthy();
    expect(a.queryByLabelText('Preview Facebook')).toBeNull();
    expect(a.getByText('4.7')).toBeTruthy();
    const b = within(beta);
    expect(b.queryByRole('button', { name: /Preview/ })).toBeNull();
    expect(b.getByText('Rating unavailable')).toBeTruthy();
    expect(b.getByText('£1K – £3.5K')).toBeTruthy();
    expect(b.getByText('Estimated ad budget / mo')).toBeTruthy();
    expect(screen.queryByText(/Opportunity Score/i)).toBeNull();
    expect(screen.queryByText(/View & Contact/i)).toBeNull();
  });

  it('website click opens the right-side preview with the blocked-embed fallback', async () => {
    const api = makeApi();
    render(<BusinessConnectPage token="t" api={api} />);
    await searchNow();
    fireEvent.click(within(screen.getAllByTestId('business-card')[0]).getByLabelText('Preview Website'));
    expect(await screen.findByText('Alpha Dental Care')).toBeTruthy();
    expect(screen.getByText('This page doesn’t allow embedded viewing.')).toBeTruthy();
    expect(screen.getByText('Open External Page')).toBeTruthy();
    expect(screen.queryByTestId('preview-iframe')).toBeNull();
    expect(screen.getByTestId('preview-url').textContent).toContain('alpha.example');
  });

  it('embeddable websites render in an iframe', async () => {
    const api = makeApi({
      preview: vi.fn(async () => ({ data: { kind: 'website', url: 'https://alpha.example/', domain: 'alpha.example', reachable: true, embeddable: true, title: null, description: null, favicon: null, image: null, keyLinks: [] }, meta: {} })),
    });
    render(<BusinessConnectPage token="t" api={api} />);
    await searchNow();
    fireEvent.click(within(screen.getAllByTestId('business-card')[0]).getByLabelText('Preview Website'));
    const frame = (await screen.findByTestId('preview-iframe')) as HTMLIFrameElement;
    expect(frame.src).toBe('https://alpha.example/');
  });

  it('social click switches the preview, and back/forward walk the history', async () => {
    const api = makeApi();
    render(<BusinessConnectPage token="t" api={api} />);
    await searchNow();
    const card = within(screen.getAllByTestId('business-card')[0]);
    fireEvent.click(card.getByLabelText('Preview Website'));
    await screen.findByText('Alpha Dental Care');
    fireEvent.click(card.getByLabelText('Preview Instagram'));
    expect(await screen.findByText('Alpha on Instagram')).toBeTruthy();
    expect(api.preview).toHaveBeenLastCalledWith('osm:node:1', 'instagram', 't');
    fireEvent.click(screen.getByLabelText('Back'));
    expect(await screen.findByText('Alpha Dental Care')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Forward'));
    expect(await screen.findByText('Alpha on Instagram')).toBeTruthy();
    expect(window.location.pathname).not.toContain('instagram');
  });

  it('TikTok click shows only that business’s TikTok profile', async () => {
    render(<BusinessConnectPage token="t" api={makeApi()} />);
    await searchNow();
    fireEvent.click(within(screen.getAllByTestId('business-card')[0]).getByLabelText('Preview TikTok'));
    const tt = await screen.findByTestId('tiktok-preview');
    expect(within(tt).getByText('@alpha')).toBeTruthy();
    expect(within(tt).getByText('12.3K')).toBeTruthy();
    expect(within(tt).getByText('4.5K views')).toBeTruthy();
  });

  it('TikTok profile not found state', async () => {
    const api = makeApi({ preview: vi.fn(async () => ({ data: { kind: 'tiktok', url: 'https://www.tiktok.com/@alpha', embeddable: false, profile: null }, meta: {} })) });
    render(<BusinessConnectPage token="t" api={api} />);
    await searchNow();
    fireEvent.click(within(screen.getAllByTestId('business-card')[0]).getByLabelText('Preview TikTok'));
    expect(await screen.findByText('TikTok profile not found')).toBeTruthy();
  });

  it('outreach: verified email shown, "Email not found" otherwise, Gmail not connected', async () => {
    render(<BusinessConnectPage token="t" api={makeApi()} />);
    await searchNow();
    fireEvent.click(screen.getAllByTestId('business-card')[0]);
    await waitFor(() => expect(screen.getByTestId('email-to').textContent).toBe('hello@alpha.example'));
    expect(await screen.findByTestId('connect-gmail')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Send Email/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getAllByTestId('business-card')[1]);
    await waitFor(() => expect(screen.getByTestId('email-to').textContent).toBe('Email not found'));
  });

  it('saves a draft and a note to the selected lead', async () => {
    const api = makeApi();
    render(<BusinessConnectPage token="t" api={api} />);
    await searchNow();
    fireEvent.click(screen.getAllByTestId('business-card')[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Save Draft' }));
    expect(await screen.findByText('Draft saved to this lead.')).toBeTruthy();
    expect(api.addOutreach).toHaveBeenCalledWith('osm:node:1', expect.objectContaining({ intent: 'draft', channel: 'email' }), 't');

    fireEvent.click(screen.getByRole('tab', { name: 'Add Note' }));
    fireEvent.change(screen.getByPlaceholderText(/Spoke to the owner/), { target: { value: 'Call back Tuesday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }));
    expect(await screen.findByText('Call back Tuesday')).toBeTruthy();
    expect(api.addNote).toHaveBeenCalledWith('osm:node:1', 'Call back Tuesday', 't');
  });
});
