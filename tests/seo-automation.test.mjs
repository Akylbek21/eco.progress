import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { canonicalForPublicPath } from '../src/seo/indexingPolicy.ts';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'seoRegistry.generated.json'), 'utf8'));
const seoPages = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'seoPages.generated.json'), 'utf8'));
const sitemap = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const sitemapSet = new Set(sitemapUrls);
const indexable = registry.filter((entry) => entry.robots === 'index,follow');
const noindex = registry.filter((entry) => entry.robots !== 'index,follow');
const noindexPaths = new Set(noindex.map((entry) => entry.path));
const redirectConfig = fs.readFileSync(path.join(root, 'deploy', 'nginx-host', 'snippets', 'legacy-redirects.conf'), 'utf8');
const serviceCityFallbackConfig = fs.readFileSync(path.join(root, 'deploy', 'nginx-host', 'snippets', 'service-city-fallbacks.generated.conf'), 'utf8');
const redirectRules = [
  ...[...redirectConfig.matchAll(/location\s+~\s+(\S+)\s*\{\s*return\s+301\s+([^;]+);/g)]
    .map((match) => ({ source: match[1], destination: match[2], pattern: new RegExp(match[1]) })),
  ...[...serviceCityFallbackConfig.matchAll(/location\s+=\s+(\S+)\s*\{\s*return\s+301\s+([^;]+);/g)]
    .map((match) => ({ source: match[1], destination: match[2], pattern: new RegExp(`^${match[1]}$`) })),
];
const pageFile = (pathname) => pathname === '/'
  ? path.join(dist, 'index.html')
  : path.join(dist, pathname.replace(/^\//, ''), 'index.html');
const capture = (html, pattern) => html.match(pattern)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';

test('every indexable page has a final self-canonical and is present exactly once in sitemap', () => {
  assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'duplicate sitemap URL');
  assert.equal(sitemapSet.size, indexable.length, 'sitemap and indexable registry counts differ');

  for (const entry of indexable) {
    const expected = canonicalForPublicPath(entry.path);
    assert.equal(entry.canonical, expected, `${entry.path}: canonical != final URL`);
    assert.equal(entry.includeInSitemap, true, `${entry.path}: indexable but excluded from sitemap`);
    assert.equal(sitemapSet.has(expected), true, `${entry.path}: indexable page absent from sitemap`);
    assert.equal(fs.existsSync(pageFile(entry.path)), true, `${entry.path}: prerendered page is not 200-ready`);
    const html = fs.readFileSync(pageFile(entry.path), 'utf8');
    const canonicals = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)];
    assert.equal(canonicals.length, 1, `${entry.path}: indexable page must have one canonical`);
    assert.equal(capture(canonicals[0][0], /href=["']([^"']+)["']/i), expected, `${entry.path}: HTML canonical != final URL`);
  }
});

test('sitemap contains neither noindex nor redirect URLs', () => {
  for (const entry of noindex) assert.equal(sitemapSet.has(entry.canonical), false, `${entry.path}: noindex in sitemap`);
  for (const url of sitemapUrls) {
    const pathname = new URL(url).pathname;
    const redirect = redirectRules.find((rule) => rule.pattern.test(pathname));
    assert.equal(redirect, undefined, `${pathname}: sitemap URL redirects via ${redirect?.source}`);
  }
});

test('generated service and related links never target noindex pages', () => {
  for (const page of seoPages) {
    for (const field of ['services', 'relatedLinks']) {
      for (const item of page[field] || []) {
        assert.equal(noindexPaths.has(item.path), false, `/${page.slug} [${field}] -> ${item.path}: internal link targets noindex`);
      }
    }
  }
});

test('indexable pages have unique non-empty Title and H1', () => {
  const titles = new Map();
  const headings = new Map();
  for (const entry of indexable) {
    const html = fs.readFileSync(pageFile(entry.path), 'utf8');
    const title = capture(html, /<title>([\s\S]*?)<\/title>/i);
    const h1 = capture(html, /<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i).toLowerCase();
    assert.ok(title, `${entry.path}: empty Title`);
    assert.ok(h1, `${entry.path}: empty H1`);
    assert.equal(titles.has(title), false, `${entry.path}: duplicate Title with ${titles.get(title)}`);
    assert.equal(headings.has(h1), false, `${entry.path}: duplicate H1 with ${headings.get(h1)}`);
    titles.set(title, entry.path);
    headings.set(h1, entry.path);
  }
});

test('internal links on indexable pages never point through a 301', () => {
  for (const entry of indexable) {
    const html = fs.readFileSync(pageFile(entry.path), 'utf8');
    for (const match of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
      const href = match[1];
      let url;
      try { url = new URL(href, 'https://ecoprogress.kz'); } catch { continue; }
      if (!['ecoprogress.kz', 'www.ecoprogress.kz'].includes(url.hostname)) continue;
      const redirect = redirectRules.find((rule) => rule.pattern.test(url.pathname));
      const redirects = url.protocol !== 'https:' || url.hostname !== 'ecoprogress.kz'
        || (url.pathname !== '/' && url.pathname.endsWith('/')) || redirect;
      assert.equal(Boolean(redirects), false, `${entry.path} -> ${href}: internal link leads through 301`);
      assert.equal(noindexPaths.has(url.pathname), false, `${entry.path} -> ${href}: internal link targets noindex`);
    }
  }
});
