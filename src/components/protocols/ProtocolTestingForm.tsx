import type { ProtocolTemplateId, ProtocolTestingData } from '../../types/protocols';
import { physicalFactorTypes } from '../../data/protocolTemplates';

type Props = {
  templateId: ProtocolTemplateId;
  value: ProtocolTestingData;
  measurementDate?: string;
  readOnly: boolean;
  onMeasurementDateChange?: (value: string) => void;
  onChange: (value: ProtocolTestingData) => void;
};
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';

const ProtocolTestingForm = ({ templateId, value, measurementDate, readOnly, onMeasurementDateChange, onChange }: Props) => (
  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="mb-4 text-lg font-bold text-slate-900">Данные испытаний</h2>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {templateId === 'physical_factors' && <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Подтип</span><select className={inputClass} disabled={readOnly} value={value.physicalFactorType || ''} onChange={(e) => onChange({ ...value, physicalFactorType: e.target.value })}><option value="">Выберите</option>{physicalFactorTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>}
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Дата замера / отбора</span><input type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} disabled={readOnly} value={measurementDate || value.samplingDate || ''} onChange={(e) => { onMeasurementDateChange?.(e.target.value); onChange({ ...value, samplingDate: e.target.value }); }} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Начало испытаний</span><input type="date" className={inputClass} disabled={readOnly} value={value.testingStartDate || ''} onChange={(e) => onChange({ ...value, testingStartDate: e.target.value })} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Окончание испытаний</span><input type="date" className={inputClass} disabled={readOnly} value={value.testingEndDate || ''} onChange={(e) => onChange({ ...value, testingEndDate: e.target.value, testingDate: e.target.value })} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>НД на продукцию</span><input className={inputClass} disabled={readOnly} value={value.productNormativeDocument || ''} onChange={(e) => onChange({ ...value, productNormativeDocument: e.target.value })} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>НД на методы отбора</span><input className={inputClass} disabled={readOnly} value={value.samplingMethodDocument || ''} onChange={(e) => onChange({ ...value, samplingMethodDocument: e.target.value })} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>НД на методы испытаний</span><input className={inputClass} disabled={readOnly} value={value.testingMethodDocument || ''} onChange={(e) => onChange({ ...value, testingMethodDocument: e.target.value })} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3"><span>Цель испытаний</span><textarea rows={3} className={inputClass} disabled={readOnly} value={value.testingPurpose || ''} onChange={(e) => onChange({ ...value, testingPurpose: e.target.value })} /></label>
    </div>
  </section>
);

export default ProtocolTestingForm;
