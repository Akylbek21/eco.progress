import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { readIndexableUrls, validateIndexNowUrls } from '../scripts/submit-indexnow.mjs';

test('IndexNow payload uses only unique canonical site URLs', () => {
  const urls = validateIndexNowUrls(readIndexableUrls());
  assert.equal(urls.length, new Set(urls).size);
  assert.ok(urls.every((url) => new URL(url).origin === 'https://ecoprogress.kz'));
});

test('IndexNow defaults to a network-free dry run', () => {
  const output = execFileSync(process.execPath, ['scripts/submit-indexnow.mjs'], { encoding: 'utf8' });
  assert.match(output, /IndexNow dry run:/u);
  assert.match(output, /Use --submit after deployment/u);
});

test('IndexNow rejects foreign hosts', () => {
  assert.throws(() => validateIndexNowUrls(['https://example.com/page']), /non-canonical URL rejected/u);
});
