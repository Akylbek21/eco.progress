import type { NewsItem } from '../types';
import type { ArticleContent } from '../content/types';
import { articleContent, articleContentMap } from '../content/articles/articleContent';
import { normalizeArticleSlug } from '../content/articles/articleSlugs';

export type NewsSource = 'api' | 'fallback';
export interface NewsResult { items: NewsItem[]; source: NewsSource; stale: boolean }

const articleToNewsItem = (article: ArticleContent): NewsItem => ({
  id: normalizeArticleSlug(article.slug),
  title: article.title,
  excerpt: article.excerpt,
  category: 'Полезные материалы',
  date: article.datePublished,
  image: article.heroImage || '/og-cover.jpg',
  content: article.sections.flatMap((section) => [section.title, ...section.paragraphs, ...(section.table?.headers || []), ...(section.table?.rows.flatMap((row) => row.cells) || [])]),
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
  const article = articleContentMap.get(normalizeArticleSlug(id));
  return article ? articleToNewsItem(article) : undefined;
};
