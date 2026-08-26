import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import WhatsAppButton from '../components/WhatsAppButton';
import WhatsAppLeadForm from '../components/WhatsAppLeadForm';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { company } from '../config/company';
import { trackServiceView } from '../services/analytics';
import { createBlankWhatsAppRequestMessage } from '../utils/whatsapp';
import { activeServices, formatKztPrice, getCatalogService, getServicePrimaryCtaLabel, getServiceSecondaryCtaLabel } from '../content/serviceCatalog';
import { buildBreadcrumbSchema, buildCorePageEntities, buildPersonSchema, buildServiceEntity } from '../seo/entityBuilders';
import { serviceContentMap } from '../content/services/serviceContent';
import { publicContentRepository } from '../content/apiRepository';
import { ServiceAeoContent } from '../components/content/AeoContent';
import { ContentLastUpdated, RelatedArticles, RelatedServices } from '../components/content/ContentBlocks';
import { CheckCircle2 } from 'lucide-react';

export const serviceLandingSlugs = activeServices
  .filter((service) => serviceContentMap.has(service.slug))
  .map((service) => service.slug);

const ServiceLandingPage = ({ slug }: { slug: string }) => {
  const service = getCatalogService(slug);
  // The reviewed local content is the deterministic first render for SSR and
  // hydration. React Query can still refresh it from the public CMS afterward.
  const staticContent = service ? serviceContentMap.get(service.slug) : undefined;
  const { data: content, isLoading, isError } = useQuery({
    queryKey: ['public-content', 'service', service?.slug],
    queryFn: () => publicContentRepository.getServiceBySlug(service?.slug || ''),
    enabled: Boolean(service?.slug), initialData: staticContent, staleTime: 5 * 60 * 1000,
  });
  const { data: confirmedExperts = [] } = useQuery({ queryKey: ['public-content', 'experts'], queryFn: () => publicContentRepository.getExperts(), staleTime: 5 * 60 * 1000 });
  const { data: confirmedCases = [] } = useQuery({ queryKey: ['public-content', 'cases'], queryFn: () => publicContentRepository.getCases(), staleTime: 5 * 60 * 1000 });

  useEffect(() => { if (service) trackServiceView({ slug: service.slug, title: service.title }); }, [service]);

  if (!service || !service.isActive) return <Navigate to="/services" replace />;
  if (isLoading && !content) return <div className="px-5 py-20 text-center text-slate-600">Загрузка услуги…</div>;
  if (isError || !content) return <div className="px-5 py-20 text-center text-rose-800">Не удалось загрузить описание услуги с сервера.</div>;

  const canonical = `${company.siteUrl}/services/${service.slug}`;
  const expertNodes = confirmedExperts.map((expert, index) => buildPersonSchema(expert, `${canonical}#expert-${index + 1}`));
  const caseUrls = confirmedCases.filter((item) => item.service === service.slug).map((item) => `${company.siteUrl}/cases/${item.slug}`);
  const schema = [
    ...buildCorePageEntities({ canonical, name: service.title, description: service.seo.description }),
    buildServiceEntity({ canonical, name: service.title, description: service.fullDescription, serviceType: service.category, areaServed: service.areaServed.type === 'KAZAKHSTAN' ? 'Казахстан' : service.areaServed.regions, expertIds: expertNodes.map((node) => String(node['@id'])), caseUrls }),
    ...expertNodes,
    buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Услуги', url: `${company.siteUrl}/services` }, { name: service.title, url: canonical }]),
  ];

  return <div className="bg-white">
    <SEO title={service.seo.title} description={service.seo.description} canonical={canonical} schema={schema} />
    <section className="relative isolate overflow-hidden bg-eco-900 px-4 py-16 text-white sm:px-8 sm:py-24">
      <ResponsiveImage fill sizes="100vw" src={service.image || '/og-cover.jpg'} alt={service.title} priority width={1600} height={900} wrapperClassName="-z-20" className="object-cover" />
      <div className="absolute inset-0 -z-10 bg-eco-900/82" />
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">{service.category}</p><h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">{content.hero.title}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-white/76">{content.hero.subtitle}</p>{content.hero.benefits?.length ? <ul className="mt-6 grid gap-3" aria-label="Преимущества">{content.hero.benefits.map((benefit) => <li key={benefit} className="flex items-center gap-2 text-sm font-semibold text-white/90"><CheckCircle2 className="shrink-0 text-accent" size={19} aria-hidden="true" /><span>{benefit}</span></li>)}</ul> : null}<p className="mt-4 text-xl font-bold text-accent">{formatKztPrice(service.pricing)}</p><div className="mt-8 grid gap-3 sm:flex sm:flex-wrap"><Button asChild className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto"><a href="#lead">{getServicePrimaryCtaLabel(service.slug)}</a></Button><WhatsAppButton label={getServiceSecondaryCtaLabel(service.slug)} message={createBlankWhatsAppRequestMessage(service.title)} className="w-full sm:w-auto" /></div></div>
        <WhatsAppLeadForm source={`service_${service.slug}_whatsapp`} title={['report-pek', 'roos'].includes(service.slug) ? 'Короткая заявка' : 'Заявка через WhatsApp'} compact defaultService={service.title} serviceSlug={service.slug} />
      </div>
    </section>
    <main className="bg-eco-50 px-4 py-16 sm:px-8 sm:py-20"><ServiceAeoContent content={content} /><div className="mx-auto mt-14 max-w-7xl space-y-10">{content.contentReview.lastReviewedAt && <ContentLastUpdated date={content.contentReview.lastReviewedAt} requiresReview={content.contentReview.reviewStatus !== 'approved'} />}<RelatedServices slugs={content.relatedServices} />{content.relatedArticles.length > 0 && <RelatedArticles slugs={content.relatedArticles} />}</div></main>
    {service.relatedServiceSlugs.length > 0 && <section className="px-4 py-14 sm:px-8"><div className="mx-auto max-w-4xl"><h2 className="text-2xl font-bold text-eco-900">Связанные услуги</h2><div className="mt-5 flex flex-wrap gap-3">{service.relatedServiceSlugs.map((relatedSlug) => { const related = getCatalogService(relatedSlug); return related ? <Link key={relatedSlug} to={`/services/${related.slug}`} className="rounded-full border border-eco-200 bg-eco-50 px-4 py-2 text-sm font-semibold text-eco-800">{related.title}</Link> : null; })}</div></div></section>}
    <section id="lead" className="px-4 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]"><div><h2 className="text-3xl font-bold text-eco-900">Получить консультацию по услуге</h2><p className="mt-4 leading-7 text-slate-600">Опишите объект и задачу. Специалист проверит применимость требований, перечень исходных документов и условия выполнения работ.</p></div><WhatsAppLeadForm source={`service_bottom_${service.slug}_whatsapp`} title="Короткая заявка" defaultService={service.title} serviceSlug={service.slug} compact /></div></section>
  </div>;
};

export default ServiceLandingPage;
