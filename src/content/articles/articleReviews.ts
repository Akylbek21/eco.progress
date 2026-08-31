import type { CmsArticleReviewDto, ReviewStatus } from '../types';
import snapshot from '../../data/articleReviews.generated.json' with { type: 'json' };
import { normalizeArticleReviewStatus } from '../publicArticleNormalizer.ts';

export interface ArticleReview { articleSlug: string; reviewerSlug: string; status: ReviewStatus; reviewedAt?: string }

// Build-time snapshot from CMS; this source file is never an approval authority.
const cmsReviews = snapshot.articleReviews as CmsArticleReviewDto[];

export const articleReviews: ArticleReview[] = cmsReviews.map((review) => ({
  articleSlug: review.articleSlug,
  reviewerSlug: review.expertId,
  status: normalizeArticleReviewStatus(review.status),
  reviewedAt: review.reviewedAt,
}));
export const articleReviewBySlug = new Map(articleReviews.map((review) => [review.articleSlug, review] as const));
