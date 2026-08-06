import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import DocumentFlowGate from './components/DocumentFlowGate';
import DocumentFlowLayout from './layout/DocumentFlowLayout';

const DocumentFlowPricingPage = lazy(() => import('./pages/DocumentFlowPricingPage'));
const DocumentFlowLandingPage = lazy(() => import('./pages/DocumentFlowLandingPage'));
const DocumentFlowLoginPage = lazy(() => import('../../pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const CreateDocumentPage = lazy(() => import('./pages/CreateDocumentPage'));
const DocumentDetailsPage = lazy(() => import('./pages/DocumentDetailsPage'));
const CounterpartiesPage = lazy(() => import('./pages/CounterpartiesPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));

export default function DocumentFlowRoutes() {
  return (
    <Routes>
      <Route index element={<DocumentFlowLandingPage />} />
      <Route path="request" element={<DocumentFlowLandingPage requestInitiallyOpen />} />
      <Route path="login" element={<DocumentFlowLoginPage documentFlow />} />
      <Route path="plans" element={<DocumentFlowPricingPage />} />
      <Route element={<DocumentFlowGate />}>
        <Route element={<DocumentFlowLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="access" element={<Navigate to="/document-flow/members" replace />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/new" element={<CreateDocumentPage />} />
          <Route path="documents/:id" element={<DocumentDetailsPage />} />
          <Route path="counterparties" element={<CounterpartiesPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="archive" element={<Navigate to="/document-flow/documents?status=ARCHIVED" replace />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/document-flow" replace />} />
    </Routes>
  );
}
