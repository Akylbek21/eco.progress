import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import WhatsAppButton from '../components/WhatsAppButton';
import WhatsAppLeadForm from '../components/WhatsAppLeadForm';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { TrustCompact } from '../components/TrustBlocks';
import { company } from '../config/company';
import { trackServiceView } from '../services/analytics';
import { createBlankWhatsAppRequestMessage } from '../utils/whatsapp';
import { activeServices, formatKztPrice, getCatalogService, PRELIMINARY_PRICE_NOTICE } from '../content/serviceCatalog';
import { buildBreadcrumbSchema, buildFaqSchema, buildOrganizationSchema, buildServiceSchema } from '../utils/schema';
import { serviceContentMap } from '../content/services/serviceContent';
import { publicContentRepository } from '../content/apiRepository';
import { ContentLastUpdated, RegionalAvailability, RelatedArticles, RelatedServices, ServiceDeliverables, ServiceExclusions, ServiceLegalBasis, ServicePricingFactors, ServiceRequiredDocuments, ServiceWorkflow } from '../components/content/ContentBlocks';

export const serviceLandingSlugs = activeServices.map((service) => service.slug);

const ServiceLandingPage = ({ slug }: { slug: string }) => {
  const service = getCatalogService(slug);
  const staticContent = service ? serviceContentMap.get(service.slug) : undefined;
  const { data: content } = useQuery({
    queryKey: ['public-content', 'service', service?.slug],
    queryFn: () => publicContentRepository.getServiceBySlug(service?.slug || ''),
    enabled: Boolean(service?.slug),
    initialData: staticContent,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (service) trackServiceView({ slug: service.slug, title: service.title });
  }, [service]);

  if (!service || !service.isActive) return <Navigate to="/services" replace />;

  const canonical = `${company.siteUrl}/services/${service.slug}`;
  const schema = [
    buildOrganizationSchema(),
    buildServiceSchema(service, canonical),
    buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Услуги', url: `${company.siteUrl}/services` }, { name: service.title, url: canonical }]),
    buildFaqSchema(content?.faq ?? service.faq),
  ];

  return <div className="bg-white">
    <SEO title={service.seo.title} description={service.seo.description} canonical={canonical} schema={schema} />
    <section className="relative isolate overflow-hidden bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-24">
      <ResponsiveImage fill src={service.image || '/og-cover.jpg'} alt={service.title} priority width={1600} height={900} wrapperClassName="-z-20" className="object-cover" />
      <div className="absolute inset-0 -z-10 bg-eco-900/82" />
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">{service.category}</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">{content?.hero.title ?? service.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/76">{content?.hero.subtitle ?? service.fullDescription}</p>
          <p className="mt-4 text-xl font-bold text-accent">{formatKztPrice(service.pricing)}</p>
          <p className="mt-3 text-sm text-white/70">{service.areaServed.description}</p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <Button asChild className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto"><a href="#lead">Оставить заявку</a></Button>
            <WhatsAppButton label="Оставить заявку через WhatsApp" message={createBlankWhatsAppRequestMessage(service.title)} className="w-full sm:w-auto" />
          </div>
        </div>
        <WhatsAppLeadForm source={`service_${service.slug}_whatsapp`} title="Заявка через WhatsApp" compact defaultService={service.title} />
      </div>
    </section>

    {!content && <section className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-8">
        <Block title="Кому нужна услуга" items={service.targetClients} />
        <Block title="Что получает клиент" items={service.deliverables} />
        <Block title="Какие документы могут понадобиться" items={service.requiredDocuments} />
        <div className="rounded-[22px] border border-slate-200 bg-[#F7FBFD] p-6"><h2 className="text-2xl font-bold text-eco-900">Как проходит работа</h2><ol className="mt-5 space-y-4">{service.workflow.map((step) => <li key={step.order} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-eco-800 text-sm font-bold text-white">{step.order}</span><span><strong className="text-eco-900">{step.title}</strong><span className="mt-1 block text-sm text-slate-600">{step.description}</span></span></li>)}</ol></div>
        <div className="rounded-[22px] border border-slate-200 bg-white p-6"><h2 className="text-2xl font-bold text-eco-900">Стоимость и сроки</h2><p className="mt-3 text-xl font-bold text-eco-700">{formatKztPrice(service.pricing)}</p><p className="mt-2 text-slate-600">{service.duration.text}</p><p className="mt-4 text-sm leading-6 text-slate-600">{PRELIMINARY_PRICE_NOTICE}</p></div>
      </div>
      <div className="h-fit rounded-[22px] bg-eco-50 p-5"><h2 className="text-2xl font-bold text-eco-900">Почему выбирают нас</h2><div className="mt-5"><TrustCompact /></div></div>
    </div></section>}

    {content && <main className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-7xl space-y-16">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-3xl font-bold text-eco-900">Об услуге</h2>
          <p className="mt-4 leading-7 text-slate-600">{content.summary.shortDescription}</p>
          <p className="mt-4 leading-7 text-slate-700"><strong>Результат для клиента:</strong> {content.summary.clientResult}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><p className="rounded-2xl bg-eco-50 p-4 text-sm"><strong>Срок:</strong> {content.summary.durationText}</p><p className="rounded-2xl bg-eco-50 p-4 text-sm"><strong>Стоимость:</strong> {formatKztPrice(service.pricing)}</p></div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{PRELIMINARY_PRICE_NOTICE}</p>
        </div>
        <div className="space-y-5"><RegionalAvailability availability={content.summary.availability} /><div className="rounded-[22px] bg-eco-50 p-5"><h2 className="text-2xl font-bold text-eco-900">Почему выбирают нас</h2><div className="mt-5"><TrustCompact /></div></div></div>
      </section>
      <section><h2 className="text-3xl font-bold text-eco-900">Когда требуется услуга</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{content.whenRequired.map((item) => <article key={item.title} className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-bold text-eco-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></article>)}</div></section>
      <section><h2 className="text-3xl font-bold text-eco-900">Для кого подходит</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{content.targetClients.map((item) => <article key={item.title} className="rounded-[22px] bg-eco-50 p-5"><h3 className="font-bold text-eco-900">{item.title}</h3>{item.description && <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>}</article>)}</div></section>
      <section><h2 className="text-3xl font-bold text-eco-900">Какие задачи решаем</h2><div className="mt-5 grid gap-4 lg:grid-cols-2">{content.problemsSolved.map((item) => <article key={item.problem} className="rounded-[22px] border border-slate-200 bg-white p-6"><h3 className="font-bold text-rose-800">Задача: {item.problem}</h3><p className="mt-3 text-sm leading-6 text-slate-600"><strong className="text-eco-800">Решение:</strong> {item.solution}</p></article>)}</div></section>
      <ServiceDeliverables items={content.deliverables} />
      <ServiceWorkflow items={content.workflow} />
      <ServiceRequiredDocuments items={content.requiredDocuments} />
      <ServicePricingFactors items={content.pricingFactors} />
      <ServiceExclusions items={content.notIncluded} />
      <ServiceLegalBasis items={content.legalBasis} />
      <section><h2 className="text-3xl font-bold text-eco-900">Риски и профилактика</h2><div className="mt-5 grid gap-4 lg:grid-cols-2">{content.risks.map((item) => <article key={item.risk} className="rounded-[22px] border border-slate-200 bg-white p-6"><h3 className="font-bold text-eco-900">{item.risk}</h3><p className="mt-2 text-sm leading-6 text-slate-600">Как снизить риск: {item.prevention}</p></article>)}</div></section>
      <ContentLastUpdated date={content.contentReview.lastReviewedAt ?? '2026-07-17'} requiresReview={content.contentReview.reviewStatus !== 'approved'} />
    </div></main>}

    <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-4xl"><h2 className="text-3xl font-bold text-eco-900">Частые вопросы</h2><div className="mt-8 space-y-4">{(content?.faq ?? service.faq).map((item) => <div key={item.question} className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-bold text-eco-900">{item.question}</h3><p className="mt-3 leading-7 text-slate-600">{item.answer}</p></div>)}</div></div></section>

    {service.relatedServiceSlugs.length > 0 && <section className="px-4 py-14 sm:px-8"><div className="mx-auto max-w-4xl"><h2 className="text-2xl font-bold text-eco-900">Связанные услуги</h2><div className="mt-5 flex flex-wrap gap-3">{service.relatedServiceSlugs.map((relatedSlug) => { const related = getCatalogService(relatedSlug); return related ? <Link key={relatedSlug} to={`/services/${related.slug}`} className="rounded-full border border-eco-200 bg-eco-50 px-4 py-2 text-sm font-semibold text-eco-800">{related.title}</Link> : null; })}</div></div></section>}
    {content && <section className="px-4 py-14 sm:px-8"><div className="mx-auto max-w-7xl space-y-12"><RelatedServices slugs={content.relatedServices} />{content.relatedArticles.length > 0 && <RelatedArticles slugs={content.relatedArticles} />}</div></section>}

    <section id="lead" className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]"><div><h2 className="text-3xl font-bold text-eco-900">Получить консультацию по услуге</h2><p className="mt-4 leading-7 text-slate-600">Опишите задачу, и специалист подскажет сроки, документы и порядок работы.</p></div><WhatsAppLeadForm source={`service_bottom_${service.slug}_whatsapp`} defaultService={service.title} /></div></section>
  </div>;
};

const Block = ({ title, items }: { title: string; items: string[] }) => <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-2xl font-bold text-eco-900">{title}</h2><ul className="mt-5 grid gap-3 sm:grid-cols-2">{items.map((item) => <li key={item} className="rounded-2xl bg-eco-50 p-4 text-sm font-semibold leading-6 text-eco-900">{item}</li>)}</ul></div>;

export default ServiceLandingPage;
