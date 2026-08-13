import { useFormContext } from 'react-hook-form';
import { RefreshCw } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import type { ProtocolSelectOption } from '../../../../config/protocolWater';
import { isWaterProtocolType } from '../../../../config/protocolWater';
import type { ProtocolWizardForm } from '../wizardTypes';

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-100';

type Props = {
  weatherLoading: boolean;
  weatherMessage: string;
  onRefresh: () => void;
  waterTypeOptions: ProtocolSelectOption[];
  waterUseCategoryOptions: ProtocolSelectOption[];
};

const EnvironmentStep = ({
  weatherLoading,
  weatherMessage,
  onRefresh,
  waterTypeOptions,
  waterUseCategoryOptions,
}: Props) => {
  const { register, watch, setValue, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  const manualWeather = (field: 'temperature' | 'humidity' | 'pressure' | 'windSpeed') =>
    register(field, {
      onChange: () => setValue('environmentSource', 'MANUAL', { shouldDirty: true }),
    });
  const type = watch('templateId');
  const ambient = type === 'ambient_air';
  const micro = type === 'microclimate';
  const lighting = type === 'lighting';
  const noise = type === 'noise_vibration';
  const water = isWaterProtocolType(type);

  return (
    <section>
      <h3 className="text-xl font-black">Условия на объекте</h3>
      <p className="mt-2 text-sm text-slate-500">Погода заполняется по объекту, дате и времени. Если автоматические данные недоступны, значения можно ввести вручную.</p>
      {water && (
        <fieldset
          id="water-characteristics"
          className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/60 p-4"
        >
          <legend className="px-1 text-base font-black text-slate-900">Характеристики воды</legend>
          <p className="mt-1 text-sm text-slate-600">Оба значения обязательны для водного протокола.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label htmlFor="waterType" className="text-sm font-bold">
              Тип воды
              <select
                id="waterType"
                data-testid="water-type-select"
                required
                aria-invalid={Boolean(errors.waterType)}
                {...register('waterType', { required: 'Выберите тип воды' })}
                className={`${input} mt-1.5 ${errors.waterType ? 'border-rose-400 ring-2 ring-rose-100' : ''}`}
              >
                <option value="">Выберите тип воды</option>
                {waterTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.waterType && <span className="mt-1 block text-sm font-semibold text-rose-700">{errors.waterType.message}</span>}
            </label>
            <label htmlFor="waterUseCategory" className="text-sm font-bold">
              Категория водопользования
              <select
                id="waterUseCategory"
                data-testid="water-use-category-select"
                required
                aria-invalid={Boolean(errors.waterUseCategory)}
                {...register('waterUseCategory', { required: 'Выберите категорию водопользования' })}
                className={`${input} mt-1.5 ${errors.waterUseCategory ? 'border-rose-400 ring-2 ring-rose-100' : ''}`}
              >
                <option value="">Выберите категорию водопользования</option>
                {waterUseCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.waterUseCategory && <span className="mt-1 block text-sm font-semibold text-rose-700">{errors.waterUseCategory.message}</span>}
            </label>
          </div>
        </fieldset>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-bold">
          Дата отбора
          <input type="date" {...register('sampleDate')} className={`${input} mt-1.5`} />
        </label>
        <label className="text-sm font-bold">
          Температура, °C
          <input {...manualWeather('temperature')} inputMode="decimal" className={`${input} mt-1.5 ${errors.temperature ? 'border-rose-400' : ''}`} />
          {errors.temperature?.message && <span className="mt-1 block text-xs text-rose-700">{errors.temperature.message}</span>}
        </label>
        <label className="text-sm font-bold">
          Влажность, %
          <input {...manualWeather('humidity')} inputMode="decimal" className={`${input} mt-1.5 ${errors.humidity ? 'border-rose-400' : ''}`} />
          {errors.humidity?.message && <span className="mt-1 block text-xs text-rose-700">{errors.humidity.message}</span>}
        </label>
        <label className="text-sm font-bold">
          Давление, кПа
          <input {...manualWeather('pressure')} inputMode="decimal" className={`${input} mt-1.5 ${errors.pressure ? 'border-rose-400' : ''}`} />
          {errors.pressure?.message && <span className="mt-1 block text-xs text-rose-700">{errors.pressure.message}</span>}
        </label>
        <label className="text-sm font-bold">
          Скорость воздуха/ветра, м/с
          <input {...manualWeather('windSpeed')} inputMode="decimal" className={`${input} mt-1.5 ${errors.windSpeed ? 'border-rose-400' : ''}`} />
          {errors.windSpeed?.message && <span className="mt-1 block text-xs text-rose-700">{errors.windSpeed.message}</span>}
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
            <label className="text-sm font-bold">Тип рабочего места<input {...register('workplaceType')} className={`${input} mt-1.5`} /></label>
            <label className="text-sm font-bold">Тип помещения<input {...register('roomType')} className={`${input} mt-1.5`} /></label>
            <label className="text-sm font-bold">Уровень нормирования<input {...register('normLevel')} className={`${input} mt-1.5`} /></label>
          </>
        )}
        {lighting && (
          <>
            <label className="text-sm font-bold">Тип помещения<input {...register('roomType')} className={`${input} mt-1.5`} /></label>
            <label className="text-sm font-bold">Тип рабочего места<input required {...register('workplaceType', { required: 'Укажите тип рабочего места' })} className={`${input} mt-1.5 ${errors.workplaceType ? 'border-rose-400' : ''}`} />{errors.workplaceType?.message && <span className="mt-1 block text-xs text-rose-700">{errors.workplaceType.message}</span>}</label>
            <label className="text-sm font-bold">Уровень нормирования<input {...register('normLevel')} className={`${input} mt-1.5`} /></label>
            <label className="text-sm font-bold">Тип освещения<input {...register('lightingType')} className={`${input} mt-1.5`} /></label>
            <label className="text-sm font-bold">Разряд зрительной работы<input {...register('visualWorkCategory')} className={`${input} mt-1.5`} /></label>
          </>
        )}
        {noise && (
          <>
            <label className="text-sm font-bold">Тип рабочего места<input {...register('workplaceType')} className={`${input} mt-1.5`} /></label>
            <label className="text-sm font-bold">Тип помещения<input {...register('roomType')} className={`${input} mt-1.5`} /></label>
            <label className="text-sm font-bold">Тип шума<input {...register('noiseType')} className={`${input} mt-1.5`} /></label>
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
      <Button type="button" variant="secondary" className="mt-4" disabled={weatherLoading} onClick={onRefresh}>
        <RefreshCw className={`h-4 w-4 ${weatherLoading ? 'animate-spin' : ''}`} />
        Обновить условия
      </Button>
    </section>
  );
};

export default EnvironmentStep;
