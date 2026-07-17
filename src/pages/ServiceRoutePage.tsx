import { Navigate, useParams } from 'react-router-dom';
import ServiceDetailsPage from './ServiceDetailsPage';
import ServiceLandingPage, { serviceLandingSlugs } from './ServiceLandingPage';
import { normalizeServiceSlug } from '../content/serviceCatalog';

const ServiceRoutePage = () => {
  const { id } = useParams();
  const canonicalSlug = id ? normalizeServiceSlug(id) : '';
  if (id && canonicalSlug !== id) return <Navigate to={`/services/${canonicalSlug}`} replace />;
  if (canonicalSlug && serviceLandingSlugs.includes(canonicalSlug)) return <ServiceLandingPage slug={canonicalSlug} />;
  return <ServiceDetailsPage />;
};

export default ServiceRoutePage;
