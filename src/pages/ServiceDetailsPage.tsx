import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import OrderChoiceModal from '../components/OrderChoiceModal';
import { getServiceById } from '../services/serviceService';

const ServiceDetailsPage = () => {
  const { id } = useParams();
  const [orderModal, setOrderModal] = useState(false);
  const { data: service, isLoading } = useQuery({
    queryKey: ['services', id],
    queryFn: () => getServiceById(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;
  if (!service) return <Navigate to="/services" replace />;

  return (
    <div>
      <SEO title={`${service.title} | ECOPROGRESS GROUP`} description={service.description} />
      <section className="relative overflow-hidden px-5 py-24 text-white sm:px-8">
        <div className="absolute inset-0 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 bg-eco-900/80" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal><p className="text-sm font-semibold uppercase tracking-[0.22em] text-eco-200">{service.category}</p></Reveal>
          <Reveal delay={0.1}><h1 className="mt-4 max-w-4xl text-4xl font-bold sm:text-6xl">{service.title}</h1></Reveal>
          <Reveal delay={0.16}><p className="mt-5 max-w-2xl text-lg text-white/78">{service.description}</p></Reveal>
          <button type="button" onClick={() => setOrderModal(true)} className="mt-8 inline-block"><Button className="bg-accent text-eco-900 hover:bg-accent/90">Заказать услугу</Button></button>
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
      <OrderChoiceModal open={orderModal} onClose={() => setOrderModal(false)} preSelectedService={id} />
    </div>
  );
};

export default ServiceDetailsPage;
