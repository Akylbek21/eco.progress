import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { MeasurementDevice, NormativeRecord } from '../../../../types/protocols';
import NormativeSelectorModal from '../components/NormativeSelectorModal';
import ProtocolResultTable from '../components/ProtocolResultTable';
import SamplingPointsEditor from '../components/SamplingPointsEditor';
import { emptyWizardResult, type ProtocolWizardForm } from '../wizardTypes';
import { validateProtocolWizardStep } from '../../utils/protocolWizardValidation';

type Props = { devices: MeasurementDevice[]; onSuggestChangeType?: () => void };

const text = (value: unknown) => value == null ? '' : String(value);

const ResultsStep = ({ devices, onSuggestChangeType }: Props) => {
  const [selector, setSelector] = useState(false);
  const [activeSamplingPointId, setActiveSamplingPointId] = useState('');
  const { control, watch, setValue } = useFormContext<ProtocolWizardForm>();
  const fieldArray = useFieldArray({ control, name: 'results' });
  const { append, update } = fieldArray;
  const form = watch();
  const ambient = form.templateId === 'ambient_air';
  const effectiveSamplingPointId = ambient
    ? activeSamplingPointId || form.samplingPoints[0]?.clientPointId || ''
    : '';
  const resultErrors = validateProtocolWizardStep(form, 2).filter((item) => item.severity === 'ERROR');
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

  useEffect(() => {
    if (!ambient) {
      setActiveSamplingPointId('');
      return;
    }
    if (!form.samplingPoints.some((point) => point.clientPointId === activeSamplingPointId)) {
      setActiveSamplingPointId(form.samplingPoints[0]?.clientPointId || '');
    }
  }, [activeSamplingPointId, ambient, form.samplingPoints]);

  const addNormatives = (items: NormativeRecord[]) => {
    const existingIds = new Set(
      form.results
        .filter((row) => !ambient || row.samplingPointId === effectiveSamplingPointId)
        .map((row) => row.normativeId)
        .filter(Boolean),
    );

    const rows = items.flatMap((item) => {
      if (existingIds.has(String(item.id))) return [];
      existingIds.add(String(item.id));
      return [{
        ...emptyWizardResult(),
        samplingPointId: effectiveSamplingPointId,
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
      }];
    });
    if (!rows.length) return;

    const emptyIndex = form.results.findIndex(
      (current) =>
        !current.normativeId &&
        !current.indicatorName &&
        !current.value,
    );
    if (emptyIndex >= 0) {
      const [first, ...rest] = rows;
      update(emptyIndex, first);
      if (rest.length) append(rest);
      return;
    }
    append(rows);
  };

  const addManual = () => {
    append({
      ...emptyWizardResult(),
      samplingPointId: effectiveSamplingPointId,
      normativeSource: 'MANUAL',
      measurementDeviceId: form.defaultMeasurementDeviceId || '',
    });
    setSelector(false);
  };

  const copyIndicatorsToAllPoints = () => {
    if (!effectiveSamplingPointId) return;
    const sourceRows = form.results.filter((row) => row.samplingPointId === effectiveSamplingPointId);
    const copies = form.samplingPoints.flatMap((point) => {
      if (point.clientPointId === effectiveSamplingPointId) return [];
      const existing = new Set(form.results.filter((row) => row.samplingPointId === point.clientPointId).map((row) => row.normativeId || `${row.pollutantCode}:${row.indicatorName}`));
      return sourceRows.flatMap((row) => {
        const key = row.normativeId || `${row.pollutantCode}:${row.indicatorName}`;
        if (existing.has(key)) return [];
        return [{ ...row, clientRowId: emptyWizardResult().clientRowId, serverResultId: undefined, samplingPointId: point.clientPointId, value: '', textValue: '' }];
      });
    });
    if (copies.length) append(copies);
  };

  return (
    <section>
      {ambient && <div className="mb-6 space-y-4">
        <SamplingPointsEditor />
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black text-slate-900">Точка для добавления показателей</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {form.samplingPoints.map((point) => <button key={point.clientPointId} type="button" onClick={() => setActiveSamplingPointId(point.clientPointId)} className={`rounded-full px-4 py-2 text-sm font-bold ${effectiveSamplingPointId === point.clientPointId ? 'bg-eco-700 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{point.name || 'Без названия'}</button>)}
          </div>
          <button type="button" disabled={!effectiveSamplingPointId || !form.results.some((row) => row.samplingPointId === effectiveSamplingPointId)} onClick={copyIndicatorsToAllPoints} className="mt-3 rounded-xl border border-eco-300 px-4 py-2.5 text-sm font-bold text-eco-800 disabled:opacity-40">Скопировать показатели во все точки</button>
        </div>
      </div>}
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
            Добавьте показатели и заполните результат каждой строки.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelector(true)} className="rounded-full bg-eco-700 px-4 py-2 text-sm font-bold text-white hover:bg-eco-800">Добавить из справочника</button>
          <button type="button" onClick={addManual} className="rounded-full border border-eco-300 px-4 py-2 text-sm font-bold text-eco-800">Добавить вручную</button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 rounded-2xl border border-eco-200 bg-eco-50/60 p-4 sm:grid-cols-3">
        {['Добавьте норматив', 'Введите результат и единицу', 'Выберите прибор'].map((label, index) => <div key={label} className="flex items-center gap-2 text-sm font-semibold text-eco-950"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-eco-700 text-xs text-white">{index + 1}</span>{label}</div>)}
      </div>

      <div className="mt-5">
        <ProtocolResultTable
          fieldArray={fieldArray}
          devices={devices}
          onSelectNormatives={() => setSelector(true)}
          onAddManual={addManual}
          activeSamplingPointId={effectiveSamplingPointId}
        />
      </div>

      {resultErrors.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-black">Для завершения заполните:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-semibold">
            {resultErrors.slice(0, 5).map((item) => <li key={`${item.code}-${item.field}`}>{item.message}</li>)}
          </ul>
          {resultErrors.length > 5 && <p className="mt-2 font-semibold">Ещё ошибок: {resultErrors.length - 5}</p>}
          <p className="mt-2 text-xs font-semibold text-amber-800">Нажмите карандаш в строке, чтобы открыть все поля.</p>
        </div>
      )}

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
        onSuggestChangeType={(templateId) => {
          setValue('templateId', templateId, { shouldDirty: true });
          setSelector(false);
          onSuggestChangeType?.();
        }}
        onAdd={(items) => {
          addNormatives(items);
          setSelector(false);
        }}
      />
    </section>
  );
};

export default ResultsStep;
