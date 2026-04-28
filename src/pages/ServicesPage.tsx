import { useQuery } from '@tanstack/react-query';
import SectionTitle from '../components/ui/SectionTitle';
import ServiceCard from '../components/content/ServiceCard';
import { getServices } from '../services/serviceService';
import { services as servicesData } from '../data/mockData';

const ServicesPage = () => {
  const { data: services = servicesData } = useQuery({ queryKey: ['services'], queryFn: getServices });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:py-14">
      <SectionTitle title="Услуги Eco.Progress" subtitle="Экологические решения" />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </div>
  );
};

export default ServicesPage;
