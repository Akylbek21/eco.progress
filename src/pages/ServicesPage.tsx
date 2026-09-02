import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { CheckCircle2, ChevronDown, FileText, Globe2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import WhatsAppButton from '../components/WhatsAppButton';
import WhatsAppLeadForm from '../components/WhatsAppLeadForm';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { fallbackServices, getServiceCatalog } from '../services/serviceService';
import { activeServices, formatKztPrice, GENERAL_PRIMARY_CTA_LABEL, getServicePrimaryCtaLabel, PRELIMINARY_PRICE_NOTICE } from '../content/serviceCatalog';
import type { ServiceCategory } from '../types';
import { pageHeroImages } from '../data/pageHeroImages';

const OrderChoiceModal = lazy(() => import('../components/OrderChoiceModal'));

const categories: Array<'Все' | ServiceCategory> = ['Все', 'Проектирование', 'Разрешения', 'Лаборатория', 'Отходы', 'Предприятия'];
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
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [selectedIncludes, setSelectedIncludes] = useState<Record<string, string[]>>({});
  const [orderModal, setOrderModal] = useState<string | null>(null);
  const [calculator, setCalculator] = useState({
    serviceId: '',
    objectScale: 'medium',
    urgency: 'standard',
    wasteVolume: '0',
    labPoints: '0',
  });
  useEffect(() => { if (calculatorServices.length && !calculator.serviceId) setCalculator((c) => ({ ...c, serviceId: calculatorServices[0].slug })); }, [calculator.serviceId, calculatorServices]);
  const items = useMemo(() => (category === 'Все' ? services : services.filter((item) => item.category === category)), [category, services]);
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
  const toggleIncludedService = (serviceId: string, item: string) => {
    setSelectedIncludes((current) => {
      const selected = current[serviceId] ?? [];
      const next = selected.includes(item) ? selected.filter((value) => value !== item) : [...selected, item];
      return { ...current, [serviceId]: next };
    });
  };
  const getOrderPath = (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId);
    const selected = selectedIncludes[serviceId] ?? [];
    const indexes = selected.map((item) => service?.includes.indexOf(item) ?? -1).filter((index) => index >= 0);
    return indexes.length > 0 ? `/cabinet/orders/new?service=${serviceId}&items=${indexes.join(',')}` : `/cabinet/orders/new?service=${serviceId}`;
  };

  useEffect(() => {
    const openServiceFromHash = () => {
      const serviceId = window.location.hash.replace('#service-', '');
      if (services.some((service) => service.id === serviceId)) setExpandedService(serviceId);
    };
    openServiceFromHash();
    window.addEventListener('hashchange', openServiceFromHash);
    return () => window.removeEventListener('hashchange', openServiceFromHash);
  }, [services]);

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
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {categories.map((item) => (
              <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`rounded-full px-4 py-2.5 text-sm font-semibold transition sm:px-5 sm:py-3 ${category === item ? 'bg-eco-800 text-white shadow-sm' : 'border border-white bg-white text-eco-800 hover:border-eco-200 hover:bg-eco-100'}`}>
                {item}
              </button>
            ))}
          </div>
          <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-6 md:grid-cols-2">
            {items.map((service, index) => (
              <Reveal key={service.id} delay={index * 0.04}>
                <div id={`service-${service.id}`} className={`card-hover flex h-full scroll-mt-28 flex-col rounded-[18px] border bg-white p-5 sm:rounded-[22px] sm:p-6 ${(selectedIncludes[service.id] ?? []).length > 0 ? 'border-accent ring-4 ring-accent/15' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-eco-500">{service.category}</p>
                    {(selectedIncludes[service.id] ?? []).length > 0 && (
                      <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-eco-900">
                        Выбрано: {(selectedIncludes[service.id] ?? []).length}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-xl font-bold leading-snug text-eco-900 sm:text-2xl">{service.title}</h2>
                  {['waste-transportation', 'waste-management'].includes(service.id) && (
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-eco-600">Только в Шымкенте</p>
                  )}
                  {service.id === 'waste-recycling' && (
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-eco-600">Шымкент · Тараз · Туркестан</p>
                  )}
                  <p className="mt-4 flex-1 text-sm leading-6 text-slate-600 sm:mt-5">{service.description}</p>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-eco-100 bg-eco-50 sm:mt-6 sm:rounded-[18px]">
                    <button
                      type="button"
                      onClick={() => setExpandedService(expandedService === service.id ? null : service.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold text-eco-900 transition hover:bg-eco-100/60 sm:gap-4 sm:px-5 sm:py-4"
                      aria-expanded={expandedService === service.id}
                    >
                      <span>Выберите услуги внутри направления</span>
                      <ChevronDown className={`shrink-0 transition-transform ${expandedService === service.id ? 'rotate-180' : ''}`} size={20} />
                    </button>
                    {expandedService === service.id && (
                      <ul className="space-y-3 border-t border-eco-100 bg-white px-4 py-4 text-sm leading-6 text-slate-700 sm:px-5">
                        {service.includes.map((item) => (
                          <li key={item}>
                            <label className="flex cursor-pointer gap-3 rounded-2xl p-2 transition hover:bg-eco-50">
                              <input
                                type="checkbox"
                                checked={(selectedIncludes[service.id] ?? []).includes(item)}
                                onChange={() => toggleIncludedService(service.id, item)}
                                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#38C7BA]"
                              />
                              <span>{item}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mt-5 grid gap-3 sm:mt-6 sm:flex sm:flex-wrap">
                    <Button asChild variant="secondary" className="w-full sm:w-auto"><Link to={`/services/${service.id}`}>Подробнее</Link></Button>
                    <Button type="button" onClick={() => setOrderModal(service.id)} className="w-full sm:w-auto">{(selectedIncludes[service.id] ?? []).length > 0 ? 'Заказать выбранные' : getServicePrimaryCtaLabel(service.id)}</Button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
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
