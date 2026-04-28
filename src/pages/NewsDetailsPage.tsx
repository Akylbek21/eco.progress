import { Navigate, useParams } from 'react-router-dom';
import Reveal from '../components/animations/Reveal';
import { news } from '../data/mockData';

const NewsDetailsPage = () => {
  const { id } = useParams();
  const item = news.find((newsItem) => newsItem.id === id);
  if (!item) return <Navigate to="/news" replace />;
  return (
    <article className="bg-white">
      <section className="relative overflow-hidden px-5 py-24 text-white sm:px-8">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${item.image})` }} />
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
