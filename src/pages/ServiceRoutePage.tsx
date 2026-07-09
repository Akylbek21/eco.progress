import { useParams } from 'react-router-dom';
import ServiceDetailsPage from './ServiceDetailsPage';
import ServiceLandingPage, { serviceLandingSlugs } from './ServiceLandingPage';

const ServiceRoutePage = () => {
  const { id } = useParams();
  if (id && serviceLandingSlugs.includes(id)) return <ServiceLandingPage slug={id} />;
  return <ServiceDetailsPage />;
};

export default ServiceRoutePage;
