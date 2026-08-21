import type { SeoRobots } from '../seo/types';
import type { ArticleContent } from './types';

export const isApprovedArticleReview = (reviewStatus: unknown): reviewStatus is 'approved' =>
  reviewStatus === 'approved';

export const articleRobotsForReviewStatus = (reviewStatus: unknown): SeoRobots =>
  isApprovedArticleReview(reviewStatus) ? 'index,follow' : 'noindex,follow';

export const isArticleEligibleForSeoLinks = (
  article: Pick<ArticleContent, 'status' | 'reviewStatus'> | null | undefined,
): boolean => article?.status === 'published' && isApprovedArticleReview(article.reviewStatus);
