import seoArticlesJson from './seoArticles.generated.json';

export interface SeoArticleSection {
  title: string;
  body: string;
}

export interface SeoArticleConfig {
  id: string;
  slug: string;
  title: string;
  description: string;
  h1: string;
  excerpt: string;
  category: string;
  datePublished: string;
  dateModified: string;
  image: string;
  sections: SeoArticleSection[];
  faq: Array<{ question: string; answer: string }>;
  relatedLinks: Array<{ label: string; path: string }>;
}

export const seoArticles = seoArticlesJson as SeoArticleConfig[];
export const seoArticleMap = new Map(seoArticles.map((article) => [article.id, article]));

