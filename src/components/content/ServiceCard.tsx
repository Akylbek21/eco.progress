import { ArrowRight, Clock3, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ServiceItem } from '../../types';
import { getCatalogService, getServicePrimaryCtaLabel } from '../../content/serviceCatalog';
import Button from '../ui/Button';

const ServiceCard = ({ service, onOrder }: { service: ServiceItem; onOrder: (serviceId: string) => void }) => {
  const catalog = getCatalogService(service.id);
  const hasConfirmedDuration = Boolean(catalog?.duration.minDays || catalog?.duration.maxDays);

  return (
    <article id={`service-${service.id}`} className="group flex h-full scroll-mt-28 flex-col rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-eco-200 hover:shadow-xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-eco-600">{catalog?.shortTitle || service.title}</p>
        <ArrowRight className="shrink-0 text-eco-300 transition group-hover:translate-x-1 group-hover:text-eco-600" size={20} aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-xl font-bold leading-snug text-eco-900 sm:text-2xl">{service.title}</h3>
      <p className="mt-3 flex-1 text-base leading-7 text-slate-600">{service.description}</p>
      <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
        <div className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-eco-600" size={17} aria-hidden="true" /><dt className="sr-only">География</dt><dd>{service.areaServed}</dd></div>
        {hasConfirmedDuration && <div className="flex items-start gap-2"><Clock3 className="mt-0.5 shrink-0 text-eco-600" size={17} aria-hidden="true" /><dt className="sr-only">Срок</dt><dd>{service.duration}</dd></div>}
        {service.price && <div><dt className="sr-only">Стоимость</dt><dd className="font-bold text-eco-900">{service.price}</dd></div>}
      </dl>
      <div className="mt-6 grid gap-3 sm:grid-cols-[auto_1fr]">
        <Button asChild variant="secondary" className="w-full"><Link to={`/services/${service.id}`}>Подробнее</Link></Button>
        <Button type="button" onClick={() => onOrder(service.id)} className="w-full">{getServicePrimaryCtaLabel(service.id)}</Button>
      </div>
    </article>
  );
};

export default ServiceCard;
