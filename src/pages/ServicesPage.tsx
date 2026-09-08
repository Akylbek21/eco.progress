import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { CheckCircle2, FileText, Globe2, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import WhatsAppButton from '../components/WhatsAppButton';
import WhatsAppLeadForm from '../components/WhatsAppLeadForm';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import ServiceCard from '../components/content/ServiceCard';
import { fallbackServices, getServiceCatalog } from '../services/serviceService';
import { activeServices, formatKztPrice, GENERAL_PRIMARY_CTA_LABEL, getCatalogService, getServiceCatalogGroup, PRELIMINARY_PRICE_NOTICE, serviceGroups } from '../content/serviceCatalog';
import type { ServiceCategory } from '../types';
import { pageHeroImages } from '../data/pageHeroImages';

const OrderChoiceModal = lazy(() => import('../components/OrderChoiceModal'));

const categories: Array<'Все' | ServiceCategory> = ['Все', ...serviceGroups.map((group) => group.category)];
const categoryLabel = (value: 'Все' | ServiceCategory) => value === 'Все' ? value : serviceGroups.find((group) => group.category === value)?.title || value;
const calculatorCatalogServices = activeServices.filter((service) => service.showInCalculator && service.pricing.calculatorBasePrice !== undefined);

const ServicesPage = () => {
  const { data, isError } = useQuery({
    queryKey: ['services'],
    queryFn: getServiceCatalog,
    initialData: { items: fallbackServices, source: 'fallback' },
    initialDataUpdatedAt: 0,
  });
  const services = data?.items ?? [];
  const calculatorServices = calculatorCatalogServices;
  const [category, setCategory] = useState<'Все' | ServiceCategory>('Все');
  const [search, setSearch] = useState('');
  const [orderModal, setOrderModal] = useState<string | null>(null);
  const [calculator, setCalculator] = useState({
    serviceId: '',
    objectScale: 'medium',
    urgency: 'standard',
    wasteVolume: '0',
    labPoints: '0',
  });
  useEffect(() => { if (calculatorServices.length && !calculator.serviceId) setCalculator((c) => ({ ...c, serviceId: calculatorServices[0].slug })); }, [calculator.serviceId, calculatorServices]);
  const normalizedSearch = search.trim().toLocaleLowerCase('ru');
  const items = useMemo(() => services.filter((service) => {
    if (service.pageType !== 'service') return false;
    if (category !== 'Все' && getServiceCatalogGroup({ slug: service.id, category: service.category }) !== category) return false;
    if (!normalizedSearch) return true;
    const catalog = getCatalogService(service.id);
    return [service.title, catalog?.shortTitle, service.id, ...service.searchAliases]
      .filter(Boolean).join(' ').toLocaleLowerCase('ru').includes(normalizedSearch);
  }), [category, normalizedSearch, services]);
  const groupedItems = useMemo(() => serviceGroups.map((group) => ({
    ...group,
    services: items.filter((service) => getServiceCatalogGroup({ slug: service.id, category: service.category }) === group.category),
    overviewPages: services.filter((service) => service.pageType === 'direction-overview' && getServiceCatalogGroup({ slug: service.id, category: service.category }) === group.category),
  })).filter((group) => group.services.length > 0), [items, services]);
  const selectedService = services.find((service) => service.id === calculator.serviceId) ?? services[0];
  const selectedCatalogService = activeServices.find((service) => service.slug === calculator.serviceId);
  const basePrice = selectedCatalogService?.showInCalculator ? selectedCatalogService.pricing.calculatorBasePrice : undefined;
  const scaleMultiplier = calculator.objectScale === 'small' ? 0.85 : calculator.objectScale === 'large' ? 1.45 : 1;
  const urgencyMultiplier = calculator.urgency === 'fast' ? 1.25 : calculator.urgency === 'complex' ? 1.55 : 1;
  const wasteVolume = Number(calculator.wasteVolume) || 0;
  const labPoints = Number(calculator.labPoints) || 0;
  const estimatedPrice = basePrice === undefined ? undefined : basePrice * scaleMultiplier * urgencyMultiplier + wasteVolume * 9000 + labPoints * 18000;
  const minPrice = estimatedPrice === undefined ? undefined : estimatedPrice * 0.9;
  const maxPrice = estimatedPrice === undefined ? undefined : estimatedPrice * 1.15;
  const updateCalculator = (name: keyof typeof calculator, value: string) => {
    setCalculator((current) => ({ ...current, [name]: value }));
  };
  if (!selectedService) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5 text-center text-sm font-semibold text-slate-600">
        {isError ? 'Не удалось загрузить услуги с сервера.' : 'Услуги временно недоступны. Попробуйте обновить страницу.'}
      </div>
    );
  }

  return (
    <div>
      <SEO />
      <section className="relative isolate min-h-[620px] overflow-hidden px-5 py-20 text-white sm:px-8 sm:py-24 lg:flex lg:items-center">
        <ResponsiveImage
          fill
          priority
          sizes="100vw"
          src={pageHeroImages.services}
          alt="Горный природный ландшафт"
          width={1600}
          height={900}
          wrapperClassName="-z-20"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-eco-900/72 via-eco-900/36 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 -z-[5] h-16 bg-gradient-to-t from-eco-50/90 to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl [text-shadow:0_2px_18px_rgba(2,28,57,0.72)]">
          <Reveal><h1 className="max-w-4xl text-4xl font-bold leading-[1.08] sm:text-6xl lg:text-7xl">Экологические услуги полного цикла</h1></Reveal>
          <Reveal delay={0.1}><p className="mt-6 max-w-2xl text-base leading-7 text-white/82 sm:text-xl sm:leading-8">Проектная документация и лабораторные исследования по Казахстану. Утилизация отходов — в Шымкенте, Таразе и Туркестане; транспортировка и размещение — в Шымкенте.</p></Reveal>
          <Reveal delay={0.14}>
            <div className="mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-eco-900/42 p-4 backdrop-blur-md"><FileText className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/75 sm:text-sm">документы и проекты</span></div>
              <div className="rounded-2xl border border-white/15 bg-eco-900/42 p-4 backdrop-blur-md"><CheckCircle2 className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/75 sm:text-sm">работа по договору</span></div>
              <div className="col-span-2 rounded-2xl border border-white/15 bg-eco-900/42 p-4 backdrop-blur-md sm:col-span-1"><Globe2 className="text-accent" size={25} /><span className="mt-2 block text-xs text-white/75 sm:text-sm">по всему Казахстану</span></div>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <Button type="button" onClick={() => setOrderModal('')} className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto">{GENERAL_PRIMARY_CTA_LABEL}</Button>
              <WhatsAppButton label="Написать в WhatsApp" className="w-full sm:w-auto" />
            </div>
          </Reveal>
        </div>
      </section>
      <section className="bg-eco-50 px-4 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="sticky top-16 z-20 -mx-4 border-y border-eco-100 bg-eco-50/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <label className="relative block max-w-2xl">
              <span className="sr-only">Поиск услуги</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти услугу: НДВ, ПЭК, анализ воды…" className="input-focus w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-12 text-base text-slate-900 shadow-sm" />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Очистить поиск" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>}
            </label>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:gap-3">
              {categories.map((item) => (
                <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition sm:px-5 ${category === item ? 'bg-eco-800 text-white shadow-sm' : 'border border-white bg-white text-eco-800 hover:border-eco-200 hover:bg-eco-100'}`}>
                  {categoryLabel(item)}
                </button>
              ))}
            </div>
          </div>

          {groupedItems.length > 0 ? <div className="mt-10 space-y-14">
            {groupedItems.map((group) => (
              <section key={group.category} id={`direction-${serviceGroups.findIndex((item) => item.category === group.category) + 1}`} className="scroll-mt-28" aria-labelledby={`group-${group.category}`}>
                <div className="flex flex-col justify-between gap-4 border-b border-eco-200 pb-5 sm:flex-row sm:items-end">
                  <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-eco-500">Направление</p><h2 id={`group-${group.category}`} className="mt-2 text-3xl font-bold text-eco-900">{group.title}</h2><p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">{group.description}</p></div>
                  {group.overviewPages.length > 0 && <nav aria-label={`Обзор направления ${group.title}`} className="flex flex-wrap gap-2">{group.overviewPages.map((page) => <Link key={page.id} to={`/services/${page.id}`} className="rounded-full border border-eco-200 bg-white px-4 py-2 text-sm font-semibold text-eco-800 hover:bg-eco-100">Обзор: {page.title}</Link>)}</nav>}
                </div>
                <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {group.services.map((service, index) => <Reveal key={service.id} delay={index * 0.03}><ServiceCard service={service} onOrder={setOrderModal} /></Reveal>)}
                </div>
              </section>
            ))}
          </div> : <div className="mt-10 rounded-[24px] border border-dashed border-eco-300 bg-white px-6 py-12 text-center"><h2 className="text-2xl font-bold text-eco-900">Услуги не найдены</h2><p className="mt-3 text-slate-600">Попробуйте другое название или сокращение либо сбросьте фильтр.</p><Button type="button" variant="secondary" className="mt-6" onClick={() => { setSearch(''); setCategory('Все'); }}>Показать все услуги</Button></div>}
        </div>
      </section>

      <section className="overflow-hidden bg-white px-4 py-10 sm:px-8 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 rounded-[20px] border border-slate-200 bg-[#F7FBFD] p-4 shadow-xl shadow-eco-900/6 sm:gap-8 sm:rounded-[28px] sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal direction="right">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Калькулятор</p>
              <h2 className="mt-3 text-2xl font-bold leading-tight text-eco-900 sm:text-4xl">Примерная стоимость услуг</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:mt-5 sm:text-base sm:leading-7">
                Рассчитайте ориентировочный бюджет по выбранному направлению. Итоговая стоимость зависит от категории объекта, объема исходных данных, сроков, состава работ и требований согласования.
              </p>
              <div className="mt-6 rounded-[18px] bg-eco-900 p-5 text-white sm:mt-8 sm:rounded-[22px] sm:p-6">
                <p className="text-sm text-white/70">Ориентировочный диапазон</p>
                <p className="mt-3 text-2xl font-bold leading-tight text-accent sm:text-4xl">
                  <span className="block sm:inline">{minPrice === undefined ? 'Стоимость рассчитывается индивидуально' : formatKztPrice({ priceFrom: Math.round(minPrice), currency: 'KZT', requiresCalculation: true })}</span>
                  {maxPrice !== undefined && <>
                  <span className="block text-white/55 sm:inline"> - </span>
                  <span className="block sm:inline">{new Intl.NumberFormat('ru-RU').format(Math.round(maxPrice))} ₸</span></>}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  {PRELIMINARY_PRICE_NOTICE}
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal direction="left">
            <div className="min-w-0 rounded-[18px] bg-white p-4 shadow-lg shadow-eco-900/5 sm:rounded-[24px] sm:p-6">
              <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
                <label className="min-w-0 text-sm font-semibold text-slate-700">
                  Услуга
                  <select
                    value={calculator.serviceId}
                    onChange={(event) => updateCalculator('serviceId', event.target.value)}
                    className="input-focus mt-2 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  >
                    {calculatorServices.map((service) => (
                      <option key={service.slug} value={service.slug}>{service.title}</option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 text-sm font-semibold text-slate-700">
                  Масштаб объекта
                  <select
                    value={calculator.objectScale}
                    onChange={(event) => updateCalculator('objectScale', event.target.value)}
                    className="input-focus mt-2 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  >
                    <option value="small">Небольшой объект</option>
                    <option value="medium">Средний объект</option>
                    <option value="large">Крупное предприятие</option>
                  </select>
                </label>
                <label className="min-w-0 text-sm font-semibold text-slate-700">
                  Срочность и сложность
                  <select
                    value={calculator.urgency}
                    onChange={(event) => updateCalculator('urgency', event.target.value)}
                    className="input-focus mt-2 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  >
                    <option value="standard">Стандартный срок</option>
                    <option value="fast">Срочно</option>
                    <option value="complex">Сложный проект</option>
                  </select>
                </label>
                <label className="min-w-0 text-sm font-semibold text-slate-700">
                  Объем отходов, тонн
                  <input
                    type="number"
                    min="0"
                    value={calculator.wasteVolume}
                    onChange={(event) => updateCalculator('wasteVolume', event.target.value)}
                    className="input-focus mt-2 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  />
                </label>
                <label className="min-w-0 text-sm font-semibold text-slate-700 md:col-span-2">
                  Количество лабораторных точек или замеров
                  <input
                    type="number"
                    min="0"
                    value={calculator.labPoints}
                    onChange={(event) => updateCalculator('labPoints', event.target.value)}
                    className="input-focus mt-2 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  />
                </label>
              </div>
              <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                <Button asChild className="w-full sm:w-auto"><Link to={`/cabinet/orders/new?service=${calculator.serviceId}`}>Получить точный расчет</Link></Button>
                <Button asChild variant="secondary" className="w-full sm:w-auto"><Link to={`/services/${selectedService.id}`}>Подробнее об услуге</Link></Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal direction="right">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Не нашли нужную услугу?</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Оставьте заявку — специалист подскажет решение</h2>
              <p className="mt-4 leading-7 text-slate-600">Можно коротко описать ситуацию без специальных терминов. Мы сами подскажем, какие документы, вывоз или анализы нужны.</p>
            </div>
          </Reveal>
          <Reveal direction="left">
            <WhatsAppLeadForm source="services_page_bottom_whatsapp" />
          </Reveal>
        </div>
      </section>
      {orderModal !== null && <Suspense fallback={null}><OrderChoiceModal open onClose={() => setOrderModal(null)} preSelectedService={orderModal} /></Suspense>}
    </div>
  );
};

export default ServicesPage;
