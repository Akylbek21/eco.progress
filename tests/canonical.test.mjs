import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canonicalForPublicPath } from '../src/seo/indexingPolicy.ts';
import { absoluteUrl } from '../src/seo/url.ts';

const registry = JSON.parse(await readFile(
  new URL('../src/data/seoRegistry.generated.json', import.meta.url),
  'utf8',
));

test('canonical URL normalization removes scheme, host, slash and tracking variants', () => {
  const expected = 'https://ecoprogress.kz/services/report-pek';
  const variants = [
    '/services/report-pek',
    '/services/report-pek/',
    '/services/report-pek/?utm_source=google&utm_campaign=seo',
    'http://ecoprogress.kz/services/report-pek/?ref=legacy#details',
    'https://www.ecoprogress.kz/services/report-pek/?gclid=123',
  ];

  for (const variant of variants) {
    assert.equal(absoluteUrl(variant), expected);
    assert.equal(canonicalForPublicPath(variant), expected);
  }
});

test('every indexable registry entry has exactly its normalized self canonical', () => {
  const indexableEntries = registry.filter((entry) => entry.robots === 'index,follow');

  for (const entry of indexableEntries) {
    assert.equal(entry.canonical, canonicalForPublicPath(entry.path), entry.path);
    const canonical = new URL(entry.canonical);
    assert.equal(canonical.protocol, 'https:', entry.path);
    assert.equal(canonical.hostname, 'ecoprogress.kz', entry.path);
    assert.equal(canonical.search, '', entry.path);
    assert.equal(canonical.hash, '', entry.path);
    if (canonical.pathname !== '/') assert.ok(!canonical.pathname.endsWith('/'), entry.path);
  }

  assert.equal(
    registry.find((entry) => entry.path === '/services/report-pek')?.canonical,
    'https://ecoprogress.kz/services/report-pek',
  );
});
