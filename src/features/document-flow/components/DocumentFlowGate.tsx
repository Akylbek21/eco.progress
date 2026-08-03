import { createContext, useContext } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import type { AccessContext } from '../model/types';
import { useDocumentFlowAccess } from '../hooks/useDocumentFlowAccess';

const Context = createContext<AccessContext | null>(null);

export const useDocumentFlowContext = () => {
  const value = useContext(Context);
  if (!value) throw new Error('DocumentFlowGate is missing');
  return value;
};

export default function DocumentFlowGate() {
  const { isAuthenticated, loading } = useAuth();
  const access = useDocumentFlowAccess();

  if ((!isAuthenticated && loading) || access.isLoading) {
    return <Box minHeight="70vh" display="grid" sx={{ placeItems: 'center' }}><CircularProgress /></Box>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (access.isError) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error" action={<Button onClick={() => access.refetch()}>Повторить</Button>}>
          Не удалось проверить доступ к документообороту.
        </Alert>
      </Container>
    );
  }
  if (!access.data?.available) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={2}>
          <Typography variant="h4" fontWeight={800}>Документооборот</Typography>
          <Alert severity="warning">{access.data?.reason || 'У вас пока нет доступа к документообороту.'}</Alert>
        </Stack>
      </Container>
    );
  }
  return <Context.Provider value={access.data}><Outlet /></Context.Provider>;
}
