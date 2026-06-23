import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';
import { PageSkeleton } from '../components/loading/PageLoader';
import ErrorState from '../components/ui/ErrorState';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { getNewsById } from '../services/newsService';

const NewsDetailsPage = () => {
  const { id } = useParams();
  const { data: item, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['news', id],
    queryFn: () => getNewsById(id!),
    enabled: !!id,
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <div className="mx-auto min-h-[60vh] max-w-3xl px-5 py-16"><ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => refetch()} /></div>;
  if (!item) {
    return (
      <div className="bg-eco-50 px-5 py-20">
        <SEO title="Новость не найдена | ecoprogress.kz" description="Материал не найден или был снят с публикации." />
        <div className="mx-auto max-w-3xl rounded-[24px] bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-eco-900">Новость не найдена</h1>
          <p className="mt-3 text-slate-600">Материал мог быть снят с публикации или ссылка устарела.</p>
          <Link to="/news" className="mt-6 inline-flex rounded-full bg-eco-800 px-5 py-3 text-sm font-semibold text-white">
            Вернуться к новостям
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="bg-white">
      <SEO title={`${item.title} | ecoprogress.kz`} description={item.excerpt} />
      <section className="relative overflow-hidden px-5 py-24 text-white sm:px-8">
        <ResponsiveImage fill src={item.image} alt="" priority width={1600} height={900} className="object-cover" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative mx-auto max-w-4xl">
          <Reveal><p className="text-sm font-semibold uppercase tracking-[0.22em] text-eco-200">{item.category} · {item.date}</p></Reveal>
          <Reveal delay={0.1}><h1 className="mt-4 text-4xl font-bold sm:text-5xl">{item.title}</h1></Reveal>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-5 py-14 text-lg leading-8 text-slate-700 sm:px-8">
        {item.content.map((paragraph) => <p key={paragraph} className="mb-5">{paragraph}</p>)}
      </section>
    </article>
  );
};

export default NewsDetailsPage;
