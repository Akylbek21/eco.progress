import type { ReviewStatus } from '../types';

export interface ArticleReview { articleSlug: string; reviewerSlug: string; status: ReviewStatus; reviewedAt?: string }

// Пусто, пока нет подтверждённой рецензии конкретного опубликованного эксперта.
export const articleReviews: ArticleReview[] = [];
export const articleReviewBySlug = new Map(articleReviews.map((review) => [review.articleSlug, review] as const));
