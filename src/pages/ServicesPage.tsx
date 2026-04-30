import { useMemo, useState } from 'react';
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

  return (
    <div>
      <section className="relative overflow-hidden px-5 py-24 text-white sm:px-8">
        <div className="absolute inset-0 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal><h1 className="max-w-3xl text-4xl font-bold sm:text-6xl">Экологические услуги полного цикла</h1></Reveal>
          <Reveal delay={0.1}><p className="mt-5 max-w-2xl text-lg text-white/78">От проектной документации и лабораторных исследований до утилизации, транспортировки и размещения отходов на полигоне.</p></Reveal>
        </div>
      </section>
      <section className="bg-eco-50 px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap gap-3">
            {categories.map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-5 py-3 text-sm font-semibold transition ${category === item ? 'bg-eco-800 text-white' : 'bg-white text-eco-800 hover:bg-eco-200/30'}`}>
                {item}
              </button>
            ))}
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {items.map((service, index) => (
              <Reveal key={service.id} delay={index * 0.04}>
                <div className="card-hover flex h-full flex-col rounded-[22px] border border-slate-200 bg-white p-6">
                  <p className="text-sm font-semibold text-eco-500">{service.category}</p>
                  <h2 className="mt-3 text-2xl font-bold text-eco-900">{service.title}</h2>
                  <p className="mt-5 flex-1 text-sm leading-6 text-slate-600">{service.description}</p>
                  <div className="mt-6 overflow-hidden rounded-[18px] border border-eco-100 bg-eco-50">
                    <button
                      type="button"
                      onClick={() => setExpandedService(expandedService === service.id ? null : service.id)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-eco-900 transition hover:bg-eco-100/60"
                      aria-expanded={expandedService === service.id}
                    >
                      <span>Что входит</span>
                      <ChevronDown className={`shrink-0 transition-transform ${expandedService === service.id ? 'rotate-180' : ''}`} size={20} />
                    </button>
                    {expandedService === service.id && (
                      <ul className="space-y-3 border-t border-eco-100 bg-white px-5 py-4 text-sm leading-6 text-slate-700">
                        {service.includes.map((item) => (
                          <li key={item} className="flex gap-3">
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to={`/services/${service.id}`}><Button variant="secondary">Подробнее</Button></Link>
                    <Link to="/cabinet/orders/new"><Button>Заказать</Button></Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[28px] border border-slate-200 bg-[#F7FBFD] p-6 shadow-xl shadow-eco-900/6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal direction="right">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Калькулятор</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Примерная стоимость услуг</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                Рассчитайте ориентировочный бюджет по выбранному направлению. Итоговая стоимость зависит от категории объекта, объема исходных данных, сроков, состава работ и требований согласования.
              </p>
              <div className="mt-8 rounded-[22px] bg-eco-900 p-6 text-white">
                <p className="text-sm text-white/70">Ориентировочный диапазон</p>
                <p className="mt-3 text-3xl font-bold text-accent sm:text-4xl">
                  {formatPrice(minPrice)} - {formatPrice(maxPrice)}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Для точного расчета специалист уточнит объект, перечень документов, лабораторные точки и условия работы с отходами.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal direction="left">
            <div className="rounded-[24px] bg-white p-6 shadow-lg shadow-eco-900/5">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Услуга
                  <select
                    value={calculator.serviceId}
                    onChange={(event) => updateCalculator('serviceId', event.target.value)}
                    className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  >
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>{service.title}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Масштаб объекта
                  <select
                    value={calculator.objectScale}
                    onChange={(event) => updateCalculator('objectScale', event.target.value)}
                    className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  >
                    <option value="small">Небольшой объект</option>
                    <option value="medium">Средний объект</option>
                    <option value="large">Крупное предприятие</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Срочность и сложность
                  <select
                    value={calculator.urgency}
                    onChange={(event) => updateCalculator('urgency', event.target.value)}
                    className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  >
                    <option value="standard">Стандартный срок</option>
                    <option value="fast">Срочно</option>
                    <option value="complex">Сложный проект</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Объем отходов, тонн
                  <input
                    type="number"
                    min="0"
                    value={calculator.wasteVolume}
                    onChange={(event) => updateCalculator('wasteVolume', event.target.value)}
                    className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                  Количество лабораторных точек или замеров
                  <input
                    type="number"
                    min="0"
                    value={calculator.labPoints}
                    onChange={(event) => updateCalculator('labPoints', event.target.value)}
                    className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                  />
                </label>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/cabinet/orders/new"><Button>Получить точный расчет</Button></Link>
                <Link to={`/services/${selectedService.id}`}><Button variant="secondary">Подробнее об услуге</Button></Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default ServicesPage;
