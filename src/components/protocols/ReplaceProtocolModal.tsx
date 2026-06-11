import { FormEvent } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

type Props = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

const ReplaceProtocolModal = ({ open, loading = false, onClose, onConfirm }: Props) => {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onConfirm(String(form.get('reason') || ''));
  };

  return (
    <Modal open={open} onClose={onClose} title="Создать исправленную версию">
      <form onSubmit={submit} className="space-y-4">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Причина исправления <span className="text-rose-600">*</span></span>
          <textarea name="reason" required rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100" />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Создание...' : 'Создать версию'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ReplaceProtocolModal;
