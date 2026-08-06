import { useFormContext } from 'react-hook-form';
import type { Company, CompanyObject } from '../../../../types/companies';
import type { ProtocolTemplate } from '../../../../types/protocols';
import type { ProtocolWizardForm } from '../wizardTypes';

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-eco-500 focus:ring-2 focus:ring-eco-100';

export default function BasicDataStep({ templates, companies, objects, companyLocked, lockedCompanyId, onCompanyChange, onStartNew }: {
  templates: ProtocolTemplate[]; companies: Company[]; objects: CompanyObject[]; companyLocked?: boolean; lockedCompanyId?: string; onCompanyChange: (id: string) => void; onStartNew?: () => void;
}) {
  const { register, watch } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  const pekContext = form.pekProgramId || form.pekReportId || form.pekControlItemId;
  return <section className="space-y-5">
    <div><h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Основные данные</h3><p className="mt-1 text-sm text-slate-500">Выберите тип, компанию и место измерения.</p></div>
    {form.orderId && <div className="rounded-xl border border-eco-200 bg-eco-50 p-4 text-sm font-semibold text-eco-900">Протокол создаётся из заказа №{form.orderId}{form.orderServiceItemId ? `, услуга ${form.orderServiceItemId}` : ''}.</div>}
    {pekContext && <div className="rounded-xl border border-eco-200 bg-eco-50 p-4 text-sm font-semibold text-eco-900">Протокол связан с мероприятием ПЭК{form.pekControlEventId ? ` №${form.pekControlEventId}` : ''}. Переданный контекст сохранён в форме.</div>}
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-semibold">Тип протокола<select {...register('templateId')} className={`${inputClass} mt-1`}><option value="">Выберите тип</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Компания<select value={form.companyId} disabled={Boolean(companyLocked || lockedCompanyId)} onChange={(event) => onCompanyChange(event.target.value)} className={`${inputClass} mt-1 disabled:bg-slate-100`}><option value="">Выберите компанию</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{Boolean(companyLocked || lockedCompanyId) && <span className="mt-2 block text-xs font-normal text-slate-600">Компания закрепляется за протоколом после создания черновика. Чтобы выбрать другую компанию, создайте новый протокол.</span>}{Boolean(companyLocked || lockedCompanyId) && onStartNew && <button type="button" onClick={onStartNew} className="mt-2 text-sm font-bold text-eco-700 underline">Начать новый протокол</button>}</label>
      <label className="text-sm font-semibold">Объект<select {...register('objectId')} className={`${inputClass} mt-1`} disabled={!form.companyId}><option value="">Выберите объект</option>{objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Дата<input type="date" {...register('protocolDate')} className={`${inputClass} mt-1`} /></label>
      <label className="text-sm font-semibold">Дата измерения<input type="date" {...register('measurementDate')} className={`${inputClass} mt-1`} /></label>
      <label className="text-sm font-semibold md:col-span-2">Место измерения<input {...register('measurementPlace')} className={`${inputClass} mt-1`} placeholder="Например: производственный участок №1" /></label>
    </div>
    <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold text-eco-800">Дополнительные сведения</summary><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Номер источника<input {...register('sourceNumber')} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold">Основание<input {...register('basis')} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold">Примечание<input {...register('note')} className={`${inputClass} mt-1`} /></label></div></details>
  </section>;
}
