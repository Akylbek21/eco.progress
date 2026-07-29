import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, Step, StepLabel, Stepper,
  TextField, Typography,
} from '@mui/material';
import { documentFlowDocumentsApi } from '../api/documentFlowApi';
import { useDocumentFlowAccess } from '../access/DocumentFlowAccessProvider';
import { getDocumentFlowError } from '../utils/errors';
import type { DocumentRouteMode, DocumentSigner } from '../types';

const schema = z.object({
  type: z.string().min(1, 'Выберите тип'),
  counterpartyId: z.string().min(1, 'Укажите контрагента'),
  title: z.string().trim().min(3, 'Минимум 3 символа').max(250),
  number: z.string().trim().min(1, 'Укажите номер'),
  dueAt: z.string().optional(),
  description: z.string().max(2000).optional(),
});
type Values = z.infer<typeof schema>;
const steps = ['Тип', 'Контрагент', 'Данные', 'Файлы', 'Подписанты', 'Маршрут', 'Предпросмотр', 'Подтверждение'];

const DocumentFlowCreatePage = () => {
  const navigate = useNavigate();
  const { access, can, hasFeature, hasAction } = useDocumentFlowAccess();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [signers, setSigners] = useState<DocumentSigner[]>([]);
  const [routeMode, setRouteMode] = useState<DocumentRouteMode>('SEQUENTIAL');
  const [issues, setIssues] = useState<string[]>([]);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { type: '', counterpartyId: '', title: '', number: '', dueAt: '', description: '' } });
  const mutation = useMutation({
    retry: false,
    mutationFn: async (values: Values) => {
      const payload = new FormData();
      payload.append('metadata', new Blob([JSON.stringify({ ...values, signers, routeMode })], { type: 'application/json' }));
      if (file) payload.append('file', file);
      attachments.forEach((attachment) => payload.append('attachments', attachment));
      return documentFlowDocumentsApi.createDraft(payload, crypto.randomUUID());
    },
    onSuccess: (document) => navigate(`/document-flow/app/documents/${document.id}`),
  });
  const unavailable = access.readOnly || !can('DOCUMENT_CREATE') || !hasAction('CREATE_DOCUMENT');
  if (unavailable) return <Alert severity="warning">Создание документа недоступно согласно ответу backend.</Alert>;

  const validateStep = async () => {
    if (step === 0 && !await form.trigger('type')) return;
    if (step === 1 && !await form.trigger('counterpartyId')) return;
    if (step === 2 && !await form.trigger(['title', 'number'])) return;
    if (step === 3 && !file) { setIssues(['Добавьте основной файл документа.']); return; }
    if (step === 4 && signers.length === 0) { setIssues(['Добавьте минимум одного подписанта.']); return; }
    setIssues([]);
    setStep((value) => Math.min(7, value + 1));
  };
  const addSigner = () => setSigners((current) => [...current, {
    fullName: '', email: '', required: true, step: current.length + 1, external: false,
  }]);
  const updateSigner = (index: number, patch: Partial<DocumentSigner>) => setSigners((current) => current.map((signer, position) => position === index ? { ...signer, ...patch } : signer));
  const canUseMode = (mode: DocumentRouteMode) => mode === 'SEQUENTIAL'
    ? hasFeature('SEQUENTIAL_SIGNING')
    : mode === 'PARALLEL' ? hasFeature('PARALLEL_SIGNING') : hasFeature('MIXED_SIGNING');
  const values = form.getValues();

  return (
    <Box>
      <Typography variant="h4" fontWeight={950}>Создание документа</Typography>
      <Stepper activeStep={step} alternativeLabel sx={{ mt: 3, display: { xs: 'none', md: 'flex' } }}>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
      <Typography sx={{ display: { md: 'none' }, mt: 2 }} fontWeight={800}>Шаг {step + 1} из 8 · {steps[step]}</Typography>
      <Paper variant="outlined" sx={{ mt: 3, p: { xs: 2, md: 3 }, borderRadius: 3 }}>
        {step === 0 && <TextField select fullWidth label="Тип документа" defaultValue="" {...form.register('type')} error={!!form.formState.errors.type} helperText={form.formState.errors.type?.message}><MenuItem value="CONTRACT">Договор</MenuItem><MenuItem value="ACT">Акт</MenuItem><MenuItem value="FREE_FORM">Произвольный документ</MenuItem><MenuItem value="ECO_REPORT">Экологический отчёт</MenuItem></TextField>}
        {step === 1 && <TextField fullWidth label="ID контрагента" {...form.register('counterpartyId')} error={!!form.formState.errors.counterpartyId} helperText={form.formState.errors.counterpartyId?.message || 'Поиск и проверка дубля по БИН выполняются backend.'} />}
        {step === 2 && <Stack spacing={2}><TextField label="Название" {...form.register('title')} error={!!form.formState.errors.title} helperText={form.formState.errors.title?.message} /><TextField label="Номер" {...form.register('number')} error={!!form.formState.errors.number} helperText={form.formState.errors.number?.message} /><TextField type="date" label="Срок подписания" InputLabelProps={{ shrink: true }} {...form.register('dueAt')} /><TextField multiline minRows={3} label="Описание" {...form.register('description')} /></Stack>}
        {step === 3 && <Stack spacing={2}><Button component="label" variant="outlined">Основной файл PDF/DOCX/XLSX/изображение<input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} /></Button>{file && <Typography>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} МБ</Typography>}<Button component="label">Добавить вложения<input hidden multiple type="file" onChange={(event) => setAttachments(Array.from(event.target.files || []))} /></Button>{attachments.map((item) => <Typography key={`${item.name}-${item.size}`} variant="body2">{item.name}</Typography>)}</Stack>}
        {step === 4 && <Stack spacing={2}>{signers.map((signer, index) => <Paper key={index} variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}><TextField label="ФИО" value={signer.fullName} onChange={(event) => updateSigner(index, { fullName: event.target.value })} /><TextField label="Email" value={signer.email} onChange={(event) => updateSigner(index, { email: event.target.value })} /><TextField label="Шаг" type="number" value={signer.step} onChange={(event) => updateSigner(index, { step: Number(event.target.value) })} /><FormControlLabel control={<Checkbox checked={signer.required} onChange={(event) => updateSigner(index, { required: event.target.checked })} />} label="Обязательная подпись" />{hasFeature('EXTERNAL_SIGNING') && <FormControlLabel control={<Checkbox checked={signer.external} onChange={(event) => updateSigner(index, { external: event.target.checked })} />} label="Внешний подписант" />}</Stack></Paper>)}<Button onClick={addSigner} disabled={signers.length > 0 && !hasFeature('MULTI_SIGNING')}>Добавить подписанта</Button>{!hasFeature('MULTI_SIGNING') && <Alert severity="info">Несколько подписантов не входят в текущий тариф.</Alert>}</Stack>}
        {step === 5 && <Stack spacing={2}>{(['SEQUENTIAL', 'PARALLEL', 'MIXED'] as DocumentRouteMode[]).map((mode) => <Button key={mode} variant={routeMode === mode ? 'contained' : 'outlined'} disabled={!canUseMode(mode)} onClick={() => setRouteMode(mode)}>{mode}</Button>)}<Alert severity="info">После начала подписания маршрут становится неизменяемым.</Alert></Stack>}
        {step === 6 && <Stack spacing={1}><Typography variant="h6" fontWeight={900}>{values.number} · {values.title}</Typography><Typography>Тип: {values.type}</Typography><Typography>Контрагент: {values.counterpartyId}</Typography><Typography>Файл: {file?.name}</Typography><Typography>Подписантов: {signers.length}</Typography><Typography>Маршрут: {routeMode}</Typography></Stack>}
        {step === 7 && <Alert severity="info">Будет создан серверный черновик. Отправка и подпись выполняются отдельными backend-controlled действиями.</Alert>}
        {issues.length > 0 && <Alert severity="error" sx={{ mt: 2 }}>{issues.join(' ')}</Alert>}
        {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>{getDocumentFlowError(mutation.error, 'Не удалось создать черновик.').message}</Alert>}
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}><Button disabled={step === 0 || mutation.isPending} onClick={() => setStep((value) => value - 1)}>Назад</Button>{step < 7 ? <Button variant="contained" onClick={() => void validateStep()}>Продолжить</Button> : <Button variant="contained" disabled={mutation.isPending || issues.length > 0} onClick={form.handleSubmit((data) => mutation.mutate(data))}>{mutation.isPending ? 'Создание…' : 'Создать черновик'}</Button>}</Stack>
      </Paper>
    </Box>
  );
};

export default DocumentFlowCreatePage;

