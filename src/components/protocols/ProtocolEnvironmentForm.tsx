import type { ProtocolEnvironmentalConditions } from '../../types/protocols';

type Props = {
  value: ProtocolEnvironmentalConditions;
  readOnly: boolean;
  onChange: (value: ProtocolEnvironmentalConditions) => void;
};

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';

const ProtocolEnvironmentForm = ({ value, readOnly, onChange }: Props) => {
  const update = (key: keyof ProtocolEnvironmentalConditions, next: string) => onChange({ ...value, [key]: next });
  const fields: Array<[keyof ProtocolEnvironmentalConditions, string]> = [
    ['temperature', 'Температура'],
    ['minTemperature', 'Минимальная температура'],
    ['maxTemperature', 'Максимальная температура'],
    ['humidity', 'Влажность'],
    ['minHumidity', 'Минимальная влажность'],
    ['maxHumidity', 'Максимальная влажность'],
    ['pressureKpa', 'Давление, кПа'],
    ['windSpeed', 'Скорость ветра, м/с'],
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-900">Условия среды</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([key, label]) => (
          <label key={key} className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>{label}</span>
            <input
              type="number"
              step="any"
              disabled={readOnly}
              value={value[key] || ''}
              onChange={(event) => update(key, event.target.value)}
              className={inputClass}
            />
          </label>
        ))}
        <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">
          <span>Комментарий</span>
          <textarea disabled={readOnly} rows={4} value={value.comment || ''} onChange={(event) => update('comment', event.target.value)} className={inputClass} />
        </label>
      </div>
    </section>
  );
};

export default ProtocolEnvironmentForm;
