import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from '../../layouts/PublicLayout';
import DocumentFlowLandingPage from './pages/DocumentFlowLandingPage';
import DocumentFlowPricingPage from './pages/DocumentFlowPricingPage';

const edoAppUrl = (import.meta.env.VITE_EDO_APP_URL || 'https://edo.ecoprogress.kz').replace(/\/$/, '');

const ExternalEdoRedirect = () => {
  const location = useLocation();

  useEffect(() => {
    const legacy = location.pathname.replace(/^\/document-flow\/app\/?/, '');
    const mappings: Array<[string, string]> = [
      ['requires-my-signature', 'documents/waiting-for-me'],
      ['incoming', 'documents/incoming'],
      ['outgoing', 'documents/outgoing'],
      ['drafts', 'documents/drafts'],
      ['archive', 'documents/archive'],
    ];
    const match = mappings.find(([prefix]) => legacy === prefix || legacy.startsWith(`${prefix}/`));
    const legacyPath = match
      ? `/${legacy.replace(match[0], match[1])}`
      : `/${legacy || 'dashboard'}`;
    window.location.replace(`${edoAppUrl}${legacyPath}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search]);

  return (
    <PublicLayout>
      <main className="mx-auto min-h-[50vh] max-w-3xl px-5 py-20 text-center">
        <h1 className="text-3xl font-black text-eco-950">Переходим в EcoProgress EDO</h1>
        <p className="mt-4 text-slate-600">Защищённый кабинет работает на отдельном домене.</p>
        <a className="mt-8 inline-flex rounded-full bg-eco-900 px-6 py-3 font-bold text-white" href={edoAppUrl}>
          Открыть EDO
        </a>
      </main>
    </PublicLayout>
  );
};

const DocumentFlowRoutes = () => (
  <Routes>
    <Route index element={<PublicLayout><DocumentFlowLandingPage /></PublicLayout>} />
    <Route path="pricing" element={<PublicLayout><DocumentFlowPricingPage /></PublicLayout>} />
    <Route path="app/*" element={<ExternalEdoRedirect />} />
    <Route path="*" element={<Navigate to="/document-flow" replace />} />
  </Routes>
);

export default DocumentFlowRoutes;
