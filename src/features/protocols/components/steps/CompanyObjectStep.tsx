import { useFormContext } from 'react-hook-form';
import { Link } from 'react-router-dom';
import type { Company, CompanyObject } from '../../../../types/companies';
import type { ProtocolWizardForm } from '../wizardTypes';

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-100';

type Props = {
  companies: Company[];
  objects: CompanyObject[];
  loading: boolean;
  lockedCompanyId?: string;
  onCompanyChange: (id: string) => void;
};

const CompanyObjectStep = ({ companies, objects, loading, lockedCompanyId, onCompanyChange }: Props) => {
  const { register, watch, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  const companyId = watch('companyId');
  const objectId = watch('objectId');
  const company = companies.find((item) => item.id === companyId);
  const object = objects.find((item) => item.id === objectId);

  return (
    <section>
      <h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Компания и объект</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold">
          Компания *
          <select {...register('companyId')} disabled={Boolean(lockedCompanyId)} onChange={(event) => onCompanyChange(event.target.value)} className={`${input} mt-1.5 disabled:bg-slate-100`}>
            <option value="">Выберите компанию</option>
            {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {lockedCompanyId && <span className="mt-1 block text-xs text-slate-500">Компания зафиксирована контекстом ПЭК.</span>}
          {errors.companyId?.message && <span className="mt-1 block text-xs text-rose-700">{errors.companyId.message}</span>}
        </label>
        <label className="text-sm font-bold">
          Объект компании *
          <select {...register('objectId')} disabled={!companyId || loading || !objects.length} className={`${input} mt-1.5`}>
            <option value="">{loading ? 'Загрузка…' : 'Выберите объект'}</option>
            {objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {errors.objectId?.message && <span className="mt-1 block text-xs text-rose-700">{errors.objectId.message}</span>}
        </label>
        {companyId && !loading && !objects.length && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 md:col-span-2">
            <p>Перед созданием протокола сохраните объект компании.</p>
            <Link to={`/staff/companies/${companyId}`} className="mt-2 inline-flex rounded-lg bg-amber-900 px-3 py-2 text-white">Создать объект</Link>
          </div>
        )}
        <label className="text-sm font-bold">Адрес объекта<input readOnly value={object?.address || ''} className={`${input} mt-1.5 bg-slate-50`} /></label>
        <label className="text-sm font-bold">БИН<input readOnly value={company?.bin || ''} className={`${input} mt-1.5 bg-slate-50`} /></label>
        <label className="text-sm font-bold">Заказчик<input {...register('customer')} className={`${input} mt-1.5`} /></label>
        <label className="text-sm font-bold">Основание проведения испытаний<input {...register('basis')} className={`${input} mt-1.5`} /></label>
      </div>
    </section>
  );
};

export default CompanyObjectStep;
