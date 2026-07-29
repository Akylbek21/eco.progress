import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { documentFlowAccessApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import type { DocumentFlowAccess, DocumentFlowFeature, DocumentFlowPermission } from '../types';
import { getDocumentFlowError } from '../utils/errors';
import { hasDocumentFlowAction, hasDocumentFlowFeature, hasDocumentFlowPermission } from '../utils/access';

type AccessContextValue = {
  access: DocumentFlowAccess;
  can: (permission: DocumentFlowPermission) => boolean;
  hasFeature: (feature: DocumentFlowFeature) => boolean;
  hasAction: (action: string) => boolean;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export const useDocumentFlowAccess = () => {
  const value = useContext(AccessContext);
  if (!value) throw new Error('useDocumentFlowAccess must be used inside DocumentFlowAccessProvider');
  return value;
};

const CenteredState = ({ children }: { children: ReactNode }) => (
  <Box sx={{ minHeight: '65vh', display: 'grid', placeItems: 'center', p: 3 }}>{children}</Box>
);

export const DocumentFlowAccessProvider = ({ children }: { children: ReactNode }) => {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  const accessQuery = useQuery({
    queryKey: documentFlowKeys.access(),
    queryFn: documentFlowAccessApi.get,
    enabled: !authLoading && isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });

  if (authLoading) return <CenteredState><CircularProgress aria-label="Проверка авторизации" /></CenteredState>;
  if (!isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (accessQuery.isPending) return <CenteredState><CircularProgress aria-label="Проверка доступа" /></CenteredState>;
  if (accessQuery.isError) {
    const error = getDocumentFlowError(accessQuery.error, 'Не удалось проверить доступ к документообороту.');
    return (
      <CenteredState>
        <Alert severity="error" sx={{ maxWidth: 620 }}>
          <Typography fontWeight={800}>Проверка доступа не выполнена</Typography>
          <Typography variant="body2">{error.message}</Typography>
          {error.traceId && <Typography variant="caption">Код обращения: {error.traceId}</Typography>}
        </Alert>
      </CenteredState>
    );
  }

  const access = accessQuery.data;
  if (access.status === 'NO_SUBSCRIPTION' || access.status === 'FEATURE_DISABLED') {
    return <Navigate to="/document-flow/access-required" replace />;
  }
  if (access.status === 'SUSPENDED' || (!access.available && !access.readOnly)) {
    return <Navigate to="/document-flow/access-expired" replace />;
  }

  return (
    <AccessContext.Provider value={{
      access,
      can: (permission) => hasDocumentFlowPermission(access, permission),
      hasFeature: (feature) => hasDocumentFlowFeature(access, feature),
      hasAction: (action) => hasDocumentFlowAction(access, action),
    }}>
      {children}
    </AccessContext.Provider>
  );
};

export const DocumentFlowPermissionGuard = ({
  permission,
  feature,
  action,
  children,
}: {
  permission?: DocumentFlowPermission;
  feature?: DocumentFlowFeature;
  action?: string;
  children: ReactNode;
}) => {
  const access = useDocumentFlowAccess();
  const allowed = (!permission || access.can(permission))
    && (!feature || access.hasFeature(feature))
    && (!action || access.hasAction(action));
  return allowed ? <>{children}</> : <Navigate to="/document-flow/access-required" replace />;
};

