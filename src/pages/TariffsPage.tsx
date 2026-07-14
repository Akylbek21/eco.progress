import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, FileText, FlaskConical, Recycle, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Reveal from '../components/animations/Reveal';
import Button from '../components/ui/Button';
import SEO from '../components/SEO';
import { PageSkeleton } from '../components/loading/PageLoader';
import { fetcher } from '../services/api';
import type { TariffItem } from '../types';

const modes = ['Все', 'Разовая задача', 'Ежемесячное сопровождение'] as const;

const fallbackTariffs: TariffItem[] = [
  {
    id: 'consultation',
    name: 'Первичная консультация',
    price: 'от 25 000 ₸',
    description: 'Разбор ситуации, проверка рисков и список следующих шагов по экологическим требованиям.',
    features: ['Анализ задачи', 'Рекомендации по документам', 'План дальнейших действий'],
    cta: 'Получить консультацию',
    mode: 'Разовая задача',
  },
  {
    id: 'documents',
    name: 'Экологические документы',
    price: 'от 180 000 ₸',
    description: 'Подготовка проектных, разрешительных и отчетных материалов для бизнеса.',
    features: ['Сбор исходных данных', 'Подготовка пакета документов', 'Сопровождение согласования'],
    cta: 'Заказать документы',
    mode: 'Разовая задача',
    popular: true,
  },
  {
    id: 'laboratory',
    name: 'Лаборатория',
    price: 'от 90 000 ₸',
    description: 'Замеры, отбор проб, исследования и оформление лабораторных протоколов.',
    features: ['Согласование точек', 'Выезд специалиста', 'Протоколы исследований'],
    cta: 'Заказать анализы',
    mode: 'Разовая задача',
  },
  {
    id: 'support',
    name: 'Сопровождение',
    price: 'от 350 000 ₸ / мес',
    description: 'Регулярное экологическое сопровождение предприятия, контроль сроков и отчетности.',
    features: ['План работ', 'Контроль отчетности', 'Консультации команды', 'Подготовка к проверкам'],
    cta: 'Обсудить сопровождение',
    mode: 'Ежемесячное сопровождение',
  },
];

const workflow = [
  ['Консультация', 'Клиент оставляет заявку, а специалист уточняет вид деятельности, объект и текущую задачу.'],
  ['Анализ', 'Проверяем исходные данные, документы, риски, объем работ и сроки.'],
  ['Коммерческое предложение', 'Готовим КП с понятным составом работ, стоимостью и сроками.'],
  ['Договор', 'Согласовываем условия и отправляем договор на подписание.'],
  ['Счет на оплату', 'Выставляем счет и фиксируем оплату в заявке.'],
  ['Рабочий этап', 'Выполняем выбранную услугу: проектирование, лабораторию, вывоз или утилизацию.'],
  ['Проверка результата', 'Проверяем документы, протоколы, акты, отчеты и рекомендации перед передачей.'],
  ['Готово', 'Передаем клиенту готовый результат и подтверждающие материалы.'],
  ['Завершено', 'Закрываем заявку после передачи результата и закрывающих документов.'],
];

const TariffsPage = () => {
  const [mode, setMode] = useState<(typeof modes)[number]>('Все');
  const { data: tariffs = [], isLoading } = useQuery({
    queryKey: ['tariffs'],
    queryFn: async () => {
      try {
        const response = await fetcher<TariffItem[]>('/tariffs');
        return Array.isArray(response) && response.length ? response : fallbackTariffs;
      } catch {
        return fallbackTariffs;
      }
    },
  });
  const usingFallbackTariffs = tariffs === fallbackTariffs;
  const filteredTariffs = useMemo(
    () => (mode === 'Все' ? tariffs : tariffs.filter((tariff) => tariff.mode === mode)),
    [mode, tariffs],
  );

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="bg-[#F7FBFD]">
      <SEO title="Тарифы на экологическое сопровождение | ecoprogress.kz" description="Тарифы ecoprogress.kz на консультации, экологические документы, лабораторные исследования, отходы и сопровождение бизнеса." />
      <section className="relative isolate overflow-hidden px-5 py-24 text-white sm:px-8">
        <div className="absolute inset-0 -z-30 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 -z-20 bg-eco-900/80" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal><p className="text-sm font-semibold uppercase tracking-[0.22em] text-eco-100">Тарифы</p></Reveal>
          <Reveal delay={0.08}><h1 className="mt-4 max-w-4xl text-4xl font-bold sm:text-6xl">Тарифы на экологическое сопровождение</h1></Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/78">
              Мы предлагаем несколько форматов работы: от первичной консультации и проверки документов до полного экологического сопровождения предприятия.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
              <div>
                <h2 className="text-3xl font-bold text-eco-900 sm:text-4xl">Выберите формат сопровождения</h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  Наша команда помогает пройти весь путь: анализ объекта, подготовка документов, лабораторные исследования, разрешения, транспортировка отходов, утилизация и закрывающие документы.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                {modes.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`rounded-full px-5 py-3 text-sm font-semibold transition ${mode === item ? 'bg-eco-800 text-white' : 'bg-white text-eco-800 hover:bg-eco-100'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          {usingFallbackTariffs && (
            <p className="mt-8 rounded-[20px] border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Показываем базовые тарифы. Данные с сервера временно недоступны.
            </p>
          )}

          <div className="mt-10 grid gap-6 lg:grid-cols-4">
            {filteredTariffs.map((tariff, index) => (
              <Reveal key={tariff.id} delay={index * 0.04}>
                <article className={`card-hover relative flex h-full flex-col rounded-[24px] border bg-white p-6 shadow-lg shadow-eco-900/6 ${tariff.popular ? 'border-accent ring-4 ring-accent/12' : 'border-slate-200'}`}>
                  {tariff.popular && (
                    <span className="absolute right-5 top-5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-eco-900">Популярный</span>
                  )}
                  <ShieldCheck className="text-accent" size={26} />
                  <h3 className="mt-5 text-2xl font-bold text-eco-900">{tariff.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{tariff.description}</p>
                  <p className="mt-6 text-3xl font-bold leading-tight text-eco-900">{tariff.price}</p>
                  <p className="mt-6 text-sm font-bold text-eco-900">Что входит:</p>
                  <ul className="mt-4 flex-1 space-y-3 text-sm leading-6 text-slate-700">
                    {tariff.features.map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-7 w-full"><Link to="/cabinet/orders/new">{tariff.cta}</Link></Button>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="mt-8 rounded-[20px] border border-eco-100 bg-white p-5 text-sm leading-6 text-slate-600">
              Стоимость зависит от категории объекта, количества документов, объема отходов, необходимости лабораторных исследований, региона и сроков выполнения. После первичного анализа мы подготовим точный расчет и план работ.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">От начала до конца</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Как проходит сопровождение</h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map(([title, text], index) => (
              <Reveal key={title} delay={index * 0.04}>
                <div className="h-full rounded-[20px] border border-slate-200 bg-[#F7FBFD] p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-eco-800 text-sm font-bold text-white">{index + 1}</span>
                  <h3 className="mt-5 text-lg font-bold text-eco-900">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-4">
          {[
            ['Документы', 'Проекты, заявления, отчеты и программы', FileText],
            ['Лаборатория', 'Исследования, замеры и протоколы', FlaskConical],
            ['Отходы', 'Вывоз, утилизация и размещение', Recycle],
            ['Согласования', 'Разрешения и сопровождение процедур', ClipboardCheck],
          ].map(([title, text, Icon]) => (
            <div key={String(title)} className="rounded-[20px] border border-slate-200 bg-white p-6">
              <Icon className="text-eco-600" size={24} />
              <h3 className="mt-4 text-lg font-bold text-eco-900">{String(title)}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{String(text)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TariffsPage;
