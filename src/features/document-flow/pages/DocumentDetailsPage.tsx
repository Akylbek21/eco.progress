import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Grid, LinearProgress, Stack, Tab, Tabs,
  TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import DocumentStatusBadge from '../components/DocumentStatusBadge';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import { canMutate, documentMutationAllowed, hasFeature, hasPermission, isKnownDocumentStatus, validateDocumentFile } from '../model/access';
import { createCmsSignatureWithNCALayer } from '../../../services/ncalayer';
import { mapDocumentFlowError } from '../utils/apiErrorMapper';

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Не удалось прочитать файл документа.'));
  reader.onload = () => {
    const raw = String(reader.result || '');
    resolve(raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw);
  };
  reader.readAsDataURL(blob);
});

export default function DocumentDetailsPage() {
  const id = Number(useParams().id);
  const access = useDocumentFlowContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ title: '', description: '', documentNumber: '', signingDeadline: '' });
  const [reasonAction, setReasonAction] = useState<'reject' | 'return' | 'revoke' | null>(null);
  const [reason, setReason] = useState('');
  const documentQuery = useQuery({
    queryKey: documentFlowKeys.document(id),
    queryFn: ({ signal }) => documentFlowApi.document(id, undefined, signal),
    enabled: Number.isSafeInteger(id),
  });
  const versions = useQuery({ queryKey: documentFlowKeys.versions(id), queryFn: ({ signal }) => documentFlowApi.versions(id, undefined, signal), enabled: tab === 2 && Number.isSafeInteger(id) });
  const attachments = useQuery({ queryKey: documentFlowKeys.attachments(id), queryFn: ({ signal }) => documentFlowApi.attachments(id, undefined, signal), enabled: tab === 3 && Number.isSafeInteger(id) });
  const route = useQuery({ queryKey: documentFlowKeys.signingRoute(id), queryFn: ({ signal }) => documentFlowApi.signingRoute(id, signal), enabled: tab === 1 && Number.isSafeInteger(id), retry: false });
  const signatures = useQuery({ queryKey: documentFlowKeys.signatures(id), queryFn: ({ signal }) => documentFlowApi.signatures(id, signal), enabled: tab === 1 && Number.isSafeInteger(id) });
  const revocations = useQuery({ queryKey: documentFlowKeys.revocations(id), queryFn: ({ signal }) => documentFlowApi.revocations(id, signal), enabled: tab === 4 && Number.isSafeInteger(id) });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.document(id) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.documents({ page: 0, size: 20, sort: 'createdAt,desc' }) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.signingRoute(id) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.signatures(id) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.revocations(id) }),
    ]);
  };
  const action = useMutation({
    mutationFn: async (name: string) => {
      const document = documentQuery.data;
      if (!document) throw new Error('Документ не загружен.');
      if (name === 'prepare') return documentFlowApi.prepareForSigning(id, document.version);
      if (name === 'send') return documentFlowApi.sendForSigning(id);
      if (name === 'delete') return documentFlowApi.deleteDocument(id);
      if (name === 'zip') {
        const response = await documentFlowApi.signedPackage(id);
        saveBlob(response.data, `document-${id}-signed-package.zip`);
        return null;
      }
      if (name === 'verify') {
        await documentFlowApi.verifyAll(id);
        return documentFlowApi.verificationReport(id);
      }
      throw new Error('Неизвестное действие.');
    },
    onSuccess: async (_, name) => {
      if (name === 'delete') navigate('/document-flow/documents');
      else await refresh();
    },
  });
  const reasonMutation = useMutation({
    mutationFn: async () => {
      if (!reason.trim() || !reasonAction) throw new Error('Причина обязательна.');
      if (reasonAction === 'reject') return documentFlowApi.reject(id, reason.trim());
      if (reasonAction === 'return') return documentFlowApi.returnForRevision(id, reason.trim());
      return documentFlowApi.createRevocation(id, reason.trim());
    },
    onSuccess: async () => { setReasonAction(null); setReason(''); await refresh(); },
  });
  const update = useMutation({
    mutationFn: () => documentFlowApi.updateDocument(id, {
      title: edit.title.trim(),
      description: edit.description.trim() || null,
      documentNumber: edit.documentNumber.trim() || null,
      signingDeadline: edit.signingDeadline || null,
    }),
    onSuccess: async () => { setEditOpen(false); await refresh(); },
  });
  const sign = useMutation({
    mutationFn: async () => {
      const fresh = await documentFlowApi.document(id);
      if (!hasPermission(access, 'SIGN_DOCUMENT') || !hasFeature(access, 'NCALAYER_SIGNING') || access.readOnly) throw new Error('Backend-контекст не разрешает подписание через NCALayer.');
      if (!fresh.currentVersionId) throw new Error('У документа нет текущей версии.');
      const signingData = await documentFlowApi.signingData(id);
      const assignments = signingData.steps.flatMap((step) => step.assignments)
        .filter((item) => ['AVAILABLE', 'VIEWED'].includes(item.status));
      if (assignments.length !== 1) throw new Error('Backend не вернул единственное активное задание текущего пользователя.');
      const [assignment] = assignments;
      const file = await documentFlowApi.download(id);
      const cms = await createCmsSignatureWithNCALayer(await blobToBase64(file.data));
      return documentFlowApi.submitSignature(id, {
        documentId: id,
        versionId: fresh.currentVersionId,
        assignmentId: assignment.id,
        cms,
        clientRequestId: crypto.randomUUID(),
      });
    },
    onSuccess: refresh,
  });
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const currentType = useQuery({ queryKey: documentFlowKeys.documentTypes(), queryFn: ({ signal }) => documentFlowApi.documentTypes(signal) });
  const typeConfig = useMemo(() => currentType.data?.find((item) => item.type === documentQuery.data?.type), [currentType.data, documentQuery.data?.type]);
  if (documentQuery.isLoading) return <Box py={10} textAlign="center"><CircularProgress /></Box>;
  if (documentQuery.isError || !documentQuery.data) return <Alert severity="error">{documentQuery.error?.message || 'Документ не найден'}</Alert>;
  const document = documentQuery.data;
  const mutable = documentMutationAllowed(document, access);
  const unknown = !isKnownDocumentStatus(document.status);
  const download = async () => saveBlob((await documentFlowApi.download(id)).data, document.number || `document-${id}`);
  const openPreview = async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL((await documentFlowApi.preview(id)).data));
  };
  const upload = async (file: File, kind: 'version' | 'attachment') => {
    if (typeConfig) {
      const error = validateDocumentFile(file, typeConfig);
      if (error) throw new Error(error);
    }
    if (kind === 'version') await documentFlowApi.uploadVersion(id, file);
    else await documentFlowApi.uploadAttachment(id, file);
    await refresh();
  };
  return (
    <Stack spacing={3}>
      {unknown && <Alert severity="error">Backend вернул неизвестный статус. Документ открыт только для чтения; изменяющие действия отключены.</Alert>}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
        <Box><Typography variant="h4" fontWeight={800}>{document.title}</Typography><Typography color="text.secondary">{document.number || 'Без номера'}</Typography></Box>
        <DocumentStatusBadge status={document.status} />
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {mutable && document.permissions.canEdit && document.availableActions.includes('EDIT') && <Button onClick={() => {
          setEdit({ title: document.title, description: document.description || '', documentNumber: document.number || '', signingDeadline: document.deadline?.slice(0, 16) || '' });
          setEditOpen(true);
        }}>Редактировать</Button>}
        {document.permissions.canDownload && document.currentVersionId && <><Button onClick={openPreview}>Preview</Button><Button onClick={download}>Скачать</Button></>}
        {mutable && document.permissions.canSend && document.availableActions.includes('PREPARE_FOR_SIGNING') && <Button variant="contained" onClick={() => action.mutate('prepare')}>Подготовить к подписанию</Button>}
        {mutable && document.permissions.canSend && document.availableActions.includes('SEND_FOR_SIGNING') && <Button variant="contained" onClick={() => action.mutate('send')}>Отправить на подпись</Button>}
        {!access.readOnly && hasPermission(access, 'SIGN_DOCUMENT') && hasFeature(access, 'NCALAYER_SIGNING') && (document.availableActions.includes('SIGN') || document.availableActions.includes('SELF_SIGN')) && <Button variant="contained" onClick={() => sign.mutate()}>Подписать через NCALayer</Button>}
        {!access.readOnly && document.availableActions.includes('REJECT') && <Button color="error" onClick={() => setReasonAction('reject')}>Отказаться от подписания</Button>}
        {!access.readOnly && document.availableActions.includes('RETURN') && <Button color="warning" onClick={() => setReasonAction('return')}>Вернуть на доработку</Button>}
        {document.status === 'SIGNED' && document.permissions.canDownload && document.availableActions.includes('DOWNLOAD') && <Button onClick={() => action.mutate('zip')}>Скачать подписанный ZIP</Button>}
        {document.availableActions.includes('REVOKE') && canMutate(access, 'REVOKE_SIGNATURE', 'REVOCATION') && <Button color="warning" onClick={() => setReasonAction('revoke')}>Запросить отзыв</Button>}
        {mutable && document.permissions.canDelete && document.availableActions.includes('DELETE') && <Button color="error" onClick={() => action.mutate('delete')}>Удалить</Button>}
      </Stack>
      {(action.isError || sign.isError) && <Alert severity="error">{mapDocumentFlowError(action.error || sign.error).message}</Alert>}
      {(action.isPending || sign.isPending) && <LinearProgress />}
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
        <Tab label="Документ" /><Tab label="Подписание" /><Tab label="Версии" /><Tab label="Вложения" /><Tab label="Отзыв" />
      </Tabs>
      {tab === 0 && <Grid container spacing={2}><Grid size={{ xs: 12, md: previewUrl ? 5 : 12 }}><Card><CardContent><Typography>{document.description || 'Описание отсутствует'}</Typography><Divider sx={{ my: 2 }} /><Typography>Тип: {typeConfig?.title || document.type}</Typography><Typography>Направление: {document.direction}</Typography><Typography>Контрагент: {document.counterparty?.name || '—'}</Typography><Typography>Автор: {document.author?.fullName || '—'}</Typography><Typography>Версия записи: {document.version}</Typography></CardContent></Card></Grid>{previewUrl && <Grid size={{ xs: 12, md: 7 }}><Box component="iframe" src={previewUrl} title="Предпросмотр документа" width="100%" height="650px" border={0} /></Grid>}</Grid>}
      {tab === 1 && <Stack spacing={2}>
        {route.isError ? <Alert severity="info">Маршрут подписания ещё не создан.</Alert> : route.data?.steps.map((step) => <Card key={step.id}><CardContent><Typography fontWeight={800}>Шаг {step.stepOrder}: требуется {step.requiredCount}</Typography>{step.assignments.map((item) => <Typography key={item.id}>{item.signerFullName || item.roleCode || item.signerType} — {item.status}</Typography>)}</CardContent></Card>)}
        {(signatures.data || []).map((item) => <Card key={item.id}><CardContent><Typography>{item.certificateSubject}</Typography><Typography color="text.secondary">Сертификат: {item.certificateSerialNumber}</Typography><Typography>Проверка: {item.verificationStatus}</Typography></CardContent></Card>)}
        {(signatures.data?.length || 0) > 0 && <Button onClick={() => action.mutate('verify')}>Проверить все подписи</Button>}
      </Stack>}
      {tab === 2 && <Stack spacing={2}>{mutable && hasFeature(access, 'VERSIONING') && document.permissions.canUploadVersion && <Button component="label">Загрузить новую версию<input hidden type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, 'version'); }} /></Button>}{(versions.data || []).map((item) => <Card key={item.id}><CardContent><Typography fontWeight={800}>Версия {item.versionNumber} {item.current && '· текущая'}</Typography><Typography>{item.originalFileName} · {item.mimeType} · {item.fileSize} байт</Typography><Typography>SHA-256: {item.sha256Hash}</Typography><Typography>{item.locked ? `Заблокирована ${item.lockedAt || ''}` : 'Не заблокирована'}</Typography><Button onClick={async () => saveBlob((await documentFlowApi.downloadVersion(id, item.id)).data, item.originalFileName)}>Скачать</Button></CardContent></Card>)}</Stack>}
      {tab === 3 && <Stack spacing={2}>{mutable && document.permissions.canManageAttachments && <Button component="label">Добавить вложение<input hidden type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, 'attachment'); }} /></Button>}{(attachments.data || []).map((item) => <Card key={item.id}><CardContent><Typography>{item.originalFileName}</Typography><Typography>{item.mimeType} · {item.fileSize} байт</Typography><Typography>SHA-256: {item.sha256Hash}</Typography><Typography>Загрузил: {item.uploadedBy}, {new Date(item.createdAt).toLocaleString('ru-RU')}</Typography>{mutable && document.permissions.canManageAttachments && <Button color="error" onClick={() => documentFlowApi.deleteAttachment(id, item.id).then(refresh)}>Удалить</Button>}</CardContent></Card>)}</Stack>}
      {tab === 4 && <Stack spacing={2}>{!hasFeature(access, 'REVOCATION') && <Alert severity="info">Feature REVOCATION недоступен.</Alert>}{(revocations.data || []).map((item) => <Card key={item.id}><CardContent><Typography fontWeight={800}>{item.status}</Typography><Typography>{item.reason}</Typography><Typography color="text.secondary">{new Date(item.createdAt).toLocaleString('ru-RU')}</Typography>{canMutate(access, 'REVOKE_SIGNATURE', 'REVOCATION') && <Stack direction="row" gap={1} mt={1}>{item.status === 'DRAFT' && <><Button onClick={() => documentFlowApi.revocationAction(item.id, 'send').then(refresh)}>Отправить</Button><Button onClick={() => documentFlowApi.revocationAction(item.id, 'cancel').then(refresh)}>Отменить</Button></>}{item.status === 'PENDING' && <><Button color="success" onClick={() => documentFlowApi.revocationAction(item.id, 'approve').then(refresh)}>Согласовать отзыв</Button><Button color="error" onClick={() => documentFlowApi.revocationAction(item.id, 'reject').then(refresh)}>Отклонить отзыв</Button></>}</Stack>}</CardContent></Card>)}</Stack>}
      <Dialog open={reasonAction !== null} onClose={() => setReasonAction(null)} fullWidth><DialogTitle>{reasonAction === 'reject' ? 'Отклонить документ' : reasonAction === 'return' ? 'Вернуть на доработку' : 'Запросить отзыв'}</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline minRows={3} label="Причина" value={reason} onChange={(event) => setReason(event.target.value)} sx={{ mt: 1 }} />{reasonMutation.isError && <Alert severity="error">{reasonMutation.error.message}</Alert>}</DialogContent><DialogActions><Button onClick={() => setReasonAction(null)}>Отмена</Button><Button variant="contained" disabled={!reason.trim() || reasonMutation.isPending} onClick={() => reasonMutation.mutate()}>Подтвердить</Button></DialogActions></Dialog>
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth><DialogTitle>Редактировать документ</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField label="Название" value={edit.title} onChange={(event) => setEdit((value) => ({ ...value, title: event.target.value }))} /><TextField label="Описание" multiline minRows={3} value={edit.description} onChange={(event) => setEdit((value) => ({ ...value, description: event.target.value }))} /><TextField label="Номер" value={edit.documentNumber} onChange={(event) => setEdit((value) => ({ ...value, documentNumber: event.target.value }))} /><TextField type="datetime-local" InputLabelProps={{ shrink: true }} label="Срок подписания" value={edit.signingDeadline} onChange={(event) => setEdit((value) => ({ ...value, signingDeadline: event.target.value }))} />{update.isError && <Alert severity="error">{update.error.message}</Alert>}</Stack></DialogContent><DialogActions><Button onClick={() => setEditOpen(false)}>Отмена</Button><Button variant="contained" disabled={!edit.title.trim() || update.isPending} onClick={() => update.mutate()}>Сохранить</Button></DialogActions></Dialog>
    </Stack>
  );
}
