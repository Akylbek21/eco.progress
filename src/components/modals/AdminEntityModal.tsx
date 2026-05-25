import { FormEvent, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type AdminEntityType = 'service' | 'news' | 'employee';

export type AdminEntityValues = {
  entityType: AdminEntityType;
  title: string;
  subtitle: string;
  description: string;
  category: string;
};

type AdminEntityModalProps = {
  isOpen: boolean;
  entityType: AdminEntityType;
  mode: 'create' | 'edit';
  initialValues?: Partial<AdminEntityValues>;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: AdminEntityValues) => void | Promise<void>;
};

const labels: Record<AdminEntityType, string> = {
  service: 'услугу',
  news: 'новость',
  employee: 'сотрудника',
};

const AdminEntityModal = ({ isOpen, entityType, mode, initialValues = {}, loading = false, onClose, onSubmit }: AdminEntityModalProps) => {
  const [error, setError] = useState('');
  const title = useMemo(() => `${mode === 'create' ? 'Добавить' : 'Редактировать'} ${labels[entityType]}`, [entityType, mode]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await onSubmit({
        entityType,
        title: String(form.get('title') || ''),
        subtitle: String(form.get('subtitle') || ''),
        description: String(form.get('description') || ''),
        category: String(form.get('category') || ''),
      });
      onClose();
    } catch {
      setError('Не удалось сохранить изменения.');
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description="Это frontend-заготовка: данные будут отправлены в callback страницы, когда появится backend API." loading={loading}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">{entityType === 'employee' ? 'Имя' : 'Название'}<input name="title" defaultValue={initialValues.title || ''} required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">{entityType === 'employee' ? 'Должность' : 'Краткое описание'}<input name="subtitle" defaultValue={initialValues.subtitle || ''} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Категория<input name="category" defaultValue={initialValues.category || ''} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Описание<textarea name="description" defaultValue={initialValues.description || ''} rows={4} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit">Сохранить</Button></div>
      </form>
    </Modal>
  );
};

export default AdminEntityModal;
