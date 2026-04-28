import { news } from '../data/mockData';

export const getNews = async () => news;

export const getNewsById = async (id: string) => news.find((item) => item.id === id);
