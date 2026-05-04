import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Beaker, Building2, CheckCircle2, ClipboardCheck, FileText, HelpCircle, Recycle, SearchCheck, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';

type Situation = {
  title: string;
  text: string;
  Icon: LucideIcon;
};

type PopularService = {
  title: string;
  text: string;
  items: string[];
  Icon: LucideIcon;
  href: string;
};

const situations: Situation[] = [
  { title: 'Открываю новый объект', text: 'Подскажем, какие экологические документы нужны для запуска.', Icon: Building2 },
  { title: 'Пришла проверка', text: 'Поможем подготовить документы и снизить риски.', Icon: ShieldCheck },
  { title: 'Нужно вывезти отходы', text: 'Организуем сбор, транспортировку и утилизацию отходов.', Icon: Truck },
  { title: 'Нужно сдать отчет', text: 'Подготовим экологическую отчетность и поможем со сроками.', Icon: ClipboardCheck },
  { title: 'Нужны анализы или замеры', text: 'Организуем лабораторные исследования и протоколы.', Icon: Beaker },
  { title: 'Не знаю, что выбрать', text: 'Специалист разберет вашу ситуацию и подскажет решение.', Icon: HelpCircle },
];

const popularServices: PopularService[] = [
  {
    title: 'Экологические документы',
    text: 'Подготовим проекты, разрешения и программы для вашего объекта простым и понятным планом.',
    items: ['РООС', 'ОВОС', 'ПУО', 'ПЭК', 'НДВ'],
    Icon: FileText,
    href: '/services#service-eco-design',
  },
  {
    title: 'Вывоз и утилизация отходов',
    text: 'Организуем сбор, транспортировку, переработку, размещение и сопроводительные документы.',
    items: ['сбор отходов', 'вывоз', 'транспортировка', 'утилизация'],
    Icon: Recycle,
    href: '/services#service-waste-management',
  },
  {
    title: 'Лабораторные анализы',
    text: 'Проведем замеры воды, воздуха, почвы, выбросов и подготовим протоколы.',
    items: ['вода', 'почва', 'воздух', 'выбросы'],
    Icon: Beaker,
    href: '/services#service-laboratory',
  },
  {
    title: 'Сопровождение проверок',
    text: 'Поможем собрать документы, ответить на вопросы и понять следующий шаг.',
    items: ['аудит', 'документы', 'пояснения', 'план действий'],
    Icon: SearchCheck,
    href: '/services#service-enterprise-support',
  },
];

const steps = [
  ['Вы оставляете заявку', 'Коротко описываете задачу или выбираете ситуацию.'],
  ['Специалист уточняет детали', 'Мы задаем только нужные вопросы и объясняем следующий шаг.'],
  ['Мы готовим расчет и договор', 'Вы видите условия до начала работы.'],
  ['Выполняем работу', 'Готовим документы, организуем вывоз, замеры или сопровождение.'],
  ['Результат в личном кабинете', 'Статус, документы и комментарии доступны онлайн.'],
];

const HomePage = () => {
  const [sent, setSent] = useState(false);

  const submitLead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
    event.currentTarget.reset();
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="relative isolate overflow-hidden px-4 py-20 text-white sm:px-8 sm:py-28 lg:min-h-[720px]">
        <div className="hero-zoom absolute inset-0 -z-30 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 -z-20 bg-eco-900/86" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-white to-transparent" />
        <div className="mx-auto flex max-w-7xl flex-col justify-center lg:min-h-[560px]">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">ECOPROGRESS GROUP</p>
            <h1 className="mt-5 max-w-5xl text-4xl font-bold leading-tight sm:text-6xl lg:text-[68px]">
              Экологические документы, вывоз отходов и сопровождение бизнеса
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/82 sm:text-xl">
              Поможем подготовить документы, пройти проверки, организовать вывоз отходов и контролировать процесс в личном кабинете.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
              <a href="#lead" className="w-full sm:w-auto"><Button className="w-full bg-accent px-7 py-4 text-eco-900 hover:bg-accent/90 sm:w-auto">Оставить заявку</Button></a>
              <a href="#lead" className="w-full sm:w-auto"><Button variant="secondary" className="w-full border-white/35 bg-white/10 px-7 py-4 text-white hover:bg-white/18 sm:w-auto">Получить консультацию</Button></a>
              <a href="#situations" className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-semibold text-white/88 transition hover:bg-white/10">
                Не знаю, какая услуга нужна <ArrowRight size={17} />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="situations" className="bg-white px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Выберите вашу ситуацию</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Что вам нужно?</h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {situations.map(({ title, text, Icon }, index) => (
              <Reveal key={title} delay={index * 0.04}>
                <div className="card-hover flex h-full flex-col rounded-[20px] border border-slate-200 bg-white p-5 shadow-lg shadow-eco-900/5 sm:p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-eco-50 text-eco-600">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-eco-900">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{text}</p>
                  <a href="#lead" className="mt-5"><Button className="w-full">Оставить заявку</Button></a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Популярные услуги</p>
                <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Понятно, что входит и зачем это нужно</h2>
              </div>
              <Link to="/services"><Button variant="secondary">Все услуги</Button></Link>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-5 lg:grid-cols-4">
            {popularServices.map(({ title, text, items, Icon, href }, index) => (
              <Reveal key={title} delay={index * 0.05}>
                <Link to={href} className="group card-hover flex h-full flex-col rounded-[20px] border border-slate-200 bg-white p-6 shadow-lg shadow-eco-900/5">
                  <Icon className="text-eco-600" size={28} />
                  <h3 className="mt-5 text-xl font-bold text-eco-900 group-hover:text-eco-600">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{text}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {items.map((item) => <span key={item} className="rounded-full bg-eco-50 px-3 py-1 text-xs font-semibold text-eco-800">{item}</span>)}
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-eco-700">Перейти к выбору <ArrowRight size={16} /></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Как это работает</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Пять простых шагов</h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-5">
            {steps.map(([title, text], index) => (
              <Reveal key={title} delay={index * 0.05}>
                <div className="h-full rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-eco-900 text-sm font-bold text-white">{index + 1}</span>
                  <h3 className="mt-5 font-bold text-eco-900">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal direction="right">
            <div>
              <CheckCircle2 className="text-accent" size={30} />
              <h2 className="mt-5 text-3xl font-bold sm:text-4xl">Где отслеживать статус?</h2>
              <p className="mt-4 max-w-xl leading-7 text-white/72">
                После заявки вы сможете видеть этапы работы, договор, счет, документы и комментарии специалиста в личном кабинете.
              </p>
              <Link to="/cabinet" className="mt-7 inline-block"><Button className="bg-accent text-eco-900 hover:bg-accent/90">Перейти в кабинет</Button></Link>
            </div>
          </Reveal>
          <Reveal direction="left">
            <div className="grid gap-3 sm:grid-cols-2">
              {['Заявка создана', 'Проверка специалистом', 'Договор и счет', 'Оплата', 'В работе', 'Готовый результат'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/12 bg-white/8 p-4 text-sm font-semibold text-white/88">
                  {item}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="lead" className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal direction="right">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Заявка</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Получить консультацию</h2>
              <p className="mt-4 leading-7 text-slate-600">Оставьте контакты. Специалист свяжется с вами, уточнит ситуацию и подскажет, какая услуга нужна.</p>
            </div>
          </Reveal>
          <Reveal direction="left">
            <form onSubmit={submitLead} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-xl shadow-eco-900/8 sm:p-7">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Имя<input required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label className="text-sm font-semibold text-slate-700">Телефон / WhatsApp<input required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                <label className="text-sm font-semibold text-slate-700 md:col-span-2">Что нужно?
                  <select className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
                    <option>Не знаю, нужна помощь специалиста</option>
                    <option>Экологические документы</option>
                    <option>Вывоз отходов</option>
                    <option>Лабораторные анализы</option>
                    <option>Проверка / сопровождение</option>
                    <option>Консультация</option>
                  </select>
                </label>
              </div>
              <label className="mt-4 block text-sm font-semibold text-slate-700">Комментарий<textarea className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} /></label>
              <Button className="mt-5 w-full">Отправить заявку</Button>
              {sent && <p className="mt-4 rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">Спасибо! Заявка принята. Специалист свяжется с вами.</p>}
            </form>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
