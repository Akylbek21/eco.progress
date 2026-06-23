import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';
import { PageSkeleton } from '../components/loading/PageLoader';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { fallbackNews, getNews } from '../services/newsService';

const NewsPage = () => {
  const { data: news = [], isLoading } = useQuery({ queryKey: ['news'], queryFn: getNews });
  const usingFallbackNews = news === fallbackNews;

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="bg-eco-50">
      <SEO title="Новости | ecoprogress.kz" description="Новости и материалы ecoprogress.kz об экологических документах, отчетности, проверках и сопровождении бизнеса." />
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <Reveal><h1 className="text-4xl font-bold text-eco-900 sm:text-5xl">Новости</h1></Reveal>
        {usingFallbackNews && (
          <p className="mt-5 rounded-[20px] border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Показываем базовые материалы. Новостной API временно недоступен.
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
      </section>
    </div>
  );
};

export default NewsPage;
