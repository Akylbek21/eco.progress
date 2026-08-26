import { isApprovedArticleReview } from '../content/articleReview.ts';
import type { SeoRobots } from './types.ts';
import { absoluteUrl, SITE_ORIGIN } from './url.ts';

export const PUBLIC_SITE_URL = SITE_ORIGIN;

export const canonicalForPublicPath = (routePath: string): string => absoluteUrl(routePath);

export interface PublicIndexingCandidate {
  path: string;
  type?: string;
  indexable?: boolean;
  reviewStatus?: unknown;
}

export const robotsForPublicPage = (page: PublicIndexingCandidate): SeoRobots => {
  if (page.indexable === false || page.path === '/employees') return 'noindex,follow';
  if (page.type === 'article' && page.path !== '/news' && !isApprovedArticleReview(page.reviewStatus)) {
    return 'noindex,follow';
  }
  return 'index,follow';
};

export const isPublicPageIndexable = (page: PublicIndexingCandidate): boolean =>
  robotsForPublicPage(page) === 'index,follow';
