import { Alert, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import protocolService from '../../../../services/protocolService';
import { getAvailableMeasurementDevices } from '../../../../services/measurementDeviceService';
import { normalizeApiError } from '../../../../services/apiHelpers';
import type { MeasurementDevice, Protocol, ProtocolResult, ProtocolSamplingPoint } from '../../../../types/protocols';
import { mapProtocolResultFormToRequest } from '../../../protocols/api/protocolMappers';
import type { ProtocolCreationRequirement } from '../../../protocols/api/protocolCreationContracts';
import { protocolCreationContextKey } from '../../../protocols/hooks/useProtocolCreationContext';
import { protocolToUpdatePayload } from '../../../protocols/mappers/protocolUpdatePayload';
import type { PekControlItem, PekIndicator, PekProgram, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';

type Props = {
  open: boolean;
  report: PekReport;
  program?: PekProgram;
  onClose: () => void;
  onCollect: () => void;
};

type CreatedProtocol = { id: string; number: string };
type EntryIndicator = PekIndicator & { rowKey: string };

const scalarText = (value: unknown) => String(value ?? '').trim();
const sameId = (left: unknown, right: unknown) => scalarText(left) !== '' && scalarText(left) === scalarText(right);
const resultNumber = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const numericId = (value: unknown) => Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
const normalizedDeviceText = (value: unknown) => scalarText(value).toLocaleLowerCase('ru-RU').replace(/[^a-zа-яё0-9]+/gi, ' ').trim();
const deviceForIndicator = (indicator: PekIndicator, devices: MeasurementDevice[], laboratoryId?: string | number | null) => {
  const requested = normalizedDeviceText(indicator.measurementDeviceType);
  if (!requested) return undefined;
  const matches = devices.filter((device) => {
    if (laboratoryId && device.laboratoryId && !sameId(device.laboratoryId, laboratoryId)) return false;
    const candidates = [device.deviceType, device.name, device.model]
      .map(normalizedDeviceText)
      .filter(Boolean);
    const description = candidates.join(' ');
    return candidates.some((candidate) => candidate === requested || candidate.includes(requested) || requested.includes(candidate))
      || description.includes(requested);
  });
  return matches.length === 1 ? matches[0] : undefined;
};

const normativeLabel = (indicator: PekIndicator) => {
  if (indicator.minValue != null || indicator.maxValue != null) {
    return [indicator.minValue, indicator.maxValue].filter((value) => value != null).join(' — ');
  }
  return indicator.normativeValue == null ? 'Не задан' : String(indicator.normativeValue);
};

const indicatorsForRequirement = (requirement: ProtocolCreationRequirement, indicators: PekIndicator[]): EntryIndicator[] => {
  const fromProgram = indicators.filter((indicator) => sameId(indicator.controlItemId, requirement.pekControlItemId));
  const source = fromProgram.length > 0 ? fromProgram : requirement.indicators.map((indicator, index): PekIndicator => ({
    id: numericId(indicator.id),
    controlItemId: numericId(requirement.pekControlItemId),
    indicatorName: indicator.name,
    unit: indicator.unit,
    mandatory: true,
    sortOrder: index,
  }));
  return source.map((indicator, index) => ({
    ...indicator,
    rowKey: `${requirement.id}:${scalarText(indicator.id || indicator.clientId || indicator.indicatorId || index)}`,
  }));
};

const findControlItem = (program: PekProgram | undefined, requirement: ProtocolCreationRequirement): PekControlItem | undefined =>
  program?.controlItems?.find((item) => sameId(item.id, requirement.pekControlItemId));

const findResult = (protocol: Protocol, indicator: PekIndicator) => protocol.results.find((row) =>
  sameId(row.values.programIndicatorId, indicator.id)
  || scalarText(row.values.indicatorName ?? row.indicatorName).toLocaleLowerCase('ru-RU') === indicator.indicatorName.trim().toLocaleLowerCase('ru-RU'),
);

const resultRequest = (
  requirement: ProtocolCreationRequirement,
  indicator: PekIndicator,
  value: number,
  samplingPointId: string | number | null,
  measurementDeviceId?: string | number | null,
  existing?: ProtocolResult,
) => mapProtocolResultFormToRequest({
  normativeId: indicator.normativeId ?? null,
  measurementDeviceId: existing?.measurementDeviceId ?? measurementDeviceId ?? null,
  samplingPointId,
  values: {
    ...(existing?.values || {}),
    programIndicatorId: indicator.id ?? null,
    pekControlItemId: requirement.pekControlItemId,
    monitoringPointId: requirement.monitoringPointId,
    code: indicator.indicatorCode || '',
    pollutantCode: indicator.indicatorCode || '',
    indicator: indicator.indicatorName,
    indicatorName: indicator.indicatorName,
    unit: indicator.unit || '',
    result: value,
    resultValue: value,
    primaryReading: value,
    measurementReadings: value,
    normativeId: indicator.normativeId ?? null,
    normativeSource: indicator.normativeId ? 'DIRECTORY' : 'PROGRAM',
    normativeValue: indicator.normativeValue ?? null,
    normativeMin: indicator.minValue ?? null,
    normativeMax: indicator.maxValue ?? null,
    comparisonType: indicator.comparisonType || null,
    normativeDocument: indicator.normativeDocument || '',
  },
});

const prepareProtocol = async (
  protocol: Protocol,
  requirement: ProtocolCreationRequirement,
  controlItem: PekControlItem | undefined,
  measurementDate: string,
): Promise<Protocol> => {
  if (protocol.availableActions.edit !== true) throw new Error(`Протокол №${protocol.protocolNumber} нельзя редактировать в текущем статусе.`);
  const pointName = requirement.monitoringPointName || protocol.measurementPlace || 'Место отбора по программе ПЭК';
  let samplingPoints = protocol.samplingPoints || [];
  if (protocol.templateId === 'ambient_air' && !samplingPoints.some((point) => point.name === pointName)) {
    samplingPoints = [...samplingPoints, {
      clientPointId: `pek-point-${scalarText(requirement.monitoringPointId) || requirement.id}`,
      name: pointName,
      description: 'Точка мониторинга из программы ПЭК',
      sortOrder: samplingPoints.length,
    }];
  }
  const changed: Protocol = {
    ...protocol,
    protocolDate: measurementDate,
    measurementDate,
    measurementPlace: pointName,
    samplingPlace: pointName,
    laboratory: {
      ...protocol.laboratory,
      laboratoryId: controlItem?.laboratoryId == null ? protocol.laboratory?.laboratoryId : String(controlItem.laboratoryId),
    },
    testing: {
      ...protocol.testing,
      samplingDate: measurementDate,
      testingStartDate: measurementDate,
      testingEndDate: measurementDate,
      samplingMethodDocument: controlItem?.samplingMethod || protocol.testing.samplingMethodDocument,
      testingMethodDocument: controlItem?.measurementMethod || protocol.testing.testingMethodDocument,
      testingPurpose: protocol.testing.testingPurpose || 'Производственный экологический контроль',
    },
    testingStartDate: measurementDate,
    testingEndDate: measurementDate,
    testingMethodDocument: controlItem?.measurementMethod || protocol.testingMethodDocument,
    samplingMethodDocument: controlItem?.samplingMethod || protocol.samplingMethodDocument,
    samplingPoints,
  };
  let updated = await protocolService.updateProtocol(protocol.id, protocolToUpdatePayload(changed));
  const laboratoryId = controlItem?.laboratoryId ?? updated.laboratory?.laboratoryId;
  if (laboratoryId && (!updated.laboratory?.laboratoryName || !updated.laboratory?.accreditationNumber)) {
    updated = await protocolService.refreshLaboratoryData(updated.id, updated.version);
  }
  return updated;
};

const localSamplingPointId = (protocol: Protocol, requirement: ProtocolCreationRequirement): string | number | null => {
  if (protocol.templateId !== 'ambient_air') return null;
  const point = protocol.samplingPoints.find((item: ProtocolSamplingPoint) =>
    item.name === requirement.monitoringPointName
    || item.clientPointId === `pek-point-${scalarText(requirement.monitoringPointId) || requirement.id}`,
  );
  if (point?.id == null) throw new Error(`Backend не вернул идентификатор места отбора «${requirement.monitoringPointName || 'без названия'}».`);
  return point.id;
};

export default function PekProtocolQuickEntryDialog({ open, report, program, onClose, onCollect }: Props) {
  const queryClient = useQueryClient();
  const [measurementDate, setMeasurementDate] = useState(report.periodStart);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedProtocol[]>([]);
  const contextQuery = useQuery({
    queryKey: protocolCreationContextKey(String(report.companyId), String(report.objectId), measurementDate),
    queryFn: ({ signal }) => protocolService.getProtocolCreationContext({
      companyId: String(report.companyId), objectId: String(report.objectId), date: measurementDate,
    }, signal),
    enabled: open && Boolean(measurementDate),
    retry: false,
  });
  const devicesQuery = useQuery({
    queryKey: ['measurement-devices', 'pek-quick-entry', measurementDate],
    queryFn: () => getAvailableMeasurementDevices({ measurementDate }),
    enabled: open && Boolean(measurementDate),
  });

  const requirements = useMemo(() => contextQuery.data?.requirements.filter((requirement) =>
    sameId(requirement.pekProgramId, report.programId),
  ) || [], [contextQuery.data?.requirements, report.programId]);

  useEffect(() => {
    if (!open) return;
    setMeasurementDate(report.periodStart);
    setValues({});
    setCreated([]);
    setError('');
  }, [open, report.periodStart]);

  useEffect(() => {
    setSelected(Object.fromEntries(requirements.map((requirement) => [requirement.id,
      Boolean(requirement.existingDraftProtocolId) || (requirement.canCreate && requirement.missingCount > 0),
    ])));
  }, [requirements]);

  const selectedRequirements = requirements.filter((requirement) => selected[requirement.id]);
  const canSubmit = Boolean(program) && selectedRequirements.length > 0 && selectedRequirements.every((requirement) =>
    indicatorsForRequirement(requirement, program?.indicators || []).length > 0
    && indicatorsForRequirement(requirement, program?.indicators || []).every((indicator) => resultNumber(values[indicator.rowKey] || '') !== null),
  );

  const save = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    const completed: CreatedProtocol[] = [];
    try {
      for (const requirement of selectedRequirements) {
        let protocol = requirement.existingDraftProtocolId
          ? await protocolService.getProtocol(String(requirement.existingDraftProtocolId))
          : await protocolService.createProtocolFromPek({
            companyId: requirement.companyId,
            objectId: requirement.objectId,
            pekProgramId: requirement.pekProgramId,
            pekMonitoringId: requirement.pekMonitoringId,
            pekControlItemId: requirement.pekControlItemId,
            monitoringPointId: requirement.monitoringPointId,
            protocolTemplateId: requirement.protocolTemplateId,
            date: measurementDate,
          });
        protocol = await prepareProtocol(protocol, requirement, findControlItem(program, requirement), measurementDate);
        const pointId = localSamplingPointId(protocol, requirement);
        const controlItem = findControlItem(program, requirement);
        const indicatorDevices = new Map<string, MeasurementDevice>();
        for (const indicator of indicatorsForRequirement(requirement, program?.indicators || [])) {
          const device = deviceForIndicator(indicator, devicesQuery.data || [], controlItem?.laboratoryId);
          if (device) indicatorDevices.set(indicator.rowKey, device);
        }
        for (const device of Array.from(new Map(Array.from(indicatorDevices.values()).map((item) => [String(item.id), item])).values())) {
          const attached = protocol.measurementDevices.some((item) => sameId(item.deviceId || item.id, device.id));
          if (!attached) protocol = await protocolService.addProtocolMeasurementDevice(protocol.id, device, protocol.version);
        }
        const added = [];
        const updated = [];
        for (const indicator of indicatorsForRequirement(requirement, program?.indicators || [])) {
          const existing = findResult(protocol, indicator);
          const request = resultRequest(requirement, indicator, resultNumber(values[indicator.rowKey] || '')!, pointId, indicatorDevices.get(indicator.rowKey)?.id, existing);
          if (existing) updated.push({ ...request, id: existing.id });
          else added.push({ ...request, clientRowId: globalThis.crypto?.randomUUID?.() || `pek-result-${Date.now()}-${indicator.rowKey}` });
        }
        protocol = await protocolService.saveProtocolDraftResults(protocol.id, { version: protocol.version, added, updated, deletedIds: [] });
        completed.push({ id: protocol.id, number: protocol.protocolNumber || protocol.number || protocol.id });
        setCreated([...completed]);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['protocol-creation-context'] }),
        queryClient.invalidateQueries({ queryKey: pekKeys.root }),
      ]);
    } catch (caught) {
      setError(normalizeApiError(caught, 'Не удалось создать протоколы и сохранить результаты.').message);
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="lg">
    <DialogTitle>Протоколы по программе ПЭК</DialogTitle>
    <DialogContent>
      <Alert severity="info" className="mb-4">Точки, показатели, единицы, нормативы, лаборатория и методики подставляются из программы. Укажите дату и только фактические результаты. Для следующего месяца повторите ввод с новой датой.</Alert>
      {!program && <Alert severity="warning" className="mb-4">Загружаем показатели и нормативы программы ПЭК. Сохранение станет доступно после загрузки.</Alert>}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <TextField
          type="date"
          size="small"
          label="Дата отбора и измерения"
          value={measurementDate}
          inputProps={{ min: report.periodStart, max: report.periodEnd }}
          InputLabelProps={{ shrink: true }}
          disabled={saving}
          onChange={(event) => { setMeasurementDate(event.target.value); setValues({}); setCreated([]); setError(''); }}
        />
        <span className="pb-2 text-sm text-slate-500">Период отчёта: {report.periodStart} — {report.periodEnd}</span>
      </div>
      {contextQuery.isLoading && <div className="flex items-center gap-3 py-10"><CircularProgress size={24} /> Загружаем план ПЭК…</div>}
      {contextQuery.isError && <Alert severity="error">{normalizeApiError(contextQuery.error, 'Не удалось загрузить задания ПЭК.').message}</Alert>}
      {!contextQuery.isLoading && !contextQuery.isError && requirements.length === 0 && <Alert severity="warning">Для выбранной даты backend не вернул заданий этой программы ПЭК.</Alert>}
      {requirements.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left"><tr><th className="w-12 p-3"></th><th className="p-3">Контроль / точка</th><th className="p-3">Показатель</th><th className="p-3">Единица</th><th className="p-3">Норматив</th><th className="w-48 p-3">Результат измерения</th></tr></thead>
          <tbody>{requirements.flatMap((requirement) => {
            const rows = indicatorsForRequirement(requirement, program?.indicators || []);
            const actionable = Boolean(requirement.existingDraftProtocolId) || (requirement.canCreate && requirement.missingCount > 0);
            if (rows.length === 0) return [<tr key={requirement.id} className="border-t"><td className="p-3"><Checkbox disabled /></td><td className="p-3 font-semibold">{requirement.title}<div className="text-xs text-slate-500">{requirement.monitoringPointName || 'Точка не указана'}</div></td><td className="p-3 text-amber-700" colSpan={4}>В программе нет показателей для этой позиции.</td></tr>];
            return rows.map((indicator, index) => <tr key={indicator.rowKey} className="border-t align-middle">
              {index === 0 && <td className="p-3 align-top" rowSpan={rows.length}><Checkbox checked={Boolean(selected[requirement.id])} disabled={!actionable || saving} onChange={(event) => setSelected((current) => ({ ...current, [requirement.id]: event.target.checked }))} /></td>}
              {index === 0 && <td className="p-3 align-top" rowSpan={rows.length}><strong>{requirement.title}</strong><div className="mt-1 text-slate-600">{requirement.monitoringPointName || 'Точка не указана'}</div><div className="mt-1 text-xs text-slate-500">{requirement.existingDraftProtocolId ? `Будет заполнен черновик №${requirement.existingDraftProtocolId}` : actionable ? `Осталось по плану: ${requirement.missingCount}` : 'Создание сейчас недоступно'}</div></td>}
              <td className="p-3"><strong>{indicator.indicatorName}</strong>{indicator.indicatorCode && <div className="text-xs text-slate-500">{indicator.indicatorCode}</div>}</td>
              <td className="p-3">{indicator.unit || '—'}</td>
              <td className="p-3"><strong>{normativeLabel(indicator)}</strong><div className="text-xs text-slate-500">{indicator.comparisonType || ''}</div></td>
              <td className="p-3"><TextField size="small" fullWidth inputMode="decimal" placeholder="Например, 0.18" value={values[indicator.rowKey] || ''} disabled={!selected[requirement.id] || !actionable || saving} error={Boolean(values[indicator.rowKey]) && resultNumber(values[indicator.rowKey]) === null} onChange={(event) => setValues((current) => ({ ...current, [indicator.rowKey]: event.target.value }))} /></td>
            </tr>);
          })}</tbody>
        </table>
      </div>}
      {error && <Alert severity="error" className="mt-4">{error}</Alert>}
      {created.length > 0 && <Alert severity={error ? 'warning' : 'success'} className="mt-4"><strong>Результаты сохранены:</strong> {created.map((item, index) => <span key={item.id}>{index ? ', ' : ' '}<Link className="font-bold underline" to={`/staff/protocols/${item.id}?pekReportId=${report.id}`}>протокол №{item.number}</Link></span>)}</Alert>}
    </DialogContent>
    <DialogActions className="flex-wrap">
      <Button disabled={saving} onClick={onCollect}>Собрать уже подписанные</Button>
      <Button disabled={saving} onClick={onClose}>Закрыть</Button>
      <Button variant="contained" disabled={saving || !canSubmit} onClick={() => void save()}>{saving ? 'Создаём и сохраняем…' : 'Создать протоколы и сохранить результаты'}</Button>
    </DialogActions>
  </Dialog>;
}

export { indicatorsForRequirement, normativeLabel, resultNumber };
