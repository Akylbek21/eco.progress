import { Alert, Box, Container, FormControl, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';
import { hasPermission } from '../model/access';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import { useDocumentFlowTenant } from '../hooks/useDocumentFlowTenant';
import { useAuth } from '../../../contexts/AuthContext';

export default function DocumentFlowLayout() {
  const access = useDocumentFlowContext();
  const tenant = useDocumentFlowTenant();
  const { isStaff } = useAuth();
  const links = isStaff ? [
    ['/document-flow/documents', 'Документы', true],
    ['/document-flow/documents?requiresMySignature=true', 'Ожидают моей подписи', true],
  ] as const : [
    ['/document-flow/dashboard', 'Обзор', true],
    ['/document-flow/documents', 'Документы', true],
    ['/document-flow/documents?requiresMySignature=true', 'Ожидают моей подписи', true],
    ['/document-flow/counterparties', 'Контрагенты', hasPermission(access, 'VIEW_DOCUMENTS')],
    ['/document-flow/members', 'Сотрудники и доступ', hasPermission(access, 'MANAGE_MEMBERS')],
    ['/document-flow/archive', 'Архив', true],
    ['/document-flow/subscription', 'Подписка', hasPermission(access, 'MANAGE_SUBSCRIPTION')],
    ['/document-flow/settings', 'Настройки', hasPermission(access, 'MANAGE_SUBSCRIPTION')],
  ] as const;
  return (
    <Box minHeight="100vh" bgcolor="#f4f7f6">
      <Paper square elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} alignItems={{ md: 'center' }}>
            <Typography variant="h5" fontWeight={800}>Документооборот</Typography>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <Select
                aria-label="Активная организация"
                value={tenant.organizationId ?? ''}
                onChange={(event) => tenant.selectOrganization(Number(event.target.value))}
              >
                {tenant.organizations.map((organization) => <MenuItem key={organization.id} value={organization.id}>{organization.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
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
