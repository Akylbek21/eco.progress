import { useFormContext } from 'react-hook-form';
import type { ProtocolWizardForm } from '../wizardTypes';

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-100';
const fields: Array<[keyof ProtocolWizardForm, string, string]> = [
  ['protocolDate', 'Дата протокола *', 'date'],
  ['measurementDate', 'Дата измерения *', 'date'],
  ['testingStartDate', 'Дата начала испытаний', 'date'],
  ['testingEndDate', 'Дата завершения испытаний', 'date'],
  ['measurementTime', 'Время измерения', 'time'],
  ['measurementPlace', 'Место измерения *', 'text'],
  ['sourceNumber', 'Номер источника', 'text'],
];

const MeasurementDetailsStep = () => {
  const { register } = useFormContext<ProtocolWizardForm>();
  return (
    <section>
      <h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Даты и место измерения</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {fields.map(([name, label, type]) => (
          <label key={name} className="text-sm font-bold">
            {label}
            <input type={type} {...register(name)} className={`${input} mt-1.5`} />
          </label>
        ))}
      </div>
    </section>
  );
};

export default MeasurementDetailsStep;
