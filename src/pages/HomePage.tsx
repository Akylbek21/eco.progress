import { Link } from 'react-router-dom';
import { ArrowRight, Beaker, Building2, FileText, MapPinned, Recycle, ShieldCheck, Truck } from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import WhatsAppButton from '../components/WhatsAppButton';
import WhatsAppLeadForm from '../components/WhatsAppLeadForm';
import ServiceSelector from '../components/ServiceSelector';
import CaseStudies from '../components/CaseStudies';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { DocumentsSection, TrustSection } from '../components/TrustBlocks';
import { company } from '../config/company';
import { featuredSeoLinks } from '../data/featuredSeoLinks';
import { trackEvent } from '../services/analytics';
import { activeServices } from '../content/serviceCatalog';

const benefits = ['Экологическое проектирование', 'Лабораторные исследования', 'Вывоз и утилизация в Шымкенте', 'Полигон ТБО', 'Работаем по Казахстану', 'Документы и сопровождение'];

const processSteps = [
  {
    title: 'Консультация',
    text: 'Уточняем задачу, город, объект и выбранную услугу.',
  },
  {
    title: 'Анализ',
    text: 'Проверяем исходные данные, объем работ, сроки и необходимые документы.',
  },
  {
    title: 'Коммерческое предложение',
    text: 'Готовим КП с перечнем работ, стоимостью и сроками.',
  },
  {
    title: 'Договор',
    text: 'Согласовываем условия и отправляем договор на подписание.',
  },
  {
    title: 'Счет на оплату',
    text: 'Выставляем счет, а статус оплаты сохраняется в кабинете.',
  },
  {
    title: 'Рабочий этап',
    text: 'Запускаем проектирование, лабораторию, вывоз или утилизацию по выбранной услуге.',
  },
  {
    title: 'Проверка результата',
    text: 'Проверяем документы, протоколы, акты и закрывающие материалы перед передачей.',
  },
  {
    title: 'Готово',
    text: 'Клиент получает результат и может скачать материалы в кабинете.',
  },
  {
    title: 'Завершено',
    text: 'Закрываем заявку после передачи результата и финальных документов.',
  },
];

const serviceIcons = { Проектирование: FileText, Разрешения: ShieldCheck, Лаборатория: Beaker, Отходы: Recycle, Предприятия: Building2 };
const services = activeServices.filter((service) => service.showOnHome).map((service) => ({
  title: service.title,
  text: service.shortDescription,
  Icon: serviceIcons[service.category],
  href: `/services/${service.slug}`,
  image: service.image || '/og-cover.jpg',
}));

const visualHighlights = [
  { title: 'Лабораторный контроль', image: '/edward.jpg', className: 'col-span-2 aspect-[16/9] lg:col-span-1 lg:row-span-2 lg:aspect-auto' },
  { title: 'Документы и сопровождение', image: '/images (1).jpg', className: 'aspect-[4/3] lg:aspect-auto' },
  { title: 'Вывоз и утилизация', image: '/jose.jpg', className: 'aspect-[4/3] lg:aspect-auto' },
];

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: company.name,
  url: company.siteUrl,
  email: company.email,
  telephone: company.phone,
  areaServed: 'Шымкент, Казахстан',
  description: 'Экологические и лабораторные услуги для бизнеса в Шымкенте и Казахстане',
  address: {
    '@type': 'PostalAddress',
    streetAddress: company.address,
    addressLocality: 'Шымкент',
    addressCountry: 'KZ',
  },
};

const HomePage = () => (
  <div className="min-h-screen bg-white">
    <SEO
      title="Экологические услуги в Шымкенте — лаборатория, СЭС, отходы | ECOPROGRESS"
      description="ECOPROGRESS GROUP оказывает экологические и лабораторные услуги для бизнеса в Шымкенте: производственный контроль СЭС, замеры, ПЭК, паспорта отходов и утилизация."
      schema={organizationSchema}
    />
    <section id="lead" className="relative isolate overflow-hidden px-4 py-20 text-white sm:px-8 sm:py-28 lg:min-h-[760px]">
      <div className="hero-zoom absolute inset-0 -z-30 bg-windmill bg-cover bg-center" />
      <div className="absolute inset-0 -z-20 bg-eco-900/88" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-white to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-10 lg:min-h-[600px] lg:grid-cols-[1.05fr_0.78fr] lg:items-center">
        <div>
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">{company.name}</p>
            <h1 className="mt-5 max-w-5xl text-4xl font-bold leading-tight sm:text-6xl lg:text-[66px]">
              Экологические услуги и лабораторные замеры в Казахстане
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/82 sm:text-xl">
              Подготовим экологические документы, организуем вывоз отходов, лабораторные исследования и сопровождение проверок по требованиям РК.
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild className="w-full bg-accent px-7 py-4 text-eco-900 hover:bg-accent/90 sm:w-auto"><a href="#lead" onClick={() => trackEvent('consultation_click', { placement: 'hero' })}>Получить консультацию</a></Button>
              <Button asChild variant="secondary" className="w-full border-white/35 bg-white/10 px-7 py-4 text-white hover:bg-white/18 sm:w-auto"><a href="#lead">Оставить заявку</a></Button>
              <WhatsAppButton label="Оставить заявку через WhatsApp" className="w-full px-7 py-4 sm:w-auto" />
            </div>
          </Reveal>
          <Reveal delay={0.22}>
            <div className="mt-8 flex flex-wrap gap-2">
              {benefits.map((item) => <span key={item} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/86">{item}</span>)}
            </div>
          </Reveal>
        </div>
        <Reveal direction="left">
          <WhatsAppLeadForm source="home_hero_whatsapp_form" title="Заявка через WhatsApp без регистрации" compact />
        </Reveal>
      </div>
    </section>

    <ServiceSelector />

    <section id="about-company" className="bg-white px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[28px] border border-eco-100 bg-gradient-to-br from-white to-eco-50/70 p-5 shadow-xl shadow-eco-900/6 sm:p-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-12">
        <Reveal direction="right" className="lg:pl-2">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">О компании</p>
            <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">ecoprogress.kz — комплексные экологические решения</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              ecoprogress.kz помогает бизнесу с проектированием, лабораторными исследованиями и сопровождением по Казахстану. Вывоз и утилизация отходов доступны в Шымкенте.
            </p>
            <Button asChild className="mt-7"><Link to="/about">Подробнее о компании</Link></Button>
          </div>
        </Reveal>
        <Reveal direction="left" className="min-w-0">
          <div className="grid grid-cols-2 gap-3 lg:h-[430px] lg:grid-cols-[1.18fr_0.82fr] lg:grid-rows-2">
            {visualHighlights.map((item) => (
              <div key={item.title} className={`group relative min-h-[145px] overflow-hidden rounded-[20px] bg-eco-900 shadow-sm ${item.className}`}>
                <ResponsiveImage fill src={item.image} alt={item.title} width={900} height={506} className="object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-eco-900/90 via-eco-900/10 to-transparent" />
                <div className="relative flex h-full min-h-[145px] items-end p-4 sm:p-5">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-white">
                    <Building2 className="shrink-0 text-accent" size={18} />
                    {item.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>

    <section id="services" className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Услуги</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Что мы делаем для бизнеса</h2>
            </div>
            <Button asChild variant="secondary"><Link to="/services">Полный список услуг</Link></Button>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {services.map(({ title, text, Icon, href, image }, index) => (
            <Reveal key={title} delay={index * 0.04}>
              <Link to={href} className="group card-hover flex h-full flex-col rounded-[20px] border border-slate-200 bg-white shadow-lg shadow-eco-900/5">
                <div className="relative h-44 overflow-hidden">
                  <ResponsiveImage src={image} alt={title} width={900} height={506} wrapperClassName="h-44 w-full" className="object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-eco-900/70 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/92 text-eco-700 shadow-sm">
                    <Icon size={24} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-xl font-bold text-eco-900 group-hover:text-eco-600">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{text}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-eco-700">Подробнее <ArrowRight size={16} /></span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-white px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Направления</p>
            <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Экологические услуги для бизнеса в Шымкенте и Казахстане</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Помогаем предприятиям с лабораторными замерами, производственным контролем СЭС, отчетами ПЭК, паспортами отходов, экологическим проектированием и утилизацией.
            </p>
          </div>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featuredSeoLinks.map((page, index) => (
            <Reveal key={page.slug} delay={index * 0.03}>
              <Link to={`/${page.slug}`} className="group block h-full rounded-[8px] border border-slate-200 bg-[#F7FBFD] p-5 shadow-sm transition hover:border-eco-300 hover:bg-white">
                <h3 className="font-bold text-eco-900 group-hover:text-eco-600">{page.h1}</h3>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{page.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-eco-700">Открыть страницу <ArrowRight size={16} /></span>
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
            <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">От заявки до результата в кабинете</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {processSteps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.04}>
              <div className="h-full rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-eco-900 text-sm font-bold text-white">{index + 1}</span>
                <h3 className="mt-5 font-bold text-eco-900">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <TrustSection />
    <DocumentsSection />
    <CaseStudies />

  </div>
);

export default HomePage;
