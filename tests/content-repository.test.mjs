import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { articleContent } from '../src/content/articles/articleContent.ts';
import { serviceContent } from '../src/content/services/serviceContent.ts';
import { regionContent } from '../src/content/regions/regionContent.ts';
import { caseStudies, publishedCaseStudies } from '../src/content/cases/caseStudies.ts';
import { trustDocuments } from '../src/content/trust-documents/trustDocuments.ts';
import { FallbackContentRepository, LocalContentRepository } from '../src/content/repository.ts';
import { getAllPublicUrls, seoPages } from '../scripts/seo-data.mjs';

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
  assert.equal(serviceContent.length, 10);
  for (const item of serviceContent) {
    assert.ok(item.workflow.length >= 3);
    assert.ok(item.deliverables.length > 0);
    assert.ok(item.faq.length >= 5);
    assert.ok(item.contentReview.reviewStatus);
  }
  assert.ok(articleContent.length >= 10);
  for (const article of articleContent) {
    assert.ok(article.shortAnswer.length > 40);
    assert.ok(article.sections.length >= 4);
    assert.ok(article.sources.length > 0);
    assert.ok(article.heroImageAlt);
    assert.ok(new Date(article.dateModified) >= new Date(article.datePublished));
  }
  assert.equal(regionContent.length, 10);
  assert.ok(regionContent.every((region) => region.remoteConditions.length && region.onSiteConditions.length));
});

test('unverified trust data and case drafts are never presented as approved', () => {
  assert.ok(trustDocuments.every((document) => document.verificationStatus !== 'verified' || (document.number && document.issuedBy)));
  assert.ok(caseStudies.every((item) => item.verificationStatus !== 'approved'));
  assert.equal(publishedCaseStudies.length, 0);
});

test('thin service-city templates are excluded from the public SEO registry', () => {
  const serviceCityPages = seoPages.filter((page) => page.type === 'service-city');
  assert.deepEqual(serviceCityPages.map((page) => page.slug), ['utilizaciya-othodov-shymkent']);
  const citySlugs = new Set(seoPages.filter((page) => page.type === 'city').map((page) => page.slug.replace('ecologicheskie-uslugi-', '')));
  assert.ok(regionContent.every((region) => citySlugs.has(region.regionSlug)));
  const publicUrls = new Set(getAllPublicUrls().map((item) => item.loc));
  assert.ok(publicUrls.has('https://ecoprogress.kz/ecologicheskie-uslugi-karaganda'));
  assert.ok(!publicUrls.has('https://ecoprogress.kz/ecologicheskie-uslugi-kostanay'));
});

test('service and article templates render mandatory structured content blocks', async () => {
  const [servicePage, articlePage, generatedRegistry] = await Promise.all([
    readFile(new URL('../src/pages/ServiceLandingPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/NewsDetailsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/data/seoRegistry.generated.json', import.meta.url), 'utf8'),
  ]);
  for (const block of ['ServiceDeliverables', 'ServiceWorkflow', 'ServiceRequiredDocuments', 'ServicePricingFactors', 'ServiceLegalBasis', 'RelatedServices']) assert.match(servicePage, new RegExp(block));
  for (const block of ['ArticleTableOfContents', 'ArticleChecklist', 'ArticleSources', 'ArticleAuthorCard', 'ArticleReviewerCard', 'RelatedArticles']) assert.match(articlePage, new RegExp(block));
  assert.match(articlePage, /normalizeArticleSlug/);
  assert.match(generatedRegistry, /"path": "\/ecologicheskie-uslugi-kostanay"[\s\S]*?"robots": "noindex,follow"/);
});
