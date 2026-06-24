import type { Protocol } from '../../types/protocols';
import ProtocolStatusBadge from './ProtocolStatusBadge';
import { subtypeName, templateName } from '../../data/protocolTemplates';

type Props = { protocol: Protocol; readOnly: boolean; onChange: (patch: Partial<Protocol>) => void };
const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';

const ProtocolGeneralForm = ({ protocol, readOnly, onChange }: Props) => (
  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-slate-900">Общие данные</h2>
      <ProtocolStatusBadge status={protocol.status} />
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Номер протокола</span><input className={inputClass} disabled={readOnly} value={protocol.protocolNumber || ''} onChange={(e) => onChange({ protocolNumber: e.target.value, number: e.target.value })} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Дата протокола</span><input type="date" className={inputClass} disabled={readOnly} value={protocol.protocolDate || ''} onChange={(e) => onChange({ protocolDate: e.target.value })} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Форма</span><input className={inputClass} disabled={readOnly} value={protocol.formCode || ({ industrial_emissions: 'Ф 01', water_wastewater: 'Ф 02', ambient_air: 'Ф 03', physical_factors: 'Ф 04', soil: 'Почва' } as Record<string, string>)[protocol.templateId] || ''} onChange={(e) => onChange({ formCode: e.target.value })} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Приложение</span><input className={inputClass} disabled={readOnly} value={protocol.application || ''} onChange={(e) => onChange({ application: e.target.value })} placeholder="При наличии" /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Тип протокола</span><input className={inputClass} disabled value={templateName(protocol.templateId)} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Подтип</span><input className={inputClass} disabled value={subtypeName(protocol.subtype)} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Исполнитель</span><input className={inputClass} disabled={readOnly} value={protocol.executor || ''} onChange={(e) => onChange({ executor: e.target.value })} /></label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Утверждающий</span><input className={inputClass} disabled={readOnly} value={protocol.approver || ''} onChange={(e) => onChange({ approver: e.target.value })} /></label>
    </div>
  </section>
);

export default ProtocolGeneralForm;
