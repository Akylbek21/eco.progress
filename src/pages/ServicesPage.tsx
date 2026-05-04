import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import { services, type ServiceCategory } from '../data/mockData';

const categories: Array<'Все' | ServiceCategory> = ['Все', 'Проектирование', 'Разрешения', 'Лаборатория', 'Отходы', 'Предприятия'];

const servicePriceBase: Record<string, number> = {
  'eco-design': 350000,
  permits: 280000,
  laboratory: 90000,
  'waste-management': 120000,
  'waste-transportation': 80000,
  landfill: 60000,
  'enterprise-support': 450000,
};

const formatPrice = (price: number) => `${Math.round(price).toLocaleString('ru-RU')} ₸`;

const ServicesPage = () => {
  const [category, setCategory] = useState<'Все' | ServiceCategory>('Все');
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [selectedIncludes, setSelectedIncludes] = useState<Record<string, string[]>>({});
  const [calculator, setCalculator] = useState({
    serviceId: services[0]?.id ?? '',
    objectScale: 'medium',
    urgency: 'standard',
    wasteVolume: '0',
    labPoints: '0',
  });
  const items = useMemo(() => (category === 'Все' ? services : services.filter((item) => item.category === category)), [category]);
  const selectedService = services.find((service) => service.id === calculator.serviceId) ?? services[0];
  const basePrice = servicePriceBase[selectedService.id] ?? 150000;
  const scaleMultiplier = calculator.objectScale === 'small' ? 0.85 : calculator.objectScale === 'large' ? 1.45 : 1;
  const urgencyMultiplier = calculator.urgency === 'fast' ? 1.25 : calculator.urgency === 'complex' ? 1.55 : 1;
  const wasteVolume = Number(calculator.wasteVolume) || 0;
  const labPoints = Number(calculator.labPoints) || 0;
  const estimatedPrice = basePrice * scaleMultiplier * urgencyMultiplier + wasteVolume * 9000 + labPoints * 18000;
  const minPrice = estimatedPrice * 0.9;
  const maxPrice = estimatedPrice * 1.15;
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
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden px-4 py-16 text-white sm:px-8 sm:py-24">
        <div className="absolute inset-0 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal><h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-6xl">Экологические услуги полного цикла</h1></Reveal>
          <Reveal delay={0.1}><p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:mt-5 sm:text-lg">От проектной документации и лабораторных исследований до утилизации, транспортировки и размещения отходов на полигоне.</p></Reveal>
        </div>
      </section>
      <section className="bg-eco-50 px-4 py-10 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
            {categories.map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition sm:px-5 sm:py-3 ${category === item ? 'bg-eco-800 text-white' : 'bg-white text-eco-800 hover:bg-eco-200/30'}`}>
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
                    <Link to={`/services/${service.id}`} className="w-full sm:w-auto"><Button variant="secondary" className="w-full sm:w-auto">Подробнее</Button></Link>
                    <Link to={getOrderPath(service.id)} className="w-full sm:w-auto">
                      <Button className="w-full sm:w-auto">{(selectedIncludes[service.id] ?? []).length > 0 ? 'Заказать выбранные' : 'Заказать услугу'}</Button>
                    </Link>
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
                  <span className="block sm:inline">{formatPrice(minPrice)}</span>
                  <span className="block text-white/55 sm:inline"> - </span>
                  <span className="block sm:inline">{formatPrice(maxPrice)}</span>
                </p>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Для точного расчета специалист уточнит объект, перечень документов, лабораторные точки и условия работы с отходами.
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
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>{service.title}</option>
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
                <Link to={`/cabinet/orders/new?service=${calculator.serviceId}`} className="w-full sm:w-auto"><Button className="w-full sm:w-auto">Получить точный расчет</Button></Link>
                <Link to={`/services/${selectedService.id}`} className="w-full sm:w-auto"><Button variant="secondary" className="w-full sm:w-auto">Подробнее об услуге</Button></Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default ServicesPage;
