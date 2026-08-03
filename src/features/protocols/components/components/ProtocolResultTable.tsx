import { Plus } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { MeasurementDevice } from '../../../../types/protocols';
import { isDeviceValidForDate } from '../../../../utils/protocolDevices';
import ProtocolResultRow from './ProtocolResultRow';
import { CHEMICAL_TYPES, type ProtocolWizardForm } from '../wizardTypes';

type Props = {
  devices: MeasurementDevice[];
  onSelectNormatives: () => void;
  onAddManual: () => void;
};

const ProtocolResultTable = ({ devices, onSelectNormatives, onAddManual }: Props) => {
  const { control, watch } = useFormContext<ProtocolWizardForm>();
  const { fields, remove } = useFieldArray({
    control,
    name: 'results',
  });
  const values = watch();
  const chemical = Boolean(
    values.templateId && CHEMICAL_TYPES.has(values.templateId),
  );

  return (
    <div>
      <div className="space-y-4">
        {fields.map((field, index) => {
          const row = values.results[index];
          const selected = devices.find(
            (item) => String(item.id) === row?.measurementDeviceId,
          );
          const invalidDevice = Boolean(
            row?.measurementDeviceId &&
              (!selected ||
                !isDeviceValidForDate(selected, values.measurementDate)),
          );

          return (
            <ProtocolResultRow
              key={field.id}
              index={index}
              chemical={chemical}
              devices={devices}
              measurementDate={values.measurementDate}
              laboratoryId={values.laboratoryId}
              invalidDevice={invalidDevice}
              onRemove={() => remove(index)}
            />
          );
        })}
      </div>

      {!fields.length && (
        <div className="rounded-2xl border border-dashed border-eco-300 bg-eco-50/50 px-5 py-8 text-center">
          <p className="font-bold text-slate-900">Показатели ещё не выбраны</p>
          <p className="mt-1 text-sm text-slate-600">
            Найдите и выберите норматив — показатель, единица измерения и
            нормативное значение заполнятся автоматически.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onSelectNormatives}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-eco-300 bg-white px-4 py-2.5 text-sm font-bold text-eco-800 transition hover:border-eco-500 hover:bg-eco-50"
      >
        <Plus className="h-4 w-4" />
        Выбрать норматив
      </button>
      <button type="button" onClick={onAddManual} className="ml-2 mt-4 inline-flex items-center gap-2 rounded-xl border border-eco-300 bg-white px-4 py-2.5 text-sm font-bold text-eco-800">
        <Plus className="h-4 w-4" /> Добавить показатель вручную
      </button>
    </div>
  );
};

export default ProtocolResultTable;
