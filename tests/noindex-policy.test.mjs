import assert from 'node:assert/strict';
import test from 'node:test';
import registry from '../src/data/seoRegistry.generated.json' with { type: 'json' };
import { seoArticles, seoPages } from '../scripts/seo-data.mjs';

const priorityCommercialPaths = [
  '/laboratornye-zamery-almaty',
  '/roos-almaty',
  '/otchet-pek-almaty',
];

const contentWords = (page) => [
  page.title,
  page.description,
  page.h1,
  page.intro,
  ...page.sections.flatMap((section) => [section.title, section.body]),
  ...page.faq.flatMap((item) => [item.question, item.answer]),
  page.ctaTitle,
  page.ctaText,
].join(' ').trim().split(/\s+/u).filter(Boolean).length;

test('priority Алматы commercial landings are indexable only with substantial unique content', () => {
  const selectedPages = priorityCommercialPaths.map((path) => seoPages.find((page) => `/${page.slug}` === path));
  assert.ok(selectedPages.every(Boolean));

  for (const page of selectedPages) {
    assert.equal(page.indexable, true, page.slug);
    assert.ok(contentWords(page) >= 600, `${page.slug}: insufficient content`);
    assert.ok(page.sections.length >= 8, `${page.slug}: insufficient sections`);
    assert.ok(page.faq.length >= 5, `${page.slug}: insufficient FAQ`);
  }

  for (const field of ['title', 'description', 'h1', 'intro', 'sections', 'faq']) {
    assert.equal(new Set(selectedPages.map((page) => JSON.stringify(page[field]))).size, selectedPages.length, `duplicate ${field}`);
  }
});

test('priority GSC article stays noindex until a specialist approves it', () => {
  const path = '/news/kak-opredelit-kategoriyu-obekta';
  const article = seoArticles.find((item) => item.slug === path);
  const entry = registry.find((item) => item.path === path);

  assert.ok(article);
  assert.notEqual(article.reviewStatus, 'approved');
  assert.equal(article.reviewerSlug, undefined);
  assert.equal(entry?.robots, 'noindex,follow');
  assert.equal(entry?.includeInSitemap, false);
});

test('every noindex registry page remains out of sitemap', () => {
  const noindexPages = registry.filter((entry) => entry.robots === 'noindex,follow');
  assert.ok(noindexPages.length > 0);
  assert.ok(noindexPages.every((entry) => entry.includeInSitemap === false));
});
