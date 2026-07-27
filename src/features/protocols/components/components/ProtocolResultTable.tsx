import { Plus } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { MeasurementDevice } from '../../../../types/protocols';
import { isDeviceValidForDate } from '../../../../utils/protocolDevices';
import ProtocolResultRow from './ProtocolResultRow';
import { CHEMICAL_TYPES, emptyWizardResult, type ProtocolWizardForm } from '../wizardTypes';

type Props = {
  devices: MeasurementDevice[];
};

const ProtocolResultTable = ({ devices }: Props) => {
  const { control, watch } = useFormContext<ProtocolWizardForm>();
  const { fields, append, remove, insert } = useFieldArray({
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
              onDuplicate={() => insert(index + 1, { ...row })}
              onRemove={() => remove(index)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => append(emptyWizardResult())}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-eco-300 bg-white px-4 py-2.5 text-sm font-bold text-eco-800 transition hover:border-eco-500 hover:bg-eco-50"
      >
        <Plus className="h-4 w-4" />
        Добавить показатель
      </button>
    </div>
  );
};

export default ProtocolResultTable;
