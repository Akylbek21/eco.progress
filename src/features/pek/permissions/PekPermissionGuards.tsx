import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekAvailableAction, PekAvailableActionCode } from '../api/pekContracts';
import { PekState } from '../components/common/PekUi';
import { canUsePekPermission } from './pekAccess';

type GuardProps = { permission: string; children: ReactNode; message?: string };

export const PekPermissionGuard = ({ permission, children, message }: GuardProps) => {
  const { user, loading } = useAuth();
  if (loading) return <div aria-busy="true" className="h-24 animate-pulse rounded-2xl bg-slate-200" />;
  if (!canUsePekPermission(user, permission)) {
    return <PekState title="Недостаточно прав" message={message || 'Обратитесь к администратору для получения доступа.'} />;
  }
  return <>{children}</>;
};

export const PekRouteGuard = ({ permission, children, message }: GuardProps) => {
  const location = useLocation();
  const { user, loading } = useAuth();
  if (loading) return <div aria-busy="true" className="h-24 animate-pulse rounded-2xl bg-slate-200" />;
  if (!user) return <Navigate to="/staff/login" replace state={{ from: location }} />;
  if (!canUsePekPermission(user, permission)) return <PekState title="Недостаточно прав" message={message || 'Этот маршрут недоступен для вашей учётной записи.'} />;
  return <>{children}</>;
};

export const PekActionGuard = ({
  action,
  code,
  permission,
  children,
}: {
  action?: PekAvailableAction;
  code: PekAvailableActionCode;
  permission?: string;
  children: ReactNode;
}) => {
  const { user } = useAuth();
  if (!action || action.code !== code || !action.enabled) return null;
  if (permission && !canUsePekPermission(user, permission)) return null;
  return <>{children}</>;
};
