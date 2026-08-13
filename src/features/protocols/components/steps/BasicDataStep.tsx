import { CheckCircle2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { Company, CompanyObject } from '../../../../types/companies';
import type { ProtocolTemplate } from '../../../../types/protocols';
import type { ProtocolWizardForm } from '../wizardTypes';

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-eco-500 focus:ring-2 focus:ring-eco-100';
const errorClass = 'mt-1 block text-xs font-semibold text-rose-700';

export default function BasicDataStep({ templates, companies, objects, companyLocked, lockedCompanyId, onCompanyChange, onStartNew }: {
  templates: ProtocolTemplate[]; companies: Company[]; objects: CompanyObject[]; companyLocked?: boolean; lockedCompanyId?: string; onCompanyChange: (id: string) => void; onStartNew?: () => void;
}) {
  const { register, watch, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  const pekContext = form.pekProgramId || form.pekReportId || form.pekControlItemId;
  const requiredFilled = [form.templateId, form.companyId, form.objectId].filter(Boolean).length;

  return <section className="space-y-5">
    <div>
      <h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Клиент и протокол</h3>
      <p className="mt-1 text-sm text-slate-500">Заполните три обязательных пункта — остальные данные уже подставлены.</p>
    </div>

    <div className="rounded-2xl border border-eco-200 bg-eco-50/70 p-4">
      <div className="flex items-center justify-between gap-3 text-sm font-bold text-eco-900">
        <span>Обязательные пункты</span><span>{requiredFilled} из 3</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[['Тип протокола', form.templateId], ['Компания', form.companyId], ['Объект', form.objectId]].map(([label, value], index) => <div key={label} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${value ? 'bg-white text-emerald-800' : 'bg-eco-100 text-eco-900'}`}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${value ? 'bg-emerald-600 text-white' : 'bg-white text-eco-800'}`}>{value ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span>{label}</div>)}
      </div>
    </div>

    {form.orderId && <div className="rounded-xl border border-eco-200 bg-eco-50 p-4 text-sm font-semibold text-eco-900">Протокол создаётся из заказа №{form.orderId}{form.orderServiceItemId ? `, услуга ${form.orderServiceItemId}` : ''}.</div>}
    {pekContext && <div className="rounded-xl border border-eco-200 bg-eco-50 p-4 text-sm font-semibold text-eco-900">Протокол связан с мероприятием ПЭК{form.pekControlEventId ? ` №${form.pekControlEventId}` : ''}. Переданный контекст сохранён в форме.</div>}

    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-2 text-base font-black text-slate-900">1. Что оформляем</legend>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Тип протокола *<select {...register('templateId')} aria-invalid={Boolean(errors.templateId)} className={`${inputClass} mt-1 ${errors.templateId ? 'border-rose-400' : ''}`}><option value="">Выберите тип</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.templateId?.message && <span className={errorClass}>{errors.templateId.message}</span>}</label>
        <label className="text-sm font-semibold">Компания *<select value={form.companyId} aria-invalid={Boolean(errors.companyId)} disabled={Boolean(companyLocked || lockedCompanyId)} onChange={(event) => onCompanyChange(event.target.value)} className={`${inputClass} mt-1 disabled:bg-slate-100 ${errors.companyId ? 'border-rose-400' : ''}`}><option value="">Выберите компанию</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.companyId?.message && <span className={errorClass}>{errors.companyId.message}</span>}{Boolean(companyLocked || lockedCompanyId) && <span className="mt-2 block text-xs font-normal text-slate-600">Компания закреплена за созданным черновиком.</span>}{Boolean(companyLocked || lockedCompanyId) && onStartNew && <button type="button" onClick={onStartNew} className="mt-2 text-sm font-bold text-eco-700 underline">Создать протокол для другой компании</button>}</label>
        <label className="text-sm font-semibold md:col-span-2">Объект *<select {...register('objectId')} aria-invalid={Boolean(errors.objectId)} className={`${inputClass} mt-1 ${errors.objectId ? 'border-rose-400' : ''}`} disabled={!form.companyId}><option value="">{form.companyId ? 'Выберите объект' : 'Сначала выберите компанию'}</option>{objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.objectId?.message && <span className={errorClass}>{errors.objectId.message}</span>}{form.companyId && objects.length === 0 && <span className="mt-2 block text-xs font-normal text-amber-700">У компании нет доступных активных объектов.</span>}</label>
      </div>
    </fieldset>

    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-2 text-base font-black text-slate-900">2. Когда и где измеряли</legend>
      <p className="mb-4 text-sm text-slate-500">Даты заполнены сегодняшним числом — при необходимости измените их.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">Дата протокола *<input type="date" {...register('protocolDate')} aria-invalid={Boolean(errors.protocolDate)} className={`${inputClass} mt-1 ${errors.protocolDate ? 'border-rose-400' : ''}`} />{errors.protocolDate?.message && <span className={errorClass}>{errors.protocolDate.message}</span>}</label>
        <label className="text-sm font-semibold">Дата измерения *<input type="date" {...register('measurementDate')} aria-invalid={Boolean(errors.measurementDate)} className={`${inputClass} mt-1 ${errors.measurementDate ? 'border-rose-400' : ''}`} />{errors.measurementDate?.message && <span className={errorClass}>{errors.measurementDate.message}</span>}</label>
        <label className="text-sm font-semibold md:col-span-2">Место измерения<input {...register('measurementPlace')} className={`${inputClass} mt-1`} placeholder="Например: производственный участок №1" /></label>
      </div>
    </fieldset>

    <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold text-eco-800">Дополнительные сведения — необязательно</summary><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Номер источника<input {...register('sourceNumber')} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold">Основание<input {...register('basis')} className={`${inputClass} mt-1`} /></label><label className="text-sm font-semibold">Примечание<input {...register('note')} className={`${inputClass} mt-1`} /></label></div></details>
  </section>;
}
