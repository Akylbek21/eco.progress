import type { SeoRobots } from '../seo/types';
import type { ArticleContent, Expert } from './types';
import { expertMap, isPublishableExpert } from './experts/experts.ts';

export const isApprovedArticleReview = (reviewStatus: unknown): reviewStatus is 'approved' =>
  reviewStatus === 'approved';

const isIndexableArticleReview = (reviewStatus: unknown): boolean =>
  reviewStatus === 'approved' || reviewStatus === 'requires-specialist-review';

export const articleRobotsForReviewStatus = (reviewStatus: unknown): SeoRobots =>
  isIndexableArticleReview(reviewStatus) ? 'index,follow' : 'noindex,follow';

export const isArticleIndexable = (
  article: Pick<ArticleContent, 'status' | 'reviewStatus'> | null | undefined,
): boolean => Boolean(article?.status === 'published' && isIndexableArticleReview(article.reviewStatus));

export const isArticleEligibleForSeoLinks = (
  article: Pick<ArticleContent, 'status' | 'reviewStatus' | 'reviewerSlug' | 'lastReviewedAt'> | null | undefined,
): boolean => isArticleIndexable(article);

export const isArticleApproved = (
  article: Pick<ArticleContent, 'status' | 'reviewStatus' | 'reviewerSlug' | 'lastReviewedAt'> | null | undefined,
  reviewers: ReadonlyMap<string, Expert> = expertMap,
): boolean => Boolean(article?.status === 'published' && article.reviewStatus === 'approved'
  && article.reviewerSlug && article.lastReviewedAt && isPublishableExpert(reviewers.get(article.reviewerSlug)));
