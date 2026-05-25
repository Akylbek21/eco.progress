import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type PrimaryDocumentRequestValues = {
  documents: string[];
  customName: string;
  required: boolean;
  comment: string;
  dueDate: string;
};

type PrimaryDocumentRequestModalProps = {
  isOpen: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: PrimaryDocumentRequestValues) => void | Promise<void>;
};

const templates = [
  'Карточка компании',
  'БИН / ИИН',
  'Реквизиты',
  'Договор аренды / право собственности',
  'Адрес объекта',
  'Предыдущие экологические документы',
  'Разрешения',
  'Заключения',
  'Договор на вывоз отходов',
  'Паспорт отходов',
  'Другое',
];

const PrimaryDocumentRequestModal = ({ isOpen, loading = false, onClose, onSubmit }: PrimaryDocumentRequestModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await onSubmit({
        documents: form.getAll('documents').map(String),
        customName: String(form.get('customName') || ''),
        required: form.get('required') === 'on',
        comment: String(form.get('comment') || ''),
        dueDate: String(form.get('dueDate') || ''),
      });
      onClose();
    } catch {
      setError('Не удалось запросить документы.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Запросить первичные документы" size="lg" loading={loading}>
      <form onSubmit={submit} className="grid gap-4">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((name) => (
            <label key={name} className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              <input name="documents" type="checkbox" value={name} className="mt-1 accent-[#38C7BA]" />
              {name}
            </label>
          ))}
        </div>
        <label className="text-sm font-semibold text-slate-700">Другое название<input name="customName" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input name="required" type="checkbox" defaultChecked className="accent-[#38C7BA]" /> Обязательный документ</label>
          <label className="text-sm font-semibold text-slate-700">Срок предоставления<input name="dueDate" type="date" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        </div>
        <label className="text-sm font-semibold text-slate-700">Комментарий клиенту<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit">Запросить</Button></div>
      </form>
    </Modal>
  );
};

export default PrimaryDocumentRequestModal;
