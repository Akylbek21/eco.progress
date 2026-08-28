import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activeServices, DEFAULT_SECONDARY_CTA_LABEL, formatKztPrice, GENERAL_PRIMARY_CTA_LABEL, getCatalogService, getServicePrimaryCtaLabel, getServiceSecondaryCtaLabel, normalizeServiceSlug, serviceCatalog, serviceSlugAliases } from '../src/content/serviceCatalog.ts';
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

test('primary CTA follows the service intent', () => {
  const expected = {
    ndv: 'Рассчитать стоимость НДВ',
    szz: 'Получить расчёт СЗЗ',
    'report-pek': 'Рассчитать стоимость отчёта ПЭК',
    'program-pek': 'Рассчитать стоимость программы ПЭК',
    'waste-passport': 'Рассчитать стоимость паспорта',
    ovos: 'Получить расчёт ОВОС',
    roos: 'Получить расчёт РООС',
    'environmental-permits': 'Получить консультацию эколога',
    'waste-recycling': 'Рассчитать стоимость утилизации',
    'laboratory-tests': 'Рассчитать стоимость замеров',
  };
  for (const [slug, label] of Object.entries(expected)) assert.equal(getServicePrimaryCtaLabel(slug), label);
  assert.equal(getServicePrimaryCtaLabel('unknown-service'), GENERAL_PRIMARY_CTA_LABEL);
  assert.equal(getServiceSecondaryCtaLabel('unknown-service'), DEFAULT_SECONDARY_CTA_LABEL);
  assert.equal(getServiceSecondaryCtaLabel('report-pek'), 'Отправить документы на проверку');
  assert.equal(getServiceSecondaryCtaLabel('roos'), 'Отправить проект на проверку');
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
  const text = regions.map((item) => `Для предприятий ${item.cityGenitive} и ${item.regionGenitive}. Работаем в ${item.cityPrepositional} и ${item.regionPrepositional}.`).join('\n');
  assert.doesNotMatch(text, /для Алматы и Алматинская область/iu);
  assert.doesNotMatch(text, /в Караганда и Карагандинская область/iu);
  assert.doesNotMatch(text, /для Астана и Акмолинская область/iu);
  assert.equal(regions.find((item) => item.slug === 'karaganda')?.regionPrepositional, 'Карагандинской области');
  assert.deepEqual(regions.find((item) => item.slug === 'semey'), {
    slug: 'semey', city: 'Семей', cityNominative: 'Семей', cityGenitive: 'Семея', cityDative: 'Семею', cityAccusative: 'Семей', cityInstrumental: 'Семеем', cityPrepositional: 'Семее', regionNominative: 'область Абай', regionGenitive: 'области Абай', regionDative: 'области Абай', regionInstrumental: 'областью Абай', regionPrepositional: 'области Абай',
  });
});

test('regions route and canonical alias redirect are wired before catch-all route', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const route = await readFile(new URL('../src/pages/ServiceRoutePage.tsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/regions"/);
  assert.ok(app.indexOf('path="/regions"') < app.indexOf('path="/:seoSlug"'));
  assert.match(route, /normalizeServiceSlug/);
  assert.match(route, /<Navigate to=\{`\/services\/\$\{canonicalSlug\}`\} replace/);
});

test('news renders the complete static article registry without a production API dependency', async () => {
  const source = await readFile(new URL('../src/services/newsService.ts', import.meta.url), 'utf8');
  assert.match(source, /articleContent\.filter\(\(article\) => article\.status === 'published'\)/);
  assert.match(source, /return prerenderNewsResult/);
  assert.match(source, /normalizeArticleSlug/);
  assert.doesNotMatch(source, /publicContentRepository|fetcher|SEO_CONTENT_API/);
});

test('all required schema entities come from one builder module', async () => {
  const source = await readFile(new URL('../src/seo/entityBuilders.ts', import.meta.url), 'utf8');
  for (const name of ['buildOrganizationSchema', 'buildLocalBusinessSchema', 'buildWebSiteSchema', 'buildWebPageSchema', 'buildServiceEntity', 'buildPersonSchema', 'buildArticleSchema', 'buildBreadcrumbSchema']) assert.match(source, new RegExp(`export const ${name}`));
  const prerender = await readFile(new URL('../scripts/prerender.js', import.meta.url), 'utf8');
  const generator = await readFile(new URL('../scripts/generate-sitemap.js', import.meta.url), 'utf8');
  assert.match(prerender, /seoRegistry\.generated\.json/);
  assert.doesNotMatch(prerender, /seo\/entityBuilders\.ts/);
  assert.match(generator, /seo\/entityBuilders\.ts/);
  assert.doesNotMatch(prerender, /const build(?:Organization|Service|Breadcrumb)Schema/);
});
