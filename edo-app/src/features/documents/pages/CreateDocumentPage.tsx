import { useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Grid, LinearProgress, MenuItem, Paper, Radio, RadioGroup, Stack, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDocumentTypes } from '../hooks/useDocuments';
import { documentsApi } from '../api/documentsApi';
import { documentKeys } from '../api/documentKeys';
import { mapApiError } from '../../../shared/api/apiError';

const stepLabels = ['Тип', 'Контрагент', 'Данные', 'Файлы', 'Подписанты', 'Порядок', 'Предпросмотр', 'Подтверждение'];

export const CreateDocumentPage = () => {
  const navigate = useNavigate();
  const client = useQueryClient();
  const types = useDocumentTypes();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [values, setValues] = useState({ typeId: '', counterpartyId: '', title: '', number: '', description: '', dueAt: '', signerIds: '', routeMode: 'SEQUENTIAL' });
  const [files, setFiles] = useState<File[]>([]);
  const issues = useMemo(() => [
    !values.typeId && 'Выберите тип документа',
    !values.counterpartyId && 'Выберите контрагента',
    !values.title.trim() && 'Укажите название',
    files.length === 0 && 'Добавьте основной файл',
    !values.signerIds.split(',').some((item) => item.trim()) && 'Добавьте хотя бы одного обязательного подписанта',
  ].filter(Boolean) as string[], [values, files]);
  const mutation = useMutation({
    mutationFn: async () => {
      const document = await documentsApi.createDraft({
        typeId: values.typeId,
        counterpartyId: values.counterpartyId,
        title: values.title,
        number: values.number || undefined,
        description: values.description || undefined,
        dueAt: values.dueAt || undefined,
        route: { mode: values.routeMode, signerIds: values.signerIds.split(',').map((item) => item.trim()).filter(Boolean) },
      }, idempotencyKey.current);
      for (const file of files) await documentsApi.upload(document.id, file, undefined, setUploadProgress);
      return documentsApi.send(document.id, document.version, crypto.randomUUID());
    },
    onSuccess: async (document) => {
      client.setQueryData(documentKeys.details(document.id), document);
      await client.invalidateQueries({ queryKey: documentKeys.dashboard });
      navigate(`/app/documents/${document.id}`);
    },
    onError: (requestError) => setError(mapApiError(requestError, 'Не удалось создать документ.').message),
  });
  const canNext = step < 7 || issues.length === 0;
  return (
    <Stack spacing={3}>
      <div><Typography variant="h4" fontWeight={900}>Новый документ</Typography><Typography color="text.secondary">Серверный черновик создаётся при подтверждении; повторная отправка защищена Idempotency-Key.</Typography></div>
      <Stepper activeStep={step} alternativeLabel sx={{ overflowX: 'auto' }}>{stepLabels.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
      {error && <Alert severity="error">{error}</Alert>}
      {mutation.isPending && <LinearProgress variant={uploadProgress ? 'determinate' : 'indeterminate'} value={uploadProgress} />}
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, minHeight: 360 }}>
        {step === 0 && <TextField select label="Тип документа" value={values.typeId} onChange={(event) => setValues({ ...values, typeId: event.target.value })}>{types.data?.filter((type) => type.direction === 'OUTGOING').map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}</TextField>}
        {step === 1 && <Stack spacing={2}><Alert severity="info">Поиск контрагента выполняется через отдельный API. Укажите ID выбранной backend-записи.</Alert><TextField label="ID контрагента" value={values.counterpartyId} onChange={(event) => setValues({ ...values, counterpartyId: event.target.value })} /></Stack>}
        {step === 2 && <Grid container spacing={2}><Grid size={{ xs: 12 }}><TextField label="Название" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField label="Номер" value={values.number} onChange={(event) => setValues({ ...values, number: event.target.value })} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField label="Срок подписания" type="datetime-local" InputLabelProps={{ shrink: true }} value={values.dueAt} onChange={(event) => setValues({ ...values, dueAt: event.target.value })} /></Grid><Grid size={{ xs: 12 }}><TextField multiline minRows={4} label="Описание" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} /></Grid></Grid>}
        {step === 3 && <Stack spacing={2}><Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>Добавить файлы<input hidden multiple type="file" accept=".pdf,.docx,.xlsx,image/*" onChange={(event) => setFiles(Array.from(event.target.files || []))} /></Button>{files.map((file) => <Paper key={`${file.name}-${file.size}`} variant="outlined" sx={{ p: 2 }}><Typography fontWeight={700}>{file.name}</Typography><Typography variant="caption">{(file.size / 1024 / 1024).toFixed(2)} МБ · {file.type || 'неизвестный MIME'}</Typography></Paper>)}</Stack>}
        {step === 4 && <Stack spacing={2}><Alert severity="info">Полный ИИН не сохраняется локально. Выберите backend IDs участников через API сотрудников/контрагентов.</Alert><TextField label="ID подписантов через запятую" value={values.signerIds} onChange={(event) => setValues({ ...values, signerIds: event.target.value })} /></Stack>}
        {step === 5 && <RadioGroup value={values.routeMode} onChange={(event) => setValues({ ...values, routeMode: event.target.value })}><FormControlLabel value="SEQUENTIAL" control={<Radio />} label="Последовательно" /><FormControlLabel value="PARALLEL" control={<Radio />} label="Параллельно" /><FormControlLabel value="MIXED" control={<Radio />} label="Смешанный маршрут" /></RadioGroup>}
        {step === 6 && <Stack spacing={2}><Typography variant="h6" fontWeight={900}>Предпросмотр</Typography><Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}><Typography fontWeight={800}>{values.title || 'Без названия'}</Typography><Typography variant="body2">Файлов: {files.length} · режим: {values.routeMode}</Typography></Box><Alert severity="info">PDF preview загружается с backend и не эмулируется в браузере.</Alert></Stack>}
        {step === 7 && <Stack spacing={2}><Typography variant="h6" fontWeight={900}>Проверка перед отправкой</Typography>{issues.length ? <Alert severity="warning"><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></Alert> : <Alert severity="success">Документ готов к отправке на подписание.</Alert>}</Stack>}
      </Paper>
      <Stack direction="row" justifyContent="space-between"><Button disabled={step === 0 || mutation.isPending} onClick={() => setStep((value) => value - 1)}>Назад</Button>{step < 7 ? <Button variant="contained" onClick={() => setStep((value) => value + 1)}>Продолжить</Button> : <Button variant="contained" disabled={!canNext || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Отправляем…' : 'Отправить на подписание'}</Button>}</Stack>
    </Stack>
  );
};
