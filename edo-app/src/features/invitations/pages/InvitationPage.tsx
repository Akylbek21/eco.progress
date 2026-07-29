import { useState } from 'react';
import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { edoApiClient } from '../../../shared/api/edoApiClient';
import { PageSkeleton, QueryError } from '../../../shared/components/QueryState';

export const InvitationPage = () => {
  const { token = '' } = useParams();
  const [result, setResult] = useState<string>();
  const query = useQuery({ queryKey: ['invitation', token], queryFn: async ({ signal }) => (await edoApiClient.get<{ organizationName: string; role: string; emailMasked: string; status: string }>(`/invitations/${token}`, { signal })).data, retry: false });
  const mutation = useMutation({ mutationFn: async (action: 'accept' | 'decline') => edoApiClient.post(`/invitations/${token}/${action}`), onSuccess: (_, action) => setResult(action === 'accept' ? 'Приглашение принято.' : 'Приглашение отклонено.') });
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  return <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}>{result && <Alert severity="success">{result}</Alert>}<Typography variant="h4" fontWeight={900}>Приглашение</Typography><Typography>Организация: <b>{query.data.organizationName}</b></Typography><Typography>Роль: {query.data.role}</Typography><Typography>Email: {query.data.emailMasked}</Typography><Stack direction="row" gap={2}><Button variant="contained" onClick={() => mutation.mutate('accept')}>Принять</Button><Button color="inherit" onClick={() => mutation.mutate('decline')}>Отклонить</Button></Stack></Stack></Paper>;
};
