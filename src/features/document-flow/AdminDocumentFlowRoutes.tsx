import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import StaffLayout from '../../layouts/StaffLayout';
import { AdminAccessGrantsPage, AdminPlansPage, AdminSubscriptionsPage } from './pages/AdminPages';

export default function AdminDocumentFlowRoutes() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/staff/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/staff" replace />;
  return (
    <StaffLayout>
      <Routes>
        <Route path="plans" element={<AdminPlansPage />} />
        <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
        <Route path="access-grants" element={<AdminAccessGrantsPage />} />
        <Route path="*" element={<Navigate to="plans" replace />} />
      </Routes>
    </StaffLayout>
  );
}
