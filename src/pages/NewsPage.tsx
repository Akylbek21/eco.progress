import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getNews } from '../services/newsService';

const NewsPage = () => {
  const { data: news = [], isLoading } = useQuery({ queryKey: ['news'], queryFn: getNews });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="bg-eco-50">
      <SEO title="Новости | ECOPROGRESS GROUP" description="Новости и материалы ECOPROGRESS GROUP об экологических документах, отчетности, проверках и сопровождении бизнеса." />
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <Reveal><h1 className="text-4xl font-bold text-eco-900 sm:text-5xl">Новости</h1></Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {news.map((item, index) => (
            <Reveal key={item.id} delay={index * 0.05}>
              <Link to={`/news/${item.id}`} className="card-hover block h-full overflow-hidden rounded-[22px] bg-white shadow-sm">
                <img src={item.image} alt="" className="h-44 w-full object-cover" />
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
