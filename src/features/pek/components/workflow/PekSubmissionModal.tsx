import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import type { PekAvailableAction } from '../../api/pekContracts';

const PekSubmissionModal = ({ action, version, pending, onClose, onSubmit }: {
  action: PekAvailableAction | null;
  version: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (body: FormData) => void;
}) => {
  const [channel, setChannel] = useState('');
  const [date, setDate] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [comment, setComment] = useState('');
  const [result, setResult] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [reason, setReason] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  if (!action || !['REGISTER_SUBMISSION', 'REGISTER_RESULT'].includes(action.code)) return null;
  const resultMode = action.code === 'REGISTER_RESULT';
  const valid = resultMode
    ? Boolean(date && (result === 'ACCEPTED' || reason.trim()))
    : Boolean(channel && date && registrationNumber.trim());
  const submit = () => {
    const body = new FormData();
    body.append('version', String(version));
    body.append('date', date);
    body.append('comment', comment.trim());
    if (resultMode) {
      body.append('result', result);
      if (reason.trim()) body.append('reason', reason.trim());
    } else {
      body.append('channel', channel);
      body.append('registrationNumber', registrationNumber.trim());
    }
    if (receipt) body.append('receipt', receipt);
    onSubmit(body);
  };

  return <Modal open title={resultMode ? 'Зарегистрировать результат рассмотрения' : 'Зарегистрировать отправку'} loading={pending} onClose={onClose} footer={<><Button variant="secondary" disabled={pending} onClick={onClose}>Отмена</Button><Button disabled={pending || !valid} onClick={submit}>Зарегистрировать</Button></>}>
    <div className="grid gap-3">
      {resultMode
        ? <label>Результат<select value={result} onChange={(event) => setResult(event.target.value as 'ACCEPTED' | 'REJECTED')} className="mt-1 w-full rounded-xl border p-3"><option value="ACCEPTED">Принят</option><option value="REJECTED">Отклонён</option></select></label>
        : <label>Канал отправки *<select value={channel} onChange={(event) => setChannel(event.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="">Выберите канал</option><option value="CABINET">Личный кабинет</option><option value="EMAIL">Электронная почта</option><option value="PAPER">На бумаге</option><option value="OTHER">Другой</option></select></label>}
      <label>Дата *<input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
      {!resultMode && <label>Регистрационный номер *<input value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>}
      {resultMode && result === 'REJECTED' && <label>Причина отклонения *<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3" /></label>}
      <label>Квитанция или подтверждение<input type="file" onChange={(event) => setReceipt(event.target.files?.[0] || null)} className="mt-1 w-full rounded-xl border p-3" /></label>
      <label>Комментарий<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3" /></label>
    </div>
  </Modal>;
};

export default PekSubmissionModal;
