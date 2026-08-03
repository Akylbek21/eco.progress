import { Alert, Stack, Typography } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { hasPermission } from '../model/access';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';

export default function MembersPage() {
  const access = useDocumentFlowContext();
  if (!hasPermission(access, 'MANAGE_MEMBERS')) return <Navigate to="/document-flow/documents" replace />;
  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={800}>Сотрудники и доступ</Typography>
      <Alert severity="warning">
        Backend пока не предоставляет API списка и управления сотрудниками `/api/document-flow/members`. Выдача доступа из интерфейса отключена, чтобы не имитировать изменение прав локально.
      </Alert>
    </Stack>
  );
}
