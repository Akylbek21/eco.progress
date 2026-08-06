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
import { documentMutationAllowed, hasFeature, isKnownDocumentStatus, validateDocumentFile } from '../model/access';
import { mapDocumentFlowError } from '../utils/apiErrorMapper';
import { useDocumentFlowTenant } from '../hooks/useDocumentFlowTenant';
import BackendContractBlocker from '../components/BackendContractBlocker';
import { hasDocumentAction } from '../model/documentActions';

const saveBlob = (blob: Blob, filename: string) => {
  if (!(blob instanceof Blob) || blob.size === 0 || blob.type.includes('json')) throw new Error('Backend не вернул ожидаемый файл.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export default function DocumentDetailsPage() {
  const id = Number(useParams().id);
  const access = useDocumentFlowContext();
  const tenant = useDocumentFlowTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ title: '', description: '', documentNumber: '', signingDeadline: '' });
  const [reasonAction, setReasonAction] = useState<'reject' | 'return' | 'revoke' | null>(null);
  const [reason, setReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const documentQuery = useQuery({
    queryKey: tenant.tenantScope ? documentFlowKeys.document(tenant.tenantScope, id) : ['document-flow', 'tenant-unresolved', 'document', id],
    queryFn: ({ signal }) => documentFlowApi.document(id, tenant.organizationId!, signal),
    enabled: tenant.organizationResolved && Number.isSafeInteger(id),
  });
  const scope = tenant.tenantScope;
  const versions = useQuery({ queryKey: scope ? documentFlowKeys.versions(scope, id) : ['document-flow', 'tenant-unresolved', id, 'versions'], queryFn: ({ signal }) => documentFlowApi.versions(id, tenant.organizationId!, signal), enabled: Boolean(scope) && tab === 2 && Number.isSafeInteger(id) });
  const attachments = useQuery({ queryKey: scope ? documentFlowKeys.attachments(scope, id) : ['document-flow', 'tenant-unresolved', id, 'attachments'], queryFn: ({ signal }) => documentFlowApi.attachments(id, tenant.organizationId!, signal), enabled: Boolean(scope) && tab === 3 && Number.isSafeInteger(id) });
  const route = useQuery({ queryKey: scope ? documentFlowKeys.signingRoute(scope, id) : ['document-flow', 'tenant-unresolved', id, 'signing-route'], queryFn: ({ signal }) => documentFlowApi.signingRoute(id, signal), enabled: Boolean(scope) && tab === 1 && Number.isSafeInteger(id), retry: false });
  const signatures = useQuery({ queryKey: scope ? documentFlowKeys.signatures(scope, id) : ['document-flow', 'tenant-unresolved', id, 'signatures'], queryFn: ({ signal }) => documentFlowApi.signatures(id, signal), enabled: Boolean(scope) && tab === 1 && Number.isSafeInteger(id) });
  const revocations = useQuery({ queryKey: scope ? documentFlowKeys.revocations(scope, id) : ['document-flow', 'tenant-unresolved', id, 'revocations'], queryFn: ({ signal }) => documentFlowApi.revocations(id, signal), enabled: Boolean(scope) && tab === 4 && Number.isSafeInteger(id) });
  const assignment = useQuery({ queryKey: scope ? documentFlowKeys.assignment(scope, id) : ['document-flow', 'tenant-unresolved', id, 'my-assignment'], queryFn: ({ signal }) => documentFlowApi.myAssignment(id, tenant.organizationId!, signal), enabled: Boolean(scope) && tab === 1 && Number.isSafeInteger(id), retry: false });
  const audit = useQuery({ queryKey: scope ? documentFlowKeys.audit(scope, id, 0) : ['document-flow', 'tenant-unresolved', id, 'audit'], queryFn: ({ signal }) => documentFlowApi.audit(id, tenant.organizationId!, 0, 50, signal), enabled: Boolean(scope) && tab === 5 && hasDocumentAction(documentQuery.data, 'VIEW_AUDIT') });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.document(scope!, id) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.documentLists(scope!) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.signingRoute(scope!, id) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.signatures(scope!, id) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.revocations(scope!, id) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.assignment(scope!, id) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.audit(scope!, id) }),
    ]);
  };
  const action = useMutation({
    mutationFn: async (name: string) => {
      const document = documentQuery.data;
      if (!document) throw new Error('Документ не загружен.');
      if (name === 'send') {
        return documentFlowApi.sendForSigning(id);
      }
      if (name === 'delete') return documentFlowApi.deleteDocument(id, tenant.organizationId!);
      if (name === 'archive') return documentFlowApi.archive(id, tenant.organizationId!);
      if (name === 'zip') {
        const response = await documentFlowApi.signedPackage(id, tenant.organizationId!);
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
      if (reason.trim().length < 5 || reason.trim().length > 1000 || !reasonAction) throw new Error('Причина должна содержать от 5 до 1000 символов.');
      if (reasonAction === 'reject') return documentFlowApi.reject(id, reason.trim(), tenant.organizationId!);
      if (reasonAction === 'return') return documentFlowApi.returnForRevision(id, reason.trim(), tenant.organizationId!);
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
    }, tenant.organizationId!),
    onSuccess: async () => { setEditOpen(false); await refresh(); },
  });
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const currentType = useQuery({ queryKey: documentFlowKeys.documentTypes(), queryFn: ({ signal }) => documentFlowApi.documentTypes(signal) });
  const typeConfig = useMemo(() => currentType.data?.find((item) => item.type === documentQuery.data?.type), [currentType.data, documentQuery.data?.type]);
  if (documentQuery.isLoading) return <Box py={10} textAlign="center"><CircularProgress /></Box>;
  if (documentQuery.isError || !documentQuery.data) return <Alert severity="error">{documentQuery.error?.message || 'Документ не найден'}</Alert>;
  const document = documentQuery.data;
  const mutable = documentMutationAllowed(document, access);
  const unknown = !isKnownDocumentStatus(document.status);
  const download = async () => saveBlob((await documentFlowApi.download(id, tenant.organizationId!)).data, document.number || `document-${id}`);
  const openPreview = async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const blob = (await documentFlowApi.preview(id, tenant.organizationId!)).data;
    if (!(blob instanceof Blob) || blob.size === 0 || blob.type.includes('json')) throw new Error('Backend не вернул ожидаемый файл предпросмотра.');
    setPreviewUrl(URL.createObjectURL(blob));
  };
  const upload = async (file: File, kind: 'version' | 'attachment') => {
    if (typeConfig) {
      const error = validateDocumentFile(file, typeConfig);
      if (error) throw new Error(error);
    }
    if (kind === 'version') await documentFlowApi.uploadVersion(id, file, { organizationId: tenant.organizationId! });
    else await documentFlowApi.uploadAttachment(id, file, { organizationId: tenant.organizationId! });
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
        {mutable && document.permissions.canSend && document.availableActions.includes('SEND') && <Button variant="contained" onClick={() => action.mutate('send')}>Отправить на подпись</Button>}
        {document.permissions.canDownload && document.availableActions.includes('DOWNLOAD_SIGNED_PACKAGE') && <Button onClick={() => action.mutate('zip')}>Скачать подписанный ZIP</Button>}
        {mutable && document.permissions.canDelete && document.availableActions.includes('DELETE') && <Button color="error" onClick={() => setDeleteOpen(true)}>Удалить</Button>}
        {mutable && hasDocumentAction(document, 'ARCHIVE') && <Button color="warning" disabled={action.isPending} onClick={() => action.mutate('archive')}>В архив</Button>}
      </Stack>
      {action.isError && <Alert severity="error">{mapDocumentFlowError(action.error).message}</Alert>}
      {action.isPending && <LinearProgress />}
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
        <Tab label="Документ" /><Tab label="Подписание" /><Tab label="Версии" /><Tab label="Вложения" /><Tab label="Отзыв" />{hasDocumentAction(document, 'VIEW_AUDIT') && <Tab label="Аудит" />}
      </Tabs>
      {tab === 0 && <Grid container spacing={2}><Grid size={{ xs: 12, md: previewUrl ? 5 : 12 }}><Card><CardContent><Typography>{document.description || 'Описание отсутствует'}</Typography><Divider sx={{ my: 2 }} /><Typography>Тип: {typeConfig?.title || document.type}</Typography><Typography>Направление: {document.direction}</Typography><Typography>Контрагент: {document.counterparty?.name || '—'}</Typography><Typography>Автор: {document.author?.fullName || '—'}</Typography><Typography>Версия записи: {document.version}</Typography></CardContent></Card></Grid>{previewUrl && <Grid size={{ xs: 12, md: 7 }}><Box component="iframe" src={previewUrl} title="Предпросмотр документа" width="100%" height="650px" border={0} /></Grid>}</Grid>}
      {tab === 1 && <Stack spacing={2}>
        <Card><CardContent><Typography fontWeight={800}>Моя задача</Typography>{assignment.isLoading && <CircularProgress size={22} />}{assignment.isError && <Alert severity="info" sx={{ mt: 1 }}>Активная задача для текущего участника не найдена.</Alert>}{assignment.data && <Stack spacing={0.5} mt={1}><Typography>Требуется подпись: {assignment.data.required ? 'да' : 'нет'}</Typography><Typography>Assignment ID: {assignment.data.assignmentId}</Typography><Typography>Шаг: {assignment.data.stepOrder}</Typography><Typography>Действие: {assignment.data.action}</Typography><Typography>Статус: {assignment.data.status}</Typography><Typography>Версия: {assignment.data.versionId}</Typography><Typography>Дедлайн: {assignment.data.deadline ? new Date(assignment.data.deadline).toLocaleString('ru-RU') : '—'}</Typography><Stack direction="row" gap={1} flexWrap="wrap">{hasDocumentAction(document, 'SIGN') && <Button variant="contained" disabled>Подписать</Button>}{hasDocumentAction(document, 'REJECT') && <Button color="error" onClick={() => setReasonAction('reject')}>Отклонить</Button>}{hasDocumentAction(document, 'RETURN_FOR_REVISION') && <Button color="warning" onClick={() => setReasonAction('return')}>Вернуть на доработку</Button>}</Stack></Stack>}</CardContent></Card>
        {hasDocumentAction(document, 'SIGN') && <BackendContractBlocker title="Подписание ожидает точный challenge DTO" reason="Backend-код проверки CMS и приватный challenge в доступном исходном коде отсутствуют. Подписание другого payload было бы криптографически неверным." technicalCode="DF_PRIVATE_SIGN_CHALLENGE_UNVERIFIED" endpoint={`/api/document-flow/documents/${id}/my-assignment`} missingField="точные подписываемые bytes/challenge" />}
        {route.isError ? <Alert severity="info">Маршрут подписания ещё не создан.</Alert> : route.data?.steps.map((step) => <Card key={step.id}><CardContent><Typography fontWeight={800}>Шаг {step.stepOrder}: требуется {step.requiredCount}</Typography>{step.assignments.map((item) => <Typography key={item.id}>{item.signerFullName || item.roleCode || item.signerType} — {item.status}</Typography>)}</CardContent></Card>)}
        {(signatures.data || []).map((item) => <Card key={item.id}><CardContent><Typography>{item.certificateSubject}</Typography><Typography color="text.secondary">Сертификат: {item.certificateSerialNumber}</Typography><Typography>Проверка: {item.verificationStatus}</Typography></CardContent></Card>)}
        {(signatures.data?.length || 0) > 0 && <Button onClick={() => action.mutate('verify')}>Проверить все подписи</Button>}
      </Stack>}
      {tab === 2 && <Stack spacing={2}>{mutable && hasFeature(access, 'VERSIONING') && document.permissions.canUploadVersion && <Button component="label">Загрузить новую версию<input hidden type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, 'version'); }} /></Button>}{(versions.data || []).map((item) => <Card key={item.id}><CardContent><Typography fontWeight={800}>Версия {item.versionNumber} {item.current && '· текущая'}</Typography><Typography>{item.originalFileName} · {item.mimeType} · {item.fileSize} байт</Typography><Typography>SHA-256: {item.sha256Hash}</Typography><Typography>{item.locked ? `Заблокирована ${item.lockedAt || ''}` : 'Не заблокирована'}</Typography><Button onClick={async () => saveBlob((await documentFlowApi.downloadVersion(id, item.id, tenant.organizationId!)).data, item.originalFileName)}>Скачать</Button></CardContent></Card>)}</Stack>}
      {tab === 3 && <Stack spacing={2}>{mutable && document.permissions.canManageAttachments && <Button component="label">Добавить вложение<input hidden type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file, 'attachment'); }} /></Button>}{(attachments.data || []).map((item) => <Card key={item.id}><CardContent><Typography>{item.originalFileName}</Typography><Typography>{item.mimeType} · {item.fileSize} байт</Typography><Typography>SHA-256: {item.sha256Hash}</Typography><Typography>Загрузил: {item.uploadedBy}, {new Date(item.createdAt).toLocaleString('ru-RU')}</Typography><Button onClick={async () => saveBlob((await documentFlowApi.downloadAttachment(id, item.id, tenant.organizationId!)).data, item.originalFileName)}>Скачать</Button>{mutable && document.permissions.canManageAttachments && <Button color="error" onClick={() => documentFlowApi.deleteAttachment(id, item.id, tenant.organizationId!).then(refresh)}>Удалить</Button>}</CardContent></Card>)}</Stack>}
      {tab === 4 && <Stack spacing={2}>{!hasFeature(access, 'REVOCATION') && <Alert severity="info">Feature REVOCATION недоступен.</Alert>}{(revocations.data || []).map((item) => <Card key={item.id}><CardContent><Typography fontWeight={800}>{item.status}</Typography><Typography>{item.reason}</Typography><Typography color="text.secondary">{new Date(item.createdAt).toLocaleString('ru-RU')}</Typography></CardContent></Card>)}</Stack>}
      {tab === 5 && hasDocumentAction(document, 'VIEW_AUDIT') && <Stack spacing={2}>{audit.isLoading && <CircularProgress size={24} />}{audit.isError && <Alert severity="error">{mapDocumentFlowError(audit.error).message}</Alert>}{(audit.data?.items ?? []).map((item) => <Card key={item.id}><CardContent><Typography fontWeight={800}>{item.action}</Typography><Typography>{item.actorName || 'Система'} · {new Date(item.createdAt).toLocaleString('ru-RU')}</Typography><Typography>{item.comment || 'Без комментария'}</Typography><Typography color="text.secondary">{item.status || '—'}</Typography></CardContent></Card>)}</Stack>}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Удалить черновик?</DialogTitle><DialogContent><Typography>Черновик и связанные с ним загруженные файлы будут удалены без возможности восстановления.</Typography></DialogContent><DialogActions><Button onClick={() => setDeleteOpen(false)}>Отмена</Button><Button color="error" variant="contained" disabled={action.isPending} onClick={() => action.mutate('delete')}>Удалить черновик</Button></DialogActions></Dialog>
      <Dialog open={reasonAction !== null} onClose={() => !reasonMutation.isPending && setReasonAction(null)} fullWidth><DialogTitle>{reasonAction === 'reject' ? 'Отклонить документ' : reasonAction === 'return' ? 'Вернуть на доработку' : 'Запросить отзыв'}</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline minRows={3} inputProps={{ maxLength: 1000 }} label="Причина" value={reason} onChange={(event) => setReason(event.target.value)} error={reason.length > 0 && reason.trim().length < 5} helperText={`${reason.trim().length}/1000, минимум 5 символов`} sx={{ mt: 1 }} />{reasonMutation.isError && <Alert severity="error">{mapDocumentFlowError(reasonMutation.error).message}</Alert>}</DialogContent><DialogActions><Button disabled={reasonMutation.isPending} onClick={() => setReasonAction(null)}>Отмена</Button><Button variant="contained" disabled={reason.trim().length < 5 || reason.trim().length > 1000 || reasonMutation.isPending} onClick={() => reasonMutation.mutate()}>Подтвердить</Button></DialogActions></Dialog>
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth><DialogTitle>Редактировать документ</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField label="Название" value={edit.title} onChange={(event) => setEdit((value) => ({ ...value, title: event.target.value }))} /><TextField label="Описание" multiline minRows={3} value={edit.description} onChange={(event) => setEdit((value) => ({ ...value, description: event.target.value }))} /><TextField label="Номер" value={edit.documentNumber} onChange={(event) => setEdit((value) => ({ ...value, documentNumber: event.target.value }))} /><TextField type="datetime-local" InputLabelProps={{ shrink: true }} label="Срок подписания" value={edit.signingDeadline} onChange={(event) => setEdit((value) => ({ ...value, signingDeadline: event.target.value }))} />{update.isError && <Alert severity="error">{update.error.message}</Alert>}</Stack></DialogContent><DialogActions><Button onClick={() => setEditOpen(false)}>Отмена</Button><Button variant="contained" disabled={!edit.title.trim() || update.isPending} onClick={() => update.mutate()}>Сохранить</Button></DialogActions></Dialog>
    </Stack>
  );
}
