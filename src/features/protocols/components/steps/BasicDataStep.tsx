import { CheckCircle2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { Company, CompanyObject } from '../../../../types/companies';
import type { ProtocolTemplate } from '../../../../types/protocols';
import type { ProtocolWizardForm } from '../wizardTypes';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const errorClass = 'mt-1 block text-xs font-semibold text-rose-700';

export default function BasicDataStep({ templates, companies, objects, companyLocked, lockedCompanyId, templatesLoading, companiesLoading, objectsLoading, onCompanyChange, onStartNew }: {
  templates: ProtocolTemplate[]; companies: Company[]; objects: CompanyObject[]; companyLocked?: boolean; lockedCompanyId?: string; templatesLoading?: boolean; companiesLoading?: boolean; objectsLoading?: boolean; onCompanyChange: (id: string) => void; onStartNew?: () => void;
}) {
  const { register, watch, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  const pekContext = form.pekProgramId || form.pekReportId || form.pekControlItemId;
  const requiredFilled = [form.templateId, form.companyId, form.objectId].filter(Boolean).length;

  return <section className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black tracking-tight text-slate-950">Клиент и протокол</h3><p className="mt-1 text-sm text-slate-500">Выберите тип, компанию и объект. Даты уже заполнены сегодняшним числом.</p></div>
      <div className="flex items-center gap-3"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Обязательные пункты</span><span className={`rounded-full px-3 py-1 text-xs font-black ${requiredFilled === 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-eco-100 text-eco-900'}`}>{requiredFilled} / 3</span></div>
    </div>

    <div className="grid gap-2 sm:grid-cols-3">
      {[['Тип протокола', form.templateId], ['Компания', form.companyId], ['Объект', form.objectId]].map(([label, value], index) => <div key={label} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${value ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{value ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span>{label}</div>)}
    </div>

    {form.orderId && <div className="rounded-xl border border-eco-200 bg-eco-50 p-4 text-sm font-semibold text-eco-900">Протокол создаётся из заказа №{form.orderId}{form.orderServiceItemId ? `, услуга ${form.orderServiceItemId}` : ''}.</div>}
    {pekContext && <div className="rounded-xl border border-eco-200 bg-eco-50 p-4 text-sm font-semibold text-eco-900">Протокол связан с мероприятием ПЭК{form.pekControlEventId ? ` №${form.pekControlEventId}` : ''}. Переданный контекст сохранён в форме.</div>}

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
      <div className="p-4 sm:p-5">
      <div className="mb-4"><h4 className="font-black text-slate-900">Что оформляем</h4><p className="mt-1 text-xs text-slate-500">Основные реквизиты будущего протокола</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Тип протокола *<select {...register('templateId')} aria-invalid={Boolean(errors.templateId)} disabled={templatesLoading} className={`${inputClass} mt-1 disabled:bg-slate-100 ${errors.templateId ? 'border-rose-400' : ''}`}><option value="">{templatesLoading ? 'Загрузка типов…' : 'Выберите тип'}</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.templateId?.message && <span className={errorClass}>{errors.templateId.message}</span>}</label>
        <label className="text-sm font-semibold">Компания *<select value={form.companyId} aria-invalid={Boolean(errors.companyId)} disabled={Boolean(companyLocked || lockedCompanyId || companiesLoading)} onChange={(event) => onCompanyChange(event.target.value)} className={`${inputClass} mt-1 disabled:bg-slate-100 ${errors.companyId ? 'border-rose-400' : ''}`}><option value="">{companiesLoading ? 'Загрузка компаний…' : 'Выберите компанию'}</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.companyId?.message && <span className={errorClass}>{errors.companyId.message}</span>}{Boolean(companyLocked || lockedCompanyId) && <span className="mt-2 block text-xs font-normal text-slate-600">Компания закреплена за созданным черновиком.</span>}{Boolean(companyLocked || lockedCompanyId) && onStartNew && <button type="button" onClick={onStartNew} className="mt-2 text-sm font-bold text-eco-700 underline">Создать протокол для другой компании</button>}</label>
        <label className="text-sm font-semibold md:col-span-2">Объект *<select {...register('objectId')} aria-invalid={Boolean(errors.objectId)} className={`${inputClass} mt-1 disabled:bg-slate-100 ${errors.objectId ? 'border-rose-400' : ''}`} disabled={!form.companyId || objectsLoading}><option value="">{objectsLoading ? 'Загрузка объектов…' : form.companyId ? 'Выберите объект' : 'Сначала выберите компанию'}</option>{objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.objectId?.message && <span className={errorClass}>{errors.objectId.message}</span>}{form.companyId && !objectsLoading && objects.length === 0 && <span className="mt-2 block text-xs font-normal text-amber-700">У компании нет доступных активных объектов.</span>}</label>
      </div>
      </div>

      <div className="border-t border-slate-100 p-4 sm:p-5">
      <div className="mb-4"><h4 className="font-black text-slate-900">Дата и место измерения</h4><p className="mt-1 text-xs text-slate-500">Измените автоматически заполненные даты, если необходимо</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Дата протокола *<input type="date" {...register('protocolDate')} aria-invalid={Boolean(errors.protocolDate)} className={`${inputClass} mt-1 ${errors.protocolDate ? 'border-rose-400' : ''}`} />{errors.protocolDate?.message && <span className={errorClass}>{errors.protocolDate.message}</span>}</label>
        <label className="text-sm font-semibold">Дата измерения *<input type="date" {...register('measurementDate')} aria-invalid={Boolean(errors.measurementDate)} className={`${inputClass} mt-1 ${errors.measurementDate ? 'border-rose-400' : ''}`} />{errors.measurementDate?.message && <span className={errorClass}>{errors.measurementDate.message}</span>}</label>
        <label className="text-sm font-semibold md:col-span-2">Место измерения<input {...register('measurementPlace')} className={`${inputClass} mt-1`} placeholder="Например: производственный участок №1" /></label>
      </div>
      </div>
    </div>

    <details className="rounded-xl border border-slate-200 bg-white px-4 py-3.5"><summary className="cursor-pointer text-sm font-bold text-eco-800">Дополнительные сведения <span className="font-normal text-slate-500">(необязательно)</span></summary><div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2"><label className="text-sm font-semibold">Номер источника<input {...register('sourceNumber')} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold">Основание<input {...register('basis')} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold">Примечание<input {...register('note')} className={`${inputClass} mt-1`} /></label></div></details>
  </section>;
}
