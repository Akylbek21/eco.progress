import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type StatusChangeValues<TStatus extends string = string> = {
  status: TStatus;
  comment: string;
  reason: string;
};

type StatusChangeModalProps<TStatus extends string = string> = {
  isOpen: boolean;
  title?: string;
  currentStatus?: string;
  statuses: readonly TStatus[];
  labels?: Partial<Record<TStatus, string>>;
  defaultStatus?: TStatus;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: StatusChangeValues<TStatus>) => void | Promise<void>;
};

const StatusChangeModal = <TStatus extends string = string>({
  isOpen,
  title = 'Изменить статус',
  currentStatus,
  statuses,
  labels,
  defaultStatus,
  loading = false,
  onClose,
  onSubmit,
}: StatusChangeModalProps<TStatus>) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit({
        status: String(form.get('status')) as TStatus,
        comment: String(form.get('comment') || ''),
        reason: String(form.get('reason') || ''),
      });
      onClose();
    } catch {
      setError('Не удалось изменить статус.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={currentStatus ? `Текущий статус: ${currentStatus}` : undefined} loading={loading}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">Новый статус<select name="status" defaultValue={defaultStatus ?? statuses[0]} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">{statuses.map((status) => <option key={status} value={status}>{labels?.[status] ?? status}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Причина изменения<input name="reason" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Комментарий<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={loading}>Сохранить статус</Button>
        </div>
      </form>
    </Modal>
  );
};

export default StatusChangeModal;
