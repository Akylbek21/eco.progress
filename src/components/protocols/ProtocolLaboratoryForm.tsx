import type { ProtocolLaboratoryData } from '../../types/protocols';

type Props = { value: ProtocolLaboratoryData; readOnly: boolean; onChange: (value: ProtocolLaboratoryData) => void };
const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';
const fields: Array<{ key: keyof ProtocolLaboratoryData; label: string; type?: string }> = [
  { key: 'laboratoryName', label: 'Название лаборатории' },
  { key: 'laboratoryAddress', label: 'Адрес' },
  { key: 'accreditationNumber', label: 'Аттестат аккредитации' },
  { key: 'accreditationValidUntil', label: 'Срок действия', type: 'date' },
  { key: 'director', label: 'Директор' },
  { key: 'laboratoryHead', label: 'Заведующий' },
  { key: 'executor', label: 'Исполнитель' },
];

const ProtocolLaboratoryForm = ({ value, readOnly, onChange }: Props) => (
  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="mb-4 text-lg font-bold text-slate-900">Лаборатория</h2>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => <label key={field.key} className="space-y-1.5 text-sm font-semibold text-slate-700"><span>{field.label}</span><input type={field.type || 'text'} className={inputClass} disabled={readOnly} value={value[field.key] || ''} onChange={(e) => onChange({ ...value, [field.key]: e.target.value })} /></label>)}
    </div>
  </section>
);

export default ProtocolLaboratoryForm;
