import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { publicStaticPages, seoArticles, seoPages } from '../scripts/seo-data.mjs';
import { canonicalForPublicPath } from '../src/seo/indexingPolicy.ts';
import { isLegacyPublicPath, isPrivateOrSystemPath, sitemapEligibilityErrors } from '../src/seo/sitemapPolicy.ts';

const [sitemapXml, registry] = await Promise.all([
  readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
  readFile(new URL('../src/data/seoRegistry.generated.json', import.meta.url), 'utf8').then(JSON.parse),
]);
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
const sitemapUrlSet = new Set(sitemapUrls);
const registryByCanonical = new Map(registry.map((entry) => [entry.canonical, entry]));
const prerenderSourceCanonicals = new Set([
  ...publicStaticPages.map((page) => canonicalForPublicPath(page.path)),
  ...seoPages.map((page) => canonicalForPublicPath(`/${page.slug}`)),
  ...seoArticles.map((article) => canonicalForPublicPath(article.slug)),
]);

test('sitemap contains only unique 200-ready indexable self-canonical URLs', () => {
  assert.equal(sitemapUrlSet.size, sitemapUrls.length, 'duplicate sitemap URLs');

  for (const url of sitemapUrls) {
    const parsed = new URL(url);
    const entry = registryByCanonical.get(url);
    assert.ok(entry, `${url}: missing registry entry`);
    assert.deepEqual(sitemapEligibilityErrors(entry), [], url);
    assert.equal(parsed.protocol, 'https:', url);
    assert.equal(parsed.hostname, 'ecoprogress.kz', url);
    assert.equal(parsed.search, '', url);
    assert.equal(parsed.hash, '', url);
    if (parsed.pathname !== '/') assert.ok(!parsed.pathname.endsWith('/'), url);
    assert.ok(prerenderSourceCanonicals.has(url), `${url}: missing prerender source`);
    assert.equal(isLegacyPublicPath(parsed.pathname), false, url);
    assert.equal(isPrivateOrSystemPath(parsed.pathname), false, url);
  }
});

test('noindex, 404 and service/CRM routes excluded by policy stay out of sitemap', () => {
  for (const entry of registry.filter((item) => item.robots !== 'index,follow' || !item.includeInSitemap)) {
    assert.equal(sitemapUrlSet.has(entry.canonical), false, entry.path);
  }
  for (const path of ['/404', '/staff', '/admin', '/cabinet', '/client', '/dashboard', '/internal', '/api']) {
    assert.equal([...sitemapUrlSet].some((url) => new URL(url).pathname === path), false, path);
  }
});

test('city, service-city and service pages follow the same sitemap eligibility rules', () => {
  const cityAndServicePages = seoPages.filter((page) => ['city', 'service-city', 'service'].includes(page.type));
  const serviceEntries = registry.filter((entry) => entry.path.startsWith('/services/'));
  assert.ok(cityAndServicePages.length > 0, 'expected generated city/service pages');
  assert.ok(serviceEntries.length > 0, 'expected service registry entries');

  for (const page of cityAndServicePages) {
    const canonical = canonicalForPublicPath(`/${page.slug}`);
    const entry = registryByCanonical.get(canonical);
    assert.ok(entry, page.slug);
    assert.equal(sitemapUrlSet.has(canonical), entry.robots === 'index,follow' && entry.includeInSitemap, page.slug);
  }
  for (const entry of serviceEntries) {
    assert.equal(sitemapUrlSet.has(entry.canonical), entry.robots === 'index,follow' && entry.includeInSitemap, entry.path);
  }
});
