import type { ArticleContent, CmsArticleReviewDto, ContentStatus, ReviewStatus } from './types.ts';

type PublicArticleDto = Omit<ArticleContent, 'status' | 'reviewStatus'> & {
  status: ArticleContent['status'] | string;
  reviewStatus?: ArticleContent['reviewStatus'] | string;
  reviewerSlug?: string;
  lastReviewedAt?: string;
  review?: CmsArticleReviewDto;
  articleReview?: CmsArticleReviewDto;
};

const normalizedToken = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/-/gu, '_');

const normalizeContentStatus = (value: unknown): ContentStatus => {
  const statuses: Record<string, ContentStatus> = {
    DRAFT: 'draft', SPECIALIST_REVIEW: 'specialist-review', EXPERT_REVIEW: 'specialist-review',
    LEGAL_REVIEW: 'legal-review', APPROVED: 'approved', READY_TO_PUBLISH: 'approved',
    PUBLISHED: 'published', OUTDATED: 'outdated', ARCHIVED: 'archived',
  };
  return statuses[normalizedToken(value)] ?? 'draft';
};

export const normalizeArticleReviewStatus = (value: unknown): ReviewStatus => {
  const status = normalizedToken(value);
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  if (status === 'DRAFT') return 'draft';
  return 'requires-specialist-review';
};

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));

export const normalizePublicArticle = (value: PublicArticleDto): ArticleContent => {
  const review = value.articleReview ?? value.review;
  const reviewStatus = normalizeArticleReviewStatus(review?.status ?? value.reviewStatus);
  const reviewerSlug = review?.expertId?.trim() || value.reviewerSlug?.trim();
  const lastReviewedAt = review?.reviewedAt ?? value.lastReviewedAt;
  const hasCompleteApproval = reviewStatus === 'approved' && Boolean(reviewerSlug) && validDate(lastReviewedAt);
  const { review: _review, articleReview: _articleReview, ...article } = value;

  return {
    ...article,
    status: normalizeContentStatus(value.status),
    reviewStatus: hasCompleteApproval ? 'approved' : reviewStatus === 'approved' ? 'requires-specialist-review' : reviewStatus,
    ...(hasCompleteApproval ? { reviewerSlug, lastReviewedAt } : { reviewerSlug: undefined, lastReviewedAt: undefined }),
  } as ArticleContent;
};
