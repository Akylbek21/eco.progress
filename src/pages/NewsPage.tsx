import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { fallbackNews, getNewsResult } from '../services/newsService';

const NewsPage = () => {
  const { data } = useQuery({
    queryKey: ['news'],
    queryFn: getNewsResult,
    initialData: { items: fallbackNews, source: 'fallback', stale: false },
    initialDataUpdatedAt: 0,
  });
  const news = data?.items ?? [];

  return (
    <div className="bg-eco-50">
      <SEO title="Статьи и полезные материалы | ecoprogress.kz" description="Статьи и полезные материалы ecoprogress.kz об экологических документах, отчетности, проверках и сопровождении бизнеса." />
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <Reveal><h1 className="text-4xl font-bold text-eco-900 sm:text-5xl">Статьи и полезные материалы</h1></Reveal>
        {data?.stale && (
          <p className="mt-5 rounded-[20px] border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Не удалось обновить материалы. Показана сохранённая версия.
          </p>
        )}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {news.map((item, index) => (
            <Reveal key={item.id} delay={index * 0.05}>
              <Link to={`/news/${item.id}`} className="card-hover block h-full overflow-hidden rounded-[22px] bg-white shadow-sm">
                <ResponsiveImage src={item.image} alt={item.title} width={800} height={450} wrapperClassName="aspect-[16/9] w-full" className="object-cover" />
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase text-eco-500">{item.category} · {item.date}</p>
                  <h2 className="mt-3 text-xl font-bold text-eco-900">{item.title}</h2>
                  <p className="mt-3 text-sm text-slate-600">{item.excerpt}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        {!news.length && <p className="mt-10 rounded-[20px] bg-white p-6 text-slate-600">Материалов пока нет.</p>}
      </section>
    </div>
  );
};

export default NewsPage;
