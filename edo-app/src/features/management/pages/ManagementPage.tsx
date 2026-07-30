import { Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { managementApi } from '../api/managementApi';
import { EmptyState, PageSkeleton, QueryError } from '../../../shared/components/QueryState';
import { useAuthStore } from '../../../shared/auth/authStore';

type Props = { resource: string; title: string; description: string };

export const ManagementPage = ({ resource, title, description }: Props) => {
  const organizationId = useAuthStore((state) => state.activeOrganizationId);
  const query = useQuery({
    queryKey: ['organization', organizationId, resource, 'list'],
    queryFn: ({ signal }) => managementApi.list(resource, signal),
    enabled: Boolean(organizationId),
  });
  return <Stack spacing={3}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}><div><Typography variant="h4" fontWeight={900}>{title}</Typography><Typography color="text.secondary">{description}</Typography></div></Stack>{query.isLoading ? <PageSkeleton /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : !query.data?.items.length ? <EmptyState title={`${title}: записей нет`} text="Backend не вернул доступные записи." /> : <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Название / ФИО</TableCell><TableCell>Email</TableCell><TableCell>Роль</TableCell><TableCell>Статус</TableCell><TableCell>Действия</TableCell></TableRow></TableHead><TableBody>{query.data.items.map((item) => <TableRow key={item.id}><TableCell><Typography fontWeight={700}>{item.title || item.name || item.id}</Typography></TableCell><TableCell>{item.email || '—'}</TableCell><TableCell>{item.role || '—'}</TableCell><TableCell><Chip size="small" label={item.status || '—'} /></TableCell><TableCell>{item.availableActions?.join(', ') || 'Только просмотр'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}</Stack>;
};
