import { fetcher } from './api';
import type { NewsItem } from '../types';

export const fallbackNews: NewsItem[] = [
  {
    id: 'eco-documents-checklist',
    title: 'Экологические документы: что проверить бизнесу',
    excerpt: 'Короткий чеклист по разрешениям, отчетности, договорам на отходы и лабораторным протоколам.',
    category: 'Документы',
    date: '2026-01-15',
    image: '/cottonbro.jpg',
    content: [
      'Перед проверкой важно убедиться, что у компании собраны актуальные разрешения, отчеты, паспорта отходов и договоры на вывоз или утилизацию.',
      'Если часть документов отсутствует, лучше заранее провести аудит и закрыть пробелы до запроса контролирующего органа.',
    ],
  },
  {
    id: 'laboratory-control',
    title: 'Когда нужны лабораторные исследования',
    excerpt: 'Разбираем случаи, когда бизнесу требуются замеры, протоколы и производственный экологический контроль.',
    category: 'Лаборатория',
    date: '2026-02-10',
    image: '/edward.jpg',
    content: [
      'Лабораторные исследования помогают подтвердить показатели воды, воздуха, почвы и выбросов.',
      'Протоколы используются в отчетности, производственном контроле и при подготовке экологических документов.',
    ],
  },
  {
    id: 'waste-documents',
    title: 'Документы при обращении с отходами',
    excerpt: 'Что обычно требуется при вывозе, транспортировке, утилизации и размещении отходов.',
    category: 'Отходы',
    date: '2026-03-05',
    image: '/utilizacija-othodov-3.jpg',
    content: [
      'Для работы с отходами важны классификация, подтверждающие акты, договоры и корректное сопровождение перемещения отходов.',
      'Правильно оформленные документы снижают риски при проверках и помогают вести прозрачный учет.',
    ],
  },
];

export const getNews = async (): Promise<NewsItem[]> => {
  try {
    const news = await fetcher<NewsItem[]>('/news');
    return Array.isArray(news) && news.length ? news : fallbackNews;
  } catch {
    return fallbackNews;
  }
};

export const getNewsById = async (id: string): Promise<NewsItem | undefined> => {
  try {
    return await fetcher<NewsItem>(`/news/${id}`);
  } catch {
    return fallbackNews.find((item) => item.id === id);
  }
};
