import type { ProtocolTemplateId, ProtocolTestingData } from '../../types/protocols';
import { physicalFactorTypes } from '../../data/protocolTemplates';

type Props = {
  templateId: ProtocolTemplateId;
  value: ProtocolTestingData;
  readOnly: boolean;
  onChange: (value: ProtocolTestingData) => void;
};

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';

const Required = () => <span className="text-rose-600"> *</span>;

const ProtocolTestingForm = ({ templateId, value, readOnly, onChange }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="mb-4 text-lg font-bold text-slate-900">Данные испытаний</h2>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {templateId === 'physical_factors' && (
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Тип замера<Required /></span>
          <select className={inputClass} disabled={readOnly} value={value.physicalFactorType || ''} onChange={(event) => onChange({ ...value, physicalFactorType: event.target.value })}>
            <option value="">Выберите тип</option>
            {physicalFactorTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
      )}
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>НД на продукцию<Required /></span>
        <input className={inputClass} disabled={readOnly} value={value.productNormativeDocument || ''} onChange={(event) => onChange({ ...value, productNormativeDocument: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>НД на методы отбора<Required /></span>
        <input className={inputClass} disabled={readOnly} value={value.samplingMethodDocument || ''} onChange={(event) => onChange({ ...value, samplingMethodDocument: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>НД на методы испытаний<Required /></span>
        <input className={inputClass} disabled={readOnly} value={value.testingMethodDocument || ''} onChange={(event) => onChange({ ...value, testingMethodDocument: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Дата отбора<Required /></span>
        <input type="date" className={inputClass} disabled={readOnly} value={value.samplingDate || ''} onChange={(event) => onChange({ ...value, samplingDate: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Дата проведения испытаний<Required /></span>
        <input type="date" className={inputClass} disabled={readOnly} value={value.testingStartDate || value.testingDate || ''} onChange={(event) => onChange({ ...value, testingStartDate: event.target.value, testingDate: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Окончание испытаний<Required /></span>
        <input type="date" className={inputClass} disabled={readOnly} value={value.testingEndDate || value.testingDate || ''} onChange={(event) => onChange({ ...value, testingEndDate: event.target.value, testingDate: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
        <span>Цель испытаний<Required /></span>
        <textarea rows={2} className={inputClass} disabled={readOnly} value={value.testingPurpose || ''} onChange={(event) => onChange({ ...value, testingPurpose: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
        <span>Условия окружающей среды<Required /></span>
        <textarea rows={2} className={inputClass} disabled={readOnly} value={value.environmentConditions || ''} onChange={(event) => onChange({ ...value, environmentConditions: event.target.value })} />
      </label>
    </div>
  </section>
);

export default ProtocolTestingForm;
