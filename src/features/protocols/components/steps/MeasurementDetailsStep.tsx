import { useFormContext } from 'react-hook-form';
import type { ProtocolWizardForm } from '../wizardTypes';

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-100';
const fields: Array<[keyof ProtocolWizardForm, string, string]> = [
  ['protocolDate', 'Дата протокола *', 'date'],
  ['sampleDate', 'Дата отбора пробы *', 'date'],
  ['measurementDate', 'Дата измерения *', 'date'],
  ['testingStartDate', 'Дата начала испытаний *', 'date'],
  ['testingEndDate', 'Дата завершения испытаний *', 'date'],
  ['measurementTime', 'Время измерения *', 'time'],
  ['measurementPlace', 'Место измерения *', 'text'],
  ['sourceNumber', 'Номер источника', 'text'],
];

const MeasurementDetailsStep = () => {
  const { register, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  return (
    <section>
      <h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Даты и место измерения</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {fields.map(([name, label, type]) => (
          <label key={name} className="text-sm font-bold">
            {label}
            <input
              type={type}
              maxLength={name === 'sourceNumber' ? 80 : undefined}
              {...register(name, name === 'sourceNumber' ? {
                validate: (value) =>
                  String(value || '').trim().replace(/[\u0000-\u001F\u007F]/g, '').length <= 80
                  || 'Номер источника должен содержать не более 80 символов',
              } : undefined)}
              className={`${input} mt-1.5`}
            />
            {name === 'sourceNumber' && errors.sourceNumber && (
              <span className="mt-1 block text-xs font-semibold text-rose-700">
                {errors.sourceNumber.message}
              </span>
            )}
          </label>
        ))}
      </div>
    </section>
  );
};

export default MeasurementDetailsStep;
