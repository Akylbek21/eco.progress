import { useFormContext } from 'react-hook-form';
import type { ProtocolWizardForm } from '../wizardTypes';

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-100';

type Props = {
  weatherLoading: boolean;
  weatherMessage: string;
};

const EnvironmentStep = ({ weatherLoading, weatherMessage }: Props) => {
  const { register, watch } = useFormContext<ProtocolWizardForm>();
  const type = watch('templateId');
  const ambient = type === 'ambient_air';
  const micro = type === 'microclimate';

  return (
    <section>
      <h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Условия среды</h3>
      <p className="mt-2 text-sm text-slate-500">Условия заполняются автоматически по объекту, дате отбора и времени измерения.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-bold">
          Дата отбора
          <input type="date" {...register('sampleDate')} className={`${input} mt-1.5`} />
        </label>
        <label className="text-sm font-bold">
          Температура, °C
          <input {...register('temperature')} inputMode="decimal" className={`${input} mt-1.5`} />
        </label>
        <label className="text-sm font-bold">
          Влажность, %
          <input {...register('humidity')} inputMode="decimal" className={`${input} mt-1.5`} />
        </label>
        <label className="text-sm font-bold">
          Давление, кПа
          <input {...register('pressure')} inputMode="decimal" className={`${input} mt-1.5`} />
        </label>
        <label className="text-sm font-bold">
          Скорость воздуха/ветра, м/с
          <input {...register('windSpeed')} inputMode="decimal" className={`${input} mt-1.5`} />
        </label>
        {ambient && (
          <>
            <label className="text-sm font-bold">
              Направление ветра
              <input {...register('windDirection')} className={`${input} mt-1.5`} />
            </label>
            <label className="text-sm font-bold">
              Погодные условия
              <input {...register('weatherConditions')} className={`${input} mt-1.5`} />
            </label>
          </>
        )}
        {micro && (
          <>
            <label className="text-sm font-bold">
              Сезон
              <input {...register('season')} className={`${input} mt-1.5`} />
            </label>
            <label className="text-sm font-bold">
              Категория работ
              <input {...register('workCategory')} className={`${input} mt-1.5`} />
            </label>
          </>
        )}
      </div>
      {watch('environmentSource') === 'MANUAL' && (
        <label className="mt-4 block text-sm font-bold">
          Причина ручного изменения
          <input {...register('environmentManualChangeReason')} className={`${input} mt-1.5`} />
        </label>
      )}
      {(weatherLoading || weatherMessage) && (
        <p className={`mt-4 text-sm font-semibold ${weatherMessage.startsWith('Не удалось') || weatherMessage.startsWith('У выбранного объекта') ? 'text-amber-700' : 'text-slate-500'}`}>
          {weatherLoading ? 'Загружаем условия среды…' : weatherMessage}
        </p>
      )}
    </section>
  );
};

export default EnvironmentStep;
