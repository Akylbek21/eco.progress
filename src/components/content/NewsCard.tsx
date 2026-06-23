import { Link } from 'react-router-dom';
import type { NewsItem } from '../../types';
import Button from '../ui/Button';
import ResponsiveImage from '../ui/ResponsiveImage';

const NewsCard = ({ item }: { item: NewsItem }) => {
  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl">
      <ResponsiveImage src={item.image} alt={item.title} width={900} height={506} wrapperClassName="aspect-[16/9] w-full" className="object-cover" />
      <div className="p-6">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-eco-700">
          <span>{item.category}</span>
          <span>•</span>
          <span>{item.date}</span>
        </div>
        <h3 className="mb-3 text-xl font-semibold text-slate-900">{item.title}</h3>
        <p className="mb-5 text-slate-600">{item.excerpt}</p>
        <Link to={`/news/${item.id}`}>
          <Button variant="ghost">Читать</Button>
        </Link>
      </div>
    </article>
  );
};

export default NewsCard;
