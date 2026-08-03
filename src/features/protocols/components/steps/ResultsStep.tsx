import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { MeasurementDevice, NormativeRecord } from '../../../../types/protocols';
import NormativeSelectorModal from '../components/NormativeSelectorModal';
import ProtocolResultTable from '../components/ProtocolResultTable';
import { emptyWizardResult, type ProtocolWizardForm } from '../wizardTypes';

type Props = { devices: MeasurementDevice[] };

const text = (value: unknown) => value == null ? '' : String(value);

const ResultsStep = ({ devices }: Props) => {
  const [selector, setSelector] = useState(false);
  const { control, watch, setValue } = useFormContext<ProtocolWizardForm>();
  const { append, update } = useFieldArray({ control, name: 'results' });
  const form = watch();
  const automaticCommonMethodRef = useRef('');

  useEffect(() => {
    const methods = form.results
      .map((row) => text(row.testingMethodNd).trim())
      .filter(Boolean);
    const commonMethod =
      methods.length === form.results.length && new Set(methods).size === 1
        ? methods[0]
        : '';
    const current = text(form.testingMethodNd).trim();
    if (!current || current === automaticCommonMethodRef.current) {
      setValue('testingMethodNd', commonMethod, { shouldDirty: false });
      automaticCommonMethodRef.current = commonMethod;
    }
  }, [form.results, form.testingMethodNd, setValue]);

  const addNormatives = (items: NormativeRecord[]) => {
    const existingIds = new Set(
      form.results
        .map((row) => row.normativeId)
        .filter(Boolean),
    );

    items.forEach((item) => {
      if (existingIds.has(String(item.id))) return;

      const row = {
        ...emptyWizardResult(),
        indicatorName:
          item.indicator || item.indicatorName || item.name || '',
        pollutantCode: item.pollutantCode || item.code || '',
        factorType: item.factorType || '',
        factorCode: item.factorCode || '',
        cas: item.cas || item.casNumber || '',
        formula: item.formula || item.chemicalFormula || '',
        unit: item.unit || '',
        normativeId: String(item.id),
        normativeSource: 'DIRECTORY' as const,
        normativeStatus: item.status === 'REVIEW' || item.status === 'INACTIVE' ? item.status : 'ACTIVE' as const,
        normativeValue: text(item.normativeValue ?? item.value),
        normativeValueRaw: text(item.normativeValue ?? item.value),
        normativeMin: text(item.min ?? item.minValue),
        normativeMax: text(item.max ?? item.maxValue),
        comparisonType: item.comparisonType || 'LESS_OR_EQUAL',
        normativeDocument:
          item.normativeDocument || item.sourceDocumentName || '',
        sourceDocumentCode: item.sourceDocumentCode || '',
        testingMethodNd: item.testingMethod || '',
        measurementDeviceId: form.defaultMeasurementDeviceId || '',
      };
      const emptyIndex = form.results.findIndex(
        (current) =>
          !current.normativeId &&
          !current.indicatorName &&
          !current.value,
      );

      if (emptyIndex >= 0) update(emptyIndex, row);
      else append(row);
      existingIds.add(String(item.id));
    });
  };

  const addManual = () => {
    append({
      ...emptyWizardResult(),
      normativeSource: 'MANUAL',
      measurementDeviceId: form.defaultMeasurementDeviceId || '',
    });
    setSelector(false);
  };

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3
            id="wizard-step-title"
            tabIndex={-1}
            className="text-xl font-black"
          >
            Результаты измерений
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Сначала выберите норматив через поиск, затем укажите результат
            замера и прибор из «Средств измерений».
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelector(true)}
          className="rounded-full bg-eco-100 px-4 py-2 text-sm font-bold text-eco-800"
        >
          Найти норматив
        </button>
        <button type="button" onClick={addManual} className="rounded-full border border-eco-300 px-4 py-2 text-sm font-bold text-eco-800">
          Добавить показатель вручную
        </button>
      </div>

      <div className="mt-5">
        <ProtocolResultTable
          devices={devices}
          onSelectNormatives={() => setSelector(true)}
          onAddManual={addManual}
        />
      </div>

      <NormativeSelectorModal
        open={selector}
        templateId={form.templateId}
        filters={{
          waterType: form.waterType || undefined,
          waterUseCategory: form.waterUseCategory || undefined,
          lightingType: form.lightingType || undefined,
          noiseType: form.noiseType || undefined,
          roomType: form.roomType || undefined,
          season: form.season || undefined,
          workCategory: form.workCategory || undefined,
          workplaceType: form.workplaceType || undefined,
          normLevel: form.normLevel || undefined,
          visualWorkCategory: form.visualWorkCategory || undefined,
        }}
        onClose={() => setSelector(false)}
        onManual={addManual}
        onAdd={(items) => {
          addNormatives(items);
          setSelector(false);
        }}
      />
    </section>
  );
};

export default ResultsStep;
