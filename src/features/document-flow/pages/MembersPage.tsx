import { Stack, Typography } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { hasPermission } from '../model/access';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import BackendContractBlocker from '../components/BackendContractBlocker';

export default function MembersPage() {
  const access = useDocumentFlowContext();
  if (!hasPermission(access, 'MANAGE_MEMBERS')) return <Navigate to="/document-flow/documents" replace />;
  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={800}>Сотрудники и доступ</Typography>
      <BackendContractBlocker
        title="Управление участниками недоступно"
        reason="В проверенной версии backend нет controller и DTO для списка или изменения участников. Доступен только внутренний membership repository, который frontend вызывать не может."
        technicalCode="DF_MEMBER_API_MISSING"
        endpoint="/api/document-flow/members"
      />
    </Stack>
  );
}
