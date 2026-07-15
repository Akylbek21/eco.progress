import { seoArticles } from '../data/seoArticles';
import type { NewsItem } from '../types';

export const fallbackNews: NewsItem[] = seoArticles.map((article) => ({
  id: article.id,
  title: article.title,
  excerpt: article.excerpt,
  category: article.category,
  date: article.datePublished,
  image: article.image,
  content: article.sections.map((section) => `${section.title}. ${section.body}`),
}));

export const getNews = async (): Promise<NewsItem[]> => fallbackNews;

export const getNewsById = async (id: string): Promise<NewsItem | undefined> => fallbackNews.find((item) => item.id === id);
