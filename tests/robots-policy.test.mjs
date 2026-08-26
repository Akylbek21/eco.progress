import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { seoPages } from '../scripts/seo-data.mjs';

const [robots, registry] = await Promise.all([
  readFile(new URL('../public/robots.txt', import.meta.url), 'utf8'),
  readFile(new URL('../src/data/seoRegistry.generated.json', import.meta.url), 'utf8').then(JSON.parse),
]);

const rules = robots.split(/\r?\n/u).flatMap((line) => {
  const match = line.trim().match(/^(Allow|Disallow):\s*(\S*)$/iu);
  return match?.[2] ? [{ type: match[1].toLowerCase(), path: match[2] }] : [];
});

const isBlocked = (path) => {
  const matches = rules.filter((rule) => path.startsWith(rule.path));
  matches.sort((left, right) => right.path.length - left.path.length || (left.type === 'allow' ? -1 : 1));
  return matches[0]?.type === 'disallow';
};

test('robots keeps every indexable canonical URL crawlable', () => {
  for (const entry of registry.filter((item) => item.robots === 'index,follow')) {
    assert.equal(isBlocked(new URL(entry.canonical).pathname), false, entry.path);
  }
});

test('services, news, city landings, about and cases are not blocked', () => {
  const requiredPublicPaths = [
    '/services/report-pek',
    '/services/waste-passport',
    '/news/shtrafy-za-ekologicheskie-narusheniya',
    '/about',
    '/cases',
    ...seoPages.filter((page) => ['city', 'service-city'].includes(page.type)).map((page) => `/${page.slug}`),
  ];
  for (const path of requiredPublicPaths) assert.equal(isBlocked(path), false, path);
});

test('CRM, admin, client and staff routes are blocked', () => {
  const privatePaths = [
    '/cabinet', '/cabinet/orders', '/client', '/client/documents',
    '/staff', '/staff/orders', '/admin', '/admin/users', '/dashboard',
    '/internal/health', '/api/orders', '/login', '/register', '/reset-password',
    '/document-flow', '/sign/example', '/public/document-flow/sign/example',
  ];
  for (const path of privatePaths) assert.equal(isBlocked(path), true, path);
});

test('robots advertises only the canonical sitemap host', () => {
  assert.match(robots, /^Sitemap: https:\/\/ecoprogress\.kz\/sitemap\.xml$/mu);
  assert.match(robots, /^Host: ecoprogress\.kz$/mu);
  assert.doesNotMatch(robots, /https?:\/\/www\./iu);
});
