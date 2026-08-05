import { Alert, Button, Card, CardContent, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { canMutate } from '../model/access';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import { useDocumentFlowTenant } from '../hooks/useDocumentFlowTenant';

const directionLabels: Record<string, string> = { INCOMING: 'Входящие', OUTGOING: 'Исходящие', INTERNAL: 'Внутренние' };

export default function DashboardPage() {
  const access = useDocumentFlowContext();
  const tenant = useDocumentFlowTenant();
  const query = useQuery({
    queryKey: tenant.tenantScope ? documentFlowKeys.dashboard(tenant.tenantScope) : ['document-flow', 'tenant-unresolved', 'dashboard'],
    queryFn: ({ signal }) => documentFlowApi.dashboard(undefined, signal),
    enabled: tenant.organizationResolved,
  });
  if (query.isLoading) return <Grid container spacing={2}>{[1, 2, 3, 4].map((key) => <Grid size={{ xs: 12, sm: 6, md: 3 }} key={key}><Skeleton height={130} /></Grid>)}</Grid>;
  if (query.isError) return <Alert severity="error" action={<Button onClick={() => query.refetch()}>Повторить</Button>}>{query.error.message}</Alert>;
  const data = query.data;
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Typography variant="h4" fontWeight={800}>Dashboard</Typography>
        {canMutate(access, 'CREATE_DOCUMENT', 'DOCUMENT_CREATE') && <Button component={Link} to="/document-flow/documents/new" variant="contained">Создать документ</Button>}
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><Card><CardContent><Typography color="text.secondary">Всего документов</Typography><Typography variant="h3">{data?.total ?? 0}</Typography></CardContent></Card></Grid>
        {Object.entries(data?.byDirection || {}).map(([direction, count]) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={direction}><Card><CardContent><Typography color="text.secondary">{directionLabels[direction] || direction}</Typography><Typography variant="h3">{count}</Typography></CardContent></Card></Grid>
        ))}
      </Grid>
      <Card><CardContent><Typography variant="h6" fontWeight={700}>По статусам</Typography>
        <Grid container spacing={2} mt={0}>{Object.entries(data?.byStatus || {}).map(([status, count]) => <Grid size={{ xs: 6, md: 3 }} key={status}><Typography variant="body2" color="text.secondary">{status}</Typography><Typography variant="h5">{count}</Typography></Grid>)}</Grid>
      </CardContent></Card>
    </Stack>
  );
}
