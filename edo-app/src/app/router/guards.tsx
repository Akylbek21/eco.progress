import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthSession } from '../../features/auth/hooks/useAuthSession';
import { useAuthStore } from '../../shared/auth/authStore';
import { FullScreenLoader } from '../../shared/components/QueryState';

export const AuthenticatedGuard = () => {
  const location = useLocation();
  const query = useAuthSession();
  const setStatus = useAuthStore((state) => state.setStatus);
  useEffect(() => {
    if (query.isSuccess) setStatus('AUTHENTICATED');
    if (query.isError) setStatus('ANONYMOUS');
  }, [query.isSuccess, query.isError, setStatus]);
  if (query.isLoading) return <FullScreenLoader />;
  if (query.isError || !query.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!query.data.user.emailVerified && location.pathname !== '/verify-email') return <Navigate to="/verify-email" replace />;
  return <Outlet />;
};

export const AppGuard = () => {
  const query = useAuthSession();
  const activeOrganizationId = useAuthStore((state) => state.activeOrganizationId);
  const setActive = useAuthStore((state) => state.setActiveOrganization);
  const defaultOrganizationId = query.data?.activeOrganizationId
    || (query.data?.organizations.length === 1 ? query.data.organizations[0]?.organizationId : undefined);
  useEffect(() => {
    if (!activeOrganizationId && defaultOrganizationId) setActive(defaultOrganizationId);
  }, [activeOrganizationId, defaultOrganizationId, setActive]);
  if (query.isLoading) return <FullScreenLoader />;
  if (!query.data) return <Navigate to="/login" replace />;
  if (!query.data.organizations.length) return <Navigate to="/onboarding" replace />;
  const active = activeOrganizationId || defaultOrganizationId;
  if (!active) return <Navigate to="/select-organization" replace />;
  if (!query.data.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
};

export const PermissionGuard = ({ permission, children }: { permission: string; children: ReactNode }) => {
  const query = useAuthSession();
  const activeOrganizationId = useAuthStore((state) => state.activeOrganizationId);
  const membership = query.data?.organizations.find((item) => item.organizationId === activeOrganizationId);
  return membership?.permissions.includes(permission) ? <>{children}</> : <Navigate to="/access-denied" replace />;
};
