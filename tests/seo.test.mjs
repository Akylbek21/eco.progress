import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { seoArticles, seoPages } from '../scripts/seo-data.mjs';
import { articleRobotsForReviewStatus, isArticleEligibleForSeoLinks } from '../src/content/articleReview.ts';
import { articleContent } from '../src/content/articles/articleContent.ts';
import { regionContent } from '../src/content/regions/regionContent.ts';
import { regions } from '../src/content/regions.ts';
import { createSchemaGraph } from '../src/seo/schemaGraph.ts';

const registry = JSON.parse(await readFile(new URL('../src/data/seoRegistry.generated.json', import.meta.url), 'utf8'));

test('production SEO build fails closed on empty CMS and sitemap regression', async () => {
  const [sync, audit, dockerfile, compose, quality] = await Promise.all([
    readFile(new URL('../scripts/sync-seo-content.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/seo-audit.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../Dockerfile', import.meta.url), 'utf8'),
    readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8'),
    readFile(new URL('../src/content/regions/regionContentQuality.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(sync, /experts, cases and articleReviews are all empty/);
  assert.match(sync, /process\.env\.SEO_CONTENT_API_URL/);
  assert.match(audit, /errors\.push\('SEO CMS snapshot is empty/);
  assert.doesNotMatch(audit, /if \(cmsContentUnavailable\) warnings\.push\(`\$\{message\}/);
  assert.match(dockerfile, /ARG SEO_CONTENT_API_URL/);
  assert.match(compose, /SEO_CONTENT_API_URL is required for production build/);
  assert.doesNotMatch(quality, /publishedCaseStudies|confirmedCaseSlugs/);
});

test('SEO registry has unique canonical URLs, titles and descriptions', () => {
  const records = registry.filter((record) => record.robots === 'index,follow');
  assert.equal(new Set(records.map((record) => record.canonical)).size, records.length);
  assert.equal(new Set(records.map((record) => record.title)).size, records.length);
  assert.equal(new Set(records.map((record) => record.description)).size, records.length);
  for (const record of records) {
    assert.ok(record.title.trim());
    assert.ok(record.description.trim());
    assert.ok(record.h1.trim());
    assert.match(record.canonical, /^https:\/\/ecoprogress\.kz(?:\/(?!.*\/$))?/);
  }
});

test('sitemap is derived exactly from the unified SEO registry', async () => {
  const urls = registry.filter((item) => item.includeInSitemap).map((item) => item.canonical);
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gu)].map((match) => match[1]);
  assert.deepEqual(sitemapUrls, urls);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) assert.doesNotMatch(url, /\/(?:staff|cabinet|client|admin|dashboard|internal|login|register|reset-password|api|404)(?:\/|$)/);
});

test('priority Kazakh pages are reciprocal localized entries in the unified registry and sitemap', async () => {
  const required = ['/kk/', '/kk/ekologiyalyq-qyzmetter', '/kk/qaldyqtar-pasporty', '/kk/services/ndv', '/kk/pek-bagdarlamasy', '/kk/pek-esebi', '/kk/ekologiyalyq-ruqsat', '/kk/sanitariyalyq-qorgau-aimagy', '/kk/zerthanalyq-zertteuler', '/kk/su-analizi', '/kk/qaldyqtardy-kadege-zharatu', '/kk/pek-bagdarlamasy-shymkent'];
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  for (const path of required) {
    const entry = registry.find((item) => item.path === path);
    assert.ok(entry, path);
    assert.equal(entry.locale, 'kk');
    assert.equal(entry.robots, 'index,follow');
    assert.equal(entry.canonical, `https://ecoprogress.kz${path === '/kk/' ? '/kk' : path}`);
    assert.ok(entry.alternatePath?.startsWith('/'));
    const ru = registry.find((item) => item.path === entry.alternatePath);
    assert.equal(ru?.alternatePath, path);
    assert.ok(entry.pageId, `${path}: shared page identity`);
    assert.equal(ru?.pageId, entry.pageId, `${path}: RU and KK are localizations of one page`);
    assert.deepEqual(entry.alternates.map((item) => item.locale), ['ru-KZ', 'kk-KZ', 'x-default']);
    assert.ok(sitemap.includes(`<loc>${entry.canonical}</loc>`));
    for (const alternate of entry.alternates) assert.ok(sitemap.includes(`hreflang="${alternate.locale}" href="${alternate.url}"`));
    const page = seoPages.find((item) => `/${item.slug}` === path);
    assert.ok(page?.intro.length > 120, `${path}: useful intro`);
    assert.ok((page?.sections.length || 0) >= 4, `${path}: structured content`);
    assert.ok(page?.relatedLinks.every((link) => link.path.startsWith('/kk/')), `${path}: KK internal links`);
  }
  const [publicApp, layout] = await Promise.all([readFile(new URL('../src/PublicApp.tsx', import.meta.url), 'utf8'), readFile(new URL('../src/layouts/PublicLayout.tsx', import.meta.url), 'utf8')]);
  assert.match(publicApp, /path="\/kk\/\*"/);
  assert.match(layout, />RU<\/Link>/);
  assert.match(layout, />ҚАЗ<\/Link>/);
  assert.doesNotMatch(layout, /navigator\.language|location\.replace/);
});

test('article indexing follows reviewStatus and keeps a self canonical', async () => {
  assert.equal(articleRobotsForReviewStatus('approved'), 'index,follow');
  for (const status of ['draft', 'requires-specialist-review', 'rejected', 'unknown', undefined]) {
    assert.equal(articleRobotsForReviewStatus(status), 'noindex,follow');
  }

  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  for (const article of seoArticles) {
    const entry = registry.find((item) => item.path === article.slug);
    assert.ok(entry, article.slug);
    assert.equal(entry.robots, articleRobotsForReviewStatus(article.reviewStatus));
    assert.equal(entry.canonical, `https://ecoprogress.kz${article.slug}`);
    assert.equal(entry.includeInSitemap, article.reviewStatus === 'approved');
    assert.equal(sitemap.includes(`<loc>${entry.canonical}</loc>`), article.reviewStatus === 'approved');
  }

  const sesPage = seoPages.find((page) => page.slug === 'ses-proverka-proizvodstvennyy-kontrol');
  const sesEntry = registry.find((item) => item.path === '/ses-proverka-proizvodstvennyy-kontrol');
  assert.equal(sesEntry?.robots, articleRobotsForReviewStatus(sesPage?.reviewStatus));
  assert.equal(sesEntry?.includeInSitemap, sesPage?.reviewStatus === 'approved');
  assert.equal(sesEntry?.canonical, 'https://ecoprogress.kz/ses-proverka-proizvodstvennyy-kontrol');
  assert.ok(sesPage?.authorSlug);
  assert.ok(sesPage?.sources?.some((source) => source.url.startsWith('https://adilet.zan.kz/')));
});

test('core routes, schema and private indexing rules are registered', async () => {
  assert.equal(registry.find((item) => item.path === '/')?.canonical, 'https://ecoprogress.kz');
  const contacts = registry.find((item) => item.path === '/contacts');
  assert.ok(contacts?.title && contacts?.h1);
  assert.ok(registry.some((item) => item.path.startsWith('/services/') && item.schema.some((schema) => schema['@type'] === 'Service')));
  assert.ok(registry.some((item) => item.path.startsWith('/news/') && item.schema.some((schema) => schema['@type'] === 'Article')));
  assert.equal(registry.find((item) => item.path === '/employees')?.robots, 'noindex,follow');

  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
  for (const route of ['/staff', '/admin', '/cabinet', '/client', '/login', '/register', '/reset-password', '/api', '/internal']) {
    assert.match(robots, new RegExp(`Disallow: ${route.replace('/', '\\/')}`));
  }
});

test('nginx normalizes www, slash and legacy penalty URLs with 301', async () => {
  const hostNginx = await readFile(new URL('../deploy/nginx-host/ecoprogress.conf', import.meta.url), 'utf8');
  const redirects = await readFile(new URL('../deploy/nginx-host/snippets/legacy-redirects.conf', import.meta.url), 'utf8');
  assert.match(hostNginx, /server_name www\.ecoprogress\.kz[\s\S]*return 301 https:\/\/ecoprogress\.kz\$request_uri/);
  assert.match(hostNginx, /location ~ \^\(\.\+\)\/\+\$/);
  assert.match(redirects, /shtrafy-za-ekologicheskie-narusheniya-kazakhstan \{ return 301 \/news\/shtrafy-za-ekologicheskie-narusheniya;/);
  assert.match(redirects, /passport-othodov-\(\[a-z-\]\+\).*return 301 \/pasport-othodov-\$1/);
  assert.match(redirects, /ekologicheskoe-proektirovanie-\(\[a-z-\]\+\).*return 301 \/roos-\$1/);
  assert.match(redirects, /razreshenie-na-emissii-\(\[a-z-\]\+\).*return 301 \/ekologicheskoe-razreshenie-\$1/);
  assert.match(redirects, /proizvodstvennyy-kontrol-ses-\(\[a-z-\]\+\).*return 301 \/proizvodstvennyy-kontrol-\$1/);
  assert.match(redirects, /programma-pek\|razrabotka-pek\|proizvodstvennyy-ekologicheskiy-kontrol.*return 301 \/pek-\$1/);
  assert.match(redirects, /passport-othodov-kazakhstan \{ return 301 \/services\/waste-passport;/);
  assert.match(redirects, /otchet-pek-kazakhstan \{ return 301 \/services\/report-pek;/);
  for (const legacy of ['/passport-othodov-kazakhstan', '/otchet-pek-kazakhstan']) assert.ok(!registry.some((item) => item.path === legacy));
});

test('existing regional routes remain available while only reviewed commercial pairs are indexable', () => {
  const cityPages = seoPages.filter((page) => page.type === 'city');
  const servicePages = seoPages.filter((page) => page.type === 'service-city' && page.locale !== 'kk');
  const prefixes = ['ndv', 'pek', 'otchet-pek', 'ovos', 'szz', 'puo', 'roos', 'pasport-othodov', 'ekologicheskoe-razreshenie', 'laboratornye-zamery', 'analiz-vody', 'proizvodstvennyy-kontrol', 'utilizaciya-othodov'];
  assert.equal(servicePages.length, cityPages.length * (prefixes.length - 3) + 5);
  for (const cityPage of cityPages) {
    const citySlug = cityPage.slug.replace('ecologicheskie-uslugi-', '');
    for (const prefix of prefixes.filter((item) => !['utilizaciya-othodov', 'analiz-vody', 'proizvodstvennyy-kontrol'].includes(item))) assert.ok(servicePages.some((page) => page.slug === `${prefix}-${citySlug}`), `${prefix}-${citySlug}`);
    assert.equal(servicePages.some((page) => page.slug === `utilizaciya-othodov-${citySlug}`), ['shymkent', 'taraz', 'turkestan'].includes(citySlug));
    assert.equal(servicePages.some((page) => page.slug === `analiz-vody-${citySlug}`), citySlug === 'shymkent');
    assert.equal(servicePages.some((page) => page.slug === `proizvodstvennyy-kontrol-${citySlug}`), citySlug === 'shymkent');
  }
  for (const page of servicePages) {
    assert.ok(page.relatedLinks.some((item) => item.path === `/ecologicheskie-uslugi-${page.slug.split('-').slice(-1)[0]}`) || page.relatedLinks.some((item) => item.label.startsWith('Экологические услуги')));
    assert.ok(page.relatedLinks.filter((item) => servicePages.some((candidate) => `/${candidate.slug}` === item.path)).length >= 4);
  }
  const indexableSlugs = servicePages.filter((page) => page.indexable).map((page) => page.slug).sort();
  assert.deepEqual(indexableSlugs, [
    'analiz-vody-shymkent', 'ekologicheskoe-razreshenie-shymkent', 'laboratornye-zamery-shymkent',
    'ndv-shymkent', 'otchet-pek-shymkent', 'ovos-shymkent', 'pasport-othodov-shymkent',
    'pek-shymkent', 'proizvodstvennyy-kontrol-shymkent', 'puo-shymkent', 'roos-shymkent',
    'szz-shymkent', 'utilizaciya-othodov-shymkent', 'utilizaciya-othodov-taraz',
    'utilizaciya-othodov-turkestan',
  ]);
});

test('service-city commercial content is unique and contains all required blocks', () => {
  const pages = seoPages.filter((page) => page.type === 'service-city' && page.locale !== 'kk');
  for (const field of ['title', 'description', 'h1', 'intro', 'ctaTitle', 'ctaText']) {
    assert.equal(new Set(pages.map((page) => page[field])).size, pages.length, `duplicate ${field}`);
  }
  assert.equal(new Set(pages.map((page) => JSON.stringify(page.sections))).size, pages.length, 'duplicate service sections');
  assert.equal(new Set(pages.map((page) => JSON.stringify(page.faq))).size, pages.length, 'duplicate FAQ');
  for (const page of pages) {
    const sectionText = page.sections.map((section) => `${section.title} ${section.body}`).join(' ');
    for (const label of ['Этапы', 'Документы', 'Сроки', 'Что получает']) assert.match(sectionText, new RegExp(label, 'i'), `${page.slug}: ${label}`);
    for (const link of page.relatedLinks.filter((item) => item.path.startsWith('/news/'))) {
      const article = articleContent.find((item) => link.path.endsWith(item.slug));
      assert.ok(isArticleEligibleForSeoLinks(article), `${page.slug}: ${link.path}`);
    }
  }
});

test('regional pages use unique content quality and topic clusters expose only approved published articles', () => {
  const regionalPages = seoPages.filter((page) => page.type === 'city' || page.type === 'service-city');
  assert.equal(regionalPages.filter((page) => page.type === 'city').length, 18, 'existing cities must be retained');
  assert.ok(regionalPages.filter((page) => page.type === 'city').every((page) => page.indexable === true));
  assert.ok(regionalPages.some((page) => page.type === 'service-city' && page.indexable === false), 'unreviewed service/city pairs must stay out of the index');
  assert.ok(regionalPages.some((page) => page.type === 'service-city' && page.indexable === true), 'reviewed service/city pairs must remain indexable without a case study');
  assert.ok(regionalPages.every((page) => page.relatedLinks.every((link) => !link.path.startsWith('/news/'))));

  assert.equal(isArticleEligibleForSeoLinks({ status: 'published', reviewStatus: 'approved' }), true);
  for (const candidate of [
    { status: 'draft', reviewStatus: 'approved' },
    { status: 'published', reviewStatus: 'draft' },
    { status: 'published', reviewStatus: 'requires-specialist-review' },
    { status: 'published', reviewStatus: 'rejected' },
  ]) assert.equal(isArticleEligibleForSeoLinks(candidate), false);

  const requiredRegions = ['ust-kamenogorsk', 'kostanay', 'aktau', 'petropavlovsk', 'oral', 'kokshetau', 'taldykorgan', 'semey'];
  for (const slug of requiredRegions) {
    const content = regionContent.find((item) => item.regionSlug === slug);
    assert.ok(content?.regionalFeatures?.length >= 2, slug);
    assert.ok(content?.industries.length >= 3, slug);
    assert.ok(content?.commonTasks.length >= 3, slug);
    assert.ok(content?.estimatedTimeline, slug);
    assert.ok(content?.faq.length >= 2, slug);
  }
});

test('CMS sync normalizes the backend APPROVED expert-review enum before publication checks', async () => {
  const syncSource = await readFile(new URL('../scripts/sync-seo-content.mjs', import.meta.url), 'utf8');
  assert.match(syncSource, /APPROVED: 'approved'/);
  assert.match(syncSource, /\.map\(normalizeArticleReview\)/);
});

test('city grammar and PEK keyword cluster use explicit backend-independent forms', () => {
  const shymkent = seoPages.find((page) => page.slug === 'ecologicheskie-uslugi-shymkent');
  assert.equal(shymkent?.h1, 'Экологические услуги в Шымкенте');
  const pek = seoPages.find((page) => page.slug === 'pek-shymkent');
  assert.equal(pek?.h1, 'Программа производственного экологического контроля в Шымкенте');
  assert.match(pek?.description || '', /Программа ПЭК в Шымкенте/);
  assert.ok(pek?.keywords?.includes('Программа производственного экологического контроля Шымкент'));
  const report = seoPages.find((page) => page.slug === 'otchet-pek-shymkent');
  assert.equal(report?.h1, 'Отчёт производственного экологического контроля в Шымкенте');
  assert.ok(report?.keywords?.includes('Отчёт производственного экологического контроля Шымкент'));
  assert.match(pek?.ctaTitle || '', /для Шымкента/);
  const semey = seoPages.find((page) => page.slug === 'ecologicheskie-uslugi-semey');
  assert.equal(semey?.cityNominative, 'Семей');
  assert.equal(semey?.cityGenitive, 'Семея');
  assert.equal(semey?.cityPrepositional, 'Семее');
  assert.equal(semey?.regionNominative, 'область Абай');
  assert.equal(semey?.regionGenitive, 'области Абай');
  assert.equal(semey?.regionPrepositional, 'области Абай');
  const semeyText = JSON.stringify(seoPages.filter((page) => page.slug.endsWith('-semey')));
  assert.doesNotMatch(semeyText, /(?:^|[\s"])(?:в Семея|адрес в Семея|для предприятий Семея и область Абай)/iu);
});

test('every SEO city carries explicit cases and generated copy uses the required form', () => {
  for (const forms of regions) {
    const pages = seoPages.filter((page) => page.locale !== 'kk' && (page.slug === `ecologicheskie-uslugi-${forms.slug}` || page.slug.endsWith(`-${forms.slug}`)));
    assert.ok(pages.length >= 10, forms.slug);
    for (const page of pages) {
      assert.equal(page.cityNominative, forms.cityNominative);
      assert.equal(page.cityGenitive, forms.cityGenitive);
      assert.equal(page.cityPrepositional, forms.cityPrepositional);
      assert.equal(page.regionNominative, forms.regionNominative);
      assert.equal(page.regionGenitive, forms.regionGenitive);
      assert.equal(page.regionPrepositional, forms.regionPrepositional);
      assert.match(page.h1, new RegExp(`в ${forms.cityPrepositional}$`, 'u'));
      assert.match(page.title, new RegExp(`в ${forms.cityPrepositional}`, 'u'));
      assert.match(page.description, new RegExp(`(?:в|для) ${forms.cityPrepositional === forms.cityGenitive ? forms.cityPrepositional : `(?:${forms.cityPrepositional}|${forms.cityGenitive})`}`, 'u'));
      const copy = JSON.stringify({ sections: page.sections, faq: page.faq, ctaTitle: page.ctaTitle, ctaText: page.ctaText, breadcrumbs: page.breadcrumbs });
      if (forms.cityGenitive !== forms.cityPrepositional) assert.doesNotMatch(copy, new RegExp(`(?:^|[\\s\"])(?:в|адрес в) ${forms.cityGenitive}(?:[\\s,.:;!?\"]|$)`, 'iu'), page.slug);
      if (forms.regionNominative !== forms.regionGenitive) assert.doesNotMatch(copy, new RegExp(`для предприятий ${forms.cityGenitive} и ${forms.regionNominative}`, 'iu'), page.slug);
    }
  }
});

test('schema uses one stable graph model for prerender and hydration', async () => {
  const graph = createSchemaGraph([
    { '@context': 'https://schema.org', '@type': 'Service', name: 'ПЭК' },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] },
  ], 'https://ecoprogress.kz/pek-semey');
  assert.equal(graph['@context'], 'https://schema.org');
  for (const id of ['https://ecoprogress.kz/#organization', 'https://ecoprogress.kz/#website', 'https://ecoprogress.kz/pek-semey#webpage', 'https://ecoprogress.kz/pek-semey#service', 'https://ecoprogress.kz/pek-semey#breadcrumb']) {
    assert.ok(graph['@graph'].some((node) => node['@id'] === id), id);
  }
  const [seo, prerender] = await Promise.all([
    readFile(new URL('../src/components/SEO.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/prerender.js', import.meta.url), 'utf8'),
  ]);
  assert.match(seo, /node\.id === 'page-schema-json-ld'/);
  assert.match(seo, /schemaScripts\.filter\(\(node\) => node !== script\)/);
  assert.match(seo, /createSchemaGraph\(resolvedSchema, resolvedCanonical\)/);
  assert.match(prerender, /createSchemaGraph\(schema, canonical\)/);
});

test('expert model is strict and approved article schema links author and reviewer persons', async () => {
  const [types, experts, articlePage, schema] = await Promise.all([
    readFile(new URL('../src/content/types.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/content/experts/experts.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/NewsDetailsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/seo/entityBuilders.ts', import.meta.url), 'utf8'),
  ]);
  for (const field of ['id', 'fullName', 'position', 'specialization', 'experienceYears', 'bio', 'photo', 'profileUrl']) assert.match(types, new RegExp(`${field}:`));
  assert.match(experts, /seoCmsSnapshot\.generated\.json/);
  assert.doesNotMatch(experts, /fullName:\s*['"][^'"]+|experienceYears:\s*\d/);
  assert.match(articlePage, /item\.reviewStatus === 'approved'/);
  assert.match(articlePage, /entityIds\(canonical\)\.author/);
  assert.match(articlePage, /entityIds\(canonical\)\.reviewer/);
  assert.match(schema, /reviewedBy/);
});

test('service-city registry exposes Service schema and Shymkent UI adds LocalBusiness', async () => {
  const shymkentService = registry.find((item) => item.path === '/pek-shymkent');
  const serviceSchema = shymkentService?.schema.find((item) => item['@type'] === 'Service');
  assert.equal(serviceSchema?.areaServed?.name, 'Шымкент');
  const builders = await readFile(new URL('../src/seo/entityBuilders.ts', import.meta.url), 'utf8');
  for (const type of ['Organization', 'LocalBusiness', 'Service', 'BreadcrumbList']) assert.match(builders, new RegExp(type));
  const source = await readFile(new URL('../src/pages/SeoLandingPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /'@type': 'FAQPage'/);
});

test('AEO content is visible and cases use verified backend records', async () => {
  const [aeo, types, api, app, casePage, details] = await Promise.all([
    readFile(new URL('../src/components/content/AeoContent.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/content/types.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/content/apiRepository.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/CasesPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/CaseDetailsPage.tsx', import.meta.url), 'utf8'),
  ]);
  for (const heading of ['Короткий ответ', 'Кому нужна услуга', 'Когда она обязательна', 'Когда не требуется', 'Какие документы нужны', 'Что получает заказчик', 'Сколько занимает по времени', 'От чего зависит стоимость', 'Нормативная база', 'Частые ошибки', 'FAQ', 'Связанные подтверждённые кейсы']) assert.match(aeo, new RegExp(heading));
  for (const field of ['id', 'service', 'objectType', 'objectCategory', 'initialData', 'workPerformed', 'regulations', 'completedAt', 'expert', 'reviewer', 'clientAnonymous', 'publishedAt', 'updatedAt']) assert.match(types, new RegExp(`${field}\\??:`));
  assert.match(api, /collection<CaseStudy>\('cases'/);
  assert.match(app, /path="\/cases"/);
  assert.match(app, /path="\/cases\/:slug"/);
  assert.match(casePage, /isPublishableCaseStudy/);
  assert.match(details, /buildArticleSchema/);
  assert.match(details, /buildServiceEntity/);
  assert.match(details, /buildPersonSchema/);
});

test('city names use the prepositional case after the preposition', () => {
  const expectedHeadings = {
    almaty: '\u042d\u043a\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0443\u0441\u043b\u0443\u0433\u0438 \u0432 \u0410\u043b\u043c\u0430\u0442\u044b',
    astana: '\u042d\u043a\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0443\u0441\u043b\u0443\u0433\u0438 \u0432 \u0410\u0441\u0442\u0430\u043d\u0435',
    shymkent: '\u042d\u043a\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0443\u0441\u043b\u0443\u0433\u0438 \u0432 \u0428\u044b\u043c\u043a\u0435\u043d\u0442\u0435',
    turkestan: '\u042d\u043a\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0443\u0441\u043b\u0443\u0433\u0438 \u0432 \u0422\u0443\u0440\u043a\u0435\u0441\u0442\u0430\u043d\u0435',
    kyzylorda: '\u042d\u043a\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0443\u0441\u043b\u0443\u0433\u0438 \u0432 \u041a\u044b\u0437\u044b\u043b\u043e\u0440\u0434\u0435',
    karaganda: '\u042d\u043a\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0443\u0441\u043b\u0443\u0433\u0438 \u0432 \u041a\u0430\u0440\u0430\u0433\u0430\u043d\u0434\u0435',
  };

  for (const [slug, h1] of Object.entries(expectedHeadings)) {
    assert.equal(seoPages.find((page) => page.slug === `ecologicheskie-uslugi-${slug}`)?.h1, h1);
  }
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
