import { useEffect, useState } from 'react';
import { Alert, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import DrawIcon from '@mui/icons-material/Draw';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createDetachedCms } from '../../../shared/lib/ncalayer';
import { PageSkeleton, QueryError } from '../../../shared/components/QueryState';
import { mapApiError } from '../../../shared/api/apiError';
import { externalSigningApi } from '../api/externalSigningApi';
import {
  clearSensitiveSigningState,
  createSensitiveSigningState,
} from '../../../shared/security/sensitiveSigningState';

export const ExternalSigningPage = () => {
  const { token = '' } = useParams();
  const client = useQueryClient();
  const [state, setState] = useState<string>();
  const [error, setError] = useState<string>();
  const queryKey = ['external-sign', token] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => externalSigningApi.get(token, signal),
    retry: false,
    gcTime: 0,
  });
  useEffect(() => () => {
    clearSensitiveSigningState();
    const sensitiveQueryKey = ['external-sign', token] as const;
    void client.cancelQueries({ queryKey: sensitiveQueryKey })
      .finally(() => client.removeQueries({ queryKey: sensitiveQueryKey }));
  }, [client, token]);
  const sign = async () => {
    if (!query.data?.canSign || !query.data.signingDataBase64) return;
    const sensitiveState = createSensitiveSigningState();
    let cmsSignatureBase64: string | undefined;
    try {
      setState('Подключение к NCALayer…');
      sensitiveState.setSigningData(query.data.signingDataBase64);
      cmsSignatureBase64 = await createDetachedCms(query.data.signingDataBase64, setState);
      sensitiveState.setCms(cmsSignatureBase64);
      setState('Сервер проверяет подпись…');
      await externalSigningApi.submit(token, query.data, cmsSignatureBase64);
      await client.invalidateQueries({ queryKey: ['external-sign', token] });
      setState('Подпись проверена сервером.');
    } catch (requestError) {
      setError(mapApiError(requestError).message);
    } finally {
      sensitiveState.clear();
    }
  };
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 } }}><Stack spacing={2.5}>{state && <Alert severity={state.includes('проверена') ? 'success' : 'info'} aria-live="polite">{state}</Alert>}{error && <Alert severity="error">{error}</Alert>}<Typography variant="overline">Отправитель: {query.data.sender}</Typography><Stack direction="row" justifyContent="space-between"><Typography variant="h4" fontWeight={900}>{query.data.title}</Typography><Chip label={query.data.status} /></Stack><Typography color="text.secondary">Версия {query.data.version} · hash {query.data.hash}</Typography><Alert severity="info">Внешний подписант видит только этот документ. Доступ к организации и другим данным отсутствует.</Alert>{query.data.canSign && <Button variant="contained" color="success" startIcon={<DrawIcon />} onClick={() => void sign()}>Подписать</Button>}</Stack></Paper>;
};
