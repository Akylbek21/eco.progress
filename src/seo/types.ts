export type SeoRobots = 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
export type SeoChangeFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface SeoRouteConfig {
  path: string;
  title: string;
  description: string;
  h1: string;
  canonical: string;
  robots: SeoRobots;
  ogType: 'website' | 'article';
  ogTitle?: string;
  ogDescription?: string;
  ogImage: string;
  ogImageWidth: number;
  ogImageHeight: number;
  twitterCard: 'summary' | 'summary_large_image';
  schema: Record<string, unknown>[];
  includeInSitemap: boolean;
  priority?: number;
  changeFrequency?: SeoChangeFrequency;
  lastModified?: string;
}

export interface SeoEntityOverride {
  title?: string;
  description?: string;
  h1?: string;
  canonical?: string;
  robots?: SeoRobots;
  ogType?: 'website' | 'article';
  ogImage?: string;
  schema?: Record<string, unknown>[];
  datePublished?: string;
  dateModified?: string;
}
