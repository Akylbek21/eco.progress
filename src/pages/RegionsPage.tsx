import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, CheckCircle2, MonitorCheck, Search } from 'lucide-react';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { regions } from '../content/regions';
import { activeServices } from '../content/serviceCatalog';
import { regionContent, regionContentMap } from '../content/regions/regionContent';
import { isRegionContentIndexable } from '../content/regions/regionContentQuality';
import { pageHeroImages } from '../data/pageHeroImages';
import { getCityImage } from '../data/cityImages';

const RegionsPage = () => {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => regions.filter((region) => `${region.cityNominative} ${region.regionNominative}`.toLowerCase().includes(normalizedQuery)),
    [normalizedQuery],
  );
  const groups = [
    ['Доступны по Казахстану дистанционно', activeServices.filter((item) => item.areaServed.type === 'KAZAKHSTAN' && item.areaServed.remote)],
    ['Требуют выезд специалиста', activeServices.filter((item) => item.areaServed.onSite)],
    ['Доступны только в Шымкенте', activeServices.filter((item) => item.areaServed.type === 'SHYMKENT_ONLY')],
    ['Доступны в отдельных регионах', activeServices.filter((item) => item.areaServed.type === 'SELECTED_REGIONS')],
  ] as const;

  return (
    <div className="overflow-hidden bg-[#F4F8FA]">
      <SEO />
      <section className="relative isolate min-h-[540px] overflow-hidden px-5 py-20 text-white sm:px-8 sm:py-24 lg:flex lg:items-center">
        <ResponsiveImage fill priority sizes="100vw" src={pageHeroImages.regions} alt="Горный природный пейзаж" width={1600} height={900} wrapperClassName="-z-30" className="object-cover object-center" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-r from-eco-900/76 via-eco-900/42 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-16 bg-gradient-to-t from-[#F4F8FA]/90 to-transparent" />
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-4xl [text-shadow:0_2px_18px_rgba(2,28,57,0.72)]">
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] sm:text-6xl lg:text-7xl">Экологические услуги в вашем городе</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/80 sm:text-xl sm:leading-8">Документы готовим дистанционно по Казахстану. Выездные работы проводим после оценки задачи и согласования со специалистом.</p>
            <div className="mt-9 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"><strong className="block text-2xl text-accent">{regions.length}</strong><span className="mt-1 block text-xs text-white/70 sm:text-sm">городов на сайте</span></div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"><MonitorCheck className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/70 sm:text-sm">дистанционный старт</span></div>
              <div className="col-span-2 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:col-span-1"><CheckCircle2 className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/70 sm:text-sm">честные условия работы</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="relative z-10 -mt-7 rounded-[26px] border border-white/70 bg-white/95 p-4 shadow-2xl shadow-eco-900/10 backdrop-blur-xl sm:-mt-10 sm:p-6">
          <label htmlFor="region-search" className="mb-2 block text-sm font-bold text-eco-900">Найдите свой город или область</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-eco-600" size={21} />
            <input id="region-search" value={query} onChange={(event) => setQuery(event.target.value)} type="search" className="w-full rounded-2xl border border-slate-200 bg-[#F8FBFC] py-4 pl-12 pr-4 text-base text-eco-900 outline-none transition placeholder:text-slate-400 focus:border-eco-500 focus:bg-white focus:ring-4 focus:ring-eco-100" placeholder="Например, Караганда" />
          </div>
        </div>

        <div className="mb-7 mt-12 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-eco-600">География работы</p><h2 className="mt-2 text-3xl font-bold text-eco-900 sm:text-4xl">Выберите свой город</h2></div>
          <p aria-live="polite" className="text-sm font-medium text-slate-500">Найдено: {filtered.length}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((region) => {
            const available = activeServices.filter((service) => service.areaServed.type === 'KAZAKHSTAN' || service.areaServed.regions?.includes(region.slug));
            const details = regionContentMap.get(region.slug);
            const indexed = isRegionContentIndexable(details, regionContent);
            const serviceCount = details?.availableServiceSlugs.length ?? available.length;
            const hasRemote = available.some((item) => item.areaServed.remote);
            const hasOnSite = available.some((item) => item.areaServed.onSite);
            const cardBody = <>
              <div className="relative h-60 overflow-hidden">
                <ResponsiveImage sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" src={getCityImage(region.slug) || pageHeroImages.regions} alt={`Природа региона — ${region.cityNominative}`} width={1600} height={900} wrapperClassName="h-full w-full" className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-eco-900 via-eco-900/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white"><h3 className="text-3xl font-bold">{region.cityNominative}</h3><p className="mt-1 text-sm text-white/75">{region.regionNominative}</p></div>
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <p className="line-clamp-3 text-sm leading-6 text-slate-600">{details?.introduction ?? `Экологические услуги для предприятий в городе ${region.cityNominative} и регионе.`}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {hasRemote && <span className="inline-flex items-center gap-1.5 rounded-full bg-eco-50 px-3 py-1.5 text-xs font-bold text-eco-800"><MonitorCheck size={14} />Дистанционно</span>}
                  {hasOnSite && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"><Building2 size={14} />Выезд по согласованию</span>}
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-5"><span className="text-sm font-semibold text-slate-500">{serviceCount} услуг</span><span className="inline-flex items-center gap-2 text-sm font-bold text-eco-700">Условия работы <ArrowUpRight size={17} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span></div>
              </div>
            </>;

            return indexed ? (
              <Link key={region.slug} to={`/ecologicheskie-uslugi-${region.slug}`} className="group flex min-h-full flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-lg shadow-eco-900/5 transition duration-300 hover:-translate-y-1 hover:border-eco-200 hover:shadow-2xl hover:shadow-eco-900/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-eco-200">{cardBody}</Link>
            ) : (
              <article key={region.slug} className="group flex min-h-full flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-lg shadow-eco-900/5">{cardBody}</article>
            );
          })}
        </div>

        {!filtered.length && <div className="mt-8 rounded-[26px] border border-dashed border-eco-200 bg-white px-6 py-14 text-center"><Search className="mx-auto text-eco-400" size={36} /><h2 className="mt-4 text-xl font-bold text-eco-900">Город не найден</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Проверьте название или оставьте заявку — специалист уточнит возможность работы в вашем регионе.</p><button type="button" onClick={() => setQuery('')} className="mt-5 rounded-xl bg-eco-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-eco-800">Показать все города</button></div>}

        <section className="mt-20 rounded-[30px] border border-eco-100 bg-eco-50 p-6 text-eco-900 sm:p-10 lg:p-12">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl"><h2 className="text-3xl font-bold sm:text-4xl">Какие услуги доступны в регионах</h2><p className="mt-4 max-w-2xl leading-7 text-slate-600">Сразу показываем, где достаточно дистанционной работы, а где потребуется выезд или региональное согласование.</p></div>
            <Link to="/contacts" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-sm font-bold text-eco-900 transition hover:bg-accent/90">Уточнить свой регион <ArrowUpRight size={18} /></Link>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            {groups.map(([title, services]) => <div key={title} className="rounded-[22px] border border-eco-100 bg-white p-5 shadow-sm sm:p-6"><h3 className="text-lg font-bold text-eco-900">{title}</h3><ul className="mt-4 space-y-2.5 text-sm text-slate-600">{services.map((service) => <li key={service.slug}><Link to={`/services/${service.slug}`} className="inline-flex items-start gap-2 transition hover:text-eco-700"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-eco-500" />{service.title}</Link></li>)}</ul></div>)}
          </div>
        </section>
      </section>
    </div>
  );
};

export default RegionsPage;
