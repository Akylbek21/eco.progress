import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AnalyticsRouteTracker from './components/AnalyticsRouteTracker';
import PageLoader, { RouteProgressProvider } from './components/loading/PageLoader';
import ScrollToTop from './components/ScrollToTop';
import PublicLayout from './layouts/PublicLayout';
import { publicRouteLoaders } from './utils/publicRoutePreload';

const HomePage = lazy(publicRouteLoaders.home);
const AboutPage = lazy(publicRouteLoaders.about);
const ServicesPage = lazy(publicRouteLoaders.services);
const SeoLandingPage = lazy(() => import('./pages/SeoLandingPage'));
const ServiceLandingPage = lazy(() => import('./pages/ServiceLandingPage'));
const ServiceRoutePage = lazy(() => import('./pages/ServiceRoutePage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const TariffsPage = lazy(() => import('./pages/TariffsPage'));
const NewsPage = lazy(publicRouteLoaders.news);
const NewsDetailsPage = lazy(() => import('./pages/NewsDetailsPage'));
const CasesPage = lazy(() => import('./pages/CasesPage'));
const CaseDetailsPage = lazy(() => import('./pages/CaseDetailsPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const ContactsPage = lazy(publicRouteLoaders.contacts);
const RegionsPage = lazy(publicRouteLoaders.regions);
const SearchPage = lazy(() => import('./pages/SearchPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const QueryRuntime = lazy(() => import('./runtime/QueryRuntime'));

const PublicRoute = ({ children }: { children: React.ReactNode }) => <PublicLayout>{children}</PublicLayout>;

const PublicRoutes = () => (
  <Routes>
            <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
            <Route path="/about" element={<PublicRoute><AboutPage /></PublicRoute>} />
            <Route path="/services" element={<PublicRoute><ServicesPage /></PublicRoute>} />
            <Route path="/services/ecological-documents" element={<PublicRoute><ServiceLandingPage slug="ecological-documents" /></PublicRoute>} />
            <Route path="/services/waste-transportation" element={<PublicRoute><ServiceLandingPage slug="waste-transportation" /></PublicRoute>} />
            <Route path="/services/waste-recycling" element={<PublicRoute><ServiceLandingPage slug="waste-recycling" /></PublicRoute>} />
            <Route path="/services/laboratory-tests" element={<PublicRoute><ServiceLandingPage slug="laboratory-tests" /></PublicRoute>} />
            <Route path="/services/poligon-tbo" element={<PublicRoute><ServiceLandingPage slug="poligon-tbo" /></PublicRoute>} />
            <Route path="/services/environmental-audit" element={<PublicRoute><ServiceLandingPage slug="environmental-audit" /></PublicRoute>} />
            <Route path="/services/:id" element={<PublicRoute><ServiceRoutePage /></PublicRoute>} />
            <Route path="/tariffs" element={<PublicRoute><TariffsPage /></PublicRoute>} />
            <Route path="/employees" element={<PublicRoute><EmployeesPage /></PublicRoute>} />
            <Route path="/partners" element={<PublicRoute><PartnersPage /></PublicRoute>} />
            <Route path="/news" element={<PublicRoute><NewsPage /></PublicRoute>} />
            <Route path="/news/:id" element={<PublicRoute><NewsDetailsPage /></PublicRoute>} />
            <Route path="/cases" element={<PublicRoute><CasesPage /></PublicRoute>} />
            <Route path="/cases/:slug" element={<PublicRoute><CaseDetailsPage /></PublicRoute>} />
            <Route path="/faq" element={<PublicRoute><FaqPage /></PublicRoute>} />
            <Route path="/contacts" element={<PublicRoute><ContactsPage /></PublicRoute>} />
            <Route path="/regions" element={<PublicRoute><RegionsPage /></PublicRoute>} />
            <Route path="/search" element={<PublicRoute><SearchPage /></PublicRoute>} />
            <Route path="/shtrafy-za-ekologiyu-kazakhstan" element={<Navigate to="/news/shtrafy-za-ekologicheskie-narusheniya" replace />} />
            <Route path="/shtrafy-za-ekologicheskie-narusheniya-kazakhstan" element={<Navigate to="/news/shtrafy-za-ekologicheskie-narusheniya" replace />} />
            <Route path="/:seoSlug" element={<PublicRoute><SeoLandingPage /></PublicRoute>} />
            <Route path="*" element={<PublicRoute><NotFoundPage /></PublicRoute>} />
  </Routes>
);

const routesWithoutQueries = new Set(['/', '/about', '/partners', '/tariffs', '/faq', '/contacts', '/regions', '/search']);

export default function PublicApp() {
  const { pathname } = useLocation();
  const routes = <PublicRoutes />;
  return (
    <RouteProgressProvider>
      <div className="min-h-screen bg-eco-50 text-slate-900">
        <ScrollToTop />
        <AnalyticsRouteTracker />
        <Suspense fallback={<PublicLayout><PageLoader /></PublicLayout>}>
          {routesWithoutQueries.has(pathname) ? routes : <QueryRuntime>{routes}</QueryRuntime>}
        </Suspense>
      </div>
    </RouteProgressProvider>
  );
}
