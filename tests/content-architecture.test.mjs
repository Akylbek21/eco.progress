import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activeServices, formatKztPrice, getCatalogService, normalizeServiceSlug, serviceCatalog, serviceSlugAliases } from '../src/content/serviceCatalog.ts';
import { normalizeArticleDates } from '../src/utils/articleDates.ts';
import { regions } from '../src/content/regions.ts';
import { seoArticles } from '../scripts/seo-data.mjs';

test('service catalog has stable unique slugs and valid relations', () => {
  const articleSlugs = new Set(seoArticles.map((article) => article.id));
  assert.ok(serviceCatalog.length > 4);
  assert.equal(new Set(serviceCatalog.map((item) => item.id)).size, serviceCatalog.length);
  assert.equal(new Set(serviceCatalog.map((item) => item.slug)).size, serviceCatalog.length);
  for (const service of serviceCatalog) {
    assert.equal(service.id, service.slug);
    for (const slug of service.relatedServiceSlugs) assert.ok(getCatalogService(slug), `${service.slug} -> ${slug}`);
    for (const slug of service.relatedArticleSlugs) assert.ok(articleSlugs.has(slug), `${service.slug} -> article ${slug}`);
    if (service.showInCalculator) assert.equal(typeof service.pricing.calculatorBasePrice, 'number');
  }
});

test('legacy aliases resolve to canonical service slugs', () => {
  assert.equal(normalizeServiceSlug('eco-design'), 'ecological-documents');
  assert.equal(normalizeServiceSlug('laboratory'), 'laboratory-tests');
  for (const canonical of Object.values(serviceSlugAliases)) assert.ok(getCatalogService(canonical));
});

test('KZT formatting handles missing, minimum and range prices', () => {
  assert.equal(formatKztPrice({ currency: 'KZT', requiresCalculation: true }), 'Стоимость рассчитывается индивидуально');
  assert.match(formatKztPrice({ priceFrom: 180000, currency: 'KZT', requiresCalculation: true }), /^от 180.000 ₸$/u);
  assert.match(formatKztPrice({ priceFrom: 180000, priceTo: 350000, currency: 'KZT', requiresCalculation: true }), /^от 180.000 до 350.000 ₸$/u);
  assert.ok(activeServices.filter((item) => item.showInTariffs).every((item) => formatKztPrice(item.pricing)));
});

test('article dates are normalized and generated articles are valid', () => {
  const normalized = normalizeArticleDates('2026-07-10', '2026-07-08');
  assert.equal(normalized.dateModified, normalized.datePublished);
  assert.match(normalized.datePublished, /^2026-07-10T/);
  for (const article of seoArticles) assert.ok(new Date(article.dateModified) >= new Date(article.datePublished));
});

test('manual region forms do not produce known invalid phrases', () => {
  const text = regions.map((item) => `Для предприятий ${item.regionGenitive}. Работаем в ${item.regionPrepositional}.`).join('\n');
  assert.doesNotMatch(text, /для Алматы и Алматинская область/iu);
  assert.doesNotMatch(text, /в Караганда и Карагандинская область/iu);
  assert.doesNotMatch(text, /для Астана и Акмолинская область/iu);
  assert.equal(regions.find((item) => item.slug === 'karaganda')?.regionPrepositional, 'Караганде и Карагандинской области');
});

test('regions route and canonical alias redirect are wired before catch-all route', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const route = await readFile(new URL('../src/pages/ServiceRoutePage.tsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/regions"/);
  assert.ok(app.indexOf('path="/regions"') < app.indexOf('path="/:seoSlug"'));
  assert.match(route, /normalizeServiceSlug/);
  assert.match(route, /<Navigate to=\{`\/services\/\$\{canonicalSlug\}`\} replace/);
});

test('news distinguishes API success, empty response and real fallback errors', async () => {
  const source = await readFile(new URL('../src/services/newsService.ts', import.meta.url), 'utf8');
  assert.match(source, /fetcher<ArticleContent\[]>\('\/public\/content\/articles'\)/);
  assert.match(source, /Array\.isArray\(items\).*source: 'api'/s);
  assert.match(source, /items: fallbackNews, source: 'fallback', stale: true/);
  assert.doesNotMatch(source, /getNews\s*=\s*async[^\n]+fallbackNews/);
});

test('schema generators are separated by content type', async () => {
  const source = await readFile(new URL('../src/utils/schema.ts', import.meta.url), 'utf8');
  for (const name of ['buildOrganizationSchema', 'buildServiceSchema', 'buildArticleSchema', 'buildFaqSchema', 'buildBreadcrumbSchema']) assert.match(source, new RegExp(`export const ${name}`));
  const articleStart = source.indexOf('export const buildArticleSchema');
  const faqStart = source.indexOf('export const buildFaqSchema');
  const articleBuilder = source.slice(articleStart, faqStart);
  assert.doesNotMatch(articleBuilder, /serviceType|areaServed/);
});
