import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';
import { PageSkeleton } from '../components/loading/PageLoader';
import ErrorState from '../components/ui/ErrorState';
import WhatsAppButton from '../components/WhatsAppButton';
import { getServiceById } from '../services/serviceService';
import { catalogItemToServiceItem } from '../services/serviceService';
import { formatKztPrice, getCatalogService, getServicePrimaryCtaLabel, getServiceSecondaryCtaLabel, PRELIMINARY_PRICE_NOTICE } from '../content/serviceCatalog';
import { company } from '../config/company';
import { createBlankWhatsAppRequestMessage } from '../utils/whatsapp';

const OrderChoiceModal = lazy(() => import('../components/OrderChoiceModal'));

const ServiceDetailsPage = () => {
  const { id } = useParams();
  const [orderModal, setOrderModal] = useState(false);
  const catalogService = id ? getCatalogService(id) : undefined;
  const { data: service, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['services', id],
    queryFn: () => getServiceById(id!),
    enabled: !!id,
    initialData: catalogService ? catalogItemToServiceItem(catalogService) : undefined,
  });

  if (isLoading) return <PageSkeleton />;
  if (isError && !service) return <div className="mx-auto min-h-[60vh] max-w-3xl px-5 py-16"><ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => refetch()} /></div>;
  if (!service) return <Navigate to="/services" replace />;

  return (
    <div>
      <SEO
        title={catalogService?.seo.title || `${service.title} | ecoprogress.kz`}
        description={catalogService?.seo.description || service.description}
        canonical={`${company.siteUrl}/services/${catalogService?.slug || id}`}
      />
      <section className="relative overflow-hidden px-5 py-24 text-white sm:px-8">
        <div className="absolute inset-0 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 bg-eco-900/80" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal><p className="text-sm font-semibold uppercase tracking-[0.22em] text-eco-200">{service.category}</p></Reveal>
          <Reveal delay={0.1}><h1 className="mt-4 max-w-4xl text-4xl font-bold sm:text-6xl">{service.title}</h1></Reveal>
          <Reveal delay={0.16}><p className="mt-5 max-w-2xl text-lg text-white/78">{service.description}</p></Reveal>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <Button type="button" onClick={() => setOrderModal(true)} className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto">{getServicePrimaryCtaLabel(catalogService?.slug || id || '')}</Button>
            <WhatsAppButton label={getServiceSecondaryCtaLabel(catalogService?.slug || id || '')} message={createBlankWhatsAppRequestMessage(service.title)} className="w-full sm:w-auto" />
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
          {[
            ['Кому нужна услуга', [service.forWhom]],
            ['Что входит в услугу', service.includes],
            ['Какие документы могут понадобиться', service.documents],
            ['Как проходит работа', service.workflow],
            ['Примерные сроки', [service.duration]],
            ['Результат', [service.result]],
          ].map(([title, list], index) => (
            <Reveal key={String(title)} delay={index * 0.04}>
              <div className="card-hover h-full rounded-[22px] border border-slate-200 bg-eco-50 p-6">
                <h2 className="text-xl font-bold text-eco-900">{title}</h2>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-650">
                  {(list as string[]).map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      {catalogService && <section className="bg-eco-50 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-10">
          <section>
            <h2 className="text-2xl font-bold text-eco-900">Об услуге и условиях работы</h2>
            <p className="mt-4 leading-7 text-slate-650">{catalogService.fullDescription}</p>
            <p className="mt-3 leading-7 text-slate-650">{catalogService.areaServed.description} Перед началом работ специалист проверяет объект, задачу и исходные документы, затем фиксирует состав результата и применимые ограничения.</p>
            <p className="mt-3 leading-7 text-slate-650"><strong>Ориентировочная стоимость:</strong> {formatKztPrice(catalogService.pricing)}. {PRELIMINARY_PRICE_NOTICE}</p>
          </section>
          {catalogService.legalBasis?.length ? <section>
            <h2 className="text-2xl font-bold text-eco-900">Нормативная база</h2>
            <ul className="mt-4 space-y-2 text-slate-650">{catalogService.legalBasis.map((item) => <li key={item.title}>• {item.title}{item.documentNumber ? `, ${item.documentNumber}` : ''}</li>)}</ul>
          </section> : null}
          <section>
            <h2 className="text-2xl font-bold text-eco-900">Частые вопросы</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">{catalogService.faq.map((item) => <article key={item.question} className="rounded-[22px] border border-slate-200 bg-white p-6"><h3 className="font-bold text-eco-900">{item.question}</h3><p className="mt-3 text-sm leading-6 text-slate-650">{item.answer}</p></article>)}</div>
          </section>
          {catalogService.relatedServiceSlugs.length ? <section>
            <h2 className="text-2xl font-bold text-eco-900">Связанные услуги</h2>
            <div className="mt-4 flex flex-wrap gap-3">{catalogService.relatedServiceSlugs.map((slug) => <Link key={slug} to={`/services/${slug}`} className="rounded-full border border-eco-200 bg-white px-4 py-2 text-sm font-semibold text-eco-800">{getCatalogService(slug)?.title || slug}</Link>)}</div>
          </section> : null}
        </div>
      </section>}
      {orderModal && <Suspense fallback={null}><OrderChoiceModal open onClose={() => setOrderModal(false)} preSelectedService={id} /></Suspense>}
    </div>
  );
};

export default ServiceDetailsPage;
