import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type AgreementResponseAction = 'accept' | 'reject' | 'sign';
export type AgreementResponseValues = {
  action: AgreementResponseAction;
  comment: string;
};

type AgreementResponseModalProps = {
  isOpen: boolean;
  documentName: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: AgreementResponseValues) => void | Promise<void>;
};

const AgreementResponseModal = ({ isOpen, documentName, loading = false, onClose, onSubmit }: AgreementResponseModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await onSubmit({
        action: String(form.get('action') || 'accept') as AgreementResponseAction,
        comment: String(form.get('comment') || ''),
      });
      onClose();
    } catch {
      setError('Не удалось отправить ответ.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Согласование документа" description={documentName} loading={loading}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">
          Действие
          <select name="action" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option value="accept">Принять</option>
            <option value="reject">Отклонить / запросить исправление</option>
            <option value="sign">Подписать через ЭЦП</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Комментарий
          <textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit">Отправить ответ</Button>
        </div>
      </form>
    </Modal>
  );
};

export default AgreementResponseModal;
