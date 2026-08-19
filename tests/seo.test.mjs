import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { seoPages } from '../scripts/seo-data.mjs';

const registry = JSON.parse(await readFile(new URL('../src/data/seoRegistry.generated.json', import.meta.url), 'utf8'));

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

test('sitemap excludes private, auth and 404 routes', () => {
  const urls = registry.filter((item) => item.includeInSitemap).map((item) => item.canonical);
  assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) assert.doesNotMatch(url, /\/(?:staff|cabinet|client|admin|dashboard|internal|login|register|reset-password|api|404)(?:\/|$)/);
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
  assert.match(redirects, /otchet-pek-\(\[a-z-\]\+\).*return 301 \/pek-\$1/);
  assert.match(redirects, /ekologicheskoe-proektirovanie-\(\[a-z-\]\+\).*return 301 \/roos-\$1/);
  assert.match(redirects, /razreshenie-na-emissii-\(\[a-z-\]\+\).*return 301 \/ekologicheskoe-razreshenie-\$1/);
  assert.match(redirects, /proizvodstvennyy-kontrol-ses-\(\[a-z-\]\+\).*return 301 \/szz-\$1/);
  assert.match(redirects, /programma-pek\|razrabotka-pek\|proizvodstvennyy-ekologicheskiy-kontrol.*return 301 \/pek-\$1/);
  assert.match(redirects, /passport-othodov-kazakhstan \{ return 301 \/services\/ecological-documents;/);
  assert.match(redirects, /otchet-pek-kazakhstan \{ return 301 \/services\/report-pek;/);
  for (const legacy of ['/passport-othodov-kazakhstan', '/otchet-pek-kazakhstan']) assert.ok(!registry.some((item) => item.path === legacy));
});

test('every active SEO city has every core service landing', () => {
  const cityPages = seoPages.filter((page) => page.type === 'city' && page.indexable !== false);
  const servicePages = seoPages.filter((page) => page.type === 'service-city' && page.indexable !== false);
  const prefixes = ['ndv', 'pek', 'ovos', 'szz', 'puo', 'roos', 'pasport-othodov', 'ekologicheskoe-razreshenie', 'laboratornye-zamery', 'utilizaciya-othodov'];
  assert.equal(servicePages.length, cityPages.length * (prefixes.length - 1) + 3);
  for (const cityPage of cityPages) {
    const citySlug = cityPage.slug.replace('ecologicheskie-uslugi-', '');
    for (const prefix of prefixes.filter((item) => item !== 'utilizaciya-othodov')) assert.ok(servicePages.some((page) => page.slug === `${prefix}-${citySlug}`), `${prefix}-${citySlug}`);
    assert.equal(servicePages.some((page) => page.slug === `utilizaciya-othodov-${citySlug}`), ['shymkent', 'taraz', 'turkestan'].includes(citySlug));
  }
  for (const page of servicePages) {
    assert.ok(page.relatedLinks.some((item) => item.path === `/ecologicheskie-uslugi-${page.slug.split('-').slice(-1)[0]}`) || page.relatedLinks.some((item) => item.label.startsWith('Экологические услуги')));
    assert.ok(page.relatedLinks.filter((item) => servicePages.some((candidate) => `/${candidate.slug}` === item.path)).length >= 4);
  }
});

test('service-city commercial content is unique and contains all required blocks', () => {
  const pages = seoPages.filter((page) => page.type === 'service-city' && page.indexable !== false);
  for (const field of ['title', 'description', 'h1', 'intro', 'ctaTitle', 'ctaText']) {
    assert.equal(new Set(pages.map((page) => page[field])).size, pages.length, `duplicate ${field}`);
  }
  assert.equal(new Set(pages.map((page) => JSON.stringify(page.sections))).size, pages.length, 'duplicate service sections');
  assert.equal(new Set(pages.map((page) => JSON.stringify(page.faq))).size, pages.length, 'duplicate FAQ');
  for (const page of pages) {
    const sectionText = page.sections.map((section) => `${section.title} ${section.body}`).join(' ');
    for (const label of ['Этапы', 'Документы', 'Сроки', 'Что получает']) assert.match(sectionText, new RegExp(label, 'i'), `${page.slug}: ${label}`);
    assert.ok(page.relatedLinks.some((item) => item.path.startsWith('/news/')), `${page.slug}: article link`);
  }
});

test('city grammar and PEK keyword cluster use explicit backend-independent forms', () => {
  const shymkent = seoPages.find((page) => page.slug === 'ecologicheskie-uslugi-shymkent');
  assert.equal(shymkent?.h1, 'Экологические услуги в Шымкенте');
  const pek = seoPages.find((page) => page.slug === 'pek-shymkent');
  assert.equal(pek?.h1, 'Производственный экологический контроль в Шымкенте');
  assert.match(pek?.description || '', /Программа ПЭК для Шымкента/);
  for (const phrase of ['производственный экологический контроль Шымкент', 'программа ПЭК Шымкент', 'разработка ПЭК Шымкент', 'отчет ПЭК Шымкент']) assert.ok(pek?.keywords?.includes(phrase));
  assert.match(pek?.ctaTitle || '', /для Шымкента/);
});

test('service-city registry exposes Service schema and Shymkent UI adds LocalBusiness', async () => {
  const shymkentService = registry.find((item) => item.path === '/pek-shymkent');
  const serviceSchema = shymkentService?.schema.find((item) => item['@type'] === 'Service');
  assert.equal(serviceSchema?.areaServed?.name, 'Шымкент');
  for (const type of ['Organization', 'LocalBusiness', 'Service', 'BreadcrumbList', 'FAQPage']) {
    const source = await readFile(new URL('../src/pages/SeoLandingPage.tsx', import.meta.url), 'utf8');
    assert.match(source, new RegExp(type));
  }
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
