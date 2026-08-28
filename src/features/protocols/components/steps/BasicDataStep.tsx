import { Link2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { Company, CompanyObject } from '../../../../types/companies';
import type { ProtocolTemplate } from '../../../../types/protocols';
import { wizardErrorClass, wizardHelperClass, wizardInputClass, wizardLabelClass, wizardTextareaClass } from '../ProtocolWizardField';
import type { ProtocolWizardForm } from '../wizardTypes';

export default function BasicDataStep({ templates, companies, objects, companyLocked, lockedCompanyId, templatesLoading, companiesLoading, objectsLoading, onCompanyChange, onStartNew }: {
  templates: ProtocolTemplate[]; companies: Company[]; objects: CompanyObject[]; companyLocked?: boolean; lockedCompanyId?: string; templatesLoading?: boolean; companiesLoading?: boolean; objectsLoading?: boolean; onCompanyChange: (id: string) => void; onStartNew?: () => void;
}) {
  // Прежний блок «Обязательные пункты» удалён: ошибки теперь находятся непосредственно под полями.
  const { register, watch, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  const locked = Boolean(companyLocked || lockedCompanyId);
  return <section className="space-y-5">
    {(form.orderId || form.pekProgramId || form.pekReportId || form.pekControlItemId) && <div className="flex items-start gap-2 rounded-xl border border-eco-200 bg-eco-50 px-4 py-3 text-sm text-eco-950"><Link2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{form.orderId ? `Связано с заказом №${form.orderId}${form.orderServiceItemId ? `, услуга ${form.orderServiceItemId}` : ''}` : `Связано с мероприятием ПЭК${form.pekControlEventId ? ` №${form.pekControlEventId}` : ''}`}</span></div>}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div><h2 id="wizard-step-title" tabIndex={-1} className="text-lg font-semibold text-slate-950">Основные данные</h2><p className="mt-1 text-sm text-slate-500">Реквизиты будущего лабораторного протокола.</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className={`${wizardLabelClass} md:col-span-2 xl:col-span-1`}>Тип протокола *<select {...register('templateId')} aria-invalid={Boolean(errors.templateId)} disabled={templatesLoading} className={`${wizardInputClass} ${errors.templateId ? 'border-rose-400' : ''}`}><option value="">{templatesLoading ? 'Загрузка типов…' : 'Выберите тип'}</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.templateId?.message && <span className={wizardErrorClass}>{errors.templateId.message}</span>}</label>
        <div className="hidden xl:block" />
        <label className={wizardLabelClass}>Компания *<select value={form.companyId} aria-invalid={Boolean(errors.companyId)} disabled={locked || companiesLoading} onChange={(event) => onCompanyChange(event.target.value)} className={`${wizardInputClass} ${errors.companyId ? 'border-rose-400' : ''}`}><option value="">{companiesLoading ? 'Загрузка компаний…' : 'Выберите компанию'}</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.companyId?.message && <span className={wizardErrorClass}>{errors.companyId.message}</span>}{locked && <span className={wizardHelperClass}>Компания закреплена за серверным черновиком.</span>}{locked && onStartNew && <button type="button" onClick={onStartNew} className="mt-1.5 text-xs font-medium text-eco-700 underline">Создать протокол для другой компании</button>}</label>
        <label className={wizardLabelClass}>Объект *<select {...register('objectId')} aria-invalid={Boolean(errors.objectId)} disabled={!form.companyId || objectsLoading} className={`${wizardInputClass} ${errors.objectId ? 'border-rose-400' : ''}`}><option value="">{objectsLoading ? 'Загрузка объектов…' : form.companyId ? 'Выберите объект' : 'Сначала выберите компанию'}</option>{objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.objectId?.message && <span className={wizardErrorClass}>{errors.objectId.message}</span>}{form.companyId && !objectsLoading && objects.length === 0 && <span className="mt-1.5 block text-xs text-amber-700">У компании нет активных объектов.</span>}</label>
        <label className={wizardLabelClass}>Дата протокола *<input type="date" {...register('protocolDate')} aria-invalid={Boolean(errors.protocolDate)} className={`${wizardInputClass} ${errors.protocolDate ? 'border-rose-400' : ''}`} />{errors.protocolDate?.message && <span className={wizardErrorClass}>{errors.protocolDate.message}</span>}</label>
        <label className={wizardLabelClass}>Дата измерения *<input type="date" {...register('measurementDate')} aria-invalid={Boolean(errors.measurementDate)} className={`${wizardInputClass} ${errors.measurementDate ? 'border-rose-400' : ''}`} />{errors.measurementDate?.message && <span className={wizardErrorClass}>{errors.measurementDate.message}</span>}</label>
        <label className={`${wizardLabelClass} md:col-span-2`}>Место измерения *<input {...register('measurementPlace')} aria-invalid={Boolean(errors.measurementPlace)} className={`${wizardInputClass} ${errors.measurementPlace ? 'border-rose-400' : ''}`} placeholder="Например: производственный участок №1" />{errors.measurementPlace?.message && <span className={wizardErrorClass}>{errors.measurementPlace.message}</span>}</label>
      </div>
    </div>
    <details className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-6"><summary className="cursor-pointer text-sm font-medium text-eco-900">Дополнительные сведения <span className="font-normal text-slate-500">(необязательно)</span></summary><div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2"><label className={wizardLabelClass}>Номер источника<input {...register('sourceNumber')} className={wizardInputClass} /></label><label className={wizardLabelClass}>Основание<input {...register('basis')} className={wizardInputClass} /></label><label className={`${wizardLabelClass} md:col-span-2`}>Примечание<textarea rows={3} {...register('note')} className={wizardTextareaClass} /></label></div></details>
  </section>;
}
