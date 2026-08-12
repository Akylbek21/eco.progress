import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ClipboardCheck, Eye, FileCheck2, History, MoreHorizontal, Plus, RotateCw, Save, Search, SearchCheck, Trash2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/modals/ConfirmModal';
import ProtocolStatusBadge from '../components/protocols/ProtocolStatusBadge';
import NormativeStatusBadge from '../components/protocols/NormativeStatusBadge';
import ProtocolGeneralForm from '../components/protocols/ProtocolGeneralForm';
import ProtocolEnvironmentForm from '../components/protocols/ProtocolEnvironmentForm';
import ProtocolWaterCharacteristicsForm from '../components/protocols/ProtocolWaterCharacteristicsForm';
import ProtocolExplanatoryNoteForm from '../components/protocols/ProtocolExplanatoryNoteForm';
import ProtocolLaboratoryForm from '../components/protocols/ProtocolLaboratoryForm';
import ProtocolOrganizationForm from '../components/protocols/ProtocolOrganizationForm';
import ProtocolPreviewModal from '../components/protocols/ProtocolPreviewModal';
import ProtocolResultsTable from '../components/protocols/ProtocolResultsTable';
import ProtocolTestingForm from '../components/protocols/ProtocolTestingForm';
import ReplaceProtocolModal from '../components/protocols/ReplaceProtocolModal';
import ReturnForRevisionModal from '../components/protocols/ReturnForRevisionModal';
import SignProtocolModal from '../components/protocols/SignProtocolModal';
import { templateName } from '../data/protocolTemplates';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { getAvailableMeasurementDevices } from '../services/measurementDeviceService';
import { getCompanyObjects } from '../services/companyService';
import { getLaboratoryEmployees } from '../services/laboratorySettingsService';
import { getApiErrorMessage, getApiStatus, normalizeApiError, parseApiError } from '../services/apiHelpers';
import protocolService from '../services/protocolService';
import type { CompanyObject } from '../types/companies';
import type { LaboratoryEmployee, MeasurementDevice, Protocol, ProtocolCompanySnapshot, ProtocolMeasurementDevice, WeatherConditions } from '../types/protocols';
import { getProtocolPermissions, type ProtocolPermissions } from '../utils/protocolPermissions';
import { parseLaboratoryApiError } from '../utils/laboratoryApiError';
import { isProtocolStatusEditable } from '../config/protocolStatus';
import { isWaterProtocolType } from '../config/protocolWater';
import { collectProtocolDevices, isDeviceValidForDate } from '../utils/protocolDevices';
import { normalizeProtocolError } from '../utils/protocolError';
import ProtocolDetailsView from '../features/protocols/details/ProtocolDetailsView';
import type { ProtocolEditSection } from '../features/protocols/details/protocolDetailsModel';
import { useSignProtocolMutation } from '../features/protocols/hooks/useSignProtocolMutation';
import { protocolQueryKeys, protocolScope } from '../features/protocols/hooks/queryKeys';
import { pekApi } from '../features/pek/api/pekApi';
import { hasProtocolAction } from '../features/protocols/utils/protocolActions';

const emptyLaboratory = {
  laboratoryName: '',
  laboratoryAddress: '',
  accreditationNumber: '',
  accreditationValidUntil: '',
  director: '',
  laboratoryHead: '',
  executor: '',
};

const emptyOrganization = {
  organizationName: '',
  organizationAddress: '',
  objectName: '',
  productName: '',
  testingBasis: '',
};

const emptyTesting = {
  productNormativeDocument: '',
  samplingMethodDocument: '',
  testingMethodDocument: '',
  samplingDate: '',
  testingStartDate: '',
  testingEndDate: '',
  testingDate: '',
  testingPurpose: '',
  environmentConditions: '',
};

const fileName = (protocol: Protocol, extension: string) => `${protocol.protocolNumber || protocol.number || `protocol-${protocol.id}`}.${extension}`;
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const DEFAULT_WEATHER_TIME = '12:00';
const PROTOCOL_BACKUP_SCHEMA_VERSION = 1;
const protocolBackupKey = (userId: string | undefined, protocolId: string) => `protocol-draft-backup:${userId || 'anonymous'}:${protocolId}:${PROTOCOL_BACKUP_SCHEMA_VERSION}`;

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const editableState = (protocol: Protocol) => ({
  number: protocol.protocolNumber || protocol.number || '',
  protocolDate: protocol.protocolDate || '',
  formCode: protocol.formCode || '',
  appendixNumber: protocol.appendixNumber || '',
  sourceNumber: protocol.sourceNumber || '',
  executor: protocol.executor || '',
  executorId: protocol.executorId || '',
  approver: protocol.approver || '',
  laboratory: protocol.laboratory,
  organization: protocol.organization,
  testing: protocol.testing,
  environment: protocol.environment,
  objectId: protocol.objectId,
  measurementDate: protocol.measurementDate,
  measurementTime: protocol.measurementTime,
  measurementPlace: protocol.measurementPlace,
  explanatoryNote: protocol.explanatoryNote,
  printVisibility: protocol.printVisibility,
});

const editableSignature = (protocol: Protocol) => JSON.stringify(editableState(protocol));

const rebaseEditableProtocol = (base: Protocol, local: Protocol, remote: Protocol) => {
  const baseState = editableState(base);
  const localState = editableState(local);
  const remoteState = editableState(remote);
  const mergedState = { ...remoteState };
  const conflicts: string[] = [];

  (Object.keys(localState) as Array<keyof typeof localState>).forEach((key) => {
    const baseValue = JSON.stringify(baseState[key] ?? null);
    const localValue = JSON.stringify(localState[key] ?? null);
    const remoteValue = JSON.stringify(remoteState[key] ?? null);
    const localChanged = localValue !== baseValue;
    const remoteChanged = remoteValue !== baseValue;
    if (localChanged && remoteChanged && localValue !== remoteValue) conflicts.push(String(key));
    else if (localChanged) (mergedState as Record<string, unknown>)[key] = localState[key];
  });

  return {
    conflicts,
    protocol: {
      ...remote,
      protocolNumber: mergedState.number,
      number: mergedState.number,
      protocolDate: mergedState.protocolDate,
      formCode: mergedState.formCode,
      appendixNumber: mergedState.appendixNumber,
      sourceNumber: mergedState.sourceNumber,
      executor: mergedState.executor,
      executorId: mergedState.executorId,
      approver: mergedState.approver,
      laboratory: mergedState.laboratory,
      organization: mergedState.organization,
      testing: mergedState.testing,
      environment: mergedState.environment,
      objectId: mergedState.objectId,
      measurementDate: mergedState.measurementDate,
      measurementTime: mergedState.measurementTime,
      measurementPlace: mergedState.measurementPlace,
      explanatoryNote: mergedState.explanatoryNote,
      printVisibility: mergedState.printVisibility,
    } as Protocol,
  };
};

const SnapshotSection = ({ snapshot }: { snapshot: ProtocolCompanySnapshot }) => {
  const rows: Array<[string, string | undefined]> = [
    ['Название', snapshot.companyName],
    ['БИН', snapshot.bin],
    ['Юридический адрес', snapshot.legalAddress],
    ['Фактический адрес', snapshot.actualAddress],
    ['Руководитель', snapshot.director],
    ['Контактное лицо', snapshot.contactPerson],
    ['Телефон', snapshot.phone],
    ['Email', snapshot.email],
    ['Объект', snapshot.objectName],
    ['Адрес объекта', snapshot.objectAddress],
    ['Вид деятельности объекта', snapshot.objectActivityType || snapshot.activityType],
    ['Координаты', snapshot.coordinates],
    ['Санитарная зона', snapshot.sanitaryZone],
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">Данные организации из snapshot</h2>
        <p className="mt-1 text-sm font-semibold text-amber-700">Данные организации сохранены на момент создания протокола.</p>
      </div>
      <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{value || '-'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

const statusClasses = {
  VALID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  EXPIRING: 'bg-amber-50 text-amber-800 ring-amber-200',
  EXPIRED: 'bg-rose-50 text-rose-800 ring-rose-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 ring-slate-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  OUT_OF_SERVICE: 'bg-rose-50 text-rose-800 ring-rose-200',
};

const statusLabels = {
  VALID: 'Поверка действует',
  ACTIVE: 'Активен',
  EXPIRING: 'Скоро истекает',
  EXPIRED: 'Поверка истекла',
  ARCHIVED: 'Архив',
  INACTIVE: 'Неактивен',
  OUT_OF_SERVICE: 'Не используется',
};

const DeviceStatus = ({ status }: { status: MeasurementDevice['status'] }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusClasses[status]}`}>
    {statusLabels[status]}
  </span>
);

type ProtocolStepKey = 'general' | 'organization' | 'environment' | 'results' | 'instruments' | 'review';
type StepStatus = 'empty' | 'partial' | 'complete' | 'error';

const protocolSteps: Array<{ key: ProtocolStepKey; label: string }> = [
  { key: 'general', label: 'Основные данные' },
  { key: 'organization', label: 'Организация' },
  { key: 'environment', label: 'Условия замера' },
  { key: 'results', label: 'Результаты' },
  { key: 'instruments', label: 'Приборы' },
  { key: 'review', label: 'Проверка и выпуск' },
];

const lifecycleSteps = ['Черновик', 'Результаты', 'Готов к подписи', 'Подписан'];
const lifecycleIndexByStatus: Record<Protocol['status'], number> = {
  DRAFT: 0,
  NEEDS_REVISION: 1,
  CALCULATED: 2,
  READY: 2,
  READY_FOR_APPROVAL: 2,
  APPROVED: 2,
  SIGNED: 3,
  UNKNOWN: 0,
  REPLACED: 3,
  CANCELLED: 0,
  ARCHIVED: 3,
};

const stepStatusLabels: Record<StepStatus, string> = {
  empty: 'Не заполнено',
  partial: 'Заполнено частично',
  complete: 'Готово',
  error: 'Ошибка',
};

const stepStatusClasses: Record<StepStatus, string> = {
  empty: 'bg-slate-100 text-slate-600 ring-slate-200',
  partial: 'bg-amber-50 text-amber-800 ring-amber-200',
  complete: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  error: 'bg-rose-50 text-rose-800 ring-rose-200',
};

type MissingField = { label: string; stepKey: ProtocolStepKey };

const READONLY_STATUSES = new Set<string>(['READY_FOR_APPROVAL', 'APPROVED', 'SIGNED', 'ARCHIVED', 'CANCELLED', 'REPLACED']);
const TERMINAL_STATUSES = new Set<string>(['SIGNED', 'ARCHIVED', 'CANCELLED', 'REPLACED']);
const isProtocolEditable = (status?: string) => isProtocolStatusEditable(status);
const isProtocolReadonly = (status?: string) => READONLY_STATUSES.has(String(status || '').toUpperCase()) || !isProtocolEditable(status);
const isEditableProtocol = (protocol?: Protocol | null) => Boolean(protocol && isProtocolEditable(protocol.status));

const userProtocolError = (error: unknown) => {
  const apiError = parseApiError(error);
  if (apiError.code === 'LABORATORY_NOT_FOUND') {
    return 'Выбранная лаборатория не найдена или больше не активна. Выберите действующую лабораторию и повторите сохранение.';
  }
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();
  if (normalized.includes('только в статусах') || normalized.includes('only in statuses') || normalized.includes('draft') && normalized.includes('calculated')) {
    return 'Протокол нельзя изменить в текущем статусе. Обновите данные и повторите действие.';
  }
  if (normalized.includes('черновик')) return 'Изменения можно сохранить только в черновике.';
  return message || undefined;
};
const hasText = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';
const requiredEnvironmentFields = (protocol: Protocol) => {
  if (['industrial_emissions', 'ambient_air', 'workplace_air', 'vehicle_emissions'].includes(protocol.templateId)) {
    return ['temperature', 'humidity', 'pressureKpa', 'windSpeed'] as const;
  }
  if (['water', 'soil'].includes(protocol.templateId)) return ['temperature'] as const;
  return ['temperature', 'humidity'] as const;
};
const hasEnvironment = (protocol: Protocol) => requiredEnvironmentFields(protocol)
  .every((key) => hasText(protocol.environment?.[key]));
const hasLaboratory = (protocol: Protocol) =>
  Boolean(protocol.laboratory?.laboratoryName
    && protocol.laboratory?.laboratoryAddress
    && protocol.laboratory?.accreditationNumber
    && protocol.laboratory?.accreditationValidUntil
    && protocol.laboratory?.laboratoryHead
    && (protocol.executor || protocol.laboratory.executor)
    && (!protocol.measurementDate || protocol.laboratory.accreditationValidUntil >= protocol.measurementDate));
const resultValue = (row: Protocol['results'][number]) => row.result || row.resultValue || row.primaryReading
  || row.values.result || row.values.resultValue || row.values.resultMg || row.values.primaryReading;
const resultMethod = (protocol: Protocol, row: Protocol['results'][number]) => row.testingMethodNd || row.testingMethodDocument || row.testingMethod
  || row.values.testingMethodNd || row.values.testingMethodDocument || row.values.testingMethod
  || protocol.testing.testingMethodDocument;
const resultNormative = (row: Protocol['results'][number]) => row.normativeValue || row.normative || row.pdk
  || row.values.normativeValue || row.values.normative || row.values.pdk;
const resultDeviceId = (row: Protocol['results'][number]) => row.measurementDeviceId || row.deviceId
  || row.values.measurementDeviceId || row.values.deviceId || row.values.device;
const isExternalResult = (row: Protocol['results'][number]) => hasText(row.values.externalLaboratory) || hasText(row.values.externalLaboratoryDocument);
const hasCheckedResults = (protocol: Protocol) => protocol.results.length > 0 && protocol.results.every((row) => {
  const status = String(row.internalStatus || row.checkStatus || '').trim().toUpperCase();
  const needsNormative = status !== 'INFO';
  return Boolean(status)
    && !['EMPTY_RESULT', 'NEEDS_REVIEW', 'NORMATIVE_NOT_FOUND', 'UNIT_MISMATCH'].includes(status)
    && hasText(resultValue(row) as string | number | null | undefined)
    && hasText(row.unit || row.values.unit as string | number | null | undefined)
    && hasText(resultMethod(protocol, row) as string | number | null | undefined)
    && (!needsNormative || hasText(resultNormative(row) as string | number | null | undefined))
    && (isExternalResult(row) || hasText(resultDeviceId(row) as string | number | null | undefined));
});
const hasValidResultDevices = (protocol: Protocol) => protocol.results.every((row) => {
  if (isExternalResult(row)) return true;
  const id = String(resultDeviceId(row) || '');
  const attached = protocol.measurementDevices.find((item) => String(item.deviceId) === id || String(item.id) === id);
  if (!attached) return false;
  const validUntil = attached.deviceSnapshot.verificationValidUntil;
  return !validUntil || !protocol.measurementDate || validUntil >= protocol.measurementDate;
});

const resultHasUsableNormative = (row: Protocol['results'][number], protocolDate: string) => {
  const source = String(row.values.normativeSource || '').toUpperCase();
  if (source === 'MANUAL') return Boolean(String(row.values.manualNormativeReason || '').trim());
  const normative = row.normativeReference;
  if (!normative || normative.active !== true) return false;
  if (normative.validFrom && protocolDate && normative.validFrom > protocolDate) return false;
  if (normative.validUntil && protocolDate && normative.validUntil < protocolDate) return false;
  return true;
};

const getMissingFields = (protocol: Protocol): MissingField[] => {
  const items: MissingField[] = [];
  if (!hasText(protocol.protocolNumber || protocol.number)) items.push({ label: 'номер протокола', stepKey: 'general' });
  if (!hasText(protocol.protocolDate)) items.push({ label: 'дата протокола', stepKey: 'general' });
  if (!hasText(protocol.measurementDate || protocol.testing?.samplingDate)) items.push({ label: 'дата замера', stepKey: 'general' });
  if (!hasText(protocol.measurementTime)) items.push({ label: 'время замера', stepKey: 'general' });
  if (!hasLaboratory(protocol)) items.push({ label: 'данные лаборатории', stepKey: 'general' });
  if (!hasText(protocol.laboratoryEmployeeId ?? protocol.executorId)) items.push({ label: 'исполнитель лаборатории', stepKey: 'general' });
  if (!hasText(protocol.organization?.organizationName)) items.push({ label: 'организация', stepKey: 'organization' });
  if (!hasText(protocol.organization?.organizationAddress)) items.push({ label: 'адрес организации', stepKey: 'organization' });
  if (!hasText(protocol.organization?.objectName || protocol.companySnapshot?.objectName)) items.push({ label: 'данные объекта', stepKey: 'organization' });
  if (!hasEnvironment(protocol)) items.push({ label: 'условия среды', stepKey: 'environment' });
  if (protocol.environment?.source === 'MANUAL' && !protocol.environment.manualChangeReason?.trim()) {
    items.push({ label: 'причина ручного изменения условий среды', stepKey: 'environment' });
  }
  if (isWaterProtocolType(protocol.templateId) && !hasText(protocol.waterType || protocol.conditions?.waterType)) items.push({ label: 'тип воды', stepKey: 'environment' });
  if (isWaterProtocolType(protocol.templateId) && !hasText(protocol.waterUseCategory || protocol.conditions?.waterUseCategory)) items.push({ label: 'категория водопользования', stepKey: 'environment' });
  if (!protocol.results.length) items.push({ label: 'результаты испытаний', stepKey: 'results' });
  if (protocol.results.length && !hasCheckedResults(protocol)) items.push({ label: 'проверка соответствия нормативам', stepKey: 'results' });
  if (protocol.results.some((row) => !resultHasUsableNormative(row, protocol.protocolDate))) items.push({ label: 'действующий норматив и причина для ручного норматива', stepKey: 'results' });
  if (!protocol.measurementDevices.length) items.push({ label: 'средство измерения', stepKey: 'instruments' });
  else if (!hasValidResultDevices(protocol)) items.push({ label: 'действующий прибор для каждой строки результата', stepKey: 'results' });
  return items;
};

const getApprovalBlockers = (protocol: Protocol): string[] => {
  const blockers: string[] = [];
  if (!hasText(protocol.protocolNumber || protocol.number)) blockers.push('Заполните номер протокола');
  if (!hasText(protocol.protocolDate)) blockers.push('Заполните дату протокола');
  if (!hasText(protocol.organization?.organizationName || protocol.companySnapshot?.companyName)) blockers.push('Заполните организацию');
  if (!hasText(protocol.organization?.objectName || protocol.companySnapshot?.objectName)) blockers.push('Заполните объект');
  if (!hasText(protocol.testing?.samplingDate || protocol.measurementDate)) blockers.push('Заполните дату отбора');
  if (!hasText(protocol.testing?.testingEndDate || protocol.testing?.testingDate || protocol.testing?.testingStartDate || protocol.measurementDate)) blockers.push('Заполните дату испытаний');
  if (!hasText(protocol.testing?.testingMethodDocument || protocol.testingMethodDocument)) blockers.push('Укажите НД на методы испытаний');
  if (!hasText(protocol.laboratoryEmployeeId ?? protocol.executorId)) blockers.push('Выберите исполнителя лаборатории');
  if (!protocol.results.length) blockers.push('Добавьте хотя бы одну строку результата');
  protocol.results.forEach((row, index) => {
    if (!hasText(resultValue(row))) blockers.push(`Строка ${index + 1}: нет значения результата`);
    const calculationStatus = String(row.calculationStatus || '').trim().toUpperCase();
    if (calculationStatus === 'WAITING_INPUTS') blockers.push(`Строка ${index + 1}: не заполнены исходные данные`);
    if (calculationStatus === 'ERROR') blockers.push(`Строка ${index + 1}: ошибка расчёта`);
    if (calculationStatus === 'NEEDS_REPEAT') blockers.push(`Строка ${index + 1}: требуется повторный анализ`);
    if (!resultHasUsableNormative(row, protocol.protocolDate)) blockers.push(`Строка ${index + 1}: выберите действующий норматив; для ручного норматива укажите причину`);
  });
  return blockers;
};

const getStepStatus = (protocol: Protocol, stepKey: ProtocolStepKey): StepStatus => {
  const missing = getMissingFields(protocol).filter((item) => item.stepKey === stepKey);
  if (stepKey === 'review') return getMissingFields(protocol).length ? 'error' : 'complete';
  if (!missing.length) return 'complete';
  const hasAny = {
    general: hasText(protocol.protocolNumber || protocol.number) || hasText(protocol.protocolDate) || hasText(protocol.measurementDate || protocol.testing?.samplingDate) || hasLaboratory(protocol),
    organization: hasText(protocol.organization?.organizationName) || hasText(protocol.organization?.objectName || protocol.companySnapshot?.objectName),
    environment: Boolean(protocol.environment && Object.values(protocol.environment).some(hasText)),
    results: protocol.results.length > 0,
    instruments: protocol.measurementDevices.length > 0,
    review: false,
  }[stepKey];
  return hasAny ? 'partial' : 'empty';
};

const ProtocolStepWizard = ({
  activeStep,
  protocol,
  onSelect,
}: {
  activeStep: ProtocolStepKey;
  protocol: Protocol;
  onSelect: (step: ProtocolStepKey) => void;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
      {protocolSteps.map((step, index) => {
        const status = getStepStatus(protocol, step.key);
        const active = activeStep === step.key;
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => onSelect(step.key)}
            className={`rounded-xl border px-3 py-3 text-left transition ${active ? 'border-eco-500 bg-eco-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">Шаг {index + 1}</span>
              {status === 'complete' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {status === 'error' && <AlertCircle className="h-4 w-4 text-rose-600" />}
            </div>
            <p className="mt-1 font-bold text-slate-900">{step.label}</p>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${stepStatusClasses[status]}`}>{stepStatusLabels[status]}</span>
          </button>
        );
      })}
    </div>
  </section>
);

const DevicePickerModal = ({
  open,
  loading,
  measurementDate,
  laboratoryId,
  onClose,
  onSelect,
}: {
  open: boolean;
  loading?: boolean;
  measurementDate: string;
  laboratoryId?: string | number;
  onClose: () => void;
  onSelect: (device: MeasurementDevice) => void | Promise<void>;
}) => {
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    getAvailableMeasurementDevices()
      .then(setDevices)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить средства измерений'));
  }, [laboratoryId, open]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    const forLaboratory = laboratoryId
      ? devices.filter((device) => !device.laboratoryId || String(device.laboratoryId) === String(laboratoryId))
      : devices;
    if (!value) return forLaboratory;
    return forLaboratory.filter((device) => `${device.name} ${device.model} ${device.serialNumber}`.toLowerCase().includes(value));
  }, [devices, laboratoryId, query]);

  return (
    <Modal open={open} onClose={onClose} title="Добавить средство измерения" size="xl">
      <div className="space-y-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию, модели, заводскому номеру" className={`${inputClass} pl-10`} />
        </label>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</div>}
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {filtered.map((device) => {
            const validForMeasurement = isDeviceValidForDate(device, measurementDate);
            return (
            <button
              key={device.id}
              type="button"
              disabled={loading || !validForMeasurement}
              onClick={() => onSelect(device)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-eco-300 hover:bg-eco-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{device.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{device.model || '-'} · {device.serialNumber || '-'}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Поверка до: {device.verificationValidUntil || '-'}</p>
                </div>
                <DeviceStatus status={device.status} />
              </div>
              {device.status === 'EXPIRED' && <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">Поверка истекла. Прибор недоступен.</p>}
            </button>
            );
          })}
          {filtered.length === 0 && <p className="py-8 text-center text-sm font-semibold text-slate-500">Приборы не найдены.</p>}
        </div>
      </div>
    </Modal>
  );
};

const MeasurementDevicesSection = ({
  devices,
  readOnly,
  onAdd,
  onRemove,
}: {
  devices: ProtocolMeasurementDevice[];
  readOnly: boolean;
  onAdd: () => void;
  onRemove: (deviceId: string) => void | Promise<void>;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Приборы</h2>
        <p className="mt-1 text-sm text-slate-500">Средства измерения, которые используются в строках результатов.</p>
      </div>
      <Button type="button" disabled={readOnly} onClick={onAdd}><Plus className="h-4 w-4" /> Добавить прибор</Button>
    </div>
    {devices.some((item) => item.deviceSnapshot.status === 'EXPIRING') && (
      <div className="mb-4 inline-block max-w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        Срок поверки скоро истекает — проверьте прибор перед выпуском протокола.
      </div>
    )}
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3">Название</th>
            <th className="px-3 py-3">Модель</th>
            <th className="px-3 py-3">Заводской номер</th>
            <th className="px-3 py-3">Свидетельство поверки</th>
            <th className="px-3 py-3">Дата поверки</th>
            <th className="px-3 py-3">Срок действия</th>
            <th className="px-3 py-3">Единицы</th>
            <th className="px-3 py-3">Статус</th>
            <th className="px-3 py-3 text-right">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {devices.map((item) => {
            const device = item.deviceSnapshot;
            return (
              <tr key={item.id || item.deviceId}>
                <td className="px-3 py-3 font-bold text-slate-900">{device.name || '-'}</td>
                <td className="px-3 py-3">{device.model || '-'}</td>
                <td className="px-3 py-3">{device.serialNumber || '-'}</td>
                <td className="px-3 py-3">{device.verificationCertificateNumber || '-'}</td>
                <td className="px-3 py-3">{device.verificationDate || '-'}</td>
                <td className="px-3 py-3">{device.verificationValidUntil || '-'}</td>
                <td className="px-3 py-3">{device.units || '-'}</td>
                <td className="px-3 py-3"><DeviceStatus status={device.status} /></td>
                <td className="px-3 py-3 text-right">
                  <Button type="button" variant="secondary" className="px-3 text-rose-700 hover:bg-rose-50" disabled={readOnly} title="Удалить прибор" onClick={() => onRemove(item.deviceId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {devices.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">Приборы еще не добавлены.</p>}
  </section>
);

const ReviewChecklist = ({
  protocol,
  missingFields,
  onGoToStep,
}: {
  protocol: Protocol;
  missingFields: MissingField[];
  onGoToStep: (step: ProtocolStepKey) => void;
}) => {
  const checks = [
    { label: 'заполнены общие данные', ok: !missingFields.some((item) => item.stepKey === 'general' && ['номер протокола', 'дата протокола', 'дата замера', 'время замера'].includes(item.label)), step: 'general' as ProtocolStepKey },
    { label: 'выбрана организация', ok: hasText(protocol.organization.organizationName), step: 'organization' as ProtocolStepKey },
    { label: 'заполнены данные объекта', ok: hasText(protocol.organization.objectName || protocol.companySnapshot.objectName), step: 'organization' as ProtocolStepKey },
    { label: 'указана дата замера', ok: hasText(protocol.measurementDate || protocol.testing.samplingDate), step: 'general' as ProtocolStepKey },
    { label: 'указаны условия среды', ok: hasEnvironment(protocol), step: 'environment' as ProtocolStepKey },
    { label: 'добавлены результаты', ok: protocol.results.length > 0, step: 'results' as ProtocolStepKey },
    { label: 'выбран прибор', ok: protocol.measurementDevices.length > 0, step: 'instruments' as ProtocolStepKey },
    { label: 'заполнены данные лаборатории', ok: hasLaboratory(protocol), step: 'general' as ProtocolStepKey },
    { label: 'выполнена проверка нормативов', ok: hasCheckedResults(protocol), step: 'results' as ProtocolStepKey },
  ];
  const firstMissing = missingFields[0];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardCheck className="h-5 w-5 text-eco-700" /> Проверка перед выпуском</h2>
          <p className="mt-1 text-sm text-slate-500">Перед выпуском система проверяет обязательные данные и результаты расчета.</p>
        </div>
        {firstMissing && <Button type="button" variant="secondary" onClick={() => onGoToStep(firstMissing.stepKey)}>Перейти к исправлению</Button>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <button
            key={check.label}
            type="button"
            onClick={() => !check.ok && onGoToStep(check.step)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold ${check.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
          >
            {check.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            {check.label}
          </button>
        ))}
      </div>
      {missingFields.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Нужно заполнить: {missingFields.map((item) => item.label).join(', ')}.
        </div>
      )}
    </section>
  );
};

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

const ProtocolStepFooter = ({
  protocol,
  activeStep,
  busy,
  readOnly,
  actions,
  saveStatus,
  missingFields,
  onPrevious,
  onNext,
  onSave,
  onCalculate,
  onPreview,
  onReady,
  onApprove,
  onReturn,
  onGenerateDocx,
  onGeneratePdf,
  onSign,
  onDownloadDocx,
  onDownloadPdf,
  onReplace,
  onOpenReplacement,
}: {
  protocol: Protocol;
  activeStep: ProtocolStepKey;
  busy: boolean;
  readOnly: boolean;
  actions: ProtocolPermissions;
  saveStatus: SaveStatus;
  missingFields: MissingField[];
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void | Promise<void>;
  onCalculate: () => void | Promise<void>;
  onPreview: () => void | Promise<void>;
  onReady: () => void | Promise<void>;
  onApprove: () => void | Promise<void>;
  onReturn: () => void | Promise<void>;
  onGenerateDocx: () => void | Promise<void>;
  onGeneratePdf: () => void | Promise<void>;
  onSign: () => void;
  onDownloadDocx: () => void | Promise<void>;
  onDownloadPdf: () => void | Promise<void>;
  onReplace: () => void;
  onOpenReplacement?: () => void;
}) => {
  const activeIndex = protocolSteps.findIndex((step) => step.key === activeStep);
  const saveText = {
    saved: 'Сохранено',
    dirty: 'Есть несохраненные изменения',
    saving: 'Сохранение...',
    error: 'Ошибка сохранения',
    conflict: 'Конфликт версии',
  }[saveStatus];

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:-mx-8 sm:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className={`text-sm font-semibold ${saveStatus === 'error' || saveStatus === 'conflict' ? 'text-rose-700' : saveStatus === 'dirty' ? 'text-amber-700' : 'text-slate-500'}`}>{saveText}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions.canEdit && (
            <>
              {activeIndex > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={onPrevious}><ChevronLeft className="h-4 w-4" /> Назад</Button>}
              {activeStep !== 'review' && activeStep !== 'results' && <Button type="button" variant="secondary" disabled={busy || readOnly} onClick={onSave}><Save className="h-4 w-4" /> Сохранить</Button>}
              {activeStep === 'results' && actions.canCalculate && <Button type="button" disabled={busy || readOnly} onClick={onCalculate}><Save className="h-4 w-4" /> Сохранить результаты</Button>}
              {activeStep !== 'review' && <Button type="button" variant={activeStep === 'results' ? 'secondary' : 'primary'} disabled={busy} onClick={onNext}>Далее <ArrowRight className="h-4 w-4" /></Button>}
              {activeStep === 'review' && (
                <>
                  <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
                  <Button type="button" disabled={busy || missingFields.length > 0} title={missingFields.length ? `Нельзя открыть предпросмотр: ${missingFields[0]?.label}` : undefined} onClick={onSign}>Открыть предварительный просмотр</Button>
                </>
              )}
            </>
          )}
          {['READY', 'READY_FOR_APPROVAL', 'APPROVED'].includes(String(protocol.status).toUpperCase()) && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadDocx}>DOCX</Button>}
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadPdf}>PDF</Button>}
              {actions.canSign && <Button type="button" disabled={busy} onClick={onSign}>Подписать</Button>}
            </>
          )}
          {String(protocol.status).toUpperCase() === 'SIGNED' && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadDocx}>Скачать DOCX</Button>}
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadPdf}>Скачать PDF</Button>}
              {actions.canReplace && <Button type="button" disabled={busy} onClick={onReplace}>Создать исправленную версию</Button>}
            </>
          )}
          {String(protocol.status).trim().toUpperCase() === 'REPLACED' && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadPdf}>Скачать архивный PDF</Button>
              {onOpenReplacement && <Button type="button" onClick={onOpenReplacement}>Открыть новую версию</Button>}
            </>
          )}
          {String(protocol.status).trim().toUpperCase() === 'CANCELLED' && <span className="text-sm font-semibold text-slate-500">Протокол аннулирован. Доступен только просмотр.</span>}
        </div>
      </div>
    </div>
  );
};

const ProtocolEditorPage = () => {
  const queryClient = useQueryClient();
  const { protocolId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const protocolCacheScope = protocolScope(user?.id);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [workflowErrors, setWorkflowErrors] = useState<string[]>([]);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictLatest, setConflictLatest] = useState<Protocol | null>(null);
  const [conflictCompareOpen, setConflictCompareOpen] = useState(false);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [laboratoryEmployees, setLaboratoryEmployees] = useState<LaboratoryEmployee[]>([]);
  const [companyObjects, setCompanyObjects] = useState<CompanyObject[]>([]);
  const [activeStep, setActiveStep] = useState<ProtocolStepKey>('general');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [moreOpen, setMoreOpen] = useState(false);
  const [editSection, setEditSection] = useState<ProtocolEditSection | null>(null);
  const [deleteProtocolOpen, setDeleteProtocolOpen] = useState(false);
  const [deviceToRemove, setDeviceToRemove] = useState<string | null>(null);
  const savedSignatureRef = useRef('');
  const autoPreviewRef = useRef(false);
  const draftUnlockRef = useRef('');
  const protocolRef = useRef<Protocol | null>(null);
  const serverProtocolRef = useRef<Protocol | null>(null);
  const editVersionRef = useRef(0);
  const saveRequestRef = useRef(0);
  const saveInFlightRef = useRef<Promise<Protocol | null> | null>(null);
  const saveQueuedRef = useRef(false);
  const failedSaveSignatureRef = useRef('');

  const dirty = useMemo(() => Boolean(protocol && savedSignatureRef.current && editableSignature(protocol) !== savedSignatureRef.current), [protocol]);
  const protocolActions = useMemo(() => getProtocolPermissions(protocol, user?.role), [protocol, user?.role]);
  const readOnly = !protocolActions.canEdit;
  const applyServerProtocol = (item: Protocol) => {
    const normalized = {
      ...item,
      laboratory: item.laboratory || emptyLaboratory,
      organization: item.organization || emptyOrganization,
      testing: item.testing || emptyTesting,
      results: item.results || [],
      measurementDevices: collectProtocolDevices(item),
      history: item.history || [],
      environment: item.environment || {},
      explanatoryNote: item.explanatoryNote || '',
    };
    savedSignatureRef.current = editableSignature(normalized);
    failedSaveSignatureRef.current = '';
    protocolRef.current = normalized;
    serverProtocolRef.current = normalized;
    setSaveStatus('saved');
    setProtocol(normalized);
    return normalized;
  };

  const signMutation = useSignProtocolMutation(protocol?.id, {
    currentUserId: user?.id,
    onSigned: async (updatedProtocol) => {
      setSignOpen(false);
      setEditSection(null);
      applyServerProtocol(updatedProtocol);
      toast.success('Протокол успешно подписан');
    },
    onError: async (message, signError) => {
      toast.error('Не удалось подписать протокол', message);
      if (normalizeApiError(signError).code === 'PROTOCOL_VERSION_CONFLICT' && protocol?.id) {
        try {
          applyServerProtocol(await protocolService.getProtocol(protocol.id));
        } catch {
          // Query invalidation will refresh the active detail query when available.
        }
      }
    },
  });

  const signCurrentProtocol = () => {
    if (!protocol || signMutation.isPending) return;
    if (!hasProtocolAction(protocol, 'SIGN')) {
      toast.warning(protocol.blockingReasons?.[0] || 'Нельзя подписать: заполните обязательные данные и выберите действующий прибор');
      return;
    }
    if (protocol.version === undefined || !Number.isFinite(protocol.version)) {
      toast.error('Не удалось подписать протокол', 'Версия протокола не определена. Обновите данные');
      return;
    }
    void preview();
  };

  const ensureDraftProtocol = async (item: Protocol) => {
    return item;
  };

  const load = async () => {
    if (!protocolId) return;
    if (dirty && !window.confirm('Есть несохранённые изменения. Обновить страницу протокола и потерять их?')) return;
    setLoading(true);
    setError('');
    try {
      const [item, history] = await Promise.all([
        protocolService.getProtocol(protocolId),
        protocolService.getProtocolAudit(protocolId).catch(() => []),
      ]);
      applyServerProtocol({ ...item, history });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить протокол');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [protocolId]);

  useEffect(() => {
    draftUnlockRef.current = protocol?.id || '';
  }, [protocol?.id]);

  useEffect(() => {
    if (dirty && saveStatus !== 'saving') setSaveStatus('dirty');
    if (!dirty && saveStatus === 'dirty') setSaveStatus('saved');
  }, [dirty, saveStatus]);

  useEffect(() => {
    const laboratoryId = protocol?.laboratory?.laboratoryId;
    if (!laboratoryId) {
      setLaboratoryEmployees([]);
      return;
    }
    getLaboratoryEmployees(laboratoryId)
      .then((items) => setLaboratoryEmployees(items.filter((item) => item.active)))
      .catch((loadError) => toast.error('Не удалось загрузить исполнителей лаборатории', loadError instanceof Error ? loadError.message : undefined));
  }, [protocol?.laboratory?.laboratoryId]);

  useEffect(() => {
    if (!protocol?.companyId) {
      setCompanyObjects([]);
      return;
    }
    getCompanyObjects(String(protocol.companyId))
      .then((items) => setCompanyObjects(items.filter((item) => item.status === 'ACTIVE' && !item.virtual)))
      .catch((loadError) => {
        setCompanyObjects([]);
        toast.error('Не удалось загрузить объекты компании', loadError instanceof Error ? loadError.message : undefined);
      });
  }, [protocol?.companyId]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const beforeLinkNavigation = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.origin !== window.location.origin) return;
      if (!window.confirm('Есть несохранённые изменения. Уйти со страницы без сохранения?')) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        savedSignatureRef.current = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', beforeLinkNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', beforeLinkNavigation, true);
    };
  }, [dirty]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!protocol || autoPreviewRef.current || !new URLSearchParams(location.search).has('preview')) return;
    autoPreviewRef.current = true;
    preview();
  }, [protocol, location.search]);

  const patchProtocol = (patch: Partial<Protocol>) => {
    if (!protocolActions.canEdit) {
      toast.warning('Эта версия протокола зафиксирована и недоступна для изменения');
      return;
    }
    editVersionRef.current += 1;
    setProtocol((current) => {
      if (!current) return current;
      const updated = { ...current, ...patch };
      protocolRef.current = updated;
      return updated;
    });
  };

  const applyServerResults = (results: Protocol['results']) => {
    setProtocol((current) => {
      if (!current) return current;
      const updated = { ...current, results };
      protocolRef.current = updated;
      return updated;
    });
  };

  const reloadProtocolResults = async () => {
    if (!protocolId) return;
    const fresh = await protocolService.getProtocol(protocolId);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewOpen(false);
    applyServerProtocol({
      ...fresh,
      measurementDevices: collectProtocolDevices(fresh),
      hasPdf: false,
      pdfFileId: undefined,
      finalPdfFileId: undefined,
      finalPdfHash: undefined,
    });
  };

  const navigateSafely = (to: string) => {
    if (dirty && !window.confirm('Есть несохранённые изменения. Уйти со страницы без сохранения?')) return;
    navigate(to);
  };

  const notify = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => toast[type](message);

  const save = async (): Promise<Protocol | null> => {
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return saveInFlightRef.current;
    }
    const snapshot = protocolRef.current || protocol;
    if (!snapshot) return null;
    if (!getProtocolPermissions(snapshot, user?.role).canEdit) {
      toast.warning('Редактирование протокола закрыто для текущего статуса');
      return null;
    }
    const startedVersion = editVersionRef.current;
    const requestId = ++saveRequestRef.current;
    setSaveStatus('saving');
    setBusy(true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewOpen(false);
    let conflictDetected = false;
    const operation = (async (): Promise<Protocol | null> => {
      const updateSnapshot = (item: Protocol) => protocolService.updateProtocol(item.id, {
        version: Number(item.version || 0),
        number: item.protocolNumber || item.number || '',
        protocolDate: item.protocolDate || '',
        companyId: item.companyId,
        objectId: item.objectId,
        laboratoryId: item.laboratory?.laboratoryId || item.laboratory?.id,
        sampleDate: item.testing.samplingDate || item.measurementDate || item.protocolDate,
        sampleNumber: item.sampleNumber,
        samplingPlace: item.samplingPlace || item.measurementPlace,
        samplingDepth: item.samplingDepth,
        measurementDate: item.measurementDate || item.testing.samplingDate || item.protocolDate,
        measurementTime: item.measurementTime,
        measurementPlace: item.measurementPlace,
        formCode: item.formCode,
        appendixNumber: item.appendixNumber,
        executor: item.executor || '',
        executorId: item.laboratoryEmployeeId !== undefined && item.laboratoryEmployeeId !== null
          ? String(item.laboratoryEmployeeId)
          : item.executorId,
        approver: item.approver || '',
        laboratory: item.laboratory,
        organization: item.organization,
        testing: item.testing,
        environment: item.environment,
        conditions: {
          ...(item.conditions || {}),
          ...(isWaterProtocolType(item.templateId) ? {
            waterType: item.waterType,
            waterUseCategory: item.waterUseCategory,
          } : {}),
        },
        explanatoryNote: item.explanatoryNote,
        testingMethodDocument: item.testingMethodDocument || item.testing.testingMethodDocument,
        complianceDocument: item.complianceDocument,
        printVisibility: item.printVisibility,
      });
      try {
        const draftProtocol = await ensureDraftProtocol(snapshot);
        const saved = await updateSnapshot(draftProtocol);
        const refreshed = await protocolService.getProtocol(saved.id);
        const updated = { ...refreshed, hasPdf: false, pdfFileId: undefined, finalPdfFileId: undefined, finalPdfHash: undefined };
        if (requestId === saveRequestRef.current && startedVersion === editVersionRef.current) {
          applyServerProtocol(updated);
          sessionStorage.removeItem(protocolBackupKey(user?.id, updated.id));
          toast.success('Протокол сохранен');
          return updated;
        }
        saveQueuedRef.current = true;
        setSaveStatus('dirty');
        return protocolRef.current;
      } catch (saveError) {
        if (getApiStatus(saveError) === 409) {
          try {
            const fresh = await protocolService.getProtocol(snapshot.id);
            const rebased = rebaseEditableProtocol(serverProtocolRef.current || snapshot, snapshot, fresh);
            if (!rebased.conflicts.length) {
              const saved = await updateSnapshot(rebased.protocol);
              const refreshed = await protocolService.getProtocol(saved.id);
              const updated = { ...refreshed, hasPdf: false, pdfFileId: undefined, finalPdfFileId: undefined, finalPdfHash: undefined };
              applyServerProtocol(updated);
              sessionStorage.removeItem(protocolBackupKey(user?.id, updated.id));
              toast.success('Протокол сохранён');
              return updated;
            }
            conflictDetected = true;
            saveQueuedRef.current = false;
            setSaveStatus('conflict');
            setConflictLatest(fresh);
            setConflictOpen(true);
          } catch {
            conflictDetected = true;
            saveQueuedRef.current = false;
            setSaveStatus('conflict');
            setConflictLatest(null);
            setConflictOpen(true);
          }
        } else {
          failedSaveSignatureRef.current = editableSignature(snapshot);
          setSaveStatus('error');
          toast.error('Не удалось сохранить протокол', userProtocolError(saveError));
        }
        return null;
      } finally {
        saveInFlightRef.current = null;
        setBusy(false);
        if (!conflictDetected && (saveQueuedRef.current || startedVersion !== editVersionRef.current)) {
          saveQueuedRef.current = false;
          window.setTimeout(() => { void save(); }, 0);
        }
      }
    })();
    saveInFlightRef.current = operation;
    return operation;
  };

  useEffect(() => {
    if (!dirty || !protocol || !protocolActions.canEdit || saveStatus === 'conflict' || signOpen) return;
    if (editableSignature(protocol) === failedSaveSignatureRef.current) return;
    if (!navigator.onLine) {
      sessionStorage.setItem(protocolBackupKey(user?.id, protocol.id), JSON.stringify(protocol));
      setSaveStatus('error');
      return;
    }
    const timer = window.setTimeout(() => {
      if (!saveInFlightRef.current) void save();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [dirty, protocol, protocolActions.canEdit, saveStatus, signOpen]);

  useEffect(() => {
    const retryOfflineDraft = () => {
      const current = protocolRef.current;
      if (!current || !sessionStorage.getItem(protocolBackupKey(user?.id, current.id))) return;
      if (window.confirm('Соединение восстановлено. Повторить сохранение изменений протокола?')) {
        void save();
      }
    };
    window.addEventListener('online', retryOfflineDraft);
    return () => window.removeEventListener('online', retryOfflineDraft);
  }, [user?.id]);

  const ensureSavedProtocol = async (message: string): Promise<Protocol | null> => {
    if (!protocol) return null;
    if (!dirty) return protocol;
    toast.info(message);
    return save();
  };

  const refreshLaboratorySnapshot = async () => {
    if (!protocol || readOnly || busy) return;
    setBusy(true);
    try {
      const draftProtocol = await ensureDraftProtocol(protocol);
      const updated = await protocolService.refreshLaboratoryData(draftProtocol.id, Number(draftProtocol.version));
      applyServerProtocol(updated);
      const laboratoryId = updated.laboratory?.laboratoryId || updated.laboratory?.id;
      if (laboratoryId) {
        const employees = await getLaboratoryEmployees(laboratoryId);
        setLaboratoryEmployees(employees.filter((item) => item.active));
      }
      toast.success('Данные лаборатории обновлены');
    } catch (error) {
      const parsed = parseLaboratoryApiError(error);
      toast.error('Не удалось обновить лабораторию', parsed.code === 'DEFAULT_LABORATORY_NOT_CONFIGURED' ? 'Лаборатория по умолчанию не настроена' : parsed.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const laboratoryId = protocol?.laboratory?.laboratoryId;
    if (!protocol || !laboratoryId || hasLaboratory(protocol) || readOnly || busy) return;
    refreshLaboratorySnapshot().catch((error) => console.error('Automatic laboratory snapshot refresh failed.', error));
  }, [protocol?.id, protocol?.laboratory?.laboratoryId, readOnly]);

  const checkSavedNormatives = async () => {
    if (!protocol) return;
    if (!protocolActions.canCheckNormatives) {
      toast.warning('Проверка нормативов сейчас недоступна');
      return;
    }
    if (protocol.signatureCount > 0) {
      toast.warning('Протокол уже подписан. Для изменения создайте исправленную версию');
      return;
    }
    if (dirty) {
      toast.info('Сначала сохраняю локальные изменения, затем проверяю нормативы.');
      const saved = await save();
      if (!saved) return;
    }
    await run(async () => {
      await protocolService.checkNormatives(protocol.id, protocol.version);
      return protocolService.getProtocol(protocol.id);
    }, 'Расчёт выполнен');
  };

  const calculateProtocolResults = async () => {
    if (!protocol) return;
    if (!protocolActions.canCalculate) {
      toast.warning('Расчёт результатов сейчас недоступен');
      return;
    }
    if (protocol.signatureCount > 0) {
      toast.warning('Протокол уже подписан. Для изменения создайте исправленную версию');
      return;
    }
    if (dirty) {
      toast.info('Сначала сохраняю данные, затем запускаю расчет.');
      const saved = await save();
      if (!saved) return;
    }
    setBusy(true);
    try {
      const summary = await protocolService.calculateProtocolSummary(protocol.id, protocol.version);
      const calculated = await protocolService.getProtocol(protocol.id);
      await protocolService.checkNormatives(calculated.id, calculated.version);
      const updated = await protocolService.getProtocol(protocol.id);
      applyServerProtocol(updated);
      toast.success(
        'Результаты сохранены',
        `Всего: ${summary.total}; рассчитано: ${summary.calculated}; ручной ввод: ${summary.manual}; ошибки: ${summary.errors}; повторный анализ: ${summary.needsRepeat}; не соответствует: ${summary.exceeded}`,
      );
    } catch (calculationError) {
      toast.error('Не удалось рассчитать результаты', getApiErrorMessage(calculationError, 'Не удалось рассчитать результаты'));
    } finally {
      setBusy(false);
    }
  };

  const refreshWeather = async (selection: { objectId: string; date: string; time: string; signal?: AbortSignal }): Promise<WeatherConditions | void> => {
    if (!protocol) return;
    patchProtocol({ environment: { ...protocol.environment, status: 'LOADING', source: 'API' } });
    try {
      const weather = await protocolService.getWeatherConditions({
        objectId: selection.objectId,
        coordinates: companyObjects.find((item) => String(item.id) === String(selection.objectId))?.coordinates || protocol.companySnapshot.coordinates,
        date: selection.date,
        time: selection.time || protocol.measurementTime || DEFAULT_WEATHER_TIME,
        signal: selection.signal,
      });
      const coordinates = companyObjects.find((item) => String(item.id) === String(selection.objectId))?.coordinates || protocol.companySnapshot.coordinates;
      const normalizedWeather = !coordinates
        ? { ...weather, warning: weather.warning || 'У объекта не указаны координаты. Используются координаты города по умолчанию' }
        : weather;
      patchProtocol({ environment: normalizedWeather });
      if (!normalizedWeather.available) {
        toast.warning('Автоматические погодные данные не получены. Заполните условия среды вручную');
      }
      return normalizedWeather;
    } catch (weatherError) {
      if (selection.signal?.aborted) return;
      patchProtocol({ environment: { ...protocol.environment, available: false, status: 'API_UNAVAILABLE', source: 'API', warning: 'Автоматические погодные данные не получены. Заполните условия среды вручную' } });
      toast.warning('Автоматические погодные данные не получены. Заполните условия среды вручную', weatherError instanceof Error ? weatherError.message : undefined);
    }
  };

  const changeWeatherSelection = (selection: { objectId: string; date: string; time: string }) => {
    if (!protocol) return;
    const object = companyObjects.find((item) => item.id === selection.objectId);
    patchProtocol({
      objectId: selection.objectId,
      measurementDate: selection.date,
      measurementTime: selection.time || DEFAULT_WEATHER_TIME,
      measurementPlace: object?.name || protocol.measurementPlace,
      testing: {
        ...protocol.testing,
        samplingDate: selection.date,
      },
    });
  };

  const run = async (action: () => Promise<Protocol>, success: string): Promise<boolean> => {
    setBusy(true);
    setWorkflowErrors([]);
    try {
      const updated = await action();
      applyServerProtocol(updated);
      void queryClient.invalidateQueries({ queryKey: protocolQueryKeys.all(protocolCacheScope) });
      void queryClient.invalidateQueries({ queryKey: protocolQueryKeys.detail(protocolCacheScope, updated.id) });
      if (updated.orderId) void queryClient.invalidateQueries({ queryKey: ['order', String(updated.orderId)] });
      if (updated.pekProgramId) void queryClient.invalidateQueries({ queryKey: ['pek', 'program', Number(updated.pekProgramId)] });
      if (updated.pekReportId) {
        void queryClient.invalidateQueries({ queryKey: ['pek', 'report', Number(updated.pekReportId)] });
      }
      toast.success(success);
      return true;
    } catch (actionError) {
      const parsed = normalizeProtocolError(actionError);
      const status = getApiStatus(actionError);
      if (status === 409) {
        setConflictOpen(true);
        try {
          setConflictLatest(await protocolService.getProtocol(protocolRef.current?.id || protocolId || ''));
        } catch {
          setConflictLatest(null);
        }
      }
      if (status === 403) {
        try {
          await refreshUser();
          if (protocolRef.current?.id) applyServerProtocol(await protocolService.getProtocol(protocolRef.current.id));
        } catch {
          // The original access error remains visible when capabilities cannot be refreshed.
        }
      }
      setWorkflowErrors([parsed.message]);
      if (parsed.field === 'waterType' || parsed.field === 'waterUseCategory') {
        setEditSection('environment');
        window.requestAnimationFrame(() => {
          document.getElementById(`protocol-${parsed.field}`)?.focus();
        });
      }
      toast.error('Действие не выполнено', parsed.message || userProtocolError(actionError));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    const current = await ensureSavedProtocol('Сначала сохраняю изменения, затем открываю предпросмотр.');
    if (!current) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const blob = await protocolService.previewProtocol(current.id);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (previewError) {
      toast.error('Не удалось открыть предпросмотр', userProtocolError(previewError));
      setPreviewUrl('');
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadGeneratedFile = async (kind: 'pdf' | 'docx') => {
    const current = protocolRef.current;
    if (!current) return;
    if (!hasProtocolAction(current, kind === 'pdf' ? 'DOWNLOAD_PDF' : 'DOWNLOAD_DOCX')) {
      toast.warning(`Скачивание ${kind.toUpperCase()} недоступно для текущего состояния протокола`);
      return;
    }
    setBusy(true);
    try {
      const downloaded = kind === 'pdf' ? await protocolService.downloadPdf(current.id) : await protocolService.downloadDocx(current.id);
      if (!downloaded?.blob.size) throw new Error('Не удалось получить сформированный файл.');
      saveBlob(downloaded.blob, downloaded.fileName || fileName(current, kind));
    } catch (downloadError) {
      toast.error('Не удалось скачать файл', userProtocolError(downloadError));
    } finally {
      setBusy(false);
    }
  };

  const generateDocument = async (kind: 'docx' | 'pdf') => {
    const current = await ensureSavedProtocol(`Сначала сохраняю изменения, затем формирую ${kind.toUpperCase()}.`);
    if (!current) return;
    if (current.signatureCount > 0 || ['SIGNED', 'REPLACED', 'CANCELLED', 'ARCHIVED'].includes(String(current.status).toUpperCase())) {
      toast.warning('Протокол уже подписан. Для изменения создайте исправленную версию');
      return;
    }
    setBusy(true);
    try {
      const updated = kind === 'docx'
        ? await protocolService.generateDocx(current.id, Number(current.version))
        : await protocolService.generatePdf(current.id, Number(current.version));
      applyServerProtocol(updated);
      toast.success(`${kind.toUpperCase()} сформирован`);
    } catch (generateError) {
      toast.error(`Не удалось сформировать ${kind.toUpperCase()}`, userProtocolError(generateError));
    } finally {
      setBusy(false);
    }
  };

  const addDevice = async (device: MeasurementDevice) => {
    if (!protocol || !protocolActions.canManageDevices) return;
    setBusy(true);
    try {
      const updated = await protocolService.addProtocolMeasurementDevice(protocol.id, device, Number(protocol.version));
      applyServerProtocol(updated);
      setDevicePickerOpen(false);
      toast.success('Средство измерения добавлено');
    } catch (addError) {
      toast.error('Не удалось добавить средство измерения', addError instanceof Error ? addError.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const removeDevice = async (deviceId: string) => {
    if (!protocol || !protocolActions.canManageDevices) return;
    setBusy(true);
    try {
      const updated = await protocolService.removeProtocolMeasurementDevice(protocol.id, deviceId, Number(protocol.version));
      applyServerProtocol(updated);
      setDeviceToRemove(null);
      toast.success('Средство измерения удалено');
    } catch (removeError) {
      toast.error('Не удалось удалить средство измерения', removeError instanceof Error ? removeError.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const deleteCurrentProtocol = async () => {
    if (!protocol) return;
    setBusy(true);
    try {
      await protocolService.deleteProtocol(protocol.id, protocol.version);
      savedSignatureRef.current = '';
      setMoreOpen(false);
      setDeleteProtocolOpen(false);
      toast.success('Протокол удалён');
      navigate('/staff/protocols');
    } catch (deleteError) {
      toast.error(getApiErrorMessage(deleteError, 'Не удалось удалить протокол'));
    } finally {
      setBusy(false);
    }
  };

  const sendForApproval = async () => {
    const current = await ensureSavedProtocol('Сначала сохраняю изменения, затем отправляю протокол на утверждение.');
    if (!current) return;
    const blockers = getApprovalBlockers(current);
    if (blockers.length) {
      setWorkflowErrors(blockers);
      toast.warning('Протокол пока нельзя отправить на утверждение', blockers[0]);
      return;
    }
    await run(
      () => protocolService.readyForApproval(current.id, { version: Number(current.version) }),
      'Протокол отправлен на утверждение',
    );
  };

  const pekReportContext = Number(new URLSearchParams(location.search).get('pekReportId'));
  const recollectPekReport = async () => {
    if (!Number.isInteger(pekReportContext) || pekReportContext <= 0) return;
    setBusy(true);
    try {
      const currentPekReport = await pekApi.getReport(pekReportContext);
      await pekApi.collectReport(pekReportContext);
      await queryClient.invalidateQueries({ queryKey: ['pek', 'report', pekReportContext] });
      toast.success('Отчёт ПЭК повторно собран с учётом финализированных протоколов');
      navigate(`/staff/pek/reports/${pekReportContext}`);
    } catch (collectError) {
      toast.error(getApiErrorMessage(collectError, 'Не удалось повторно собрать отчёт ПЭК'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">Загрузка протокола...</div>;
  if (error || !protocol) {
    return (
      <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="font-bold">{error || 'Протокол не найден'}</p>
        <Button type="button" variant="secondary" onClick={() => navigateSafely('/staff/protocols')}>Вернуться к списку</Button>
      </div>
    );
  }

  const missingFields = getMissingFields(protocol);
  const completedSteps = protocolSteps.filter((step) => getStepStatus(protocol, step.key) === 'complete').length;
  const activeStepIndex = protocolSteps.findIndex((step) => step.key === activeStep);
  const firstMissingStep = missingFields[0]?.stepKey;
  const goPreviousStep = () => setActiveStep(protocolSteps[Math.max(0, activeStepIndex - 1)].key);
  const goNextStep = () => setActiveStep(protocolSteps[Math.min(protocolSteps.length - 1, activeStepIndex + 1)].key);
  const generatedExplanation = protocol.templateId === 'industrial_emissions'
    ? `В рамках производственного экологического контроля проведены инструментальные замеры на источниках выбросов объекта «${protocol.companySnapshot.objectName}». В период обследования выполнены измерения параметров газовоздушной смеси и концентраций определяемых веществ. Работающие источники: ${Array.from(new Set(protocol.results.map((row) => String(row.values.sourceNumber || row.values.samplingPlace || '')).filter(Boolean))).join(', ') || 'не указаны'}. Неработавшие источники на момент обследования не выявлены. Определяемые вещества: ${Array.from(new Set(protocol.results.map((row) => String(row.values.indicator || row.indicator || '')).filter(Boolean))).join(', ') || 'не указаны'}. Использованные приборы: ${protocol.measurementDevices.map((item) => item.deviceSnapshot.name).join(', ') || 'не указаны'}. Измерения выполнены в соответствии с нормативными документами и областью аккредитации испытательной лаборатории.`
    : 'Испытания проведены в соответствии с областью аккредитации лаборатории. Полученные результаты приведены в таблице протокола и относятся только к исследованным пробам и объектам.';

  return (
    <>
    {protocol.status === 'UNKNOWN' && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">Статус протокола пока не поддерживается. Данные доступны только для чтения.</div>}
    {pekReportContext > 0 && ['READY', 'APPROVED', 'SIGNED'].includes(protocol.status) && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><span>Протокол завершён. Можно повторно собрать связанный отчёт ПЭК.</span><Button type="button" disabled={busy} onClick={() => { void recollectPekReport(); }}>Повторно собрать отчёт ПЭК</Button></div>}
    <ProtocolDetailsView
      protocol={protocol}
      role={user?.role}
      permissions={protocolActions}
      missing={missingFields}
      workflowErrors={workflowErrors}
      busy={busy || signMutation.isPending}
      signing={signMutation.isPending}
      onBack={() => navigateSafely('/staff/protocols')}
      onEdit={setEditSection}
      onReady={() => { void sendForApproval(); }}
      onApprove={() => { void run(() => protocolService.approveProtocol(protocol.id, { version: Number(protocol.version) }), 'Протокол утверждён'); }}
      onSign={signCurrentProtocol}
      onPublish={() => { void run(() => protocolService.publishToClient(protocol.id, { version: Number(protocol.version) }), 'Протокол отправлен клиенту'); }}
      onPreview={() => { void preview(); }}
      onGenerateDocx={() => { void generateDocument('docx'); }}
      onGeneratePdf={() => { void generateDocument('pdf'); }}
      onDocx={() => { void downloadGeneratedFile('docx'); }}
      onPdf={() => { void downloadGeneratedFile('pdf'); }}
      onCorrection={() => setReplaceOpen(true)}
      onCancel={() => setCancelOpen(true)}
      onArchive={() => {
        if (!window.confirm('Архивировать протокол?')) return;
        void run(() => protocolService.archiveProtocol(protocol.id, { version: Number(protocol.version) }), 'Протокол перемещён в архив');
      }}
      onReplacement={() => { if (protocol.replacedByProtocolId) navigateSafely(`/staff/protocols/${protocol.replacedByProtocolId}`); }}
    />

      <Modal
        open={Boolean(editSection)}
        onClose={() => {
          if (dirty && !window.confirm('Закрыть редактирование? Несохранённые изменения будут сохранены автоматически.')) return;
          setEditSection(null);
        }}
        loading={busy}
        size="xl"
        closeOnBackdrop={false}
        title={({ general: 'Изменить даты и сведения протокола', organization: 'Изменить данные заказчика', laboratory: 'Изменить лабораторию и исполнителя', environment: 'Изменить условия измерения', results: 'Изменить результаты', methods: 'Изменить методику' } as Record<ProtocolEditSection, string>)[editSection || 'general']}
        footer={<><Button type="button" variant="secondary" disabled={busy} onClick={() => setEditSection(null)}>Закрыть</Button>{editSection === 'results' ? <Button type="button" disabled={busy} onClick={() => { void calculateProtocolResults(); }}>Сохранить результаты</Button> : <Button type="button" disabled={busy} onClick={async () => { const saved = await save(); if (saved) setEditSection(null); }}>Сохранить</Button>}</>}
      >
        {editSection === 'general' && <div className="space-y-5"><ProtocolGeneralForm protocol={protocol} readOnly={!protocolActions.canEdit} onChange={patchProtocol} /><ProtocolTestingForm templateId={protocol.templateId} value={protocol.testing} measurementDate={protocol.measurementDate || protocol.testing.samplingDate} readOnly={!protocolActions.canEdit} onMeasurementDateChange={(measurementDate) => patchProtocol({ measurementDate })} onChange={(testing) => patchProtocol({ testing })} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} /></div>}
        {editSection === 'organization' && <div className="space-y-5"><ProtocolOrganizationForm value={protocol.organization} readOnly={!protocolActions.canEdit} onChange={(organization) => patchProtocol({ organization })} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} /></div>}
        {editSection === 'laboratory' && <ProtocolLaboratoryForm value={protocol.laboratory} employees={laboratoryEmployees} readOnly={!protocolActions.canManageDevices} loading={busy} canOpenSettings={protocolActions.canManageDevices} onExecutorChange={(employee) => patchProtocol({ laboratoryEmployeeId: employee.id, executorId: String(employee.id), executor: employee.fullName, laboratory: { ...protocol.laboratory, executorId: String(employee.id), executor: employee.fullName } })} onRefresh={refreshLaboratorySnapshot} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} />}
        {editSection === 'environment' && <div className="space-y-5">{isWaterProtocolType(protocol.templateId) && <ProtocolWaterCharacteristicsForm waterType={protocol.waterType || String(protocol.environment?.conditions?.waterType || '')} waterUseCategory={protocol.waterUseCategory || String(protocol.environment?.conditions?.waterUseCategory || '')} readOnly={!protocolActions.canEdit} onChange={({ waterType, waterUseCategory }) => patchProtocol({ conditions: { ...(protocol.environment?.conditions || {}), waterType, waterUseCategory } })} />}<ProtocolEnvironmentForm value={protocol.environment || {}} measurementDate={protocol.measurementDate || protocol.testing.samplingDate || protocol.protocolDate} measurementTime={protocol.measurementTime || ''} objectId={String(protocol.objectId || '')} objectName={companyObjects.find((item) => item.id === String(protocol.objectId))?.name || protocol.companySnapshot.objectName || ''} objectOptions={companyObjects.map((item) => ({ id: item.id, name: item.name }))} readOnly={!protocolActions.canEdit} loading={busy} onSelectionChange={changeWeatherSelection} onRequestConditions={refreshWeather} onChange={(environment) => patchProtocol({ environment })} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} /></div>}
        {editSection === 'methods' && <ProtocolTestingForm templateId={protocol.templateId} value={protocol.testing} measurementDate={protocol.measurementDate || protocol.testing.samplingDate} readOnly={!protocolActions.canEdit} onMeasurementDateChange={(measurementDate) => patchProtocol({ measurementDate })} onChange={(testing) => patchProtocol({ testing })} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} />}
        {editSection === 'results' && <ProtocolResultsTable protocolId={protocol.id} version={protocol.version} templateId={protocol.templateId} subtype={protocol.subtype} rows={protocol.results} devices={protocol.measurementDevices} readOnly={!protocolActions.canManageResults} busy={busy} objectId={protocol.objectId} measurementPlace={protocol.measurementPlace || ''} testingDate={protocol.testing.testingEndDate || protocol.testing.testingDate || protocol.protocolDate} waterType={protocol.waterType || String(protocol.conditions?.waterType || '')} waterUseCategory={protocol.waterUseCategory || String(protocol.conditions?.waterUseCategory || '')} onChange={applyServerResults} onCheckNormatives={checkSavedNormatives} onImported={reloadProtocolResults} onNotify={notify} />}
      </Modal>

      <ProtocolPreviewModal
        open={previewOpen}
        loading={previewLoading}
        previewUrl={previewUrl}
        protocol={protocol}
        draft={false}
        onClose={() => setPreviewOpen(false)}
        onConfirmSign={hasProtocolAction(protocol, 'SIGN') ? () => {
          setPreviewOpen(false);
          setSignOpen(true);
        } : undefined}
      />
      <Modal open={conflictOpen} onClose={() => setConflictOpen(false)} title="Протокол был изменён. Обновляем актуальные данные">
        <p className="text-sm text-slate-600">Мы загрузили последнюю версию. Проверьте изменения и повторите действие.</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setConflictOpen(false)}>Закрыть</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const local = protocolRef.current;
              if (local) void navigator.clipboard?.writeText(JSON.stringify(local, null, 2));
            }}
          >
            Скопировать мои изменения
          </Button>
          <Button type="button" variant="secondary" disabled={!conflictLatest} onClick={() => setConflictCompareOpen(true)}>
            Сравнить изменения
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!protocolId) return;
              setBusy(true);
              try {
                applyServerProtocol(conflictLatest || await protocolService.getProtocol(protocolId));
                setConflictOpen(false);
              } catch (reloadError) {
                toast.error('Не удалось обновить данные протокола', userProtocolError(reloadError));
              } finally {
                setBusy(false);
              }
            }}
          >
            Обновить данные
          </Button>
        </div>
      </Modal>
      <Modal open={conflictCompareOpen} onClose={() => setConflictCompareOpen(false)} title="Сравнение версий протокола" size="xl">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 font-bold">Мои изменения · версия {protocolRef.current?.version ?? '—'}</h3>
            <pre className="max-h-[55vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(protocolRef.current, null, 2)}</pre>
          </div>
          <div>
            <h3 className="mb-2 font-bold">Версия сервера · {conflictLatest?.version ?? '—'}</h3>
            <pre className="max-h-[55vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(conflictLatest, null, 2)}</pre>
          </div>
        </div>
      </Modal>
      <ReplaceProtocolModal
        open={replaceOpen}
        loading={busy}
        onClose={() => setReplaceOpen(false)}
        onConfirm={async (reason) => {
          setBusy(true);
          try {
            const replacement = await protocolService.createCorrection(protocol.id, { version: Number(protocol.version), reason });
            toast.success('Создана исправленная версия');
            savedSignatureRef.current = '';
            navigate(`/staff/protocols/${replacement.id}`);
          } catch (replaceError) {
            toast.error('Не удалось создать исправленную версию', replaceError instanceof Error ? replaceError.message : undefined);
          } finally {
            setBusy(false);
          }
        }}
      />
      <ReturnForRevisionModal
        open={cancelOpen}
        loading={busy}
        title="Отменить протокол"
        description="Укажите причину отмены. После отмены редактирование будет недоступно."
        confirmText="Отменить протокол"
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          if (await run(() => protocolService.cancelProtocol(protocol.id, { version: Number(protocol.version), reason }), 'Протокол отменён')) setCancelOpen(false);
        }}
      />
      <SignProtocolModal
        open={signOpen}
        loading={signMutation.isPending}
        phase={signMutation.phase}
        protocol={protocol}
        onClose={() => !signMutation.isPending && setSignOpen(false)}
        onConfirm={() => signMutation.sign({ protocol })}
      />
      <DevicePickerModal
        open={devicePickerOpen}
        loading={busy}
        measurementDate={protocol.measurementDate || protocol.testing.samplingDate || protocol.protocolDate}
        laboratoryId={protocol.laboratory?.laboratoryId || protocol.laboratory?.id}
        onClose={() => setDevicePickerOpen(false)}
        onSelect={addDevice}
      />
      <ConfirmModal
        isOpen={deleteProtocolOpen}
        title="Удалить протокол?"
        description="Данные будут скрыты из списка."
        confirmText="Удалить протокол"
        variant="danger"
        loading={busy}
        onClose={() => setDeleteProtocolOpen(false)}
        onConfirm={deleteCurrentProtocol}
      />
      <ConfirmModal
        isOpen={Boolean(deviceToRemove)}
        title="Удалить прибор?"
        description="Прибор будет удален из протокола. Если он выбран в строках результатов, проверьте эти строки перед выпуском."
        confirmText="Удалить прибор"
        variant="danger"
        loading={busy}
        onClose={() => setDeviceToRemove(null)}
        onConfirm={async () => {
          if (deviceToRemove) await removeDevice(deviceToRemove);
        }}
      />
    </>
  );
};

export default ProtocolEditorPage;
