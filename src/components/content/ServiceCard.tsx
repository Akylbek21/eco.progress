import { Link } from 'react-router-dom';
import { type ServiceItem } from '../../data/mockData';
import Button from '../ui/Button';

const ServiceCard = ({ service }: { service: ServiceItem }) => {
  return (
    <div className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-eco-100 text-2xl">{service.icon}</div>
      <h3 className="mb-3 text-xl font-semibold text-slate-900">{service.title}</h3>
      <p className="mb-6 text-slate-600">{service.description}</p>
      <div className="flex flex-wrap gap-3">
        <Link to={`/services/${service.id}`} className="inline-flex items-center">
          <Button variant="secondary">Подробнее</Button>
        </Link>
        <Button variant="primary">Заказать</Button>
      </div>
    </div>
  );
};

export default ServiceCard;
