import type { NewsItem } from '../types';
import type { ArticleContent } from '../content/types';
import { articleContent } from '../content/articles/articleContent';

export type NewsSource = 'api' | 'fallback';
export interface NewsResult { items: NewsItem[]; source: NewsSource; stale: boolean }

const articleToNewsItem = (article: ArticleContent): NewsItem => ({
  id: article.slug,
  title: article.title,
  excerpt: article.excerpt,
  category: 'Полезные материалы',
  date: article.datePublished,
  image: article.heroImage || '/og-cover.jpg',
  content: article.sections.flatMap((section) => [section.title, ...section.paragraphs]),
});

export const prerenderNewsResult: NewsResult = {
  items: articleContent.filter((article) => article.status === 'published').map(articleToNewsItem),
  source: 'fallback',
  stale: false,
};

export const getNewsResult = async (): Promise<NewsResult> => {
  return prerenderNewsResult;
};

export const getNews = async (): Promise<NewsItem[]> => (await getNewsResult()).items;

export const getNewsById = async (id: string): Promise<NewsItem | undefined> => {
  const article = articleContent.find((item) => item.slug === id);
  return article ? articleToNewsItem(article) : undefined;
};
