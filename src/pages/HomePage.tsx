import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Beaker, Building2, ChevronDown, ClipboardCheck, FileCheck2, FileText, MapPinned, Recycle, ShieldCheck, Sparkles, Truck, type LucideIcon } from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import EcoDashboardPreview from '../components/content/EcoDashboardPreview';
import { tariffs } from '../data/mockData';

const helpCards: Array<[string, string, LucideIcon]> = [
  ['Экологическая отчетность', 'Сроки, формы и исходные данные под контролем специалиста.', BarChart3],
  ['Документация и разрешения', 'Комплект документов под деятельность компании и требования проверок.', FileText],
  ['Производственный контроль', 'План контроля, документы, рекомендации и понятный мониторинг.', ClipboardCheck],
  ['Сопровождение проверок', 'Подготовка к инспекции, снижение рисков и помощь с пояснениями.', ShieldCheck],
];

const fullCycleServices: Array<{
  title: string;
  description: string;
  itemsLabel?: string;
  items: string[];
  cta: string;
  Icon: LucideIcon;
}> = [
  {
    title: 'Экологическое проектирование',
    description: 'Разрабатываем экологическую документацию для предприятий, строительных объектов, производственных площадок и организаций. Помогаем пройти необходимые согласования и подготовить документы в соответствии с требованиями Экологического кодекса Республики Казахстан.',
    items: [
      'Разработка раздела охраны окружающей среды — РООС',
      'Разработка проекта оценки воздействия на окружающую среду — ОВОС',
      'Подготовка отчета о возможных воздействиях — ОВВ',
      'Подготовка заявления о намечаемой деятельности — ЗОНД',
      'Разработка проектов нормативов допустимых выбросов — НДВ',
      'Разработка нормативов предельно допустимых сбросов — ПДС',
      'Разработка проекта санитарно-защитной зоны — СЗЗ',
      'Разработка проекта утилизации отходов',
      'Разработка программы управления отходами — ПУО',
      'Разработка программы производственного экологического контроля — ПЭК',
      'Разработка плана природоохранных мероприятий — ППМ',
      'Инвентаризация источников выбросов парниковых газов',
    ],
    cta: 'Заказать экологический проект',
    Icon: FileText,
  },
  {
    title: 'Разрешительная документация',
    description: 'Помогаем компаниям подготовить и получить необходимую разрешительную экологическую документацию для законной деятельности предприятия.',
    items: [
      'Получение комплексного экологического разрешения — КЭР',
      'Подготовка документов для экологических согласований',
      'Сопровождение при прохождении экологических процедур',
      'Подготовка документов для объектов I, II, III и IV категорий',
      'Консультация по требованиям Экологического кодекса РК',
      'Документальное сопровождение предприятия',
    ],
    cta: 'Получить консультацию',
    Icon: FileCheck2,
  },
  {
    title: 'Лабораторные исследования',
    description: 'Проводим лабораторные исследования и замеры с выдачей протоколов. Исследования помогают предприятиям подтвердить экологическую безопасность, пройти проверки и подготовить нужную документацию.',
    items: [
      'Химический анализ воды',
      'Химический анализ почвы и грунта',
      'Анализ атмосферного воздуха',
      'Анализ сточных и природных вод',
      'Замеры промышленных выбросов в атмосферу',
      'Замеры на границе санитарно-защитной зоны — СЗЗ',
      'Замеры факторов производственной среды',
      'Замеры выбросов загрязняющих веществ от автотранспорта',
      'Проведение лабораторных анализов с выдачей протокола',
    ],
    cta: 'Заказать лабораторный анализ',
    Icon: Beaker,
  },
  {
    title: 'Обращение с отходами',
    description: 'Организуем полный цикл работы с отходами: прием, сбор, вывоз, транспортировку, переработку, утилизацию и безопасное размещение. Работаем с соблюдением экологических и санитарных требований.',
    items: [
      'Прием отходов',
      'Сбор отходов',
      'Вывоз отходов',
      'Транспортировка отходов с оформлением документов',
      'Переработка отходов',
      'Утилизация отходов',
      'Захоронение отходов на полигоне',
      'Работа с опасными и неопасными отходами',
      'Документальное сопровождение операций с отходами',
    ],
    cta: 'Оставить заявку на вывоз отходов',
    Icon: Recycle,
  },
  {
    title: 'Транспортировка отходов',
    description: 'Обеспечиваем экологически безопасную транспортировку отходов специализированным транспортом. Сопровождаем процесс необходимыми документами и соблюдаем требования безопасности.',
    items: [
      'Вывоз производственных отходов',
      'Вывоз строительных отходов',
      'Вывоз бытовых отходов',
      'Транспортировка опасных отходов',
      'Транспортировка неопасных отходов',
      'Оформление сопроводительной документации',
      'Организация безопасного маршрута перевозки',
    ],
    cta: 'Заказать транспортировку',
    Icon: Truck,
  },
  {
    title: 'Полигон и размещение отходов',
    description: 'Предоставляем услуги по законному и безопасному размещению отходов на лицензированном полигоне. Это подходит для предприятий, строительных организаций, коммунальных служб и населения региона.',
    items: [
      'Прием отходов на законных основаниях',
      'Размещение отходов на полигоне',
      'Захоронение твердых бытовых отходов — ТБО',
      'Захоронение производственных отходов',
      'Полное документальное сопровождение',
      'Контроль соблюдения экологических требований',
    ],
    cta: 'Узнать условия приема отходов',
    Icon: MapPinned,
  },
  {
    title: 'Услуги для предприятий',
    description: 'Комплексное экологическое сопровождение для бизнеса, производственных объектов, строительных компаний, промышленных предприятий и организаций.',
    itemsLabel: 'Что входит',
    items: [
      'Анализ экологических требований для объекта',
      'Подготовка проектной документации',
      'Лабораторные замеры и протоколы',
      'Получение разрешений',
      'Организация вывоза и утилизации отходов',
      'Экологическая отчетность',
      'Консультации по проверкам и требованиям законодательства',
    ],
    cta: 'Получить сопровождение',
    Icon: Building2,
  },
];

const HomePage = () => {
  const [sent, setSent] = useState(false);
  const [expandedHomeService, setExpandedHomeService] = useState<string | null>(null);

  const submitLead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
    event.currentTarget.reset();
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#F7FBFD]">
      <section className="relative isolate min-h-[760px] overflow-hidden px-5 py-24 text-white sm:px-8 lg:py-32">
        <div className="hero-zoom absolute inset-0 -z-30 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-eco-900/94 via-eco-800/82 to-eco-500/58" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#F7FBFD] to-transparent" />
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <Reveal delay={0.08}>
              <h1 className="max-w-4xl text-4xl font-bold leading-[1.04] sm:text-5xl lg:text-[68px]">
                ECOPROGRESS GROUP — экологическое сопровождение бизнеса
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
                Помогаем подготовить экологическую документацию, сдать отчетность, пройти проверки и видеть весь процесс в удобном онлайн-кабинете.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-9 flex flex-wrap gap-4">
                <a href="#lead"><Button className="bg-accent px-7 py-4 text-eco-900 shadow-xl shadow-accent/20 hover:bg-accent/90">Заказать услугу</Button></a>
                <a href="#lead"><Button variant="secondary" className="border-white/35 bg-white/10 px-7 py-4 text-white hover:bg-white/18">Получить консультацию</Button></a>
                <Link to="/services"><Button variant="secondary" className="px-7 py-4">Посмотреть услуги</Button></Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Сопровождение без хаоса</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Чем мы помогаем</h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {helpCards.map(([title, text, Icon], index) => (
              <Reveal key={String(title)} delay={index * 0.05}>
                <div className="card-hover h-full rounded-[20px] border border-slate-200/80 bg-white p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-eco-50 text-eco-500">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-eco-900">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="bg-white px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Услуги</p>
                <h2 className="mt-3 text-3xl font-bold leading-tight text-eco-900 sm:text-4xl">
                  Экологические услуги полного цикла
                </h2>
              </div>
              <div>
                <h3 className="text-xl font-bold text-eco-900 sm:text-2xl">
                  Комплексные экологические услуги для бизнеса и организаций
                </h3>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Мы сопровождаем клиентов на всех этапах экологической работы: от разработки проектной документации и лабораторных исследований до получения разрешений, транспортировки, переработки, утилизации и безопасного размещения отходов.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href="#lead"><Button>Получить консультацию</Button></a>
                  <a href="#services-list"><Button variant="secondary" className="border-eco-200 bg-white text-eco-800 hover:bg-eco-50">Посмотреть все услуги</Button></a>
                </div>
              </div>
            </div>
          </Reveal>

          <div id="services-list" className="mt-12 grid gap-6 lg:grid-cols-2">
            {fullCycleServices.map(({ title, description, itemsLabel = 'Услуги внутри карточки', items, cta, Icon }, index) => (
              <Reveal key={title} delay={index * 0.04}>
                <article className="card-hover flex h-full flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-[#F7FBFD] shadow-lg shadow-eco-900/5">
                  <div className="h-1.5 bg-gradient-to-r from-accent via-eco-200 to-eco-500" />
                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-eco-600 shadow-sm">
                        <Icon size={25} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-eco-500">Направление {index + 1}</p>
                        <h3 className="mt-2 text-xl font-bold text-eco-900">{title}</h3>
                      </div>
                    </div>
                    <p className="mt-5 text-sm leading-6 text-slate-600">{description}</p>
                    <div className="mt-6 overflow-hidden rounded-[18px] border border-eco-100 bg-white">
                      <button
                        type="button"
                        onClick={() => setExpandedHomeService(expandedHomeService === title ? null : title)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-eco-900 transition hover:bg-eco-50"
                        aria-expanded={expandedHomeService === title}
                      >
                        <span>{itemsLabel}</span>
                        <ChevronDown className={`shrink-0 transition-transform ${expandedHomeService === title ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {expandedHomeService === title && (
                        <ul className="border-t border-eco-100 px-5 py-4 space-y-3 text-sm leading-6 text-slate-700">
                          {items.map((item) => (
                            <li key={item} className="flex gap-3">
                              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <a href="#lead" className="mt-6">
                      <Button className="w-full">{cta}</Button>
                    </a>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-5 py-20 sm:px-8">
        <div className="absolute inset-0 bg-sea bg-cover bg-center opacity-30" />
        <div className="absolute inset-0 bg-white/88" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Тарифы сопровождения</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Тарифы на экологическое сопровождение</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                Выберите формат сопровождения: от разовой консультации и проверки документов до полного экологического аутсорсинга для предприятия.
              </p>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-6 lg:grid-cols-4">
            {tariffs.map((tariff, index) => (
              <Reveal key={tariff.id} delay={index * 0.06}>
                <div className={`card-hover relative flex h-full flex-col rounded-[24px] border bg-white p-7 shadow-lg shadow-eco-900/8 ${tariff.popular ? 'border-accent ring-4 ring-accent/12' : 'border-slate-200'}`}>
                  {tariff.popular && (
                    <span className="absolute right-5 top-5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-eco-900">
                      Популярный
                    </span>
                  )}
                  <ShieldCheck className="text-accent" size={26} />
                  <h3 className="mt-5 text-2xl font-bold text-eco-900">{tariff.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{tariff.description}</p>
                  <p className="mt-6 text-3xl font-bold text-eco-900">{tariff.price}</p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                    {tariff.features.slice(0, 5).map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#lead" className="mt-7">
                    <Button className="w-full">{tariff.cta}</Button>
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-eco-100 bg-white p-5">
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Стоимость зависит от категории объекта, количества документов, объема отходов, необходимости лабораторных исследований, региона и сроков выполнения.
              </p>
              <Link to="/tariffs"><Button variant="secondary" className="border-eco-200 bg-white text-eco-800 hover:bg-eco-50">Все тарифы</Button></Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
          <Reveal direction="right">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Личный кабинет</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-eco-900 sm:text-4xl">
                Контролируйте экологические задачи без бесконечных переписок
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                Заявки, документы, комментарии специалиста и готовые файлы собраны в одном месте. Вы всегда видите, что уже сделано, что нужно от вас и когда ждать результат.
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {['Статус каждой заявки онлайн', 'Документы не теряются в чатах', 'Специалист пишет прямо в кабинете', 'Готовые файлы доступны сразу'].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-eco-100 bg-eco-50 px-4 py-3 text-sm font-semibold text-eco-900">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register"><Button>Создать кабинет</Button></Link>
                <a href="#lead"><Button variant="secondary" className="border-eco-200 bg-white text-eco-800 hover:bg-eco-50">Получить консультацию</Button></a>
              </div>
            </div>
          </Reveal>
          <Reveal direction="left">
            <EcoDashboardPreview compact />
          </Reveal>
        </div>
      </section>

      <section id="lead" className="relative overflow-hidden bg-eco-900 px-5 py-20 text-white sm:px-8">
        <div className="absolute inset-0 bg-sea bg-cover bg-center" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1fr]">
          <Reveal direction="right">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-accent">
                <Sparkles size={22} />
              </div>
              <h2 className="mt-5 text-3xl font-bold sm:text-4xl">Оставить заявку</h2>
              <p className="mt-4 leading-7 text-white/70">Расскажите о задаче. Специалист ECOPROGRESS GROUP свяжется с вами и подскажет следующий шаг.</p>
            </div>
          </Reveal>
          <Reveal direction="left">
            <form onSubmit={submitLead} className="rounded-[24px] border border-white/15 bg-white/10 p-6 backdrop-blur">
              <div className="grid gap-4 md:grid-cols-2">
                {['Имя', 'Телефон', 'Компания', 'Услуга'].map((label) => (
                  <label key={label} className="text-sm font-semibold text-white/78">
                    {label}
                    <input required className="input-focus mt-2 w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-slate-900" />
                  </label>
                ))}
              </div>
              <label className="mt-4 block text-sm font-semibold text-white/78">
                Комментарий
                <textarea className="input-focus mt-2 w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-slate-900" rows={4} />
              </label>
              <Button className="mt-5 w-full bg-accent text-eco-900 hover:bg-accent/90">Отправить заявку</Button>
              {sent && <p className="mt-4 rounded-2xl bg-white/12 p-4 text-sm">Спасибо! Ваша заявка принята. Специалист ECOPROGRESS GROUP свяжется с вами.</p>}
            </form>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
