import type { NewsItem } from '../types';
import type { ArticleContent } from '../content/types';
import { trackEvent } from './analytics';
import { publicContentRepository } from '../content/apiRepository';

export type NewsSource = 'api' | 'fallback';
export interface NewsResult { items: NewsItem[]; source: NewsSource; stale: boolean }

const getDevFallbackNews = async (): Promise<NewsItem[]> => {
  if (!import.meta.env.DEV) return [];
  const { seoArticles } = await import('../data/seoArticles');
  return seoArticles.map((article) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    date: article.datePublished,
    image: article.image,
    content: article.sections.map((section) => `${section.title}. ${section.body}`),
  }));
};

const logApiError = (error: unknown) => {
  if (!import.meta.env.DEV) return;
  const status = typeof error === 'object' && error !== null && 'response' in error
    ? (error as { response?: { status?: number } }).response?.status
    : undefined;
  console.info(`[news] API update failed${status ? ` (HTTP ${status})` : ''}.`, error);
};

const articleToNewsItem = (article: ArticleContent): NewsItem => ({
  id: article.slug,
  title: article.title,
  excerpt: article.excerpt,
  category: 'Полезные материалы',
  date: article.datePublished,
  image: article.heroImage || '/og-cover.jpg',
  content: article.sections.flatMap((section) => [section.title, ...section.paragraphs]),
});

export const getNewsResult = async (): Promise<NewsResult> => {
  try {
    const items = await publicContentRepository.getArticles();
    if (Array.isArray(items)) return { items: items.map(articleToNewsItem), source: 'api', stale: false };
    throw new Error('News API returned an invalid payload.');
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
    logApiError(error);
    trackEvent('content_fallback_usage', { collection: 'articles' });
    return { items: await getDevFallbackNews(), source: 'fallback', stale: true };
  }
};

export const getNews = async (): Promise<NewsItem[]> => (await getNewsResult()).items;

export const getNewsById = async (id: string): Promise<NewsItem | undefined> => {
  try {
    const article = await publicContentRepository.getArticleBySlug(id);
    return article ? articleToNewsItem(article) : undefined;
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
    logApiError(error);
    trackEvent('content_fallback_usage', { collection: 'article', slug: id });
    return (await getDevFallbackNews()).find((item) => item.id === id);
  }
};
