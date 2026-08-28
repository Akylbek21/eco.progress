import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { articleContent } from '../src/content/articles/articleContent.ts';
import { serviceContent } from '../src/content/services/serviceContent.ts';
import { regionContent } from '../src/content/regions/regionContent.ts';
import { caseStudies, publishedCaseStudies } from '../src/content/cases/caseStudies.ts';
import { trustDocuments } from '../src/content/trust-documents/trustDocuments.ts';
import { FallbackContentRepository, LocalContentRepository } from '../src/content/repository.ts';
import { seoPages } from '../scripts/seo-data.mjs';
import seoRegistry from '../src/data/seoRegistry.generated.json' with { type: 'json' };

test('local content repository exposes only public content and normalizes service aliases', async () => {
  const repository = new LocalContentRepository();
  assert.equal((await repository.getServices()).length, serviceContent.length);
  assert.equal((await repository.getArticles()).length, articleContent.length);
  assert.equal((await repository.getRegions()).length, regionContent.length);
  assert.equal((await repository.getServiceBySlug('eco-design'))?.serviceSlug, 'ecological-documents');
  assert.equal((await repository.getArticleBySlug('kakie-dokumenty-proveryaet-ses'))?.slug, 'podgotovka-k-ekologicheskoy-proverke');
  assert.equal(await repository.getServiceBySlug('not-a-service'), null);
});

test('fallback repository uses local content only after a real primary failure', async () => {
  const primaryResult = [{ ...serviceContent[0], serviceSlug: 'api-service' }];
  const successfulPrimary = { getServices: async () => primaryResult, getServiceBySlug: async () => null, getArticles: async () => [], getArticleBySlug: async () => null, getRegions: async () => [], getRegionBySlug: async () => null };
  assert.equal((await new FallbackContentRepository(successfulPrimary).getServices())[0].serviceSlug, 'api-service');
  const failingPrimary = { ...successfulPrimary, getServices: async () => { throw new Error('network'); } };
  assert.deepEqual(await new FallbackContentRepository(failingPrimary).getServices(), serviceContent);
});

test('priority content has structured service, article and regional fields', () => {
  assert.equal(serviceContent.length, 13);
  for (const item of serviceContent) {
    assert.equal(item.hero.benefits.length, 3);
    assert.ok(item.workflow.length >= 3);
    assert.ok(item.deliverables.length > 0);
    assert.ok(item.faq.length >= 6);
    assert.ok(item.commercial.serviceName);
    assert.ok(item.contentReview.reviewStatus);
    assert.ok(item.aeo);
    for (const [field, value] of Object.entries(item.aeo)) {
      if (field === 'faq') assert.ok(value.length >= 6);
      else assert.ok(value.trim());
    }
  }
  for (const field of Object.keys(serviceContent[0].aeo)) {
    const values = serviceContent.map((item) => field === 'faq' ? JSON.stringify(item.aeo.faq) : item.aeo[field]);
    assert.equal(new Set(values).size, serviceContent.length, `AEO field ${field} must be unique per service`);
  }
  assert.ok(articleContent.length >= 10);
  for (const article of articleContent) {
    assert.ok(article.shortAnswer.length > 40);
    assert.ok(article.sections.length >= 4);
    assert.ok(article.sources.length > 0);
    assert.ok(article.heroImageAlt);
    assert.ok(new Date(article.dateModified) >= new Date(article.datePublished));
  }
  assert.equal(regionContent.length, 18);
  assert.ok(regionContent.every((region) => region.remoteConditions.length && region.onSiteConditions.length));
});

test('report PEK landing keeps its priority SEO, commercial sections and FAQ', () => {
  const report = serviceContent.find((item) => item.serviceSlug === 'report-pek');
  const registryEntry = seoRegistry.find((item) => item.path === '/services/report-pek');
  assert.equal(registryEntry?.title, 'Отчёт ПЭК — подготовка, сроки и стоимость | EcoProgress');
  assert.equal(registryEntry?.h1, 'Подготовка отчёта ПЭК в Казахстане');
  assert.deepEqual(report?.sections?.map((section) => section.title), [
    'Кто обязан сдавать отчёт ПЭК',
    'Сроки предоставления отчёта ПЭК',
    'Стоимость подготовки отчёта ПЭК',
    'Какие данные нужны для отчёта',
    'Что делать, если отсутствуют протоколы',
    'Что получает предприятие',
    'Частые ошибки при подготовке отчёта ПЭК',
  ]);
  assert.deepEqual(report?.faq.map((item) => item.question), [
    'Когда сдаётся отчёт ПЭК?',
    'Кто обязан сдавать отчёт ПЭК?',
    'Сколько стоит подготовка?',
    'Какие документы нужны?',
    'Что делать, если часть замеров отсутствует?',
    'Можно ли подготовить отчёт дистанционно?',
    'Чем программа ПЭК отличается от отчёта ПЭК?',
  ]);
});

test('ROOS has a dedicated canonical service landing and comparison section', () => {
  const roos = serviceContent.find((item) => item.serviceSlug === 'roos');
  const registryEntry = seoRegistry.find((item) => item.path === '/services/roos');
  assert.equal(registryEntry?.canonical, 'https://ecoprogress.kz/services/roos');
  assert.equal(registryEntry?.title, 'РООС — разработка раздела охраны окружающей среды | EcoProgress');
  assert.equal(registryEntry?.h1, 'Разработка РООС в Казахстане');
  assert.deepEqual(roos?.sections?.map((section) => section.title), [
    'Когда требуется РООС',
    'Что входит в разработку РООС',
    'Какие исходные данные нужны',
    'Срок разработки РООС',
    'Стоимость РООС',
    'Что получает заказчик',
    'РООС и ОВОС — в чём разница',
  ]);
});

test('priority ROOS city pages use concise metadata and substantial unique regional copy', () => {
  const pages = ['almaty', 'astana', 'shymkent'].map((city) => seoPages.find((page) => page.slug === `roos-${city}`));
  assert.ok(pages.every(Boolean));
  assert.deepEqual(pages.map((page) => page.h1), ['Разработка РООС в Алматы', 'Разработка РООС в Астане', 'Разработка РООС в Шымкенте']);
  assert.ok(pages.every((page) => page.indexable === true));
  assert.ok(pages.every((page) => page.heroBenefits?.length === 3));
  assert.ok(pages.every((page) => page.primaryCtaLabel === 'Получить расчёт РООС'));
  const regionalSections = pages.map((page) => page.sections.find((section) => section.title.includes('особенности региона')));
  assert.ok(regionalSections.every(Boolean));
  for (const section of regionalSections) {
    const wordCount = section.body.trim().split(/\s+/u).length;
    assert.ok(wordCount >= 300 && wordCount <= 600, `${section.title}: ${wordCount} words`);
    for (const topic of ['Особенности работы в регионе', 'Типичные объекты', 'Исходные данные', 'Как проходит работа', 'Статус регионального кейса', 'Сроки взаимодействия']) assert.match(section.body, new RegExp(topic));
  }
  assert.equal(new Set(regionalSections.map((section) => section.body)).size, 3);
});

test('unverified trust data and case drafts are never presented as approved', () => {
  assert.ok(trustDocuments.every((document) => document.verificationStatus !== 'verified' || (document.number && document.issuedBy)));
  assert.ok(caseStudies.every((item) => item.status !== 'published' || !item.publishedAt));
  assert.equal(publishedCaseStudies.length, 0);
});

test('waste utilization is exposed only for Shymkent, Taraz and Turkestan', () => {
  const serviceCityPages = seoPages.filter((page) => page.type === 'service-city');
  const wasteUtilizationPages = serviceCityPages.filter((page) => page.slug.startsWith('utilizaciya-othodov-'));
  assert.deepEqual(wasteUtilizationPages.map((page) => page.slug), [
    'utilizaciya-othodov-shymkent',
    'utilizaciya-othodov-taraz',
    'utilizaciya-othodov-turkestan',
  ]);
  const publicUrls = new Set(seoRegistry.filter((item) => item.includeInSitemap).map((item) => item.canonical));
  for (const city of ['shymkent', 'taraz', 'turkestan']) {
    assert.ok(publicUrls.has(`https://ecoprogress.kz/utilizaciya-othodov-${city}`));
  }
  for (const city of ['almaty', 'astana', 'kyzylorda', 'aktobe', 'atyrau', 'karaganda', 'pavlodar']) {
    assert.ok(!publicUrls.has(`https://ecoprogress.kz/utilizaciya-othodov-${city}`));
  }
  assert.ok(wasteUtilizationPages.every((page) => page.indexable === true));
  assert.ok(wasteUtilizationPages.every((page) => page.heroBenefits?.length === 3));
  const taraz = wasteUtilizationPages.find((page) => page.slug === 'utilizaciya-othodov-taraz');
  assert.equal(taraz?.title, 'Утилизация отходов в Таразе — вывоз и документы | EcoProgress');
  assert.equal(taraz?.primaryCtaLabel, 'Рассчитать стоимость утилизации');
  assert.equal(taraz?.secondaryCtaLabel, 'Отправить перечень отходов');
  const turkestan = wasteUtilizationPages.find((page) => page.slug === 'utilizaciya-othodov-turkestan');
  assert.equal(turkestan?.title, 'Утилизация отходов в Туркестане — вывоз и документы | EcoProgress');
  assert.equal(turkestan?.primaryCtaLabel, 'Рассчитать стоимость утилизации');
});

test('service and article templates render mandatory structured content blocks', async () => {
  const [servicePage, articlePage, generatedRegistry] = await Promise.all([
    readFile(new URL('../src/pages/ServiceLandingPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/NewsDetailsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/data/seoRegistry.generated.json', import.meta.url), 'utf8'),
  ]);
  for (const block of ['ServiceAeoContent', 'RelatedServices']) assert.match(servicePage, new RegExp(block));
  for (const block of ['ArticleTableOfContents', 'ArticleChecklist', 'ArticleSources', 'ArticleAuthorCard', 'ArticleReviewerCard', 'RelatedArticles']) assert.match(articlePage, new RegExp(block));
  for (const label of ['Дата публикации', 'Последняя экспертная проверка', 'isArticleApproved']) assert.match(articlePage, new RegExp(label));
  assert.match(articlePage, /normalizeArticleSlug/);
  assert.match(generatedRegistry, /"path": "\/ecologicheskie-uslugi-kostanay"[\s\S]*?"robots": "index,follow"/);
});

test('short landing forms collect common and service-specific lead details', async () => {
  const [leadForm, whatsAppForm, serviceLanding] = await Promise.all([
    readFile(new URL('../src/components/LeadForm.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/WhatsAppLeadForm.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/ServiceLandingPage.tsx', import.meta.url), 'utf8'),
  ]);
  for (const source of [leadForm, whatsAppForm]) {
    assert.match(source, /Телефон \/ WhatsApp \*/u);
    assert.match(source, /Что нужно \/ комментарий/u);
    assert.match(source, /name="city"/u);
    assert.match(source, /name="wasteType"/u);
    assert.match(source, /name="reportingPeriod"/u);
    assert.match(source, /name="objectType"/u);
  }
  assert.doesNotMatch(leadForm, /<input name="estimatedVolume"/u);
  assert.match(leadForm, /name="serviceDetail"/u);
  assert.match(whatsAppForm, /name="estimatedVolume"/u);
  assert.match(serviceLanding, /serviceSlug=\{service\.slug\}/u);
});
