import seoArticlesJson from './seoArticles.generated.json';

export interface SeoArticleSection {
  id: string;
  title: string;
  body: string;
  paragraphs: string[];
  bullets?: string[];
  checklist?: string[];
  warning?: string;
}

export interface SeoArticleConfig {
  id: string;
  slug: string;
  title: string;
  description: string;
  h1: string;
  excerpt: string;
  shortAnswer: string;
  intent: string;
  targetAudience: string[];
  category: string;
  datePublished: string;
  dateModified: string;
  image: string;
  imageAlt: string;
  tableOfContents: boolean;
  authorSlug: string;
  reviewerSlug?: string;
  reviewStatus: 'approved' | 'requires-specialist-review' | 'draft';
  relatedServiceSlugs: string[];
  relatedArticleSlugs: string[];
  sources: Array<{ title: string; url: string; accessedAt?: string; claimStatus: 'verified' | 'requires-review' | 'general-information' }>;
  sections: SeoArticleSection[];
  faq: Array<{ question: string; answer: string }>;
  relatedLinks: Array<{ label: string; path: string }>;
}

export const seoArticles = seoArticlesJson as SeoArticleConfig[];
export const seoArticleMap = new Map(seoArticles.map((article) => [article.id, article]));
