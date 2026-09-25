import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTikTokUsername } from './usernameNormalizer.ts';

test('plain username', () => {
  const r = normalizeTikTokUsername('creatorname');
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.username, 'creatorname');
});

test('@username', () => {
  const r = normalizeTikTokUsername('@creatorname');
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.username, 'creatorname');
});

test('full TikTok profile URL', () => {
  const r = normalizeTikTokUsername('https://www.tiktok.com/@creatorname');
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.username, 'creatorname');
});

test('TikTok URL with trailing path/query', () => {
  const r = normalizeTikTokUsername('https://www.tiktok.com/@creatorname?lang=en');
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.username, 'creatorname');
});

test('trims whitespace', () => {
  const r = normalizeTikTokUsername('  creatorname  ');
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.username, 'creatorname');
});

test('lowercases', () => {
  const r = normalizeTikTokUsername('CreatorName');
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.username, 'creatorname');
});

test('rejects empty input', () => {
  const r = normalizeTikTokUsername('');
  assert.equal(r.ok, false);
});

test('rejects malformed username', () => {
  const r = normalizeTikTokUsername('not a username!!');
  assert.equal(r.ok, false);
});

test('rejects overly long username', () => {
  const r = normalizeTikTokUsername('a'.repeat(40));
  assert.equal(r.ok, false);
});
