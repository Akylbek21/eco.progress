import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type AgreementResponseAction = 'ACCEPTED' | 'REVISION_REQUESTED' | 'SIGNED';
export type AgreementResponseValues = {
  action: AgreementResponseAction;
  comment: string;
};

type AgreementResponseModalProps = {
  isOpen: boolean;
  documentName: string;
  description?: string;
  version?: number;
  documentDate?: string;
  loading?: boolean;
  onDownload: () => void | Promise<void>;
  onClose: () => void;
  onSubmit: (values: AgreementResponseValues) => void | Promise<void>;
};

const AgreementResponseModal = ({ isOpen, documentName, description, version, documentDate, loading = false, onDownload, onClose, onSubmit }: AgreementResponseModalProps) => {
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    const action = String(form.get('action') || 'ACCEPTED') as AgreementResponseAction;
    const comment = String(form.get('comment') || '').trim();
    if (!reviewed) {
      setError('Сначала скачайте и ознакомьтесь с документом.');
      return;
    }
    if (action === 'REVISION_REQUESTED' && !comment) {
      setError('Для запроса исправления укажите комментарий.');
      return;
    }
    try {
      await onSubmit({
        action,
        comment,
      });
      setReviewed(false);
      onClose();
    } catch {
      setError('Не удалось отправить ответ.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Согласование документа" description={documentName} loading={loading}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          {description && <p>{description}</p>}
          <p className="mt-1 text-xs text-slate-500">Версия: {version || 1} · Дата: {documentDate || 'не указана'}</p>
          <Button type="button" variant="secondary" disabled={loading} className="mt-3" onClick={async () => {
            setError('');
            try { await onDownload(); setReviewed(true); } catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : 'Не удалось скачать документ.'); }
          }}>Скачать и ознакомиться</Button>
        </div>
        <label className="text-sm font-semibold text-slate-700">
          Действие
          <select name="action" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option value="ACCEPTED">Принять</option>
            <option value="REVISION_REQUESTED">Запросить исправление</option>
            <option value="SIGNED">Подписать через ЭЦП</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Комментарий
          <textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={loading || !reviewed}>Отправить ответ</Button>
        </div>
      </form>
    </Modal>
  );
};

export default AgreementResponseModal;
