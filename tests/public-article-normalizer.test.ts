import { describe, expect, it } from 'vitest';
import { normalizeArticleReviewStatus, normalizePublicArticle } from '../src/content/publicArticleNormalizer';
import type { ArticleContent } from '../src/content/types';

const article = {
  slug: 'cms-review-test', status: 'PUBLISHED', title: 'Test', description: 'Description', excerpt: 'Excerpt',
  shortAnswer: 'Answer', intent: 'informational', targetAudience: [], relatedServiceSlugs: [], relatedArticleSlugs: [],
  datePublished: '2026-08-01', dateModified: '2026-08-01', authorSlug: 'ecoprogress-editorial',
  heroImageAlt: 'Alt', tableOfContents: true, sections: [], sources: [], faq: [], reviewStatus: 'REQUIRES_REVIEW',
} as unknown as ArticleContent;

describe('public article CMS review normalization', () => {
  it('maps the backend workflow statuses', () => {
    expect(normalizeArticleReviewStatus('DRAFT')).toBe('draft');
    expect(normalizeArticleReviewStatus('REQUIRES_REVIEW')).toBe('requires-specialist-review');
    expect(normalizeArticleReviewStatus('APPROVED')).toBe('approved');
    expect(normalizeArticleReviewStatus('REJECTED')).toBe('rejected');
  });

  it('promotes only a complete CMS approval', () => {
    const result = normalizePublicArticle({ ...article, articleReview: {
      articleSlug: article.slug, expertId: 'expert-slug', status: 'APPROVED',
      reviewedAt: '2026-08-31T10:00:00Z', updatedAt: '2026-08-31T10:00:00Z',
    } });
    expect(result).toMatchObject({ status: 'published', reviewStatus: 'approved', reviewerSlug: 'expert-slug', lastReviewedAt: '2026-08-31T10:00:00Z' });
  });

  it('fails closed when an approval has no reviewer or review date', () => {
    const result = normalizePublicArticle({ ...article, reviewStatus: 'APPROVED' });
    expect(result.reviewStatus).toBe('requires-specialist-review');
    expect(result.reviewerSlug).toBeUndefined();
    expect(result.lastReviewedAt).toBeUndefined();
  });
});
