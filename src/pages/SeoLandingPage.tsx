import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, MessageCircle, ShieldCheck } from 'lucide-react';
import SEO from '../components/SEO';
import LeadForm from '../components/LeadForm';
import Button from '../components/ui/Button';
import { company, getWhatsAppUrl } from '../config/company';
import { seoPageMap, type SeoFaqItem, type SeoPageConfig } from '../data/seoPages';

const baseLocalBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: company.name,
  url: company.siteUrl,
  email: company.email,
  telephone: company.phone,
  image: `${company.siteUrl}/og-cover.jpg`,
  areaServed: ['Казахстан', 'Шымкент', 'Алматы', 'Астана', 'Тараз', 'Туркестан', 'Кызылорда'],
  serviceType: ['Экологическое проектирование', 'Лабораторные замеры', 'Производственный контроль', 'Паспорт отходов', 'Отчет ПЭК', 'Утилизация отходов'],
  description: 'Экологические услуги для бизнеса в Казахстане',
  address: {
    '@type': 'PostalAddress',
    streetAddress: company.address,
    addressLocality: 'Шымкент',
    addressCountry: 'KZ',
  },
};

const buildSchema = (page: SeoPageConfig) => [
  baseLocalBusinessSchema,
  {
    '@context': 'https://schema.org',
    '@type': page.type === 'article' ? 'Article' : 'Service',
    name: page.h1,
    headline: page.h1,
    description: page.description,
    url: page.canonical,
    image: `${company.siteUrl}${page.image || '/og-cover.jpg'}`,
    provider: {
      '@type': 'Organization',
      name: company.name,
      url: company.siteUrl,
    },
    areaServed: page.city || 'Казахстан',
    serviceType: page.service || 'Экологические услуги',
    dateModified: page.lastmod,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: page.breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: `${company.siteUrl}${item.path}`,
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  },
];

const ListBlock = ({ title, items }: { title: string; items: string[] }) => (
  <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-2xl font-bold text-eco-900">{title}</h2>
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
          <CheckCircle2 className="mt-0.5 shrink-0 text-eco-600" size={18} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </section>
);

const FaqGrid = ({ faq }: { faq: SeoFaqItem[] }) => (
  <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {faq.map((item) => (
      <article key={item.question} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold leading-6 text-eco-900">{item.question}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
      </article>
    ))}
  </div>
);

const SeoLandingPage = ({ slug }: { slug: string }) => {
  const page = seoPageMap.get(slug);
  if (!page) return null;

  const whatsAppUrl = getWhatsAppUrl(`Здравствуйте! Хочу получить консультацию: ${page.h1}.`);
  const services = page.services ?? [];
  const audience = page.audience ?? [];
  const outcomes = page.outcomes ?? [];

  return (
    <div className="bg-[#F7FBFD]">
      <SEO title={page.title} description={page.description} canonical={page.canonical} schema={buildSchema(page)} />

      <section className="relative isolate overflow-hidden bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20">
        <img src={page.image || '/para.jpg'} alt={page.h1} className="absolute inset-0 -z-20 h-full w-full object-cover" width="1600" height="900" />
        <div className="absolute inset-0 -z-10 bg-eco-900/84" />
        <div className="mx-auto max-w-7xl">
          <nav className="flex flex-wrap gap-2 text-sm text-white/72" aria-label="Хлебные крошки">
            {page.breadcrumbs.map((item, index) => (
              <span key={item.path} className="inline-flex items-center gap-2">
                {index > 0 && <span>/</span>}
                <Link to={item.path} className="hover:text-white">{item.label}</Link>
              </span>
            ))}
          </nav>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.08fr_0.72fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">{page.city || page.service || 'ECOPROGRESS'}</p>
              <h1 className="mt-5 max-w-5xl text-4xl font-bold leading-tight sm:text-5xl">{page.h1}</h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/84">{page.intro}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#lead-form"><Button className="bg-accent px-6 py-4 text-eco-900 hover:bg-accent/90">Получить консультацию</Button></a>
                <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="gap-2 border-white/30 bg-white/10 px-6 py-4 text-white hover:bg-white/18">
                    <MessageCircle size={18} /> Написать в WhatsApp
                  </Button>
                </a>
              </div>
            </div>
            <div className="rounded-[8px] border border-white/15 bg-white/10 p-6 backdrop-blur">
              <ShieldCheck className="text-accent" size={34} />
              <h2 className="mt-5 text-2xl font-bold">Что сделаем на старте</h2>
              <p className="mt-4 text-sm leading-6 text-white/75">
                Проверим объект, список документов, лабораторные точки, отходы и риски перед проверкой. После консультации подготовим расчет стоимости и понятный план работ.
              </p>
            </div>
          </div>
        </div>
      </section>

      {(services.length || audience.length || outcomes.length) && (
        <section className="px-4 py-14 sm:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
            {services.length > 0 && (
              <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-eco-900">Что входит в услугу</h2>
                <div className="mt-5 grid gap-2">
                  {services.map((item) => <Link key={item.path} to={item.path} className="rounded-2xl bg-eco-50 px-4 py-3 text-sm font-semibold text-eco-900 hover:bg-eco-100">{item.label}</Link>)}
                </div>
              </section>
            )}
            {audience.length > 0 && <ListBlock title="Для каких объектов" items={audience} />}
            {outcomes.length > 0 && <ListBlock title="Что получает клиент" items={outcomes} />}
          </div>
        </section>
      )}

      <section className="bg-white px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-2">
            {page.sections.map((section) => (
              <article key={section.title} className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-eco-900">{section.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-eco-900">Почему выбирают ECOPROGRESS</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                'работаем по Казахстану и ведем часть задач дистанционно',
                'закрываем документы, замеры, отходы и сопровождение в одном процессе',
                'помогаем подготовиться к проверкам и снизить риск замечаний',
                'передаем готовые материалы в PDF/Word и объясняем следующий шаг',
              ].map((item) => (
                <div key={item} className="rounded-[8px] bg-eco-50 p-4 text-sm font-semibold leading-6 text-eco-900">{item}</div>
              ))}
            </div>
          </div>
          <div id="lead-form">
            <LeadForm source={`seo_${page.slug}`} defaultService={page.service || 'Экологические услуги'} title="Заказать расчет стоимости" />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold text-eco-900">Частые вопросы</h2>
          <FaqGrid faq={page.faq} />
        </div>
      </section>

      <section className="px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold text-eco-900">Полезные ссылки</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {page.relatedLinks.map((item) => (
              <Link key={item.path} to={item.path} className="group rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-eco-300">
                <FileText className="text-eco-600" size={24} />
                <h3 className="mt-4 font-bold text-eco-900 group-hover:text-eco-600">{item.label}</h3>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-eco-700">Открыть <ArrowRight size={16} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SeoLandingPage;
