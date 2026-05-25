import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type CommentValues = { text: string; visibility: 'client' | 'internal' };

type CommentModalProps = {
  isOpen: boolean;
  title?: string;
  defaultVisibility?: 'client' | 'internal';
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: CommentValues) => void | Promise<void>;
};

const CommentModal = ({ isOpen, title = 'Добавить комментарий', defaultVisibility = 'client', loading = false, onClose, onSubmit }: CommentModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await onSubmit({ text: String(form.get('text') || ''), visibility: String(form.get('visibility') || defaultVisibility) as CommentValues['visibility'] });
      event.currentTarget.reset();
      onClose();
    } catch {
      setError('Не удалось добавить комментарий.');
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} loading={loading}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">Видимость<select name="visibility" defaultValue={defaultVisibility} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="client">Клиенту</option><option value="internal">Внутренняя заметка</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Комментарий<textarea name="text" required rows={4} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit">Отправить</Button></div>
      </form>
    </Modal>
  );
};

export default CommentModal;
