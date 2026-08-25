import { isApprovedArticleReview } from '../content/articleReview.ts';
import type { SeoRobots } from './types.ts';

export const PUBLIC_SITE_URL = 'https://ecoprogress.kz';

export const canonicalForPublicPath = (routePath: string): string => {
  const normalized = routePath === '/' ? '/' : `/${routePath.replace(/^\/+|\/+$/gu, '')}`;
  return normalized === '/' ? PUBLIC_SITE_URL : `${PUBLIC_SITE_URL}${normalized}`;
};

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
