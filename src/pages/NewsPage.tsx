import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import SectionTitle from '../components/ui/SectionTitle';
import NewsCard from '../components/content/NewsCard';
import { getNewsList } from '../services/newsService';
import { news as newsData } from '../data/mockData';

const NewsPage = () => {
  const { data: news = newsData } = useQuery({ queryKey: ['news'], queryFn: getNewsList });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:py-14">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionTitle title="Новости" subtitle="Экология и бизнес" />
          <p className="text-slate-600">Читайте последние обновления, изменения законодательства и советы по подготовке экологической документации.</p>
        </div>
        <Link to="/news" className="text-sm font-medium text-eco-700 hover:text-eco-800">
          Все новости
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {news.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};

export default NewsPage;
