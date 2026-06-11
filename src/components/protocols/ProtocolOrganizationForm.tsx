import type { ProtocolOrganizationData } from '../../types/protocols';

type Props = {
  value: ProtocolOrganizationData;
  readOnly: boolean;
  onChange: (value: ProtocolOrganizationData) => void;
};

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';

const ProtocolOrganizationForm = ({ value, readOnly, onChange }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="mb-4 text-lg font-bold text-slate-900">Данные организации/объекта</h2>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Наименование организации</span>
        <input className={inputClass} disabled={readOnly} value={value.organizationName || ''} onChange={(event) => onChange({ ...value, organizationName: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Адрес организации</span>
        <input className={inputClass} disabled={readOnly} value={value.organizationAddress || ''} onChange={(event) => onChange({ ...value, organizationAddress: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Объект испытаний</span>
        <input className={inputClass} disabled={readOnly} value={value.objectName || ''} onChange={(event) => onChange({ ...value, objectName: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Наименование продукции</span>
        <input className={inputClass} disabled={readOnly} value={value.productName || ''} onChange={(event) => onChange({ ...value, productName: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
        <span>Основание для испытаний</span>
        <textarea rows={2} className={inputClass} disabled={readOnly} value={value.testingBasis || ''} onChange={(event) => onChange({ ...value, testingBasis: event.target.value })} />
      </label>
    </div>
  </section>
);

export default ProtocolOrganizationForm;
