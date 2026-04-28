import { Link } from 'react-router-dom';
import { type NewsItem } from '../../data/mockData';
import Button from '../ui/Button';

const NewsCard = ({ item }: { item: NewsItem }) => {
  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="h-56 overflow-hidden bg-slate-100">
        <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
      </div>
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
