import type { Protocol } from '../../types/protocols';
import ProtocolStatusBadge from './ProtocolStatusBadge';
import { templateName } from '../../data/protocolTemplates';

type ProtocolGeneralFormProps = {
  protocol: Protocol;
  readOnly: boolean;
  onChange: (patch: Partial<Protocol>) => void;
};

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';

const ProtocolGeneralForm = ({ protocol, readOnly, onChange }: ProtocolGeneralFormProps) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-slate-900">Основные данные</h2>
      <ProtocolStatusBadge status={protocol.status} />
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Номер протокола</span>
        <input className={inputClass} disabled={readOnly} value={protocol.protocolNumber || protocol.number || ''} onChange={(event) => onChange({ protocolNumber: event.target.value, number: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Дата протокола</span>
        <input type="date" className={inputClass} disabled={readOnly} value={protocol.protocolDate || ''} onChange={(event) => onChange({ protocolDate: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Шаблон</span>
        <input className={inputClass} disabled value={protocol.templateName || templateName(protocol.templateId)} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Статус</span>
        <input className={inputClass} disabled value={protocol.status} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Исполнитель</span>
        <input className={inputClass} disabled={readOnly} value={protocol.executor || ''} onChange={(event) => onChange({ executor: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Утверждающий</span>
        <input className={inputClass} disabled={readOnly} value={protocol.approver || ''} onChange={(event) => onChange({ approver: event.target.value })} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Дата утверждения</span>
        <input className={inputClass} disabled value={protocol.approvedAt || ''} />
      </label>
      <label className="space-y-1.5 text-sm font-semibold text-slate-700">
        <span>Дата подписания</span>
        <input className={inputClass} disabled value={protocol.signedAt || ''} />
      </label>
    </div>
  </section>
);

export default ProtocolGeneralForm;
