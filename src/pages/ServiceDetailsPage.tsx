import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SectionTitle from '../components/ui/SectionTitle';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { getServiceById } from '../services/serviceService';
import { services as servicesData } from '../data/mockData';

const ServiceDetailsPage = () => {
  const { id } = useParams();
  const { data: service } = useQuery({
    queryKey: ['service', id],
    queryFn: () => getServiceById(id ?? ''),
    enabled: Boolean(id),
    placeholderData: servicesData.find((item) => item.id === id),
  });

  const serviceData = useMemo(
    () =>
      service ||
      (id ? servicesData.find((item) => item.id === id) : undefined),
    [id, service]
  );

  if (!serviceData) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:py-14">
        <SectionTitle title="Услуга не найдена" subtitle="Проверьте URL" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link to="/services" className="text-sm font-medium text-eco-700 hover:text-eco-800">
          ← Назад к услугам
        </Link>
      </div>
      <SectionTitle title={serviceData.title} subtitle="Детали услуги" />
      <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-8">
          <Card>
            <h2 className="text-xl font-semibold text-slate-900">Описание</h2>
            <p className="mt-4 text-slate-600 leading-7">{serviceData.details}</p>
          </Card>
          <Card>
            <h3 className="text-xl font-semibold text-slate-900">Что входит</h3>
            <ul className="mt-5 space-y-3 text-slate-600">
              {serviceData.highlights.map((item) => (
                <li key={item} className="rounded-3xl bg-eco-50 p-4">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="text-xl font-semibold text-slate-900">Кому нужна услуга</h3>
            <ul className="mt-5 space-y-3 text-slate-600">
              {serviceData.target.map((item) => (
                <li key={item} className="rounded-3xl bg-eco-50 p-4">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-3xl bg-eco-100 text-3xl grid place-items-center">{serviceData.icon}</div>
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Сроки</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{serviceData.duration}</p>
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="text-xl font-semibold text-slate-900">Документы</h3>
            <ul className="mt-5 space-y-3 text-slate-600">
              {serviceData.documents.map((item) => (
                <li key={item} className="rounded-3xl bg-eco-50 p-4">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Button className="w-full">Заказать услугу</Button>
        </aside>
      </div>
    </div>
  );
};

export default ServiceDetailsPage;
