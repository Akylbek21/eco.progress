import { Trash2 } from 'lucide-react';
import { Controller, useFormContext } from 'react-hook-form';
import type { MeasurementDevice } from '../../../../types/protocols';
import DeviceSelector from './DeviceSelector';
import ProtocolResultDetails from './ProtocolResultDetails';
import type { ProtocolWizardForm } from '../wizardTypes';

type Props = {
  index: number;
  chemical: boolean;
  devices: MeasurementDevice[];
  measurementDate: string;
  laboratoryId: string;
  invalidDevice: boolean;
  onRemove: () => void;
};

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-eco-500 focus:ring-2 focus:ring-eco-100';
const labelClass = 'block text-xs font-bold text-slate-600';

const ProtocolResultRow = ({
  index,
  chemical,
  devices,
  measurementDate,
  laboratoryId,
  invalidDevice,
  onRemove,
}: Props) => {
  const { register, control, watch, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  const row = watch(`results.${index}`);
  const manual = row?.normativeSource !== 'DIRECTORY';
  const rowErrors = errors.results?.[index];

  return (
    <article
      data-result-index={index}
      className={`overflow-hidden rounded-2xl border shadow-sm ${
        invalidDevice
          ? 'border-rose-300 bg-rose-50/40'
          : 'border-slate-200 bg-white'
      }`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Результат измерения
          </p>
          <h4 className="text-sm font-black text-slate-900">
            Показатель №{index + 1}
          </h4>
          <p className={`mt-1 text-xs font-bold ${manual ? 'text-amber-700' : 'text-emerald-700'}`}>
            {manual ? 'Норматив не выбран' : row?.normativeStatus === 'REVIEW' ? 'Требуется проверка' : 'Норматив выбран'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-2 text-rose-700 transition hover:bg-rose-100"
            aria-label={`Удалить строку ${index + 1}`}
            title="Удалить"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-12">
        <label className={`${labelClass} sm:col-span-2 lg:col-span-5`}>
          Наименование показателя
          <input
            readOnly={!manual}
            aria-label={`Показатель строки ${index + 1}`}
            placeholder="Выберите норматив через поиск"
            {...register(`results.${index}.indicatorName`)}
            className={`${inputClass} font-semibold text-slate-700 ${!manual ? 'cursor-default bg-slate-50' : ''} ${rowErrors?.indicatorName ? 'border-rose-400' : ''}`}
          />
          {rowErrors?.indicatorName?.message && <span className="mt-1 block text-xs text-rose-700">{rowErrors.indicatorName.message}</span>}
        </label>

        <label className={`${labelClass} lg:col-span-3`}>
          {chemical ? 'Код загрязняющего вещества' : 'Тип фактора'}
          <input
            readOnly={!manual}
            aria-label={
              chemical ? 'Код загрязняющего вещества' : 'Тип фактора'
            }
            placeholder={chemical ? 'Код из норматива' : 'Тип из норматива'}
            {...register(
              chemical
                ? `results.${index}.pollutantCode`
                : `results.${index}.factorType`,
            )}
            className={`${inputClass} text-slate-700 ${!manual ? 'cursor-default bg-slate-50' : ''} ${rowErrors?.factorType || rowErrors?.pollutantCode ? 'border-rose-400' : ''}`}
          />
          {!chemical && rowErrors?.factorType?.message && <span className="mt-1 block text-xs text-rose-700">{rowErrors.factorType.message}</span>}
          {chemical && rowErrors?.pollutantCode?.message && <span className="mt-1 block text-xs text-rose-700">{rowErrors.pollutantCode.message}</span>}
        </label>

        <label className={`${labelClass} lg:col-span-2`}>
          Результат
          <input
            aria-label="Результат"
            inputMode="decimal"
            placeholder="0,00"
            {...register(`results.${index}.value`)}
            className={`${inputClass} ${rowErrors?.value ? 'border-rose-400' : ''}`}
          />
          {rowErrors?.value?.message && <span className="mt-1 block text-xs text-rose-700">{rowErrors.value.message}</span>}
        </label>

        <label className={`${labelClass} lg:col-span-2`}>
          Единица измерения
          <input
            readOnly={!manual}
            aria-label="Единица измерения"
            placeholder="Из норматива"
            {...register(`results.${index}.unit`)}
            className={`${inputClass} text-slate-700 ${!manual ? 'cursor-default bg-slate-50' : ''} ${rowErrors?.unit ? 'border-rose-400' : ''}`}
          />
          {rowErrors?.unit?.message && <span className="mt-1 block text-xs text-rose-700">{rowErrors.unit.message}</span>}
        </label>

        <label className={`${labelClass} lg:col-span-4`}>
          Место отбора
          <input
            aria-label="Место отбора"
            placeholder="Укажите точку или место отбора"
            {...register(`results.${index}.samplingPlace`)}
            className={inputClass}
          />
        </label>

        <div className={`${labelClass} sm:col-span-2 lg:col-span-5`}>
          Прибор
          <div className="mt-1.5">
            <Controller
              control={control}
              name={`results.${index}.measurementDeviceId`}
              render={({ field }) => (
                <DeviceSelector
                  value={field.value}
                  onChange={field.onChange}
                  devices={devices}
                  measurementDate={measurementDate}
                  laboratoryId={laboratoryId}
                  error={invalidDevice}
                />
              )}
            />
          </div>
          {(invalidDevice || rowErrors?.measurementDeviceId) && (
            <p className="mt-1.5 text-xs font-bold text-rose-700">
              {rowErrors?.measurementDeviceId?.message || 'Прибор недействителен на дату измерения.'}
            </p>
          )}
        </div>

        <label className={`${labelClass} lg:col-span-2`}>
          Норматив
          <input
            readOnly
            aria-label="Норматив"
            value={
              row?.comparisonType === 'RANGE'
                ? [row.normativeMin, row.normativeMax].filter((value) => value !== '').join(' — ')
                : row?.comparisonType === 'GREATER_OR_EQUAL'
                  ? `≥ ${row.normativeMin || row.normativeValue || ''}`.trim()
                  : row?.normativeMax
                    ? `≤ ${row.normativeMax}`
                    : row?.normativeValue !== ''
                      ? `≤ ${row.normativeValue}`
                      : ''
            }
            placeholder="Не выбран"
            className={`${inputClass} cursor-default bg-eco-50 font-bold text-eco-900`}
          />
        </label>

        <div className={`${labelClass} lg:col-span-1`}>
          Соответствие
          <div className="mt-1.5 flex min-h-[42px] items-center rounded-xl bg-slate-50 px-3 text-xs font-semibold text-slate-500">
            После расчёта
          </div>
        </div>
      </div>

      <ProtocolResultDetails index={index} />
    </article>
  );
};

export default ProtocolResultRow;
