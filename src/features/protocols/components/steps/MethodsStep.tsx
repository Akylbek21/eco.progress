import { useFormContext } from 'react-hook-form';
import { wizardErrorClass, wizardInputClass, wizardLabelClass, wizardTextareaClass } from '../ProtocolWizardField';
import type { ProtocolWizardForm } from '../wizardTypes';

const MethodsStep = () => {
  const { register, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-slate-950">Методика</h3>
      <p className="mt-1 text-sm text-slate-500">Общие нормативные документы и основание исследования.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className={wizardLabelClass}>
        НД на метод испытаний *
        <input {...register('testingMethodNd')} className={`${wizardInputClass} ${errors.testingMethodNd ? 'border-rose-400' : ''}`} />
        {errors.testingMethodNd?.message && <span className={wizardErrorClass}>{errors.testingMethodNd.message}</span>}
      </label>
      <label className={wizardLabelClass}>
        НД на метод отбора
        <input {...register('samplingMethodNd')} className={wizardInputClass} />
      </label>
      <label className={`${wizardLabelClass} md:col-span-2`}>
        Основание для испытаний
        <textarea
          rows={2}
          {...register('basis')}
          className={wizardTextareaClass}
          placeholder="Например: договор, заявка или программа производственного контроля"
        />
      </label>
      </div>
    </section>
  );
};

export default MethodsStep;
