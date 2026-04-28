import { news, type NewsItem } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getNewsList = async (): Promise<NewsItem[]> => {
  await delay(300);
  return news;
};

export const getNewsById = async (newsId: string): Promise<NewsItem | undefined> => {
  await delay(300);
  return news.find((item) => item.id === newsId);
};
