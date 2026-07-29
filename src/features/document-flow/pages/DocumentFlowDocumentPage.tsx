import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, LinearProgress, Paper, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import { Archive, Download, FileSignature, RotateCcw, Send } from 'lucide-react';
import { documentFlowDocumentsApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { useDocumentFlowAccess } from '../access/DocumentFlowAccessProvider';
import { DocumentStatusChip } from '../components/DocumentStatusChip';
import { DocumentSigningDialog } from '../components/DocumentSigningDialog';
import { getDocumentFlowError } from '../utils/errors';

const tabs = ['Документ', 'Подписанты', 'Вложения', 'Комментарии', 'История', 'Версии', 'Проверка ЭЦП'];

const DocumentFlowDocumentPage = () => {
  const { documentId = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [tab, setTab] = useState(0);
  const [signOpen, setSignOpen] = useState(false);
  const { access, can, hasFeature } = useDocumentFlowAccess();
  const query = useQuery({ queryKey: documentFlowKeys.document(documentId), queryFn: () => documentFlowDocumentsApi.get(documentId), enabled: !!documentId, retry: false });
  const actionMutation = useMutation({
    retry: false,
    mutationFn: ({ action, body }: { action: string; body?: unknown }) => documentFlowDocumentsApi.action(documentId, action, body),
    onSuccess: async () => client.invalidateQueries({ queryKey: documentFlowKeys.document(documentId) }),
  });
  if (query.isPending) return <Box sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (query.isError) return <Alert severity="error">{getDocumentFlowError(query.error, 'Не удалось открыть документ.').message}</Alert>;
  const document = query.data;
  const actionAllowed = (action: string) => !access.readOnly && document.availableActions.includes(action);
  const percent = document.signaturesTotal ? Math.round(document.signaturesCompleted / document.signaturesTotal * 100) : 0;

  return (
    <Box>
      <Button onClick={() => navigate(-1)}>← Назад</Button>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} sx={{ mt: 1 }}>
        <Box><Stack direction="row" alignItems="center" spacing={1.5}><Typography variant="h4" fontWeight={950}>{document.number}</Typography><DocumentStatusChip status={document.status} /></Stack><Typography variant="h6" sx={{ mt: 0.5 }}>{document.title}</Typography></Box>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {actionAllowed('SEND') && can('DOCUMENT_SEND') && <Button variant="contained" startIcon={<Send size={17} />} onClick={() => actionMutation.mutate({ action: 'send' })}>Отправить</Button>}
          {actionAllowed('SIGN') && can('DOCUMENT_SIGN') && hasFeature('NCALAYER_SIGNING') && <Button variant="contained" color="success" startIcon={<FileSignature size={17} />} onClick={() => setSignOpen(true)}>Подписать</Button>}
          {actionAllowed('REVOKE') && can('DOCUMENT_REVOKE') && <Button variant="outlined" color="warning" startIcon={<RotateCcw size={17} />} onClick={() => actionMutation.mutate({ action: 'revocation-requests' })}>Отозвать</Button>}
          {actionAllowed('ARCHIVE') && can('DOCUMENT_ARCHIVE') && <Button variant="outlined" startIcon={<Archive size={17} />} onClick={() => actionMutation.mutate({ action: 'archive' })}>В архив</Button>}
          {document.availableActions.includes('DOWNLOAD') && <Button variant="outlined" startIcon={<Download size={17} />} onClick={() => window.open(`/api/document-flow/documents/${document.id}/download`, '_blank', 'noopener,noreferrer')}>Скачать</Button>}
        </Stack>
      </Stack>
      {actionMutation.isError && <Alert severity="error" sx={{ mt: 2 }}>{getDocumentFlowError(actionMutation.error).message}</Alert>}
      <Paper variant="outlined" sx={{ mt: 3, p: 2.5, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
          <Box><Typography variant="caption" color="text.secondary">Контрагент</Typography><Typography fontWeight={800}>{document.counterparty?.name || '—'}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Автор</Typography><Typography fontWeight={800}>{document.author?.name || '—'}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Версия / хэш</Typography><Typography fontWeight={800}>v{document.version} · {document.hash ? `${document.hash.slice(0, 12)}…` : '—'}</Typography></Box>
          <Box sx={{ minWidth: 190 }}><Typography variant="caption" color="text.secondary">Подписи: {document.signaturesCompleted} из {document.signaturesTotal}</Typography><LinearProgress variant="determinate" value={percent} sx={{ mt: 1, borderRadius: 5 }} /></Box>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ mt: 2, borderRadius: 3, overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">{tabs.map((label) => <Tab key={label} label={label} />)}</Tabs>
        <Box sx={{ p: 3 }}>
          {tab === 0 && <Stack spacing={1}><Typography fontWeight={900}>{document.file?.name || 'Основной файл не загружен'}</Typography><Typography color="text.secondary">{document.description || 'Описание отсутствует'}</Typography></Stack>}
          {tab === 1 && <Stack spacing={1.5}>{document.signers.map((signer, index) => <Paper key={signer.id || `${signer.email}-${index}`} variant="outlined" sx={{ p: 2, borderRadius: 2 }}><Typography fontWeight={850}>Шаг {signer.step}: {signer.fullName}</Typography><Typography variant="body2" color="text.secondary">{signer.organization} · {signer.position} · {signer.status || 'Ожидает'}</Typography></Paper>)}</Stack>}
          {tab === 2 && <Stack spacing={1}>{document.attachments?.map((file) => <Typography key={file.id}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ</Typography>) || <Typography color="text.secondary">Вложений нет.</Typography>}</Stack>}
          {tab === 3 && <Typography color="text.secondary">Комментарии загружаются отдельным backend endpoint и не подменяются локальными данными.</Typography>}
          {tab === 4 && <Stack spacing={1}>{document.history?.map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}><Typography fontWeight={800}>{item.action}</Typography><Typography variant="body2">{item.actor} · {new Date(item.createdAt).toLocaleString('ru-KZ')}</Typography></Paper>) || <Typography color="text.secondary">История отсутствует.</Typography>}</Stack>}
          {tab === 5 && <Stack spacing={1}>{document.versions?.map((version) => <Paper key={version.id} variant="outlined" sx={{ p: 2 }}><Typography fontWeight={800}>Версия {version.version}{version.immutable ? ' · неизменяемая' : ''}</Typography><Typography variant="caption">{version.hash}</Typography></Paper>) || <Typography color="text.secondary">Версии отсутствуют.</Typography>}</Stack>}
          {tab === 6 && <Alert severity="info">Проверка ЭЦП выполняется backend по CMS, сертификату и хэшу конкретной версии.</Alert>}
        </Box>
      </Paper>
      <DocumentSigningDialog documentId={documentId} open={signOpen} onClose={() => setSignOpen(false)} />
    </Box>
  );
};

export default DocumentFlowDocumentPage;

