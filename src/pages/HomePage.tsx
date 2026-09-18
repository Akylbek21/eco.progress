import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardCheck, Factory, FileCheck2, FileText, FlaskConical, MapPinned, Recycle, ShieldCheck, Wind } from 'lucide-react';
import Reveal from '../components/animations/Reveal';
import LeadForm from '../components/LeadForm';
import SEO from '../components/SEO';
import WhatsAppButton from '../components/WhatsAppButton';
import Button from '../components/ui/Button';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { company } from '../config/company';
import { trackEvent } from '../services/analytics';
import { buildCorePageEntities } from '../seo/entityBuilders';

const ServiceSelector = lazy(() => import('../components/ServiceSelector'));
const HomeCaseStudies = lazy(() => import('../components/home/HomeCaseStudies'));
const HomeTrustSections = lazy(() => import('../components/home/HomeTrustSections'));

const DeferredSection = ({ children, minHeight = 320 }: { children: ReactNode; minHeight?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '600px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} style={visible ? undefined : { minHeight }}>{visible ? children : null}</div>;
};

const popularServices = [
  { title: 'Разработка РООС', text: 'Раздел охраны окружающей среды для проектной документации.', href: '/services/roos', Icon: FileText },
  { title: 'Программа ПЭК', text: 'Программа контроля по источникам и процессам предприятия.', href: '/services/program-pek', Icon: ClipboardCheck },
  { title: 'Отчёт ПЭК', text: 'Проверка данных и подготовка отчёта за согласованный период.', href: '/services/report-pek', Icon: FileCheck2 },
  { title: 'Экологическое разрешение', text: 'Подготовка материалов и сопровождение разрешительной процедуры.', href: '/services/environmental-permits', Icon: ShieldCheck },
  { title: 'Проект СЗЗ', text: 'Обоснование санитарно-защитной зоны с учётом воздействия объекта.', href: '/services/szz', Icon: Factory },
  { title: 'Проект НДВ', text: 'Инвентаризация источников и расчёт нормативов допустимых выбросов.', href: '/services/ndv', Icon: Wind },
  { title: 'Лабораторные исследования', text: 'Отбор проб, измерения и протоколы по согласованным показателям.', href: '/services/laboratory-tests', Icon: FlaskConical },
  { title: 'Утилизация отходов', text: 'Приём отходов и документы по выполненной операции.', href: '/services/waste-recycling', Icon: Recycle },
];

const quickLinks = [
  ['РООС', '/services/roos'], ['ПЭК', '/services/program-pek'], ['Экологическое разрешение', '/services/environmental-permits'],
  ['СЗЗ', '/services/szz'], ['НДВ', '/services/ndv'], ['ПУО', '/services/puo'],
  ['Лаборатория', '/services/laboratory-tests'], ['Отходы', '/services/waste-recycling'],
] as const;

const cityLinks = [
  ['Алматы', '/ecologicheskie-uslugi-almaty'], ['Астана', '/ecologicheskie-uslugi-astana'],
  ['Шымкент', '/ecologicheskie-uslugi-shymkent'], ['Караганда', '/ecologicheskie-uslugi-karaganda'],
  ['Атырау', '/ecologicheskie-uslugi-atyrau'], ['Актау', '/ecologicheskie-uslugi-aktau'],
  ['Тараз', '/ecologicheskie-uslugi-taraz'], ['Туркестан', '/ecologicheskie-uslugi-turkestan'],
] as const;

const processSteps = [
  ['Оставляете заявку', 'Кратко описываете объект, город и задачу удобным способом.'],
  ['Анализируем объект и документы', 'Проверяем исходные данные и определяем необходимый состав работ.'],
  ['Согласовываем и выполняем работы', 'Фиксируем стоимость, сроки и результат, затем приступаем к работе.'],
  ['Передаём готовый результат', 'Проверяем комплект и передаём документы, протоколы или закрывающие материалы.'],
] as const;

const faqs = [
  ['Какие экологические документы нужны предприятию?', 'Перечень зависит от категории объекта, процессов, источников воздействия и видов отходов. Начать можно с аудита исходных данных и действующих документов.'],
  ['Кому нужна программа ПЭК?', 'Необходимость программы определяют по категории и фактическому воздействию объекта.', '/services/program-pek', 'программе ПЭК'],
  ['Когда требуется экологическое разрешение?', 'Это зависит от категории объекта, эмиссий и изменений деятельности. Мы проверим исходные данные и определим применимую процедуру.', '/services/environmental-permits', 'экологическом разрешении'],
  ['Сколько стоит разработка РООС?', 'Стоимость зависит от состава проекта, объекта и полноты исходных данных. Точный расчёт возможен после короткого анализа.', '/services/roos', 'разработке РООС'],
  ['Какие лабораторные исследования нужны предприятию?', 'Перечень показателей, точек и периодичность зависят от цели контроля и требований к объекту.', '/services/laboratory-tests', 'лабораторных исследованиях'],
  ['Работает ли EcoProgress по всему Казахстану?', 'Да, экологическое проектирование и документы готовим для предприятий по Казахстану. Возможность выездных работ уточняется по региону.'],
  ['Можно ли полностью передать экологическое сопровождение вашей компании?', 'Да. EcoProgress может контролировать документы, отчётность, ПЭК, разрешения, отходы и сроки как внешний эколог.', '/services/ecological-support', 'экологическом сопровождении'],
] as const;

const homeTitle = 'Экологическая компания в Казахстане — услуги для бизнеса | EcoProgress';
const homeDescription = 'Комплексные экологические услуги для бизнеса по Казахстану: проектирование, ПЭК, разрешения, лабораторные исследования, отходы и сопровождение предприятий.';
const faqSchema = {
  '@type': 'FAQPage',
  mainEntity: faqs.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
};

const HomePage = () => (
  <div className="min-h-screen bg-white">
    <SEO title={homeTitle} description={homeDescription} h1="Экологические услуги для бизнеса по всему Казахстану" canonical="/" schema={[...buildCorePageEntities({ canonical: company.siteUrl, name: homeTitle, description: homeDescription, localBusiness: true }), faqSchema]} />

    <section id="lead" className="relative isolate overflow-hidden px-4 py-16 text-white sm:px-8 sm:py-24 lg:min-h-[760px]">
      <ResponsiveImage fill priority sizes="100vw" src="/media/otbor-prob-vody-1280.jpg" alt="" width={1920} height={1280} wrapperClassName="-z-30" className="hero-zoom object-cover object-center" />
      <div className="absolute inset-0 -z-20 bg-eco-900/88" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-white to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-10 lg:min-h-[610px] lg:grid-cols-[1.08fr_0.72fr] lg:items-center">
        <div>
          <Reveal><p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">Экологическая компания EcoProgress</p><h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl lg:text-[64px]">Экологические услуги для бизнеса по всему Казахстану</h1></Reveal>
          <Reveal delay={0.08}><p className="mt-6 max-w-3xl text-lg leading-8 text-white/82 sm:text-xl">Разрабатываем экологическую документацию, ПЭК, РООС, СЗЗ, НДВ и ПУО, сопровождаем получение экологических разрешений, проводим лабораторные исследования и помогаем предприятиям с отходами.</p></Reveal>
          <Reveal delay={0.14}><nav aria-label="Основные экологические услуги" className="mt-7 flex flex-wrap gap-2">{quickLinks.map(([label, href]) => <Link key={label} to={href} onClick={() => trackEvent('related_service_click', { placement: 'home_hero', service_slug: href.split('/').pop() })} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 transition hover:border-accent/70 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{label}</Link>)}</nav></Reveal>
          <Reveal delay={0.2}><div className="mt-8 grid gap-3 sm:flex sm:flex-wrap"><Button asChild className="w-full bg-accent px-7 py-4 text-eco-900 hover:bg-accent/90 sm:w-auto"><a href="#final-cta" onClick={() => trackEvent('consultation_click', { placement: 'hero' })}>Получить расчёт стоимости</a></Button><WhatsAppButton label="Написать в WhatsApp" className="w-full px-7 py-4 sm:w-auto" /></div></Reveal>
        </div>
        <Reveal direction="left"><LeadForm source="home_hero_form" formId="home_hero" ctaId="hero_calculate" title="Быстрый расчёт" submitLabel="Получить расчёт" compact showIdentityFields serviceSlug="ecological-documents" defaultService="Комплексные экологические услуги" /></Reveal>
      </div>
    </section>

    <section id="services" aria-labelledby="popular-services-title" className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <Reveal><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Основные направления</p><h2 id="popular-services-title" className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Популярные экологические услуги</h2><p className="mt-4 leading-7 text-slate-600">Проектная документация, разрешительные процедуры, производственный контроль и практические задачи предприятий.</p></div><Button asChild variant="secondary"><Link to="/services">Все экологические услуги</Link></Button></div></Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{popularServices.map(({ title, text, href, Icon }, index) => <Reveal key={title} delay={index * 0.035}><article className="group flex h-full flex-col rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-eco-200 hover:shadow-lg"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-eco-50 text-eco-700"><Icon size={24} aria-hidden="true" /></span><h3 className="mt-5 text-lg font-bold text-eco-900">{title}</h3><p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{text}</p><Link to={href} onClick={() => trackEvent('related_service_click', { placement: 'home_popular_services', service_slug: href.split('/').pop() })} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-eco-700 group-hover:text-eco-500">{title} <ArrowRight size={16} /></Link></article></Reveal>)}</div>
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-[20px] bg-eco-900 px-5 py-5 text-white sm:px-7"><p className="mr-auto font-semibold">Не уверены в составе работ? Проверим документы и подготовим расчёт.</p><Button asChild className="bg-accent text-eco-900 hover:bg-accent/90"><a href="#final-cta" onClick={() => trackEvent('consultation_click', { placement: 'after_services' })}>Получить расчёт</a></Button></div>
      </div>
    </section>

    <DeferredSection minHeight={560}><Suspense fallback={null}><HomeTrustSections /></Suspense></DeferredSection>
    <DeferredSection minHeight={420}><Suspense fallback={null}><HomeCaseStudies /></Suspense></DeferredSection>
    <Suspense fallback={null}><ServiceSelector /></Suspense>

    <section className="bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-center"><Reveal><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Постоянная поддержка</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Экологическое сопровождение предприятий</h2><p className="mt-5 max-w-3xl leading-7 text-white/75">EcoProgress может выполнять функции внешнего эколога и сопровождать предприятие на постоянной основе — без необходимости расширять штат.</p><ul className="mt-7 grid gap-3 sm:grid-cols-2">{['Контроль экологической документации', 'Отчётность и ПЭК', 'Разрешения и отходы', 'Лабораторный контроль', 'Контроль обязательных сроков', 'Подготовка к проверкам'].map((item) => <li key={item} className="flex items-start gap-2 text-sm font-semibold text-white/90"><CheckCircle2 className="mt-0.5 shrink-0 text-accent" size={18} />{item}</li>)}</ul><Button asChild className="mt-8 bg-accent text-eco-900 hover:bg-accent/90"><Link to="/services/ecological-support" onClick={() => trackEvent('related_service_click', { placement: 'home_support', service_slug: 'ecological-support' })}>Подробнее об экологическом сопровождении <ArrowRight size={17} /></Link></Button></Reveal><Reveal direction="left"><ResponsiveImage src="/media/ecologist-outsourcing-hero-1280.webp" alt="Экологическое сопровождение производственного предприятия" width={1280} height={720} sizes="(max-width: 1023px) 100vw, 42vw" wrapperClassName="overflow-hidden rounded-[24px]" className="h-full max-h-[430px] w-full object-cover" /></Reveal></div></section>

    <section aria-labelledby="object-category-title" className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-7xl gap-8 rounded-[28px] border border-eco-100 bg-white p-6 shadow-xl shadow-eco-900/6 sm:p-10 lg:grid-cols-[1fr_0.9fr] lg:items-center"><Reveal><p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Категории объектов</p><h2 id="object-category-title" className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Определите категорию воздействия объекта</h2><p className="mt-5 leading-7 text-slate-600">Категория объекта определяет объём экологической документации, отчётности, разрешений и производственного экологического контроля.</p><Button asChild className="mt-7"><Link to="/news/kak-opredelit-kategoriyu-obekta" onClick={() => trackEvent('related_article_click', { placement: 'home_object_category', article: 'kak-opredelit-kategoriyu-obekta' })}>Определить категорию объекта <ArrowRight size={17} /></Link></Button></Reveal><div className="grid grid-cols-2 gap-3" aria-label="Категории воздействия I–IV">{[['I', 'Значительное'], ['II', 'Умеренное'], ['III', 'Незначительное'], ['IV', 'Минимальное']].map(([category, impact]) => <div key={category} className="rounded-[18px] border border-eco-100 bg-eco-50 p-5"><span className="text-4xl font-black text-eco-700">{category}</span><span className="mt-2 block text-sm font-bold text-slate-700">{impact} воздействие</span></div>)}</div></div></section>

    <section className="bg-white px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><Reveal><p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">География</p><h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Работаем по всему Казахстану</h2><p className="mt-4 max-w-3xl leading-7 text-slate-600">Готовим экологические проекты и документы для бизнеса в регионах Казахстана. Выездные работы согласовываем с учётом города и задачи.</p></Reveal><nav aria-label="Экологические услуги по городам" className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cityLinks.map(([city, href]) => <Link key={city} to={href} onClick={() => trackEvent('regional_page_view', { placement: 'home_regions', region: city })} className="group flex items-center justify-between rounded-[18px] border border-slate-200 bg-[#F7FBFD] p-5 font-bold text-eco-900 transition hover:border-eco-300 hover:bg-white hover:shadow-md"><span className="flex items-center gap-3"><MapPinned size={20} className="text-eco-600" />{city}</span><ArrowRight size={17} className="transition group-hover:translate-x-1" /></Link>)}</nav><Link to="/regions" className="mt-7 inline-flex items-center gap-2 font-bold text-eco-700">Все города <ArrowRight size={17} /></Link></div></section>

    <section id="how-it-works" className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl"><Reveal><p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Порядок работы</p><h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Как мы работаем</h2></Reveal><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{processSteps.map(([title, text], index) => <Reveal key={title} delay={index * 0.04}><article className="h-full rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-eco-900 text-sm font-bold text-white">{index + 1}</span><h3 className="mt-5 font-bold text-eco-900">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article></Reveal>)}</div></div></section>

    <section className="bg-white px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-4xl"><Reveal><p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Ответы специалистов</p><h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Частые вопросы</h2></Reveal><div className="mt-9 divide-y divide-slate-200 rounded-[20px] border border-slate-200 bg-white px-5 sm:px-7">{faqs.map(([question, answer, href, anchor]) => <details key={question} className="group py-5"><summary className="cursor-pointer list-none pr-8 font-bold text-eco-900 marker:hidden">{question}<span className="float-right text-eco-600 transition group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{answer}{href && anchor ? <> Узнайте подробнее на странице <Link to={href} className="font-semibold text-eco-700 underline decoration-eco-300 underline-offset-4">{anchor}</Link>.</> : null}</p></details>)}</div></div></section>

    <section id="final-cta" className="bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Следующий шаг</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Получите расчёт экологических услуг</h2><p className="mt-5 leading-7 text-white/75">Расскажите, что требуется предприятию. Специалист проверит задачу, уточнит недостающие данные и предложит состав работ.</p><div className="mt-7 flex flex-wrap gap-3"><WhatsAppButton label="Написать в WhatsApp" /><a href={company.phoneHref} onClick={() => trackEvent('phone_click', { placement: 'home_final_cta' })} className="inline-flex items-center rounded-full border border-white/25 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">Позвонить: {company.phone}</a></div></div><LeadForm source="home_final_form" formId="home_final" ctaId="final_calculate" title="Оставить заявку" submitLabel="Получить расчёт" variant="blue" compact showIdentityFields serviceSlug="ecological-documents" defaultService="Комплексные экологические услуги" /></div></section>
  </div>
);

export default HomePage;
