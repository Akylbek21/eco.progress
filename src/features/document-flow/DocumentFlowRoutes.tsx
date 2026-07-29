import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../../layouts/PublicLayout';
import { DocumentFlowAccessProvider } from './access/DocumentFlowAccessProvider';
import DocumentFlowLayout from './layout/DocumentFlowLayout';
import DocumentFlowLandingPage from './pages/DocumentFlowLandingPage';
import DocumentFlowPricingPage from './pages/DocumentFlowPricingPage';
import DocumentFlowAccessPage from './pages/DocumentFlowAccessPage';
import DocumentFlowDashboardPage from './pages/DocumentFlowDashboardPage';
import DocumentFlowDocumentsPage from './pages/DocumentFlowDocumentsPage';
import DocumentFlowCreatePage from './pages/DocumentFlowCreatePage';
import DocumentFlowDocumentPage from './pages/DocumentFlowDocumentPage';
import DocumentFlowManagementPage from './pages/DocumentFlowManagementPage';
import DocumentFlowSubscriptionPage from './pages/DocumentFlowSubscriptionPage';

const Protected = ({ children }: { children: React.ReactNode }) => (
  <DocumentFlowAccessProvider><DocumentFlowLayout>{children}</DocumentFlowLayout></DocumentFlowAccessProvider>
);

const DocumentFlowRoutes = () => (
  <Routes>
    <Route index element={<PublicLayout><DocumentFlowLandingPage /></PublicLayout>} />
    <Route path="pricing" element={<PublicLayout><DocumentFlowPricingPage /></PublicLayout>} />
    <Route path="access-required" element={<PublicLayout><DocumentFlowAccessPage /></PublicLayout>} />
    <Route path="access-expired" element={<PublicLayout><DocumentFlowAccessPage expired /></PublicLayout>} />
    <Route path="app" element={<Navigate to="dashboard" replace />} />
    <Route path="app/dashboard" element={<Protected><DocumentFlowDashboardPage /></Protected>} />
    <Route path="app/incoming" element={<Protected><DocumentFlowDocumentsPage /></Protected>} />
    <Route path="app/incoming/:documentType" element={<Protected><DocumentFlowDocumentsPage /></Protected>} />
    <Route path="app/outgoing" element={<Protected><DocumentFlowDocumentsPage /></Protected>} />
    <Route path="app/outgoing/:documentType" element={<Protected><DocumentFlowDocumentsPage /></Protected>} />
    <Route path="app/requires-my-signature" element={<Protected><DocumentFlowDocumentsPage /></Protected>} />
    <Route path="app/drafts" element={<Protected><DocumentFlowDocumentsPage /></Protected>} />
    <Route path="app/archive" element={<Protected><DocumentFlowDocumentsPage /></Protected>} />
    <Route path="app/documents/create" element={<Protected><DocumentFlowCreatePage /></Protected>} />
    <Route path="app/documents/:documentId" element={<Protected><DocumentFlowDocumentPage /></Protected>} />
    <Route path="app/documents/:documentId/sign" element={<Protected><DocumentFlowDocumentPage /></Protected>} />
    <Route path="app/documents/:documentId/history" element={<Protected><DocumentFlowDocumentPage /></Protected>} />
    <Route path="app/documents/:documentId/versions" element={<Protected><DocumentFlowDocumentPage /></Protected>} />
    <Route path="app/revocation-requests" element={<Protected><DocumentFlowManagementPage kind="revocation-requests" /></Protected>} />
    <Route path="app/revocation-requests/:requestId" element={<Protected><DocumentFlowManagementPage kind="revocation-requests" /></Protected>} />
    <Route path="app/counterparties" element={<Protected><DocumentFlowManagementPage kind="counterparties" /></Protected>} />
    <Route path="app/counterparties/:counterpartyId" element={<Protected><DocumentFlowManagementPage kind="counterparties" /></Protected>} />
    <Route path="app/members" element={<Protected><DocumentFlowManagementPage kind="members" /></Protected>} />
    <Route path="app/templates" element={<Protected><DocumentFlowManagementPage kind="templates" /></Protected>} />
    <Route path="app/audit" element={<Protected><DocumentFlowManagementPage kind="audit" /></Protected>} />
    <Route path="app/settings" element={<Protected><DocumentFlowManagementPage kind="settings" /></Protected>} />
    <Route path="app/settings/subscription" element={<Protected><DocumentFlowSubscriptionPage /></Protected>} />
    <Route path="app/settings/notifications" element={<Protected><DocumentFlowManagementPage kind="notifications" /></Protected>} />
    <Route path="*" element={<Navigate to="/document-flow" replace />} />
  </Routes>
);

export default DocumentFlowRoutes;

