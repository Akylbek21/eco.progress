import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { type FormEvent, useEffect, useState } from 'react';
import type { PekSubmissionMethod, PekSubmissionRecord } from '../../api/pekContracts';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const pekSubmissionMethodLabels: Record<PekSubmissionMethod, string> = {
  ECO_PORTAL: 'Экологический портал',
  EGOV_PORTAL: 'Портал eGov',
  EMAIL: 'Электронная почта',
  PAPER: 'Бумажная подача',
  COURIER: 'Курьер',
  OTHER: 'Другое',
};

export type PekSubmissionDraft = {
  submissionMethod: PekSubmissionMethod;
  registrationNumber: string;
  submittedAt: string;
  submissionComment: string;
  confirmationFile: File | null;
};

type Props = {
  open: boolean;
  pending: boolean;
  submission?: PekSubmissionRecord | null;
  defaultSubmittedAt?: string | null;
  onClose: () => void;
  onSubmit: (draft: PekSubmissionDraft) => void;
};

const localDateTimeValue = (value?: string | null) => {
  if (value) return value.slice(0, 16);
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const initialDraft = (submission?: PekSubmissionRecord | null, defaultSubmittedAt?: string | null): PekSubmissionDraft => ({
  submissionMethod: submission?.submissionMethod || 'EGOV_PORTAL',
  registrationNumber: submission?.registrationNumber || '',
  submittedAt: localDateTimeValue(submission?.submittedAt || defaultSubmittedAt),
  submissionComment: submission?.submissionComment || '',
  confirmationFile: null,
});

const PekReportSubmissionDialog = ({ open, pending, submission, defaultSubmittedAt, onClose, onSubmit }: Props) => {
  const [draft, setDraft] = useState<PekSubmissionDraft>(() => initialDraft(submission, defaultSubmittedAt));
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initialDraft(submission, defaultSubmittedAt));
    setFileError(null);
  }, [open]);

  const update = <K extends keyof PekSubmissionDraft>(key: K, value: PekSubmissionDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const handleFile = (file: File | null) => {
    if (file && file.size > MAX_FILE_SIZE) {
      update('confirmationFile', null);
      setFileError('Размер файла не должен превышать 25 МБ.');
      return;
    }
    update('confirmationFile', file);
    setFileError(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.submittedAt || fileError) return;
    onSubmit(draft);
  };

  const otherCommentMissing = draft.submissionMethod === 'OTHER' && !draft.submissionComment.trim();
  const registrationNumberMissing = ['ECO_PORTAL', 'EGOV_PORTAL'].includes(draft.submissionMethod) && !draft.registrationNumber.trim();

  return (
    <Dialog open={open} onClose={() => !pending && onClose()} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit}>
        <DialogTitle>{submission ? 'Изменить сведения о сдаче' : 'Отметить отчёт как сданный'}</DialogTitle>
        <DialogContent dividers className="space-y-4">
          <Alert severity="info">
            Укажите фактические сведения о передаче подписанного отчёта. Система сохраняет запись, но не отправляет отчёт в государственный орган автоматически.
          </Alert>
          <TextField
            select
            required
            fullWidth
            label="Способ сдачи"
            value={draft.submissionMethod}
            onChange={(event) => update('submissionMethod', event.target.value as PekSubmissionMethod)}
          >
            {Object.entries(pekSubmissionMethodLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField
            required={['ECO_PORTAL', 'EGOV_PORTAL'].includes(draft.submissionMethod)}
            fullWidth
            label="Регистрационный номер"
            error={registrationNumberMissing}
            helperText={registrationNumberMissing ? 'Для сдачи через портал укажите регистрационный номер.' : undefined}
            value={draft.registrationNumber}
            onChange={(event) => update('registrationNumber', event.target.value)}
          />
          <TextField
            required
            fullWidth
            type="datetime-local"
            label="Дата сдачи"
            value={draft.submittedAt}
            inputProps={{ max: localDateTimeValue() }}
            InputLabelProps={{ shrink: true }}
            onChange={(event) => update('submittedAt', event.target.value)}
          />
          <TextField
            fullWidth
            multiline
            minRows={3}
            required={draft.submissionMethod === 'OTHER'}
            label={draft.submissionMethod === 'OTHER' ? 'Комментарий *' : 'Комментарий'}
            helperText={otherCommentMissing ? 'Для способа «Другое» опишите способ сдачи.' : undefined}
            error={otherCommentMissing}
            value={draft.submissionComment}
            onChange={(event) => update('submissionComment', event.target.value)}
          />
          <label className="block rounded-xl border border-dashed border-slate-300 p-4">
            <span className="block text-sm font-bold text-slate-700">Файл подтверждения</span>
            <input
              key={open ? `open-${submission?.updatedAt || submission?.createdAt || 'new'}` : 'closed'}
              className="mt-2 block w-full text-sm"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={(event) => handleFile(event.target.files?.[0] || null)}
            />
            <span className="mt-2 block text-xs text-slate-500">PDF, Word, Excel, JPG или PNG, до 25 МБ.</span>
            {submission?.confirmationFileId && !draft.confirmationFile && <span className="mt-1 block text-xs font-semibold text-eco-700">Ранее загруженный файл будет сохранён.</span>}
            {draft.confirmationFile && <span className="mt-1 block text-xs font-semibold text-eco-700">Выбран: {draft.confirmationFile.name}</span>}
            {fileError && <span className="mt-1 block text-xs font-semibold text-rose-700">{fileError}</span>}
          </label>
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={onClose}>Отмена</Button>
          <Button type="submit" color="success" variant="contained" disabled={pending || !draft.submittedAt || otherCommentMissing || registrationNumberMissing || Boolean(fileError)}>
            {pending ? 'Сохранение…' : submission ? 'Сохранить' : 'Отметить как сданный'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PekReportSubmissionDialog;
