import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getAllPublicUrls, publicStaticPages, seoArticles, seoPages, SITE_URL } from '../scripts/seo-data.mjs';

test('SEO registry has unique canonical URLs, titles and descriptions', () => {
  const records = [
    ...publicStaticPages.map((page) => ({ ...page, canonical: `${SITE_URL}${page.path === '/' ? '/' : page.path}` })),
    ...seoPages,
    ...seoArticles.map((article) => ({ ...article, canonical: `${SITE_URL}${article.slug}`, title: `${article.title} | ECOPROGRESS` })),
  ];
  assert.equal(new Set(records.map((record) => record.canonical)).size, records.length);
  assert.equal(new Set(records.map((record) => record.title)).size, records.length);
  assert.equal(new Set(records.map((record) => record.description)).size, records.length);
  for (const record of records) {
    assert.ok(record.title.trim());
    assert.ok(record.description.trim());
    assert.ok(record.h1.trim());
    assert.match(record.canonical, /^https:\/\/ecoprogress\.kz\/(?!.*\/$)/);
  }
});

test('sitemap excludes private, auth and 404 routes', () => {
  const urls = getAllPublicUrls().map((item) => item.loc);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) assert.doesNotMatch(url, /\/(?:staff|cabinet|admin|login|register|reset-password|404)(?:\/|$)/);
});

test('waste utilization SEO is limited to Shymkent', () => {
  const utilizationPages = seoPages.filter((page) => page.slug.startsWith('utilizaciya-othodov-'));
  assert.deepEqual(utilizationPages.map((page) => page.slug), ['utilizaciya-othodov-shymkent']);
  assert.ok(utilizationPages.every((page) => page.city === 'Шымкент'));
});

test('analytics uses direct gtag, single SPA page view and success-only lead event', async () => {
  const analytics = await readFile(new URL('../src/services/analytics.ts', import.meta.url), 'utf8');
  const tracker = await readFile(new URL('../src/components/AnalyticsRouteTracker.tsx', import.meta.url), 'utf8');
  const leadForm = await readFile(new URL('../src/components/LeadForm.tsx', import.meta.url), 'utf8');
  assert.match(analytics, /send_page_view: false/);
  assert.match(analytics, /window\.gtag\?\.\('event', eventName, params\)/);
  assert.match(analytics, /trackEvent\('generate_lead'/);
  assert.match(tracker, /location\.pathname/);
  const submitStart = leadForm.indexOf('const submit = async');
  const apiSuccess = leadForm.indexOf('await createLead', submitStart);
  const leadEvent = leadForm.indexOf('trackLeadSubmit', apiSuccess);
  const errorBranch = leadForm.indexOf('} catch', apiSuccess);
  assert.ok(apiSuccess > submitStart && apiSuccess < leadEvent);
  assert.ok(leadEvent < errorBranch);
});
