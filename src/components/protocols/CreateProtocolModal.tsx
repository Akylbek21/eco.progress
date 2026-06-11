import { FormEvent, useMemo, useState } from 'react';
import { Check, ClipboardPlus } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import type { CreateProtocolPayload, ProtocolTemplate, ProtocolTemplateId } from '../../types/protocols';
import { protocolTemplates } from '../../data/protocolTemplates';

type CreateProtocolModalProps = {
  open: boolean;
  loading?: boolean;
  templates?: ProtocolTemplate[];
  onClose: () => void;
  onCreate: (payload: CreateProtocolPayload) => void | Promise<void>;
};

const today = () => new Date().toISOString().slice(0, 10);

const Field = ({
  label,
  name,
  required = false,
  type = 'text',
}: {
  label: string;
  name: keyof CreateProtocolPayload;
  required?: boolean;
  type?: string;
}) => (
  <label className="space-y-1.5 text-sm font-semibold text-slate-700">
    <span>{label}{required && <span className="text-rose-600"> *</span>}</span>
    <input
      name={name}
      type={type}
      required={required}
      defaultValue={type === 'date' && name === 'protocolDate' ? today() : undefined}
      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100"
    />
  </label>
);

const CreateProtocolModal = ({ open, loading = false, templates, onClose, onCreate }: CreateProtocolModalProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ProtocolTemplateId | ''>('');
  const visibleTemplates = useMemo(() => templates?.length ? templates : protocolTemplates, [templates]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTemplate) return;
    const form = new FormData(event.currentTarget);
    await onCreate({
      templateId: selectedTemplate,
      organizationName: String(form.get('organizationName') || ''),
      organizationAddress: String(form.get('organizationAddress') || ''),
      objectName: String(form.get('objectName') || ''),
      productName: String(form.get('productName') || ''),
      protocolDate: String(form.get('protocolDate') || ''),
      samplingDate: String(form.get('samplingDate') || ''),
      testingDate: String(form.get('testingDate') || ''),
      testingPurpose: String(form.get('testingPurpose') || ''),
      environmentConditions: String(form.get('environmentConditions') || ''),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Создать протокол" size="xl">
      <form onSubmit={submit} className="space-y-6">
        <section>
          <p className="mb-3 text-sm font-semibold text-slate-700">Выберите шаблон</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTemplates.map((template) => {
              const active = selectedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`min-h-[112px] rounded-2xl border p-4 text-left transition hover:border-eco-500 hover:bg-eco-50 ${
                    active ? 'border-eco-600 bg-eco-50 ring-2 ring-eco-100' : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <ClipboardPlus className="mt-0.5 h-5 w-5 shrink-0 text-eco-700" />
                    {active && <Check className="h-5 w-5 shrink-0 text-eco-700" />}
                  </span>
                  <span className="mt-3 block text-sm font-bold text-slate-900">{template.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {selectedTemplate && (
          <section className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
            <Field label="Организация" name="organizationName" required />
            <Field label="Адрес организации" name="organizationAddress" required />
            <Field label="Объект" name="objectName" required />
            <Field label="Наименование продукции / объекта" name="productName" required />
            <Field label="Дата протокола" name="protocolDate" type="date" required />
            <Field label="Дата отбора" name="samplingDate" type="date" required />
            <Field label="Дата испытаний" name="testingDate" type="date" required />
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              <span>Цель испытаний <span className="text-rose-600">*</span></span>
              <textarea name="testingPurpose" required rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100" />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              <span>Условия окружающей среды <span className="text-rose-600">*</span></span>
              <textarea name="environmentConditions" required rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100" />
            </label>
          </section>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={!selectedTemplate || loading}>{loading ? 'Создание...' : 'Создать протокол'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateProtocolModal;
