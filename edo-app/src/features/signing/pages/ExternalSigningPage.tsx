import { useState } from 'react';
import { Alert, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DrawIcon from '@mui/icons-material/Draw';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { edoApiClient } from '../../../shared/api/edoApiClient';
import { createDetachedCms } from '../../../shared/lib/ncalayer';
import { PageSkeleton, QueryError } from '../../../shared/components/QueryState';
import { mapApiError } from '../../../shared/api/apiError';

type ExternalDocument = { sender: string; title: string; status: string; version: number; hash: string; canSign: boolean; canReject: boolean; signingDataBase64?: string };

export const ExternalSigningPage = () => {
  const { token = '' } = useParams();
  const client = useQueryClient();
  const [state, setState] = useState<string>();
  const [error, setError] = useState<string>();
  const query = useQuery({ queryKey: ['external-sign', token], queryFn: async ({ signal }) => (await edoApiClient.get<ExternalDocument>(`/external-sign/${token}`, { signal })).data, retry: false });
  const sign = async () => {
    if (!query.data?.canSign || !query.data.signingDataBase64) return;
    try {
      setState('Подключение к NCALayer…');
      const cmsSignatureBase64 = await createDetachedCms(query.data.signingDataBase64, setState);
      setState('Сервер проверяет подпись…');
      await edoApiClient.post(`/external-sign/${token}/signature`, { version: query.data.version, hash: query.data.hash, cmsSignatureBase64 });
      await client.invalidateQueries({ queryKey: ['external-sign', token] });
      setState('Подпись проверена сервером.');
    } catch (requestError) { setError(mapApiError(requestError).message); }
  };
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 } }}><Stack spacing={2.5}>{state && <Alert severity={state.includes('проверена') ? 'success' : 'info'} aria-live="polite">{state}</Alert>}{error && <Alert severity="error">{error}</Alert>}<Typography variant="overline">Отправитель: {query.data.sender}</Typography><Stack direction="row" justifyContent="space-between"><Typography variant="h4" fontWeight={900}>{query.data.title}</Typography><Chip label={query.data.status} /></Stack><Typography color="text.secondary">Версия {query.data.version} · hash {query.data.hash}</Typography><Alert severity="info">Внешний подписант видит только этот документ. Доступ к организации и другим данным отсутствует.</Alert><Stack direction="row" gap={2}><Button startIcon={<DownloadIcon />}>Скачать</Button>{query.data.canSign && <Button variant="contained" color="success" startIcon={<DrawIcon />} onClick={() => void sign()}>Подписать</Button>}{query.data.canReject && <Button color="warning">Отклонить</Button>}</Stack></Stack></Paper>;
};
