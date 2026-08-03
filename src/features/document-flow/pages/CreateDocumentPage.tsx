import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Step, StepLabel, Stepper, TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import DocumentFileUploader from '../components/DocumentFileUploader';
import SigningRouteBuilder from '../components/SigningRouteBuilder';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import { hasFeature, validateDocumentFile, validateRequiredCount } from '../model/access';
import type { Counterparty, DocumentDirection, DocumentType, SigningRouteRequest } from '../model/types';
import { mapDocumentFlowError } from '../utils/apiErrorMapper';
import { normalizeBin } from '../utils/counterpartyForm';

interface FormValues {
  documentType: DocumentType | '';
  title: string;
  counterpartyId: string;
  description: string;
  documentNumber: string;
  documentDate: string;
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

const draftKey = 'document-flow:create-draft';

export default function CreateDocumentPage() {
  const access = useDocumentFlowContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createKey = useRef(crypto.randomUUID());
  const createdId = useRef<number | null>(null);
  const uploaded = useRef(false);
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
    defaultValues: { documentType: '', title: '', counterpartyId: '', description: '', documentNumber: '', documentDate: new Date().toISOString().slice(0, 10), comment: '' },
  });
  const quickForm = useForm<QuickCounterpartyValues>({ defaultValues: { bin: '', name: '' } });
  const values = watch();
  const types = useQuery({ queryKey: documentFlowKeys.documentTypes(), queryFn: ({ signal }) => documentFlowApi.documentTypes(signal) });
  const counterparties = useQuery({
    queryKey: documentFlowKeys.counterparties({ page: 0, size: 20, status: 'ACTIVE' }),
    queryFn: ({ signal }) => documentFlowApi.getCounterparties({ page: 0, size: 20, signal }),
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
      await queryClient.invalidateQueries({ queryKey: documentFlowKeys.counterpartyLists() });
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
  const fileError = file && selectedType ? validateDocumentFile(file, selectedType) : null;
  const routeInvalid = !route.steps.length || route.steps.some((item) =>
    !validateRequiredCount(item.requiredCount, item.assignments.length)
    || !item.assignments.length
    || item.assignments.some((assignment) => assignment.signerType === 'ORGANIZATION_MEMBER' ? !assignment.userId : !assignment.email)
  );

  useEffect(() => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Partial<FormValues>;
      reset({ ...getValues(), ...saved });
      setRestored(true);
    } catch { localStorage.removeItem(draftKey); }
  }, [getValues, reset]);
  useEffect(() => {
    if (!isDirty) return;
    const timer = window.setTimeout(() => localStorage.setItem(draftKey, JSON.stringify(getValues())), 500);
    return () => window.clearTimeout(timer);
  }, [getValues, isDirty, values]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (isDirty && !mutation.isSuccess) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });

  const direction = (): DocumentDirection => selectedType?.allowedDirections === 'IN' ? 'INCOMING' : 'OUTGOING';
  const ensureDraftAndFile = async (fileRequired: boolean) => {
    let id = createdId.current;
    if (!id) {
      setPhase('CREATING');
      const form = getValues();
      const document = await documentFlowApi.createDocument({
        documentType: form.documentType as DocumentType,
        direction: direction(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        counterpartyId: form.counterpartyId ? Number(form.counterpartyId) : undefined,
        documentDate: form.documentDate || undefined,
        documentNumber: form.documentNumber.trim() || undefined,
      }, createKey.current);
      id = document.id;
      createdId.current = id;
    }
    if (!uploaded.current && file) {
      setPhase('UPLOADING');
      setUploadProgress(null);
      await documentFlowApi.uploadFile(id, file, { changeReason: getValues().comment.trim() || undefined, onProgress: setUploadProgress });
      uploaded.current = true;
    }
    if (fileRequired && !uploaded.current) throw new Error('Выберите основной файл.');
    return id;
  };

  const mutation = useMutation({
    mutationFn: async (intent: 'DRAFT' | 'SUBMIT') => {
      const valid = await trigger(['documentType', 'title', 'counterpartyId']);
      if (!valid || fileError || (intent === 'SUBMIT' && (!file || routeInvalid))) throw new Error(fileError || 'Проверьте обязательные поля, файл и маршрут подписания.');
      const id = await ensureDraftAndFile(intent === 'SUBMIT');
      if (intent === 'DRAFT') return { id, signed: false };
      await documentFlowApi.createSigningRoute(id, route);
      setPhase('PREPARING');
      const fresh = await documentFlowApi.document(id);
      await documentFlowApi.prepareForSigning(id, fresh.version);
      await documentFlowApi.sendForSigning(id);
      setPhase('DONE');
      return { id, signed: false };
    },
    onSuccess: async ({ id }) => {
      localStorage.removeItem(draftKey);
      await queryClient.invalidateQueries({ queryKey: documentFlowKeys.all });
      navigate(`/document-flow/documents/${id}`);
    },
    onError: (error) => {
      const mapped = mapDocumentFlowError(error);
      Object.entries(mapped.fieldErrors).forEach(([name, message]) => setError(name as keyof FormValues, { message }));
    },
  });
  const next = async () => {
    const valid = await trigger(['documentType', 'title', 'counterpartyId']);
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
          <TextField label="Название" {...register('title', { required: 'Укажите название.', validate: (value) => Boolean(value.trim()) || 'Укажите название.' })} error={Boolean(errors.title)} helperText={errors.title?.message} />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}><TextField fullWidth type="date" label="Дата документа" InputLabelProps={{ shrink: true }} {...register('documentDate')} /><TextField fullWidth label="Номер" placeholder="Будет присвоен автоматически" {...register('documentNumber')} /></Stack>
          {selectedType?.counterpartyRequired && <Controller name="counterpartyId" control={control} rules={{ required: 'Выберите контрагента.' }} render={({ field }) => <FormControl fullWidth error={Boolean(errors.counterpartyId)}><InputLabel>Контрагент</InputLabel><Select {...field} label="Контрагент" onChange={(event) => event.target.value === '__new__' ? setQuickOpen(true) : field.onChange(event)}><MenuItem value="__new__">+ Новый контрагент</MenuItem>{activeCounterparties.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name} · {item.bin}</MenuItem>)}</Select></FormControl>} />}
          <TextField label="Описание" multiline minRows={3} {...register('description')} />
          <Box textAlign="right"><Button variant="contained" onClick={next}>Далее</Button></Box>
        </Stack>}
        {step === 1 && <Stack spacing={3}>
          <DocumentFileUploader config={selectedType} file={file} onChange={(next) => { setFile(next); uploaded.current = false; }} progress={uploadProgress} disabled={mutation.isPending} />
          <TextField label="Комментарий" multiline minRows={2} {...register('comment')} />
          {selectedType?.signingRequired && <Alert severity="info">Подписание выполняется только через backend-маршрут: маршрут → подготовка → отправка → подписи.</Alert>}
          <><Button variant="text" onClick={() => setAdvanced((value) => !value)}>Настройки маршрута подписания</Button><Collapse in={advanced}><SigningRouteBuilder access={access} value={route} onChange={setRoute} /></Collapse></>
          {phase && <Box><Stepper activeStep={activePhase} alternativeLabel sx={{ display: { xs: 'none', md: 'flex' } }}>{phases.map((item) => <Step key={item.key}><StepLabel>{item.label}</StepLabel></Step>)}</Stepper><LinearProgress sx={{ mt: 2 }} /></Box>}
          {error && <Alert severity="error">{error.message}{error.code === 'NCALAYER_NOT_AVAILABLE' && ' Запустите NCALayer и нажмите кнопку ещё раз — документ повторно не создастся.'}</Alert>}
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="space-between" gap={1}>
            <Button disabled={mutation.isPending} onClick={() => setStep(0)}>Назад</Button>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><Button disabled={mutation.isPending} onClick={() => mutation.mutate('DRAFT')}>Сохранить черновик</Button><Button variant="contained" disabled={mutation.isPending || !file || Boolean(fileError || routeInvalid)} onClick={() => mutation.mutate('SUBMIT')}>Создать и отправить на подписание</Button></Stack>
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
