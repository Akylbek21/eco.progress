import { useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, FormControl, InputLabel, LinearProgress, MenuItem, Paper, Select,
  Stack, Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { mapCreateDocumentPayload } from '../mappers/documentMappers';
import type { DocumentDirection, DocumentType, SigningRouteRequest } from '../model/types';
import { hasFeature, validateDocumentFile, validateRequiredCount } from '../model/access';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import SigningRouteBuilder from '../components/SigningRouteBuilder';

const steps = ['Тип документа', 'Направление', 'Основные сведения', 'Контрагент', 'Файл', 'Маршрут подписания', 'Проверка'];

export default function CreateDocumentPage() {
  const access = useDocumentFlowContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ documentType: '' as DocumentType | '', direction: '' as DocumentDirection | '', title: '', description: '', counterpartyId: '', signingDeadline: '' });
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [route, setRoute] = useState<SigningRouteRequest>({ routeType: 'SEQUENTIAL', steps: [{ requiredCount: 1, assignments: [{ signerType: 'ORGANIZATION_MEMBER', required: true }] }] });
  const types = useQuery({ queryKey: documentFlowKeys.documentTypes(), queryFn: ({ signal }) => documentFlowApi.documentTypes(signal) });
  const counterparties = useQuery({ queryKey: documentFlowKeys.counterparties({ page: 0 }), queryFn: ({ signal }) => documentFlowApi.counterparties(0, 100, undefined, signal) });
  const selectedType = useMemo(() => types.data?.find((item) => item.type === form.documentType), [types.data, form.documentType]);
  const allowedDirections: DocumentDirection[] = selectedType?.allowedDirections === 'IN'
    ? ['INCOMING', 'INTERNAL'] : selectedType?.allowedDirections === 'OUT'
      ? ['OUTGOING', 'INTERNAL'] : ['INCOMING', 'OUTGOING', 'INTERNAL'];
  const validation = !form.documentType ? 'Выберите тип документа.'
    : !form.direction ? 'Выберите направление.'
      : !form.title.trim() ? 'Укажите название.'
        : selectedType?.counterpartyRequired && !form.counterpartyId ? 'Выберите контрагента.'
          : !file ? 'Выберите файл.'
            : selectedType ? validateDocumentFile(file, selectedType) : null;
  const routeInvalid = selectedType?.signingRequired && (
    !route.steps.length || route.steps.some((item) => !validateRequiredCount(item.requiredCount, item.assignments.length))
  );
  const mutation = useMutation({
    mutationFn: async () => {
      if (!file || !form.documentType || !form.direction || validation || routeInvalid) throw new Error(validation || 'Проверьте маршрут подписания.');
      const document = await documentFlowApi.createDocument(mapCreateDocumentPayload({
        ...form,
        documentType: form.documentType,
        direction: form.direction,
      }), idempotencyKey.current);
      await documentFlowApi.uploadFile(document.id, file, { onProgress: setProgress });
      if (selectedType?.signingRequired) await documentFlowApi.createSigningRoute(document.id, route);
      return document;
    },
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: documentFlowKeys.all });
      navigate(`/document-flow/documents/${document.id}`);
    },
  });
  const field = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={800}>Новый документ</Typography>
      <Stepper activeStep={step} alternativeLabel sx={{ display: { xs: 'none', md: 'flex' } }}>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        {step === 0 && <FormControl fullWidth><InputLabel>Тип документа</InputLabel><Select label="Тип документа" value={form.documentType} onChange={(event) => { field('documentType', event.target.value); field('direction', ''); }}>{
          (types.data || []).filter((item) => item.active && (!item.requiredFeature || hasFeature(access, item.requiredFeature))).map((item) => <MenuItem key={item.type} value={item.type}>{item.title}</MenuItem>)
        }</Select></FormControl>}
        {step === 1 && <FormControl fullWidth><InputLabel>Направление</InputLabel><Select label="Направление" value={form.direction} onChange={(event) => field('direction', event.target.value)}>{allowedDirections.map((direction) => <MenuItem key={direction} value={direction}>{direction}</MenuItem>)}</Select></FormControl>}
        {step === 2 && <Stack spacing={2}><TextField label="Название" value={form.title} onChange={(event) => field('title', event.target.value)} /><TextField label="Описание" multiline minRows={4} value={form.description} onChange={(event) => field('description', event.target.value)} /><TextField label="Срок подписания" type="datetime-local" InputLabelProps={{ shrink: true }} value={form.signingDeadline} onChange={(event) => field('signingDeadline', event.target.value)} /></Stack>}
        {step === 3 && <FormControl fullWidth required={selectedType?.counterpartyRequired}><InputLabel>Контрагент</InputLabel><Select label="Контрагент" value={form.counterpartyId} onChange={(event) => field('counterpartyId', event.target.value)}><MenuItem value="">Без контрагента</MenuItem>{(counterparties.data?.items || []).map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name} · {item.bin}</MenuItem>)}</Select></FormControl>}
        {step === 4 && <Stack spacing={2}><Button component="label" variant="outlined">Выбрать файл<input hidden type="file" accept={selectedType?.allowedMimeTypes.join(',')} onChange={(event) => setFile(event.target.files?.[0] || null)} /></Button>{file && <Typography>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} МБ</Typography>}{file && selectedType && validateDocumentFile(file, selectedType) && <Alert severity="error">{validateDocumentFile(file, selectedType)}</Alert>}</Stack>}
        {step === 5 && (selectedType?.signingRequired ? <SigningRouteBuilder access={access} value={route} onChange={setRoute} /> : <Alert severity="info">Для выбранного типа backend не требует маршрут подписания.</Alert>)}
        {step === 6 && <Stack spacing={1}><Typography>Тип: {selectedType?.title}</Typography><Typography>Направление: {form.direction}</Typography><Typography>Название: {form.title}</Typography><Typography>Файл: {file?.name}</Typography>{validation && <Alert severity="error">{validation}</Alert>}{routeInvalid && <Alert severity="error">Проверьте requiredCount маршрута.</Alert>}</Stack>}
        {mutation.isPending && <Box mt={2}><LinearProgress variant={progress == null ? 'indeterminate' : 'determinate'} value={progress || 0} /></Box>}
        {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>{mutation.error.message}</Alert>}
        <Stack direction="row" justifyContent="space-between" mt={3}><Button disabled={step === 0 || mutation.isPending} onClick={() => setStep((value) => value - 1)}>Назад</Button>{step < steps.length - 1 ? <Button variant="contained" onClick={() => setStep((value) => value + 1)}>Далее</Button> : <Button variant="contained" disabled={Boolean(validation || routeInvalid || mutation.isPending)} onClick={() => mutation.mutate()}>Создать и загрузить</Button>}</Stack>
      </Paper>
    </Stack>
  );
}
