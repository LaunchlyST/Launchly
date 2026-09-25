import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCreatorMetrics } from './creatorMetrics.ts';
import type { LaunchlyCreatorVideo } from './creatorTypes.ts';

function video(partial: Partial<LaunchlyCreatorVideo>): LaunchlyCreatorVideo {
  return {
    id: null,
    description: null,
    cover: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    publishedAt: null,
    ...partial,
  };
}

test('no videos → everything null', () => {
  const m = calculateCreatorMetrics([]);
  assert.deepEqual(m, {
    avgViews: null,
    avgLikes: null,
    avgComments: null,
    avgShares: null,
    engagementRate: null,
    postingFrequencyPerWeek: null,
  });
});

test('averages real numbers only, ignoring nulls', () => {
  const m = calculateCreatorMetrics([
    video({ views: 100, likes: 10, comments: 2, shares: 1 }),
    video({ views: 200, likes: 20, comments: 4, shares: 3 }),
    video({ views: null, likes: null, comments: null, shares: null }),
  ]);
  assert.equal(m.avgViews, 150);
  assert.equal(m.avgLikes, 15);
  assert.equal(m.avgComments, 3);
  assert.equal(m.avgShares, 2);
});

test('engagement rate is (likes+comments+shares)/views * 100', () => {
  const m = calculateCreatorMetrics([video({ views: 1000, likes: 50, comments: 30, shares: 20 })]);
  assert.equal(m.engagementRate, 10);
});

test('engagement rate is null when there are no views', () => {
  const m = calculateCreatorMetrics([video({ likes: 10 })]);
  assert.equal(m.engagementRate, null);
});

test('posting frequency uses the real publish-date span', () => {
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const m = calculateCreatorMetrics([
    video({ publishedAt: new Date(now - 3 * week).toISOString() }),
    video({ publishedAt: new Date(now - 2 * week).toISOString() }),
    video({ publishedAt: new Date(now - 1 * week).toISOString() }),
    video({ publishedAt: new Date(now).toISOString() }),
  ]);
  // 4 videos over a 3 week span → ~1.3/week
  assert.equal(m.postingFrequencyPerWeek, 1.3);
});

test('posting frequency is null with fewer than two dated videos', () => {
  const m = calculateCreatorMetrics([video({ publishedAt: new Date().toISOString() })]);
  assert.equal(m.postingFrequencyPerWeek, null);
});
