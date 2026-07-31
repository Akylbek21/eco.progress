import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import DocumentFlowGate from './components/DocumentFlowGate';
import DocumentFlowLayout from './layout/DocumentFlowLayout';

const DocumentFlowPricingPage = lazy(() => import('./pages/DocumentFlowPricingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const CreateDocumentPage = lazy(() => import('./pages/CreateDocumentPage'));
const DocumentDetailsPage = lazy(() => import('./pages/DocumentDetailsPage'));
const CounterpartiesPage = lazy(() => import('./pages/CounterpartiesPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function DocumentFlowRoutes() {
  return (
    <Routes>
      <Route path="plans" element={<DocumentFlowPricingPage />} />
      <Route element={<DocumentFlowGate />}>
        <Route element={<DocumentFlowLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="access" element={<DashboardPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/new" element={<CreateDocumentPage />} />
          <Route path="documents/:id" element={<DocumentDetailsPage />} />
          <Route path="counterparties" element={<CounterpartiesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/document-flow" replace />} />
    </Routes>
  );
}
