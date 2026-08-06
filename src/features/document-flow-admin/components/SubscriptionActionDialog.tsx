import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { mapDocumentFlowError } from '../../document-flow/utils/apiErrorMapper';

interface Props {
  open: boolean;
  title: string;
  warning?: string;
  dateLabel?: string;
  currentDate?: string | null;
  requireDate?: boolean;
  pending: boolean;
  error?: unknown;
  onClose: () => void;
  onSubmit: (reason: string, date?: string) => void;
}

export default function SubscriptionActionDialog({ open, title, warning, dateLabel, currentDate, requireDate, pending, error, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => { if (open) { setReason(''); setDate(''); } }, [open]);
  const mapped = error ? mapDocumentFlowError(error) : null;
  const days = date && currentDate ? Math.ceil((new Date(date).getTime() - new Date(currentDate).getTime()) / 86_400_000) : null;
  return <Dialog open={open} onClose={() => !pending && onClose()} fullWidth maxWidth="sm"><DialogTitle>{title}</DialogTitle><DialogContent>
    {warning && <Alert severity="warning" sx={{ mb: 2 }}>{warning}</Alert>}
    {currentDate && <Alert severity="info" sx={{ mb: 2 }}>Текущая дата окончания: {new Date(currentDate).toLocaleString('ru-RU')}</Alert>}
    {requireDate && <TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} label={dateLabel || 'Новая дата окончания'} value={date} onChange={(event) => setDate(event.target.value)} helperText={days == null ? '' : `Изменение: ${days} дней`} sx={{ mb: 2 }} />}
    <TextField fullWidth multiline minRows={3} inputProps={{ maxLength: 1000 }} label="Причина" required value={reason} onChange={(event) => setReason(event.target.value)} error={reason.length > 0 && reason.trim().length < 5} helperText={`${reason.trim().length}/1000, минимум 5 символов`} />
    {mapped && <Alert severity={mapped.status === 409 || mapped.status === 412 ? 'warning' : 'error'} sx={{ mt: 2 }}>{mapped.message}{mapped.traceId && <span> · Trace ID: {mapped.traceId}</span>}</Alert>}
  </DialogContent><DialogActions><Button disabled={pending} onClick={onClose}>Отмена</Button><Button variant="contained" color={title.includes('Отозвать') ? 'error' : 'primary'} disabled={pending || reason.trim().length < 5 || (requireDate && !date)} onClick={() => onSubmit(reason.trim(), date || undefined)}>{pending ? 'Выполнение…' : 'Подтвердить'}</Button></DialogActions></Dialog>;
}

