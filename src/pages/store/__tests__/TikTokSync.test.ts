import { describe, expect, it } from 'vitest';
import { applyTikTokProfile, defaultDesigner } from '../store';
import { normalizeTikTokProfile, shouldAutoSync } from '../tiktok';

describe('TikTok profile sync', () => {
  it('mirrors real TikTok identity into the designer', () => {
    const designer = defaultDesigner('oldhandle');
    const next = applyTikTokProfile(designer, {
      openId: 'tiktok-open-id-1',
      username: 'lovyx21',
      displayName: 'Lovy',
      avatar: 'https://tiktok/avatar.jpg',
      bio: 'Real TikTok bio',
    });
    expect(next.username).toBe('lovyx21');
    expect(next.displayName).toBe('Lovy');
    expect(next.avatar).toBe('https://tiktok/avatar.jpg');
    expect(next.bio).toBe('Real TikTok bio');
  });

  it('never wipes real identity with empty/failed payloads', () => {
    const designer = {
      ...defaultDesigner('lovyx21'),
      username: 'lovyx21',
      displayName: 'Lovy',
      avatar: 'https://tiktok/avatar.jpg',
      bio: 'Real bio',
    };
    expect(applyTikTokProfile(designer, null).username).toBe('lovyx21');
    expect(applyTikTokProfile(designer, { openId: '', username: '', displayName: '', avatar: '' }).avatar).toBe(
      'https://tiktok/avatar.jpg'
    );
  });

  it('normalizes Display API user.info.basic + user.info.profile fields', () => {
    const profile = normalizeTikTokProfile({
      data: {
        user: {
          open_id: 'oid-123',
          username: '@lovyx21',
          display_name: 'Lovy',
          avatar_url: 'https://tiktok/a.jpg',
          bio_description: 'Presets & templates',
        },
      },
    });
    expect(profile).toMatchObject({ openId: 'oid-123', username: 'lovyx21', displayName: 'Lovy' });
    expect(normalizeTikTokProfile({})).toBeNull();
  });

  it('auto-syncs on open and every 15 minutes', () => {
    expect(shouldAutoSync(null)).toBe(true);
    expect(shouldAutoSync(new Date(Date.now() - 16 * 60_000).toISOString())).toBe(true);
    expect(shouldAutoSync(new Date().toISOString())).toBe(false);
  });
});
