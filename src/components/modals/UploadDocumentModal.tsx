import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type UploadDocumentValues = {
  name: string;
  category: string;
  file: File | null;
  comment: string;
  sendToClient: boolean;
};

type UploadDocumentModalProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  defaultName?: string;
  defaultCategory?: string;
  categories?: string[];
  allowSendToClient?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: UploadDocumentValues) => void | Promise<void>;
};

const UploadDocumentModal = ({
  isOpen,
  title = 'Загрузить документ',
  description = 'Выберите файл и добавьте короткий комментарий при необходимости.',
  defaultName = '',
  defaultCategory = 'client',
  categories = ['client', 'result', 'invoice', 'internal'],
  allowSendToClient = false,
  loading = false,
  onClose,
  onSubmit,
}: UploadDocumentModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    try {
      await onSubmit({
        name: String(form.get('name') || ''),
        category: String(form.get('category') || defaultCategory),
        file: file?.name ? file : null,
        comment: String(form.get('comment') || ''),
        sendToClient: form.get('sendToClient') === 'on',
      });
      event.currentTarget.reset();
      onClose();
    } catch {
      setError('Не удалось загрузить документ. Проверьте данные и попробуйте снова.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={description} loading={loading}>
      <form id="upload-document-form" onSubmit={submit} className="grid gap-4">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">Название документа<input name="name" defaultValue={defaultName} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Тип документа<select name="category" defaultValue={defaultCategory} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Файл<input name="file" type="file" required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Комментарий<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        {allowSendToClient && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input name="sendToClient" type="checkbox" className="accent-[#38C7BA]" /> Отправить клиенту сразу</label>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={loading}>Загрузить</Button>
        </div>
      </form>
    </Modal>
  );
};

export default UploadDocumentModal;
