import { seoArticles } from '../data/seoArticles';
import type { NewsItem } from '../types';
import { fetcher } from './api';
import type { ArticleContent } from '../content/types';
import { trackEvent } from './analytics';

export type NewsSource = 'api' | 'fallback';
export interface NewsResult { items: NewsItem[]; source: NewsSource; stale: boolean }

export const fallbackNews: NewsItem[] = seoArticles.map((article) => ({
  id: article.id,
  title: article.title,
  excerpt: article.excerpt,
  category: article.category,
  date: article.datePublished,
  image: article.image,
  content: article.sections.map((section) => `${section.title}. ${section.body}`),
}));

const logApiError = (error: unknown) => {
  if (!import.meta.env.DEV) return;
  const status = typeof error === 'object' && error !== null && 'response' in error
    ? (error as { response?: { status?: number } }).response?.status
    : undefined;
  console.info(`[news] API update failed${status ? ` (HTTP ${status})` : ''}.`, error);
};

const articleToNewsItem = (article: ArticleContent): NewsItem => {
  const saved = fallbackNews.find((item) => item.id === article.slug);
  return {
    id: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    category: saved?.category || 'Полезные материалы',
    date: article.datePublished,
    image: article.heroImage || saved?.image || '/og-cover.jpg',
    content: article.sections.flatMap((section) => [section.title, ...section.paragraphs]),
  };
};

export const getNewsResult = async (): Promise<NewsResult> => {
  try {
    const items = await fetcher<ArticleContent[]>('/public/content/articles');
    if (Array.isArray(items)) return { items: items.map(articleToNewsItem), source: 'api', stale: false };
    throw new Error('News API returned an invalid payload.');
  } catch (error) {
    logApiError(error);
    trackEvent('content_fallback_usage', { collection: 'articles' });
    return { items: fallbackNews, source: 'fallback', stale: true };
  }
};

export const getNews = async (): Promise<NewsItem[]> => (await getNewsResult()).items;

export const getNewsById = async (id: string): Promise<NewsItem | undefined> => {
  try {
    return articleToNewsItem(await fetcher<ArticleContent>(`/public/content/articles/${encodeURIComponent(id)}`));
  } catch (error) {
    logApiError(error);
    trackEvent('content_fallback_usage', { collection: 'article', slug: id });
    return fallbackNews.find((item) => item.id === id);
  }
};
