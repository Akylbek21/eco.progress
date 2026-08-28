import type { SeoRobots } from '../seo/types';
import type { ArticleContent } from './types';
import { expertMap, isCompleteExpert } from './experts/experts.ts';

export const isApprovedArticleReview = (reviewStatus: unknown): reviewStatus is 'approved' =>
  reviewStatus === 'approved';

export const articleRobotsForReviewStatus = (reviewStatus: unknown): SeoRobots =>
  isApprovedArticleReview(reviewStatus) ? 'index,follow' : 'noindex,follow';

export const isArticleEligibleForSeoLinks = (
  article: Pick<ArticleContent, 'status' | 'reviewStatus' | 'reviewerSlug' | 'lastReviewedAt'> | null | undefined,
): boolean => isArticleApproved(article);

export const isArticleApproved = (
  article: Pick<ArticleContent, 'status' | 'reviewStatus' | 'reviewerSlug' | 'lastReviewedAt'> | null | undefined,
): boolean => Boolean(article?.status === 'published' && article.reviewStatus === 'approved'
  && article.reviewerSlug && article.lastReviewedAt && isCompleteExpert(expertMap.get(article.reviewerSlug)));
