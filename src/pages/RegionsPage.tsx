import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { regions } from '../content/regions';
import { activeServices } from '../content/serviceCatalog';
import { company } from '../config/company';
import { buildBreadcrumbSchema } from '../utils/schema';
import { regionContentMap } from '../content/regions/regionContent';

const RegionsPage = () => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => regions.filter((region) => `${region.city} ${region.regionNominative}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const groups = [
    ['Доступны по Казахстану дистанционно', activeServices.filter((item) => item.areaServed.type === 'KAZAKHSTAN' && item.areaServed.remote)],
    ['Требуют выезда специалиста', activeServices.filter((item) => item.areaServed.onSite)],
    ['Доступны только в Шымкенте', activeServices.filter((item) => item.areaServed.type === 'SHYMKENT_ONLY')],
    ['Доступны в отдельных регионах', activeServices.filter((item) => item.areaServed.type === 'SELECTED_REGIONS')],
  ] as const;
  return <div className="bg-[#F7FBFD]">
    <SEO title="Города и регионы обслуживания | ECOPROGRESS" description="Условия оказания экологических услуг ECOPROGRESS по городам Казахстана: дистанционная работа, выезд специалистов и услуги в Шымкенте." canonical={`${company.siteUrl}/regions`} schema={buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Города и регионы', url: `${company.siteUrl}/regions` }])} />
    <section className="bg-eco-900 px-5 py-20 text-white sm:px-8"><div className="mx-auto max-w-7xl"><h1 className="text-4xl font-bold sm:text-6xl">Города и регионы обслуживания</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">Мы не заявляем офис в каждом городе. Документы готовим дистанционно, а выездные работы выполняем только там, где это указано и согласовано со специалистом.</p></div></section>
    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <label className="block max-w-xl text-sm font-semibold text-eco-900">Поиск по городу или области<input value={query} onChange={(event) => setQuery(event.target.value)} type="search" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" placeholder="Например, Караганда" /></label>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((region) => {
        const available = activeServices.filter((service) => service.areaServed.type === 'KAZAKHSTAN' || service.areaServed.regions?.includes(region.slug));
        const details = regionContentMap.get(region.slug);
        return <article key={region.slug} className="rounded-[22px] border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold text-eco-900">{region.city}</h2><p className="mt-2 text-sm text-slate-600">{region.regionNominative}</p>{details && <><p className="mt-4 text-sm leading-6 text-slate-600">{details.introduction}</p><p className="mt-3 text-xs font-semibold text-eco-700">Отрасли: {details.industries.join(', ')}</p></>}<p className="mt-4 text-sm"><strong>Дистанционно:</strong> {available.some((item) => item.areaServed.remote) ? 'да' : 'нет'}</p><p className="mt-1 text-sm"><strong>Выезд:</strong> {available.some((item) => item.areaServed.onSite) ? 'по согласованию' : 'не предусмотрен'}</p><p className="mt-4 text-sm text-slate-600">Доступно услуг: {details?.availableServiceSlugs.length ?? available.length}</p><Link to={`/ecologicheskie-uslugi-${region.slug}`} className="mt-5 inline-flex text-sm font-bold text-eco-700">Условия работы в регионе →</Link></article>;
      })}</div>
      {!filtered.length && <p className="mt-8 rounded-2xl bg-white p-6 text-slate-600">Город не найден. Уточните возможность работы у специалиста.</p>}
      <div className="mt-14 grid gap-5 lg:grid-cols-2">{groups.map(([title, services]) => <section key={title} className="rounded-[22px] bg-white p-6"><h2 className="text-xl font-bold text-eco-900">{title}</h2><ul className="mt-4 space-y-2 text-sm text-slate-700">{services.map((service) => <li key={service.slug}><Link to={`/services/${service.slug}`} className="hover:text-eco-700">{service.title}</Link></li>)}</ul></section>)}</div>
    </section>
  </div>;
};
export default RegionsPage;
