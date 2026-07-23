import { useFormContext } from 'react-hook-form';
import type { ProtocolWizardForm } from '../wizardTypes';

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-100';

const MethodsStep = () => {
  const { register } = useFormContext<ProtocolWizardForm>();
  return (
    <section>
      <h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Методики</h3>
      <p className="mt-2 text-sm text-slate-500">Указываются только реквизиты, поддерживаемые backend quick-create.</p>
      <label className="mt-5 block text-sm font-bold">
        НД на метод испытаний *
        <input {...register('testingMethodNd')} className={`${input} mt-1.5`} />
      </label>
    </section>
  );
};

export default MethodsStep;
