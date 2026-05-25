import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { ClientPrimaryDocumentStatus } from '../../types';

export type PrimaryDocumentReviewValues = {
  status: Extract<ClientPrimaryDocumentStatus, 'accepted' | 'needs_fix' | 'rejected'>;
  clientComment: string;
  internalComment: string;
};

type PrimaryDocumentReviewModalProps = {
  isOpen: boolean;
  documentName: string;
  fileName?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: PrimaryDocumentReviewValues) => void | Promise<void>;
};

const PrimaryDocumentReviewModal = ({ isOpen, documentName, fileName, loading = false, onClose, onSubmit }: PrimaryDocumentReviewModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await onSubmit({
        status: String(form.get('status') || 'accepted') as PrimaryDocumentReviewValues['status'],
        clientComment: String(form.get('clientComment') || ''),
        internalComment: String(form.get('internalComment') || ''),
      });
      onClose();
    } catch {
      setError('Не удалось проверить документ.');
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Проверить документ" description={`${documentName}${fileName ? ` · ${fileName}` : ''}`} loading={loading}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">Действие<select name="status" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="accepted">Принять документ</option><option value="needs_fix">Запросить исправление</option><option value="rejected">Отклонить документ</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Комментарий клиенту<textarea name="clientComment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Внутренний комментарий<textarea name="internalComment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit">Сохранить проверку</Button></div>
      </form>
    </Modal>
  );
};

export default PrimaryDocumentReviewModal;
