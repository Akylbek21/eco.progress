import { Alert, Box, Container, Paper, Stack, Typography } from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';
import { hasPermission } from '../model/access';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';

export default function DocumentFlowLayout() {
  const access = useDocumentFlowContext();
  const links = [
    ['/document-flow/documents', 'Документы', true],
    ['/document-flow/documents?requiresMySignature=true', 'Ожидают моей подписи', true],
    ['/document-flow/counterparties', 'Контрагенты', hasPermission(access, 'VIEW_DOCUMENTS')],
    ['/document-flow/members', 'Сотрудники и доступ', hasPermission(access, 'MANAGE_MEMBERS')],
    ['/document-flow/archive', 'Архив', true],
  ] as const;
  return (
    <Box minHeight="100vh" bgcolor="#f4f7f6">
      <Paper square elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Typography variant="h5" fontWeight={800}>Документооборот</Typography>
          <Stack direction="row" gap={1} mt={2} overflow="auto">
            {links.filter(([, , visible]) => visible).map(([to, label]) => (
              <Box key={to} component={NavLink} to={to} sx={{ px: 2, py: 1, whiteSpace: 'nowrap', borderRadius: 2, textDecoration: 'none', color: 'text.primary', '&.active': { bgcolor: 'primary.main', color: 'white' } }}>{label}</Box>
            ))}
          </Stack>
        </Container>
      </Paper>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {access.readOnly && <Alert severity="warning" sx={{ mb: 2 }}>Доступ только для чтения.</Alert>}
        <Outlet />
      </Container>
    </Box>
  );
}
