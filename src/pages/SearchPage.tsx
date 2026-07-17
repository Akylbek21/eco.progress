import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { searchPublicContent, type PublicSearchResult } from '../services/publicContentSearch';

const labels: Record<PublicSearchResult['type'], string> = { service: 'Услуга', article: 'Статья', region: 'Регион' };

const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState<PublicSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (query.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    searchPublicContent(query).then((items) => { if (active) setResults(items); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = draft.trim();
    setParams(normalized ? { q: normalized } : {});
  };

  return <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8"><SEO title="Поиск по сайту | ECOPROGRESS" description="Поиск по опубликованным услугам, статьям и региональным материалам ECOPROGRESS." robots="noindex,follow" /><h1 className="text-4xl font-bold text-eco-900">Поиск по сайту</h1><form onSubmit={submit} role="search" className="mt-8 flex gap-3"><label className="sr-only" htmlFor="site-search">Поисковый запрос</label><input id="site-search" value={draft} onChange={(event) => setDraft(event.target.value)} minLength={2} placeholder="Услуга, документ, город…" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4" /><button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-eco-900 px-5 py-4 font-semibold text-white"><Search size={19} /> Найти</button></form>{loading ? <div className="mt-10"><LoadingSpinner /></div> : query.length >= 2 && <section className="mt-10" aria-live="polite"><h2 className="text-xl font-bold text-eco-900">Найдено: {results.length}</h2><div className="mt-5 space-y-4">{results.map((item) => <article key={`${item.type}:${item.slug}`} className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-eco-600">{labels[item.type]}</p><h3 className="mt-2 text-xl font-bold text-eco-900"><Link className="hover:underline" to={item.url}>{item.title}</Link></h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></article>)}</div>{results.length === 0 && <p className="mt-5 rounded-2xl bg-white p-6 text-slate-600">По опубликованным материалам ничего не найдено. Попробуйте изменить запрос.</p>}</section>}</div>;
};

export default SearchPage;
