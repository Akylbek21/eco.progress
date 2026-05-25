import { FormEvent, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { LaboratoryResultDocument, LaboratoryResultDocumentStatus, QuarterNumber } from '../../types';
import { laboratoryResultSectionLabels } from '../../utils/laboratory';

export type LaboratoryResultValues = {
  section: LaboratoryResultDocument['section'];
  name: string;
  quarter?: QuarterNumber;
  file: File | null;
  comment: string;
  status: LaboratoryResultDocumentStatus;
  publishNow: boolean;
};

type LaboratoryResultModalProps = {
  isOpen: boolean;
  defaultSection?: LaboratoryResultDocument['section'];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: LaboratoryResultValues) => void | Promise<void>;
};

const sections = Object.keys(laboratoryResultSectionLabels) as LaboratoryResultDocument['section'][];

const LaboratoryResultModal = ({ isOpen, defaultSection = 'protocol', loading = false, onClose, onSubmit }: LaboratoryResultModalProps) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    const quarterRaw = Number(form.get('quarter') || 0);
    setError('');
    try {
      await onSubmit({
        section: String(form.get('section') || defaultSection) as LaboratoryResultDocument['section'],
        name: String(form.get('name') || ''),
        quarter: ([1, 2, 3, 4] as number[]).includes(quarterRaw) ? quarterRaw as QuarterNumber : undefined,
        file: file?.name ? file : null,
        comment: String(form.get('comment') || ''),
        status: String(form.get('status') || 'ready') as LaboratoryResultDocumentStatus,
        publishNow: form.get('publishNow') === 'on',
      });
      onClose();
    } catch {
      setError('Не удалось загрузить результат.');
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Загрузить лабораторный результат" size="lg" loading={loading}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">Раздел<select name="section" defaultValue={defaultSection} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">{sections.map((section) => <option key={section} value={section}>{laboratoryResultSectionLabels[section]}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">Квартал<select name="quarter" defaultValue="" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="">Не указан</option>{[1, 2, 3, 4].map((quarter) => <option key={quarter} value={quarter}>{quarter} квартал</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Название документа<input name="name" required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700">Статус<select name="status" defaultValue="ready" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="ready">Готов к отправке</option><option value="published_to_client">Опубликован клиенту</option><option value="archived">Архив</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Файл<input name="file" type="file" required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2"><input name="publishNow" type="checkbox" className="accent-[#38C7BA]" /> Опубликовать клиенту сразу</label>
        <div className="flex flex-col-reverse gap-3 md:col-span-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={onClose}>Отмена</Button><Button type="submit">Загрузить результат</Button></div>
      </form>
    </Modal>
  );
};

export default LaboratoryResultModal;
