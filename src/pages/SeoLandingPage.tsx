import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, FileText, MessageCircle } from 'lucide-react';
import SEO from '../components/SEO';
import LeadForm from '../components/LeadForm';
import Button from '../components/ui/Button';
import { company, getWhatsAppUrl } from '../config/company';
import { seoPageMap, seoPages, type SeoPage } from '../data/seoPages';

const localBusinessSchema = {
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

const buildSchema = (page: SeoPage) => [
  localBusinessSchema,
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.h1,
    description: page.description,
    image: `${company.siteUrl}${page.image}`,
    author: {
      '@type': 'Organization',
      name: company.name,
    },
    publisher: {
      '@type': 'Organization',
      name: company.name,
    },
    mainEntityOfPage: `${company.siteUrl}/${page.slug}`,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.h1,
    provider: {
      '@type': 'LocalBusiness',
      name: company.name,
      url: company.siteUrl,
    },
    areaServed: 'Шымкент, Казахстан',
    serviceType: page.serviceType,
    description: page.description,
    url: `${company.siteUrl}/${page.slug}`,
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

const SeoLandingPage = ({ slug }: { slug: string }) => {
  const page = seoPageMap.get(slug);
  if (!page) return null;

  const relatedPages = page.related
    .map((item) => seoPageMap.get(item))
    .filter(Boolean) as SeoPage[];
  const canonical = `${company.siteUrl}/${page.slug}`;
  const whatsAppUrl = getWhatsAppUrl(`Здравствуйте! Хочу получить консультацию: ${page.h1}. Город: Шымкент.`);

  return (
    <div className="bg-[#F7FBFD]">
      <SEO title={page.title} description={page.description} canonical={canonical} schema={buildSchema(page)} />

      <section className="relative isolate overflow-hidden bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-20">
        <img src={page.image} alt={page.h1} className="absolute inset-0 -z-20 h-full w-full object-cover" width="1600" height="900" />
        <div className="absolute inset-0 -z-10 bg-eco-900/82" />
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.72fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">{page.eyebrow}</p>
            <h1 className="mt-5 max-w-5xl text-4xl font-bold leading-tight sm:text-5xl">{page.h1}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/84">{page.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#lead-form"><Button className="bg-accent px-6 py-4 text-eco-900 hover:bg-accent/90">Получить консультацию</Button></a>
              <a href={whatsAppUrl} target="_blank" rel="noreferrer"><Button variant="secondary" className="gap-2 border-white/30 bg-white/10 px-6 py-4 text-white hover:bg-white/18"><MessageCircle size={18} /> Написать в WhatsApp</Button></a>
            </div>
          </div>
          <div className="rounded-[8px] border border-white/15 bg-white/10 p-6 backdrop-blur">
            <p className="text-sm font-semibold uppercase text-white/65">Ориентир</p>
            <p className="mt-3 text-3xl font-bold text-accent">{page.price}</p>
            <p className="mt-4 text-sm leading-6 text-white/75">{page.deadlines}</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          <ListBlock title="Что входит" items={page.includes} />
          <ListBlock title="Кому нужна услуга" items={page.audience} />
          <ListBlock title="Что получает клиент" items={page.documents} />
        </div>
      </section>

      {page.riskRows && (
        <section className="bg-white px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Риски</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900">Таблица рисков для бизнеса</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">При проверке чаще всего смотрят не на один документ, а на связку: объект, отходы, замеры, отчеты и подтверждения.</p>
            </div>
            <div className="mt-8 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
              <div className="grid bg-eco-900 px-4 py-3 text-sm font-bold text-white md:grid-cols-4">
                <span>Нарушение</span>
                <span>Кому актуально</span>
                <span>Что может запросить проверка</span>
                <span>Как снизить риск</span>
              </div>
              {page.riskRows.map((row) => (
                <div key={row.violation} className="grid gap-3 border-t border-slate-100 px-4 py-4 text-sm leading-6 text-slate-700 md:grid-cols-4">
                  <strong className="text-eco-900">{row.violation}</strong>
                  <span>{row.audience}</span>
                  <span>{row.inspection}</span>
                  <span>{row.mitigation}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {page.articleSections && (
        <section className="px-4 py-14 sm:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
            {page.articleSections.map((section) => (
              <article key={section.title} className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-eco-900">{section.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{section.body}</p>
                {section.links && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {section.links.map((link) => (
                      <Link key={link.slug} to={`/${link.slug}`} className="rounded-full border border-eco-200 bg-eco-50 px-4 py-2 text-sm font-semibold text-eco-800 hover:bg-eco-100">
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white px-4 py-14 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Этапы</p>
            <h2 className="mt-3 text-3xl font-bold text-eco-900">Как проходит работа</h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Мы начинаем с консультации и не предлагаем лишние документы. Сначала разбираем объект, задачу и сроки, затем фиксируем перечень работ и передаем результат в понятном виде.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {page.steps.map((step, index) => (
              <div key={step} className="rounded-[8px] border border-slate-200 bg-[#F7FBFD] p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-eco-900 text-sm font-bold text-white">{index + 1}</span>
                <p className="mt-4 text-sm font-semibold leading-6 text-slate-800">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-3xl font-bold text-eco-900">Почему выбирают ECOPROGRESS</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {page.why.map((item) => (
                <div key={item} className="rounded-[8px] bg-eco-50 p-4 text-sm font-semibold leading-6 text-eco-900">{item}</div>
              ))}
            </div>
          </div>
          <div id="lead-form">
            <LeadForm source={`seo_${page.slug}`} defaultService={page.serviceType} title="Оставить заявку" />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">FAQ</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900">Частые вопросы</h2>
            </div>
            <Clock3 className="hidden text-eco-600 sm:block" size={36} />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {page.faq.map((item) => (
              <article key={item.question} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold leading-6 text-eco-900">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          {page.disclaimer && (
            <div className="mb-8 rounded-[8px] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
              <strong className="block text-base text-amber-950">Важно</strong>
              <span>{page.disclaimer}</span>
            </div>
          )}
          {page.sources && (
            <div className="mb-8 rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-bold text-eco-900">Нормативная база</h2>
              <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
                {page.sources.map((source) => <li key={source}>{source}</li>)}
              </ul>
            </div>
          )}
          <h2 className="text-3xl font-bold text-eco-900">Связанные услуги</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {relatedPages.map((item) => (
              <Link key={item.slug} to={`/${item.slug}`} className="group rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-eco-300">
                <FileText className="text-eco-600" size={24} />
                <h3 className="mt-4 font-bold text-eco-900 group-hover:text-eco-600">{item.h1}</h3>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-eco-700">Подробнее <ArrowRight size={16} /></span>
              </Link>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {seoPages.filter((item) => item.slug !== page.slug).slice(0, 6).map((item) => (
              <Link key={item.slug} to={`/${item.slug}`} className="rounded-full border border-eco-200 bg-white px-4 py-2 text-sm font-semibold text-eco-800 hover:bg-eco-50">
                {item.serviceType}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SeoLandingPage;
