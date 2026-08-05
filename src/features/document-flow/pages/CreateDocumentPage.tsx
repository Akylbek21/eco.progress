import { useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Step, StepLabel, Stepper, TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import DocumentFileUploader from '../components/DocumentFileUploader';
import SigningRouteBuilder from '../components/SigningRouteBuilder';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import { hasFeature, validateDocumentFile, validateRequiredCount } from '../model/access';
import type { Counterparty, DocumentDirection, DocumentType, SigningRouteRequest } from '../model/types';
import { mapDocumentFlowError } from '../utils/apiErrorMapper';
import { normalizeBin } from '../utils/counterpartyForm';
import { useDocumentFlowTenant } from '../hooks/useDocumentFlowTenant';
import {
  createCreationCheckpoint, creationCheckpointStorageKey, readCreationCheckpoint, runCreationWorkflow,
  type CreationCheckpoint,
} from '../model/creationCheckpoint';

interface FormValues {
  documentType: DocumentType | '';
  direction: DocumentDirection | '';
  title: string;
  counterpartyId: string;
  description: string;
  documentNumber: string;
  comment: string;
}

interface QuickCounterpartyValues { bin: string; name: string }

type ProcessPhase = 'CREATING' | 'UPLOADING' | 'PREPARING' | 'DONE';

const phases: Array<{ key: ProcessPhase; label: string }> = [
  { key: 'CREATING', label: 'Создание документа' },
  { key: 'UPLOADING', label: 'Загрузка файла' },
  { key: 'PREPARING', label: 'Подготовка подписи' },
  { key: 'DONE', label: 'Завершено' },
];

const legacyDraftKey = 'document-flow:create-draft';
const draftSchemaVersion = 1;

export default function CreateDocumentPage() {
  const access = useDocumentFlowContext();
  const { user } = useAuth();
  const tenant = useDocumentFlowTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkpoint = useRef<CreationCheckpoint | null>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null | undefined>();
  const [advanced, setAdvanced] = useState(false);
  const [phase, setPhase] = useState<ProcessPhase>();
  const [restored, setRestored] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickCreated, setQuickCreated] = useState<Counterparty | null>(null);
  const [route, setRoute] = useState<SigningRouteRequest>({ routeType: 'SEQUENTIAL', steps: [] });
  const { control, register, watch, trigger, getValues, reset, setError, setValue, formState: { errors, isDirty } } = useForm<FormValues>({
    defaultValues: { documentType: '', direction: '', title: '', counterpartyId: '', description: '', documentNumber: '', comment: '' },
  });
  const quickForm = useForm<QuickCounterpartyValues>({ defaultValues: { bin: '', name: '' } });
  const values = watch();
  const types = useQuery({ queryKey: documentFlowKeys.documentTypes(), queryFn: ({ signal }) => documentFlowApi.documentTypes(signal) });
  const counterparties = useQuery({
    queryKey: tenant.tenantScope ? documentFlowKeys.counterparties(tenant.tenantScope, { page: 0, size: 20, status: 'ACTIVE' }) : ['document-flow', 'tenant-unresolved', 'counterparties'],
    queryFn: ({ signal }) => documentFlowApi.getCounterparties({ page: 0, size: 20, signal }),
    enabled: tenant.organizationResolved,
  });
  const quickCreate = useMutation({
    mutationFn: (input: QuickCounterpartyValues) => documentFlowApi.createCounterparty({
      bin: normalizeBin(input.bin), name: input.name.trim(),
    }),
    onSuccess: async (created) => {
      setQuickCreated(created);
      setValue('counterpartyId', String(created.id), { shouldDirty: true, shouldValidate: true });
      quickForm.reset();
      setQuickOpen(false);
      await queryClient.invalidateQueries({ queryKey: documentFlowKeys.counterpartyLists(tenant.tenantScope!) });
    },
    onError: (error) => {
      const mapped = mapDocumentFlowError(error);
      if (mapped.code === 'COUNTERPARTY_DUPLICATE_BIN') quickForm.setError('bin', { message: 'Контрагент с таким БИН уже существует.' });
      Object.entries(mapped.fieldErrors).forEach(([field, message]) => {
        if (field === 'bin' || field === 'name') quickForm.setError(field, { message });
      });
    },
  });
  const activeCounterparties = useMemo(() => {
    const items = (counterparties.data?.items ?? []).filter((item) => item.status === 'ACTIVE');
    return quickCreated && !items.some((item) => item.id === quickCreated.id) ? [quickCreated, ...items] : items;
  }, [counterparties.data?.items, quickCreated]);
  const selectedType = useMemo(() => types.data?.find((item) => item.type === values.documentType), [types.data, values.documentType]);
  const organizationScope = tenant.tenantScope ?? 'tenant-unresolved';
  const numericUserId = Number(user?.id);
  const draftKey = `document-flow:create-draft:${user?.id ?? 'anonymous'}:${organizationScope}`;
  const checkpointKey = Number.isSafeInteger(numericUserId)
    ? creationCheckpointStorageKey(numericUserId, organizationScope)
    : null;
  const fileError = file && selectedType ? validateDocumentFile(file, selectedType) : null;
  const routeInvalid = !route.steps.length || route.steps.some((item) =>
    !validateRequiredCount(item.requiredCount, item.assignments.length)
    || !item.assignments.length
    || item.assignments.some((assignment) => assignment.signerType === 'ORGANIZATION_MEMBER' ? !assignment.userId : !assignment.email)
  );

  useEffect(() => {
    localStorage.removeItem(legacyDraftKey);
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { schemaVersion?: number; values?: Partial<FormValues>; route?: SigningRouteRequest };
      if (saved.schemaVersion !== draftSchemaVersion || !saved.values) throw new Error('Unsupported draft schema');
      reset({ ...getValues(), ...saved.values });
      if (saved.route) setRoute(saved.route);
      setRestored(true);
    } catch { localStorage.removeItem(draftKey); }
  }, [draftKey, getValues, reset]);
  useEffect(() => {
    if (!isDirty) return;
    const timer = window.setTimeout(() => localStorage.setItem(draftKey, JSON.stringify({
      schemaVersion: draftSchemaVersion,
      savedAt: new Date().toISOString(),
      values: getValues(),
      route,
    })), 500);
    return () => window.clearTimeout(timer);
  }, [draftKey, getValues, isDirty, route, values]);
  useEffect(() => {
    if (!checkpointKey || !tenant.tenantScope) return;
    checkpoint.current = readCreationCheckpoint(checkpointKey, numericUserId, tenant.tenantScope);
    if (checkpoint.current?.documentId) setRestored(true);
  }, [checkpointKey, numericUserId, tenant.tenantScope]);
  useEffect(() => {
    if (!selectedType) return;
    if (selectedType.allowedDirections === 'IN') setValue('direction', 'INCOMING', { shouldValidate: true });
    else if (selectedType.allowedDirections === 'OUT') setValue('direction', 'OUTGOING', { shouldValidate: true });
    else setValue('direction', '', { shouldValidate: true });
  }, [selectedType, setValue]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (isDirty && !mutation.isSuccess) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });

  const mutation = useMutation({
    mutationFn: async (intent: 'DRAFT' | 'SUBMIT') => {
      const valid = await trigger(['documentType', 'direction', 'title', 'counterpartyId']);
      if (!valid || fileError || (intent === 'SUBMIT' && (!file || selectedType?.signingRequired !== true || routeInvalid))) throw new Error(fileError || 'Проверьте обязательные поля, файл и маршрут подписания.');
      if (!checkpointKey || !tenant.tenantScope || !Number.isSafeInteger(numericUserId)) {
        throw new Error('Не удалось определить пользователя для безопасного tenant checkpoint.');
      }
      const form = getValues();
      checkpoint.current ??= createCreationCheckpoint(numericUserId, tenant.tenantScope);
      const result = await runCreationWorkflow({
        checkpoint: checkpoint.current,
        createPayload: {
          documentType: form.documentType as DocumentType,
          direction: form.direction as DocumentDirection,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          counterpartyId: form.counterpartyId ? Number(form.counterpartyId) : undefined,
        },
        requisites: form.documentNumber.trim() ? { documentNumber: form.documentNumber.trim() } : undefined,
        expectedDocumentNumber: form.documentNumber.trim() || undefined,
        mainFile: file ?? undefined,
        mainFileRequired: intent === 'SUBMIT',
        route: intent === 'SUBMIT' ? route : undefined,
        submit: intent === 'SUBMIT',
        operations: {
          createDocument: (payload, key) => { setPhase('CREATING'); return documentFlowApi.createDocument(payload, key); },
          updateDocument: (id, payload) => documentFlowApi.updateDocument(id, payload),
          getDocument: (id) => documentFlowApi.document(id),
          uploadMainFile: (id, selectedFile) => {
            setPhase('UPLOADING');
            setUploadProgress(null);
            return documentFlowApi.uploadFile(id, selectedFile, { changeReason: form.comment.trim() || undefined, onProgress: setUploadProgress });
          },
          uploadAttachment: (id, selectedFile) => documentFlowApi.uploadAttachment(id, selectedFile),
          listAttachments: (id) => documentFlowApi.attachments(id),
          getSigningRoute: async (id) => {
            try { return await documentFlowApi.signingRoute(id); }
            catch (error) { if (isAxiosError(error) && error.response?.status === 404) return null; throw error; }
          },
          createSigningRoute: (id, payload) => documentFlowApi.createSigningRoute(id, payload),
          prepare: (id, version) => { setPhase('PREPARING'); return documentFlowApi.prepareForSigning(id, version); },
          send: (id) => documentFlowApi.sendForSigning(id),
        },
        persist: (next) => {
          checkpoint.current = next;
          localStorage.setItem(checkpointKey, JSON.stringify(next));
        },
      });
      checkpoint.current = result;
      setPhase('DONE');
      return { id: result.documentId!, signed: false };
    },
    onSuccess: async ({ id }) => {
      localStorage.removeItem(draftKey);
      if (checkpointKey) localStorage.removeItem(checkpointKey);
      await queryClient.invalidateQueries({ queryKey: documentFlowKeys.all });
      navigate(`/document-flow/documents/${id}`);
    },
    onError: (error) => {
      const mapped = mapDocumentFlowError(error);
      Object.entries(mapped.fieldErrors).forEach(([name, message]) => setError(name as keyof FormValues, { message }));
    },
  });
  const next = async () => {
      const valid = await trigger(['documentType', 'direction', 'title', 'counterpartyId']);
    if (valid) setStep(1);
  };
  const error = mutation.isError ? mapDocumentFlowError(mutation.error) : null;
  const activePhase = phase ? phases.findIndex((item) => item.key === phase) : -1;

  return (
    <Stack spacing={3} maxWidth={1000} mx="auto">
      <Box><Typography variant="h4" fontWeight={800}>Новый документ</Typography><Typography color="text.secondary">Два шага: данные, затем файл и подписание.</Typography></Box>
      {restored && <Alert severity="info" onClose={() => setRestored(false)}>Восстановлен локальный черновик формы. Файл нужно выбрать заново.</Alert>}
      <Stepper activeStep={step}><Step><StepLabel>Данные документа</StepLabel></Step><Step><StepLabel>Файл и подписание</StepLabel></Step></Stepper>
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        {step === 0 && <Stack spacing={2}>
          <Controller name="documentType" control={control} rules={{ required: 'Выберите тип документа.' }} render={({ field }) => <FormControl fullWidth error={Boolean(errors.documentType)}><InputLabel>Тип документа</InputLabel><Select {...field} label="Тип документа">{(types.data || []).filter((item) => item.active && (!item.requiredFeature || hasFeature(access, item.requiredFeature))).map((item) => <MenuItem key={item.type} value={item.type}>{item.title}</MenuItem>)}</Select></FormControl>} />
          <Controller name="direction" control={control} rules={{ required: 'Выберите направление.' }} render={({ field }) => <FormControl fullWidth error={Boolean(errors.direction)} disabled={selectedType?.allowedDirections !== 'BOTH'}><InputLabel>Направление</InputLabel><Select {...field} label="Направление"><MenuItem value="INCOMING">Входящий</MenuItem><MenuItem value="OUTGOING">Исходящий</MenuItem></Select></FormControl>} />
          <TextField label="Название" {...register('title', { required: 'Укажите название.', validate: (value) => Boolean(value.trim()) || 'Укажите название.' })} error={Boolean(errors.title)} helperText={errors.title?.message} />
          <TextField fullWidth label="Номер" placeholder="Будет присвоен автоматически" {...register('documentNumber')} />
          {selectedType?.counterpartyRequired && <Controller name="counterpartyId" control={control} rules={{ required: 'Выберите контрагента.' }} render={({ field }) => <FormControl fullWidth error={Boolean(errors.counterpartyId)}><InputLabel>Контрагент</InputLabel><Select {...field} label="Контрагент" onChange={(event) => event.target.value === '__new__' ? setQuickOpen(true) : field.onChange(event)}><MenuItem value="__new__">+ Новый контрагент</MenuItem>{activeCounterparties.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name} · {item.bin}</MenuItem>)}</Select></FormControl>} />}
          <TextField label="Описание" multiline minRows={3} {...register('description')} />
          <Box textAlign="right"><Button variant="contained" onClick={next}>Далее</Button></Box>
        </Stack>}
        {step === 1 && <Stack spacing={3}>
          <DocumentFileUploader config={selectedType} file={file} onChange={setFile} progress={uploadProgress} disabled={mutation.isPending} />
          <TextField label="Комментарий" multiline minRows={2} {...register('comment')} />
          {selectedType?.signingRequired && <Alert severity="info">Подписание выполняется только через backend-маршрут: маршрут → подготовка → отправка → подписи.</Alert>}
          {selectedType && !selectedType.signingRequired && <Alert severity="info">Backend пока не предоставляет переход в готовый статус без маршрута. Документ и файл можно безопасно сохранить как черновик.</Alert>}
          {selectedType?.signingRequired && <><Button variant="text" onClick={() => setAdvanced((value) => !value)}>Настройки маршрута подписания</Button><Collapse in={advanced}><SigningRouteBuilder access={access} value={route} onChange={setRoute} /></Collapse></>}
          {phase && <Box><Stepper activeStep={activePhase} alternativeLabel sx={{ display: { xs: 'none', md: 'flex' } }}>{phases.map((item) => <Step key={item.key}><StepLabel>{item.label}</StepLabel></Step>)}</Stepper><LinearProgress sx={{ mt: 2 }} /></Box>}
          {error && <Alert severity="error">{error.message}{error.code === 'NCALAYER_NOT_AVAILABLE' && ' Запустите NCALayer и нажмите кнопку ещё раз — документ повторно не создастся.'}</Alert>}
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="space-between" gap={1}>
            <Button disabled={mutation.isPending} onClick={() => setStep(0)}>Назад</Button>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><Button disabled={mutation.isPending} onClick={() => mutation.mutate('DRAFT')}>Сохранить черновик</Button>{selectedType?.signingRequired && <Button variant="contained" disabled={mutation.isPending || !file || Boolean(fileError || routeInvalid)} onClick={() => mutation.mutate('SUBMIT')}>Создать и отправить на подписание</Button>}</Stack>
          </Stack>
        </Stack>}
      </Paper>
      <Dialog open={quickOpen} onClose={() => !quickCreate.isPending && setQuickOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Новый контрагент</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>
          <TextField label="БИН" {...quickForm.register('bin', { required: 'Укажите БИН', validate: (value) => normalizeBin(value).length === 12 || 'БИН должен содержать 12 цифр' })} error={Boolean(quickForm.formState.errors.bin)} helperText={quickForm.formState.errors.bin?.message || `${normalizeBin(quickForm.watch('bin')).length} из 12 цифр`} />
          <TextField label="Название" {...quickForm.register('name', { required: 'Укажите название', validate: (value) => Boolean(value.trim()) || 'Укажите название' })} error={Boolean(quickForm.formState.errors.name)} helperText={quickForm.formState.errors.name?.message} />
          {quickCreate.isError && !quickForm.formState.errors.bin && <Alert severity="error">{mapDocumentFlowError(quickCreate.error).message}</Alert>}
        </Stack></DialogContent>
        <DialogActions><Button disabled={quickCreate.isPending} onClick={() => setQuickOpen(false)}>Отмена</Button><Button variant="contained" disabled={quickCreate.isPending} onClick={quickForm.handleSubmit((input) => quickCreate.mutate(input))}>{quickCreate.isPending ? 'Добавление...' : 'Создать'}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
