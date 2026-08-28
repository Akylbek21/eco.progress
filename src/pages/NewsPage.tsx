import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, FileCheck2, Lightbulb } from 'lucide-react';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { getNewsResult, prerenderNewsResult } from '../services/newsService';
import { getArticleImage, pageHeroImages } from '../data/pageHeroImages';

const NewsPage = () => {
  const { data, isError } = useQuery({
    queryKey: ['news'],
    queryFn: getNewsResult,
    initialData: prerenderNewsResult,
  });
  const news = data?.items ?? [];

  return (
    <div className="bg-eco-50">
      <SEO />
      <section className="relative isolate min-h-[620px] overflow-hidden px-5 py-20 text-white sm:px-8 sm:py-24 lg:flex lg:items-center">
        <ResponsiveImage fill priority sizes="100vw" src={pageHeroImages.news} alt="Природное явление в ночном небе" width={1600} height={900} wrapperClassName="-z-20" className="object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-eco-900/72 via-eco-900/34 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 -z-[5] h-16 bg-gradient-to-t from-eco-50/90 to-transparent" />
        <div className="mx-auto w-full max-w-7xl [text-shadow:0_2px_18px_rgba(2,28,57,0.72)]">
          <Reveal><h1 className="max-w-4xl text-4xl font-bold leading-[1.08] sm:text-6xl lg:text-7xl">Статьи и полезные материалы</h1></Reveal>
          <Reveal delay={0.08}><p className="mt-6 max-w-2xl text-base leading-7 text-white/82 sm:text-xl sm:leading-8">Разбираем экологические требования, документы и практические задачи предприятий простым языком.</p></Reveal>
          <Reveal delay={0.14}>
            <div className="mt-9 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-eco-900/42 p-4 backdrop-blur-md"><BookOpenCheck className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/75 sm:text-sm">практические разборы</span></div>
              <div className="rounded-2xl border border-white/15 bg-eco-900/42 p-4 backdrop-blur-md"><FileCheck2 className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/75 sm:text-sm">документы и требования</span></div>
              <div className="col-span-2 rounded-2xl border border-white/15 bg-eco-900/42 p-4 backdrop-blur-md sm:col-span-1"><Lightbulb className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/75 sm:text-sm">понятные рекомендации</span></div>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        {data?.stale && (
          <p className="mt-5 rounded-[20px] border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Не удалось обновить материалы. Показана сохранённая версия.
          </p>
        )}
        {isError && <p className="mt-5 rounded-[20px] border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">Не удалось загрузить статьи с сервера.</p>}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {news.map((item, index) => (
            <Reveal key={item.id} delay={index * 0.05}>
              <Link to={`/news/${item.id}`} className="group card-hover block h-full overflow-hidden rounded-[22px] bg-white shadow-sm">
                <ResponsiveImage sizes="(max-width: 767px) 100vw, 33vw" src={getArticleImage(item.id, item.image)} alt={item.title} width={1600} height={900} wrapperClassName="aspect-[16/9] w-full" className="object-cover transition duration-500 group-hover:scale-105" />
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
