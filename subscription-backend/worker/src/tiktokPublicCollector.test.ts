import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEmbeddedState, parseOpenGraphProfile } from './tiktokPublicCollector.ts';

/**
 * Minimal fixtures shaped like the real public profile page's structure,
 * not copies of any real page — enough to exercise the parser without
 * depending on live network access.
 */
const HYDRATION_FIXTURE = {
  __DEFAULT_SCOPE__: {
    'webapp.user-detail': {
      userInfo: {
        user: {
          id: '6829267836783183873',
          uniqueId: 'examplecreator',
          nickname: 'Example Creator',
          avatarLarger: 'https://example.com/avatar.jpg',
          signature: 'Just an example bio',
        },
        stats: {
          followerCount: 128432,
          followingCount: 310,
          heartCount: 4200000,
          videoCount: 312,
        },
      },
      itemList: [
        {
          id: '7000000000000000001',
          desc: 'First video',
          video: { cover: 'https://example.com/cover1.jpg' },
          stats: { playCount: 50000, diggCount: 4000, commentCount: 180, shareCount: 90 },
          createTime: 1700000000,
        },
        {
          id: '7000000000000000002',
          desc: 'Second video',
          video: { cover: 'https://example.com/cover2.jpg' },
          stats: { playCount: 62000, diggCount: 4200, commentCount: 190, shareCount: 95 },
          createTime: 1700600000,
        },
      ],
    },
  },
};

function htmlWithHydration(payload: unknown) {
  return `<html><head></head><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(payload)}</script></body></html>`;
}

test('parses profile + videos out of the embedded hydration state', () => {
  const html = htmlWithHydration(HYDRATION_FIXTURE);
  const state = parseEmbeddedState(html);
  assert.ok(state);
  const user = state.__DEFAULT_SCOPE__['webapp.user-detail'].userInfo.user;
  assert.equal(user.uniqueId, 'examplecreator');
  assert.equal(state.__DEFAULT_SCOPE__['webapp.user-detail'].itemList.length, 2);
});

test('returns null for a page with no hydration script', () => {
  const state = parseEmbeddedState('<html><body>no script here</body></html>');
  assert.equal(state, null);
});

test('returns null for malformed JSON inside the hydration script', () => {
  const html =
    '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{not valid json</script>';
  const state = parseEmbeddedState(html);
  assert.equal(state, null);
});

test('OpenGraph fallback reads title/image/description', () => {
  const html = `
    <meta property="og:title" content="Example Creator" />
    <meta property="og:image" content="https://example.com/avatar.jpg" />
    <meta property="og:description" content="Just an example bio" />
  `;
  const og = parseOpenGraphProfile(html);
  assert.equal(og.displayName, 'Example Creator');
  assert.equal(og.avatar, 'https://example.com/avatar.jpg');
  assert.equal(og.bio, 'Just an example bio');
});

test('OpenGraph fallback returns nulls when tags are absent', () => {
  const og = parseOpenGraphProfile('<html><body>nothing</body></html>');
  assert.equal(og.displayName, null);
  assert.equal(og.avatar, null);
  assert.equal(og.bio, null);
});
