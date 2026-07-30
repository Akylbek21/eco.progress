import { useState } from 'react';
import { Alert, Box, Button, Chip, Divider, LinearProgress, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DrawIcon from '@mui/icons-material/Draw';
import LaunchIcon from '@mui/icons-material/Launch';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api/documentsApi';
import { documentKeys } from '../api/documentKeys';
import { useDocument } from '../hooks/useDocuments';
import { PageSkeleton, QueryError } from '../../../shared/components/QueryState';
import { signingApi } from '../../signing/api/signingApi';
import { createDetachedCms } from '../../../shared/lib/ncalayer';
import { mapApiError } from '../../../shared/api/apiError';
import { useAuthStore } from '../../../shared/auth/authStore';
import { downloadAuthorizedFile } from '../../../shared/lib/authorizedDownload';
import { createSensitiveSigningState } from '../../../shared/security/sensitiveSigningState';

const can = (actions: string[], action: string) => actions.includes(action);

export const DocumentDetailsPage = ({ initialTab = 0, openSigning = false }: { initialTab?: number; openSigning?: boolean }) => {
  const { documentId = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const organizationId = useAuthStore((state) => state.activeOrganizationId);
  const query = useDocument(documentId);
  const [tab, setTab] = useState(initialTab);
  const [signingState, setSigningState] = useState<string>();
  const [error, setError] = useState<string>();
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  const document = query.data;
  const progress = document.signatureProgress ? Math.round(document.signatureProgress.signed / Math.max(1, document.signatureProgress.total) * 100) : 0;
  const assignment = document.signingRoute.flatMap((step) => step.assignments).find((item) => item.status === 'AVAILABLE');

  const sign = async () => {
    const sensitiveState = createSensitiveSigningState();
    let cms: string | undefined;
    setError(undefined);
    setSigningState('Обновляем документ…');
    try {
      const fresh = await documentsApi.details(documentId);
      if (!can(fresh.availableActions, 'SIGN') || !assignment) throw new Error('Backend не разрешил подписание или назначение недоступно.');
      const challenge = await signingApi.challenge(documentId, assignment.id, fresh.version);
      sensitiveState.setSigningData(challenge.dataBase64);
      cms = await createDetachedCms(challenge.dataBase64, setSigningState);
      sensitiveState.setCms(cms);
      setSigningState('Сервер проверяет подпись…');
      const updated = await signingApi.submit(documentId, challenge, cms);
      client.setQueryData(documentKeys.details(organizationId, documentId), updated);
      await client.invalidateQueries({ queryKey: documentKeys.dashboard(organizationId) });
      setSigningState('Подпись проверена сервером.');
      if (openSigning) navigate(`/documents/${documentId}`, { replace: true });
    } catch (requestError) {
      const mapped = mapApiError(requestError, 'Не удалось подписать документ.');
      if (mapped.status === 409 || mapped.status === 412) await query.refetch();
      setError(mapped.status === 409 || mapped.status === 412
        ? 'Документ изменён другим пользователем. Загружена актуальная версия; проверьте данные перед повторной подписью.'
        : mapped.message);
      setSigningState(undefined);
    } finally {
      sensitiveState.clear();
    }
  };
  const download = async (kind: 'file' | 'signed-package') => {
    try {
      await downloadAuthorizedFile({
        request: () => documentsApi.download(documentId, kind),
        suggestedFileName: kind === 'file' ? `document-${documentId}` : `signed-package-${documentId}.zip`,
      });
    } catch (requestError) {
      setError(mapApiError(requestError, 'Не удалось скачать документ.').message);
    }
  };

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {signingState && <Alert severity={signingState.includes('проверена') ? 'success' : 'info'} aria-live="polite">{signingState}</Alert>}
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={3}>
          <div><Stack direction="row" spacing={1}><Chip label={document.status} color={document.status === 'SIGNED' ? 'success' : 'default'} /><Chip label={`Версия ${document.version}`} variant="outlined" /></Stack><Typography variant="h4" fontWeight={900} sx={{ mt: 2 }}>{document.title}</Typography><Typography color="text.secondary">{document.number || 'Без номера'} · {document.type.name}</Typography></div>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {can(document.availableActions, 'DOWNLOAD') && <Button startIcon={<DownloadIcon />} onClick={() => void download('file')}>Скачать</Button>}
            {document.status === 'SIGNED' && can(document.availableActions, 'DOWNLOAD_SIGNED_PACKAGE') && <Button startIcon={<DownloadIcon />} onClick={() => void download('signed-package')}>Пакет</Button>}
            {can(document.availableActions, 'SIGN') && <Button variant="contained" color="success" startIcon={<DrawIcon />} onClick={() => void sign()}>Подписать</Button>}
          </Stack>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <div><Typography variant="caption" color="text.secondary">Контрагент</Typography><Typography fontWeight={700}>{document.counterparty?.name || '—'}</Typography></div>
          <div><Typography variant="caption" color="text.secondary">Автор</Typography><Typography fontWeight={700}>{document.author?.name || '—'}</Typography></div>
          <div><Typography variant="caption" color="text.secondary">Создан</Typography><Typography fontWeight={700}>{dayjs(document.createdAt).format('DD.MM.YYYY HH:mm')}</Typography></div>
          <Box sx={{ minWidth: 180 }}><Typography variant="caption" color="text.secondary">Подписи: {document.signatureProgress ? `${document.signatureProgress.signed} из ${document.signatureProgress.total}` : '—'}</Typography><LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} /></Box>
        </Stack>
      </Paper>
      {document.sourceSystem === 'ECOPROGRESS_CRM' && <Alert severity="info" action={document.externalUrl && can(document.availableActions, 'OPEN_EXTERNAL_SOURCE') ? <Button href={document.externalUrl} target="_blank" startIcon={<LaunchIcon />}>Открыть CRM</Button> : undefined}>Создано из EcoProgress CRM</Alert>}
      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto">{['Документ', 'Подписанты', 'Вложения', 'Комментарии', 'История', 'Версии', 'Проверка ЭЦП'].map((label) => <Tab key={label} label={label} />)}</Tabs>
        <Divider />
        <Box sx={{ p: 3 }}>
          {tab === 0 && <Stack spacing={2}><Typography>{document.description || 'Описание не указано.'}</Typography><Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}><Typography variant="caption">SHA-256 текущей версии</Typography><Typography sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{document.hash}</Typography>{document.lockedAt && <Alert severity="warning" sx={{ mt: 2 }}>Версия заблокирована {dayjs(document.lockedAt).format('DD.MM.YYYY HH:mm')} и неизменяема.</Alert>}</Box></Stack>}
          {tab === 1 && <Stack spacing={2}>{document.signingRoute.map((step) => <Paper key={step.id} variant="outlined" sx={{ p: 2 }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={900}>Шаг {step.order}</Typography><Chip size="small" label={step.mode} /></Stack>{step.assignments.map((item) => <Box key={item.id} sx={{ mt: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 2 }}><Stack direction="row" justifyContent="space-between"><div><Typography fontWeight={700}>{item.signerName}</Typography><Typography variant="caption">{item.organization} · {item.position} · {item.iinMasked}</Typography></div><Chip size="small" label={item.status} /></Stack></Box>)}</Paper>)}</Stack>}
          {tab === 2 && <Stack spacing={1}>{document.files.map((file) => <Paper key={file.id} variant="outlined" sx={{ p: 2 }}><Typography fontWeight={700}>{file.name}</Typography><Typography variant="caption">{(file.size / 1024 / 1024).toFixed(2)} МБ · версия {file.version} · {file.sha256}</Typography></Paper>)}</Stack>}
          {tab > 2 && <Alert severity="info">Данные этой вкладки загружаются отдельным backend endpoint и не подменяются mock-значениями.</Alert>}
        </Box>
      </Paper>
    </Stack>
  );
};
