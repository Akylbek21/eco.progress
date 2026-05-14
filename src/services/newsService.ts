import { fetcher } from './api';
import type { NewsItem } from '../types';

export const getNews = async (): Promise<NewsItem[]> => fetcher<NewsItem[]>('/news');

export const getNewsById = async (id: string): Promise<NewsItem | undefined> => fetcher<NewsItem>(`/news/${id}`);
