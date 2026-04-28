import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import SectionTitle from '../components/ui/SectionTitle';
import Card from '../components/ui/Card';
import { getNewsById } from '../services/newsService';
import { news as newsData } from '../data/mockData';

const NewsDetailsPage = () => {
  const { id } = useParams();
  const { data: item } = useQuery({
    queryKey: ['newsItem', id],
    queryFn: () => getNewsById(id ?? ''),
    enabled: Boolean(id),
    placeholderData: newsData.find((entry) => entry.id === id),
  });

  if (!item) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:py-14">
        <SectionTitle title="Новость не найдена" subtitle="Проверьте URL" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:py-14">
      <Link to="/news" className="text-sm font-medium text-eco-700 hover:text-eco-800">
        ← Вернуться к новостям
      </Link>
      <SectionTitle title={item.title} subtitle={item.category} />
      <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="space-y-8">
          <img src={item.image} alt={item.title} className="w-full rounded-[28px] object-cover" />
          <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-slate-600 leading-7">
              {item.excerpt} Мы подробно объясняем, какие шаги необходимо предпринять для бизнеса, чтобы сохранить экологическую безопасность и соблюдать новые требования.
            </p>
            <p className="text-slate-600 leading-7">
              В материале приведены рекомендации по подготовке документов, сроки и практические примеры. Это поможет вам быстрее подготовить компанию к проверкам и избежать штрафов.
            </p>
          </div>
        </article>
        <aside className="space-y-6">
          <Card>
            <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Дата публикации</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{item.date}</p>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold text-slate-900">Смотрите также</h3>
            <ul className="mt-4 space-y-3 text-slate-600">
              {newsData.filter((entry) => entry.id !== item.id).slice(0, 2).map((entry) => (
                <li key={entry.id}>
                  <Link to={`/news/${entry.id}`} className="text-eco-700 hover:text-eco-800">
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default NewsDetailsPage;
