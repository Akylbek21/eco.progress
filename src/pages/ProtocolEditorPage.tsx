import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ClipboardCheck, Eye, FileCheck2, History, MoreHorizontal, Plus, RotateCw, Save, Search, SearchCheck, Trash2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/modals/ConfirmModal';
import ProtocolStatusBadge from '../components/protocols/ProtocolStatusBadge';
import NormativeStatusBadge from '../components/protocols/NormativeStatusBadge';
import ProtocolGeneralForm from '../components/protocols/ProtocolGeneralForm';
import ProtocolEnvironmentForm from '../components/protocols/ProtocolEnvironmentForm';
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
import { accreditationState, getLaboratoryEmployees } from '../services/laboratorySettingsService';
import { getApiErrorMessage, getApiStatus, parseApiError } from '../services/apiHelpers';
import { signBase64WithNCALayer } from '../services/ncalayer';
import protocolService from '../services/protocolService';
import type { CompanyObject } from '../types/companies';
import type { LaboratoryEmployee, MeasurementDevice, Protocol, ProtocolCompanySnapshot, ProtocolMeasurementDevice, WeatherConditions } from '../types/protocols';
import { canEditProtocol, getProtocolPermissions, type ProtocolPermissions } from '../utils/protocolPermissions';
import { parseLaboratoryApiError } from '../utils/laboratoryApiError';
import { isProtocolStatusEditable } from '../config/protocolStatus';
import { collectProtocolDevices, isDeviceValidForDate } from '../utils/protocolDevices';
import { normalizeProtocolError } from '../utils/protocolError';
import ProtocolDetailsView from '../features/protocols/details/ProtocolDetailsView';
import type { ProtocolEditSection } from '../features/protocols/details/protocolDetailsModel';

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

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Не удалось прочитать документ для подписи.'));
  reader.onload = () => {
    const result = String(reader.result || '');
    resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
  };
  reader.readAsDataURL(blob);
});

const editableSignature = (protocol: Protocol) => JSON.stringify({
  number: protocol.protocolNumber || protocol.number || '',
  protocolDate: protocol.protocolDate || '',
  formCode: protocol.formCode || '',
  application: protocol.application || '',
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

const lifecycleSteps = ['Черновик', 'Результаты', 'Расчёт', 'Согласование', 'Утверждение', 'Подписание'];
const lifecycleIndexByStatus: Record<Protocol['status'], number> = {
  DRAFT: 0,
  NEEDS_REVISION: 1,
  CALCULATED: 2,
  READY: 2,
  READY_FOR_APPROVAL: 3,
  APPROVED: 4,
  SIGNED: 5,
  REPLACED: 5,
  CANCELLED: 0,
  ARCHIVED: 5,
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
  const message = error instanceof Error ? error.message : '';
  const normalized = message.toLowerCase();
  if (normalized.includes('только в статусах') || normalized.includes('only in statuses') || normalized.includes('draft') && normalized.includes('calculated')) {
    return 'Backend пока не разрешает сохранять протокол в текущем статусе. Нужно обновить backend: PATCH/PUT протокола должен работать без перевода в DRAFT.';
  }
  if (normalized.includes('черновик')) return 'Backend пока требует черновик для сохранения. Нужно обновить backend, frontend не переводит протокол в DRAFT.';
  return message || undefined;
};
const hasText = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';
const requiredEnvironmentFields = (protocol: Protocol) => {
  if (['industrial_emissions', 'ambient_air', 'workplace_air', 'vehicle_emissions'].includes(protocol.templateId)) {
    return ['temperature', 'humidity', 'pressureKpa', 'windSpeed'] as const;
  }
  if (['water', 'water_wastewater', 'soil'].includes(protocol.templateId)) return ['temperature'] as const;
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

const getMissingFields = (protocol: Protocol): MissingField[] => {
  const items: MissingField[] = [];
  if (!hasText(protocol.protocolNumber || protocol.number)) items.push({ label: 'номер протокола', stepKey: 'general' });
  if (!hasText(protocol.protocolDate)) items.push({ label: 'дата протокола', stepKey: 'general' });
  if (!hasText(protocol.measurementDate || protocol.testing?.samplingDate)) items.push({ label: 'дата замера', stepKey: 'general' });
  if (!hasText(protocol.measurementTime)) items.push({ label: 'время замера', stepKey: 'general' });
  if (!hasLaboratory(protocol)) items.push({ label: 'данные лаборатории', stepKey: 'general' });
  if (!hasText(protocol.organization?.organizationName)) items.push({ label: 'организация', stepKey: 'organization' });
  if (!hasText(protocol.organization?.organizationAddress)) items.push({ label: 'адрес организации', stepKey: 'organization' });
  if (!hasText(protocol.organization?.objectName || protocol.companySnapshot?.objectName)) items.push({ label: 'данные объекта', stepKey: 'organization' });
  if (!hasEnvironment(protocol)) items.push({ label: 'условия среды', stepKey: 'environment' });
  if (!protocol.results.length) items.push({ label: 'результаты испытаний', stepKey: 'results' });
  if (protocol.results.length && !hasCheckedResults(protocol)) items.push({ label: 'проверка соответствия нормативам', stepKey: 'results' });
  if (!protocol.measurementDevices.length) items.push({ label: 'средство измерения', stepKey: 'instruments' });
  else if (!hasValidResultDevices(protocol)) items.push({ label: 'действующий прибор для каждой строки результата', stepKey: 'results' });
  return items;
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
          {actions.canSave && (
            <>
              {activeIndex > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={onPrevious}><ChevronLeft className="h-4 w-4" /> Назад</Button>}
              {activeStep !== 'review' && <Button type="button" variant="secondary" disabled={busy || readOnly} onClick={onSave}><Save className="h-4 w-4" /> Сохранить</Button>}
              {activeStep === 'results' && actions.canCalculate && <Button type="button" variant="secondary" disabled={busy || readOnly} onClick={onCalculate}><SearchCheck className="h-4 w-4" /> Рассчитать и проверить</Button>}
              {activeStep !== 'review' && <Button type="button" variant={activeStep === 'results' ? 'secondary' : 'primary'} disabled={busy} onClick={onNext}>Далее <ArrowRight className="h-4 w-4" /></Button>}
              {activeStep === 'review' && (
                <>
                  <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
                  {actions.canGenerate && <Button type="button" variant="secondary" disabled={busy} onClick={onGenerateDocx}><FileCheck2 className="h-4 w-4" /> Сформировать документ</Button>}
                  {actions.canSendToApproval && <Button type="button" disabled={busy || missingFields.length > 0} onClick={onReady}><CheckCircle2 className="h-4 w-4" /> Готово</Button>}
                </>
              )}
            </>
          )}
          {String(protocol.status).toUpperCase() === 'READY_FOR_APPROVAL' && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadDocx}>DOCX</Button>}
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadPdf}>PDF</Button>}
              {actions.canReturn && <Button type="button" variant="secondary" disabled={busy} onClick={onReturn}>Вернуть</Button>}
              {actions.canApprove && <Button type="button" disabled={busy} onClick={onApprove}><CheckCircle2 className="h-4 w-4" /> Утвердить</Button>}
            </>
          )}
          {String(protocol.status).toUpperCase() === 'APPROVED' && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadDocx}>DOCX</Button>}
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadPdf}>PDF</Button>}
              {actions.canCreateCorrection && <Button type="button" variant="secondary" disabled={busy} onClick={onReplace}>Создать исправленную версию</Button>}
              {actions.canSign && <Button type="button" disabled={busy} onClick={onSign}>Подписать</Button>}
            </>
          )}
          {String(protocol.status).toUpperCase() === 'SIGNED' && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadDocx}>Скачать DOCX</Button>}
              {actions.canDownload && <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadPdf}>Скачать PDF</Button>}
              {actions.canCreateCorrection && <Button type="button" disabled={busy} onClick={onReplace}>Создать исправленную версию</Button>}
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
  const { protocolId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user } = useAuth();
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [workflowErrors, setWorkflowErrors] = useState<string[]>([]);
  const [conflictOpen, setConflictOpen] = useState(false);
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
  const editVersionRef = useRef(0);
  const saveRequestRef = useRef(0);
  const saveInFlightRef = useRef<Promise<Protocol | null> | null>(null);
  const saveQueuedRef = useRef(false);

  const dirty = useMemo(() => Boolean(protocol && savedSignatureRef.current && editableSignature(protocol) !== savedSignatureRef.current), [protocol]);
  const protocolActions = useMemo(() => getProtocolPermissions(protocol, user?.role), [protocol?.status, user?.role]);
  const readOnly = useMemo(() => !canEditProtocol(user, protocol), [protocol?.status, user?.role]);
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
    protocolRef.current = normalized;
    setSaveStatus('saved');
    setProtocol(normalized);
    return normalized;
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
      const item = await protocolService.getProtocol(protocolId);
      applyServerProtocol(item);
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
    setProtocol((current) => {
      if (!current) return fresh;
      const updated = {
        ...current,
        status: fresh.status,
        complianceResult: fresh.complianceResult,
        results: fresh.results,
        measurementDevices: collectProtocolDevices(fresh),
        history: fresh.history,
        updatedAt: fresh.updatedAt,
        version: fresh.version,
      };
      protocolRef.current = updated;
      return updated;
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
    if (!isEditableProtocol(snapshot)) {
      toast.warning('Редактирование протокола закрыто для текущего статуса');
      return null;
    }
    if (snapshot.environment?.source === 'MANUAL' && !snapshot.environment.manualChangeReason?.trim()) {
      toast.warning('Укажите причину ручного изменения условий среды.');
      setActiveStep('environment');
      return null;
    }
    if (snapshot.testing.samplingDate && snapshot.testing.testingStartDate && snapshot.testing.samplingDate > snapshot.testing.testingStartDate) {
      toast.warning('Дата отбора не может быть позже начала испытаний.');
      return null;
    }
    if (snapshot.testing.testingStartDate && snapshot.testing.testingEndDate && snapshot.testing.testingStartDate > snapshot.testing.testingEndDate) {
      toast.warning('Дата начала испытаний не может быть позже окончания.');
      return null;
    }
    const startedVersion = editVersionRef.current;
    const requestId = ++saveRequestRef.current;
    setSaveStatus('saving');
    setBusy(true);
    let conflictDetected = false;
    const operation = (async (): Promise<Protocol | null> => {
      try {
        const draftProtocol = await ensureDraftProtocol(snapshot);
        const updated = await protocolService.updateProtocol(draftProtocol.id, {
           version: Number(snapshot.version || 0),
           number: snapshot.protocolNumber || snapshot.number || '',
           protocolDate: snapshot.protocolDate || '',
           companyId: snapshot.companyId,
           objectId: snapshot.objectId,
          laboratoryId: snapshot.laboratory?.laboratoryId || snapshot.laboratory?.id,
           sampleDate: snapshot.testing.samplingDate || snapshot.measurementDate || snapshot.protocolDate,
           sampleNumber: snapshot.sampleNumber,
           samplingPlace: snapshot.samplingPlace || snapshot.measurementPlace,
           samplingDepth: snapshot.samplingDepth,
          measurementDate: snapshot.measurementDate || snapshot.testing.samplingDate || snapshot.protocolDate,
          measurementTime: snapshot.measurementTime,
          measurementPlace: snapshot.measurementPlace,
          formCode: snapshot.formCode,
          application: snapshot.application,
          executor: snapshot.executor || '',
          executorId: snapshot.executorId,
          approver: snapshot.approver || '',
          laboratory: snapshot.laboratory,
          organization: snapshot.organization,
          testing: snapshot.testing,
          environment: snapshot.environment,
           explanatoryNote: snapshot.explanatoryNote,
           testingMethodDocument: snapshot.testingMethodDocument,
           complianceDocument: snapshot.complianceDocument,
          printVisibility: snapshot.printVisibility,
        });
        if (requestId === saveRequestRef.current && startedVersion === editVersionRef.current) {
          applyServerProtocol(updated);
          toast.success('Протокол сохранен');
          return updated;
        }
        saveQueuedRef.current = true;
        setSaveStatus('dirty');
        return protocolRef.current;
      } catch (saveError) {
        if (getApiStatus(saveError) === 409) {
          conflictDetected = true;
          saveQueuedRef.current = false;
          setSaveStatus('conflict');
          setConflictOpen(true);
        } else {
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
      const updated = await protocolService.refreshLaboratoryData(draftProtocol.id);
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

  useEffect(() => {
    if (!dirty || readOnly || busy) return;
    const timer = window.setTimeout(() => {
      save().catch((saveError) => console.error('Protocol autosave failed.', saveError));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [dirty, readOnly, busy, protocol]);

  const checkSavedNormatives = async () => {
    if (!protocol) return;
    if (dirty) {
      toast.info('Сначала сохраняю локальные изменения, затем проверяю нормативы.');
      const saved = await save();
      if (!saved) return;
    }
    await run(async () => {
      await protocolService.calculateProtocolSummary(protocol.id);
      return protocolService.getProtocol(protocol.id);
    }, 'Расчёт выполнен backend');
  };

  const calculateProtocolResults = async () => {
    if (!protocol) return;
    if (dirty) {
      toast.info('Сначала сохраняю данные, затем запускаю расчет.');
      const saved = await save();
      if (!saved) return;
    }
    setBusy(true);
    try {
      const summary = await protocolService.calculateProtocolSummary(protocol.id);
      const updated = await protocolService.getProtocol(protocol.id);
      applyServerProtocol(updated);
      toast.success(
        'Результаты рассчитаны',
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
      patchProtocol({ environment: weather });
      return weather;
    } catch (weatherError) {
      if (selection.signal?.aborted) return;
      patchProtocol({ environment: { ...protocol.environment, status: 'API_UNAVAILABLE', source: 'API' } });
      toast.error('Погодный API недоступен', weatherError instanceof Error ? weatherError.message : undefined);
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
      toast.success(success);
      return true;
    } catch (actionError) {
      const parsed = normalizeProtocolError(actionError);
      setWorkflowErrors([parsed.message]);
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

  const generateAndDownload = async (kind: 'pdf' | 'docx') => {
    const current = await ensureSavedProtocol('Сначала сохраняю изменения, затем формирую файл.');
    if (!current) return;
    setBusy(true);
    try {
      const immutable = ['SIGNED', 'ARCHIVED', 'REPLACED'].includes(String(current.status).trim().toUpperCase());
      if (!immutable) {
        const generated = kind === 'pdf' ? await protocolService.generatePdf(current.id) : await protocolService.generateDocx(current.id);
        applyServerProtocol(generated);
      }
      const downloaded = kind === 'pdf' ? await protocolService.downloadPdf(current.id) : await protocolService.downloadDocx(current.id);
      if (!downloaded?.blob.size) throw new Error('Backend вернул пустой файл.');
      saveBlob(downloaded.blob, downloaded.fileName || fileName(current, kind));
    } catch (downloadError) {
      toast.error('Не удалось скачать файл', userProtocolError(downloadError));
    } finally {
      setBusy(false);
    }
  };

  const generateDocuments = async () => {
    const current = await ensureSavedProtocol('Сначала сохраняю изменения, затем формирую документы.');
    if (!current) return;
    setBusy(true);
    try {
      const docx = await protocolService.generateDocx(current.id);
      applyServerProtocol(docx);
      const pdf = await protocolService.generatePdf(current.id);
      applyServerProtocol(pdf);
      toast.success('Документы сформированы');
    } catch (generateError) {
      toast.error('Не удалось сформировать документы', userProtocolError(generateError));
    } finally {
      setBusy(false);
    }
  };

  const addDevice = async (device: MeasurementDevice) => {
    if (!protocol) return;
    setBusy(true);
    try {
      const updated = await protocolService.addProtocolMeasurementDevice(protocol.id, device);
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
    if (!protocol) return;
    setBusy(true);
    try {
      const updated = await protocolService.removeProtocolMeasurementDevice(protocol.id, deviceId);
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
      await protocolService.deleteProtocol(protocol.id);
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

  const signCurrentProtocol = async () => {
    if (!protocol || busy) return;
    if (accreditationState(protocol.laboratory.accreditationValidUntil).status === 'EXPIRED') {
      toast.error('Подписание заблокировано', 'Срок действия аттестата лаборатории истёк.');
      return;
    }
    if (!protocol.laboratory.laboratoryHead) {
      toast.error('Подписание заблокировано', 'В snapshot протокола не выбран заведующий лабораторией.');
      return;
    }
    setBusy(true);
    try {
      let document;
      try {
        const latest = await protocolService.getProtocol(protocol.id);
        const localVersion = String(protocol.version ?? protocol.updatedAt ?? '');
        const latestVersion = String(latest.version ?? latest.updatedAt ?? '');
        if (localVersion && latestVersion && localVersion !== latestVersion) {
          applyServerProtocol(latest);
          throw new Error('Протокол изменён после открытия страницы. Проверьте актуальные данные и повторите подписание.');
        }
        document = await protocolService.downloadPdf(protocol.id);
      } catch (downloadError) {
        if ([404, 409].includes(getApiStatus(downloadError) || 0)) {
          throw new Error('PDF ещё не сформирован. Сначала нажмите «PDF», затем повторите подписание.');
        }
        throw downloadError;
      }
      if (!document.blob.size) throw new Error('Backend вернул пустой PDF. Сформируйте документ повторно.');
      const dataBase64 = await blobToBase64(document.blob);
      const { signedCms } = await signBase64WithNCALayer(dataBase64);
      if (!signedCms.trim()) throw new Error('NCALayer не вернул CMS-подпись.');
      await protocolService.signProtocol(protocol.id, signedCms);
      applyServerProtocol(await protocolService.getProtocol(protocol.id));
      setSignOpen(false);
      toast.success('Протокол подписан');
    } catch (signError) {
      const message = signError instanceof Error ? signError.message : '';
      if (/отменен|отменён|cancel/i.test(message)) {
        setSignOpen(false);
        return;
      }
      toast.error('Не удалось подписать протокол', message || undefined);
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
    <ProtocolDetailsView
      protocol={protocol}
      role={user?.role}
      permissions={protocolActions}
      missing={missingFields}
      workflowErrors={workflowErrors}
      busy={busy}
      onBack={() => navigateSafely('/staff/protocols')}
      onEdit={setEditSection}
      onReady={() => {
        if (firstMissingStep) {
          const section: ProtocolEditSection = firstMissingStep === 'organization' ? 'organization' : firstMissingStep === 'environment' ? 'environment' : firstMissingStep === 'results' || firstMissingStep === 'instruments' ? 'results' : firstMissingStep === 'review' ? 'methods' : 'general';
          setEditSection(section);
          return;
        }
        setReadyOpen(true);
      }}
      onApprove={() => setApproveOpen(true)}
      onReturn={() => setReturnOpen(true)}
      onSign={() => setSignOpen(true)}
      onGenerate={generateDocuments}
      onDocx={() => { void generateAndDownload('docx'); }}
      onPdf={() => { void generateAndDownload('pdf'); }}
      onCorrection={() => setReplaceOpen(true)}
      onCancel={() => {
        if (!window.confirm('Отменить протокол? После отмены редактирование будет недоступно.')) return;
        void run(() => protocolService.cancelProtocol(protocol.id), 'Протокол отменён');
      }}
      onArchive={() => {
        if (!window.confirm('Архивировать протокол?')) return;
        void run(() => protocolService.archiveProtocol(protocol.id), 'Протокол перемещён в архив');
      }}
      onReplacement={() => { if (protocol.replacedByProtocolId) navigateSafely(`/staff/protocols/${protocol.replacedByProtocolId}`); }}
    />
    {false && ((protocol: Protocol) => <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button type="button" onClick={() => navigateSafely('/staff/protocols')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-eco-700 hover:text-eco-900">
            <ArrowLeft className="h-4 w-4" /> К протоколам
          </button>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">{templateName(protocol.templateId, protocol.templateName)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProtocolStatusBadge status={protocol.status} />
            <NormativeStatusBadge status={protocol.complianceResult} />
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{protocol.protocolNumber || protocol.number || 'Новый протокол'}</h1>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={load}><RotateCw className="h-4 w-4" /> Обновить</Button>
          <Button type="button" variant="secondary" onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal className="h-4 w-4" /> Еще</Button>
          {moreOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl">
              <button type="button" className="w-full rounded-lg px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { setMoreOpen(false); void load(); }}>Обновить данные</button>
              {protocolActions.canDelete && <button type="button" className="w-full rounded-lg px-3 py-2 text-left font-semibold text-rose-700 hover:bg-rose-50" onClick={() => { setMoreOpen(false); setDeleteProtocolOpen(true); }}>Удалить протокол</button>}
              {protocolActions.canCancel && !TERMINAL_STATUSES.has(String(protocol.status).toUpperCase()) && <button type="button" className="w-full rounded-lg px-3 py-2 text-left font-semibold text-rose-700 hover:bg-rose-50" onClick={async () => {
                setMoreOpen(false);
                if (!window.confirm('Отменить протокол? После отмены редактирование будет недоступно.')) return;
                await run(() => protocolService.cancelProtocol(protocol.id), 'Протокол отменен');
              }}>Отменить протокол</button>}
            </div>
          )}
        </div>
      </div>

      <section aria-label="Этап жизненного цикла протокола" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {lifecycleSteps.map((label, index) => {
            const currentIndex = lifecycleIndexByStatus[protocol.status];
            const active = index === currentIndex;
            const complete = index < currentIndex;
            return <li key={label} className={`rounded-xl border px-3 py-3 text-sm font-bold ${active ? 'border-eco-500 bg-eco-50 text-eco-900' : complete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{index + 1}. {label}</li>;
          })}
        </ol>
        <p className="mt-3 text-sm text-slate-600">Версия: <strong>{protocol.version ?? '—'}</strong>{protocol.replacesProtocolId ? <> · Заменяет протокол: <button type="button" className="font-bold text-eco-700" onClick={() => navigateSafely(`/staff/protocols/${protocol.replacesProtocolId}`)}>{protocol.replacesProtocolId}</button></> : null}{protocol.replacedByProtocolId ? <> · Заменён протоколом: <button type="button" className="font-bold text-eco-700" onClick={() => navigateSafely(`/staff/protocols/${protocol.replacedByProtocolId}`)}>{protocol.replacedByProtocolId}</button></> : null}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Заполните протокол по шагам</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Заполните данные по шагам. Система сохранит данные, проверит нормативы и подготовит протокол.
            </p>
            {missingFields.length > 0 && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                Нужно заполнить: {missingFields.slice(0, 4).map((item) => item.label).join(', ')}{missingFields.length > 4 ? ` и еще ${missingFields.length - 4}` : ''}.
              </p>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
            Заполнено {completedSteps} из {protocolSteps.length} шагов
          </div>
        </div>
      </section>

      {workflowErrors.length > 0 && (
        <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <h2 className="font-bold">Исправьте ошибки перед продолжением</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">{workflowErrors.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}

      <ProtocolStepWizard activeStep={activeStep} protocol={protocol} onSelect={setActiveStep} />

      {activeStep === 'general' && <div className="space-y-6">
        <ProtocolGeneralForm protocol={protocol} readOnly={readOnly} onChange={patchProtocol} />
        <ProtocolTestingForm
          templateId={protocol.templateId}
          value={protocol.testing}
          measurementDate={protocol.measurementDate || protocol.testing.samplingDate}
          readOnly={readOnly}
          onMeasurementDateChange={(measurementDate) => patchProtocol({ measurementDate })}
          onChange={(testing) => patchProtocol({ testing })}
          printVisibility={protocol.printVisibility}
          onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })}
        />
        <ProtocolLaboratoryForm
          value={protocol.laboratory}
          employees={laboratoryEmployees}
          readOnly={readOnly}
          loading={busy}
          canOpenSettings={['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'].includes(String(user?.role || ''))}
          onExecutorChange={(employee) => patchProtocol({
            executorId: String(employee.id),
            executor: employee.fullName,
            laboratory: {
              ...protocol.laboratory,
              executorId: String(employee.id),
              executor: employee.fullName,
            },
          })}
          onRefresh={refreshLaboratorySnapshot}
          printVisibility={protocol.printVisibility}
          onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })}
        />
      </div>}

      {activeStep === 'organization' && <div className="space-y-6">
        <SnapshotSection snapshot={protocol.companySnapshot} />
        <ProtocolOrganizationForm value={protocol.organization} readOnly={readOnly} onChange={(organization) => patchProtocol({ organization })} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} />
      </div>}

      {activeStep === 'environment' && <ProtocolEnvironmentForm
        value={protocol.environment || {}}
        measurementDate={protocol.measurementDate || protocol.testing.samplingDate || protocol.protocolDate}
        measurementTime={protocol.measurementTime || ''}
        objectId={String(protocol.objectId || '')}
        objectName={companyObjects.find((item) => item.id === String(protocol.objectId))?.name || protocol.companySnapshot.objectName || ''}
        objectOptions={companyObjects.map((item) => ({ id: item.id, name: item.name }))}
        readOnly={readOnly}
        loading={busy}
        onSelectionChange={changeWeatherSelection}
        onRequestConditions={refreshWeather}
        onChange={(environment) => patchProtocol({ environment })}
        printVisibility={protocol.printVisibility}
        onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })}
      />}

      {activeStep === 'results' && <ProtocolResultsTable
        protocolId={protocol.id}
        templateId={protocol.templateId}
        subtype={protocol.subtype}
        rows={protocol.results}
        devices={protocol.measurementDevices}
        readOnly={readOnly}
        busy={busy}
        objectId={protocol.objectId}
        measurementPlace={protocol.measurementPlace || ''}
        testingDate={protocol.testing.testingEndDate || protocol.testing.testingDate || protocol.protocolDate}
        waterType={String((protocol.testing as Record<string, unknown>).waterType || protocol.results[0]?.values.waterType || '')}
        waterUseCategory={String((protocol.testing as Record<string, unknown>).waterUseCategory || protocol.results[0]?.values.waterUseCategory || '')}
        onChange={applyServerResults}
        onCheckNormatives={checkSavedNormatives}
        onImported={reloadProtocolResults}
        onNotify={notify}
        onGoToInstruments={() => setActiveStep('instruments')}
      />}

      {activeStep === 'instruments' && <MeasurementDevicesSection devices={protocol.measurementDevices || []} readOnly={readOnly || busy} onAdd={() => setDevicePickerOpen(true)} onRemove={(deviceId) => setDeviceToRemove(deviceId)} />}

      {activeStep === 'review' && <div className="space-y-6">
        <ProtocolExplanatoryNoteForm
          value={protocol.explanatoryNote || ''}
          readOnly={readOnly}
          onChange={(explanatoryNote) => patchProtocol({ explanatoryNote })}
          onGenerate={() => patchProtocol({ explanatoryNote: generatedExplanation })}
          printVisibility={protocol.printVisibility}
          onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })}
        />
        <ReviewChecklist protocol={protocol} missingFields={missingFields} onGoToStep={setActiveStep} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><History className="h-5 w-5 text-eco-700" /> История действий</h2>
          <div className="space-y-3">
            {protocol.history?.length ? protocol.history?.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-bold text-slate-900">{item.action}</p>
                <p className="mt-1 text-slate-500">{item.createdAt} · {item.actorName || 'Система'}</p>
                {item.comment && <p className="mt-2 text-slate-700">{item.comment}</p>}
              </div>
            )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">История действий пока пуста.</p>}
          </div>
        </section>
      </div>}

      <ProtocolStepFooter
        protocol={protocol}
        activeStep={activeStep}
        busy={busy}
        readOnly={readOnly}
        actions={protocolActions}
        saveStatus={saveStatus}
        missingFields={missingFields}
        onPrevious={goPreviousStep}
        onNext={goNextStep}
        onSave={async () => { await save(); }}
        onCalculate={calculateProtocolResults}
        onPreview={preview}
        onReady={() => {
          if (firstMissingStep) {
            setActiveStep(firstMissingStep);
            return;
          }
          setReadyOpen(true);
        }}
        onApprove={() => setApproveOpen(true)}
        onReturn={() => setReturnOpen(true)}
        onGenerateDocx={generateDocuments}
        onGeneratePdf={generateDocuments}
        onSign={() => setSignOpen(true)}
        onDownloadDocx={() => generateAndDownload('docx')}
        onDownloadPdf={() => generateAndDownload('pdf')}
        onReplace={() => setReplaceOpen(true)}
        onOpenReplacement={protocol.replacedByProtocolId ? () => navigateSafely(`/staff/protocols/${protocol.replacedByProtocolId}`) : undefined}
      />

      </div>)(protocol as Protocol)}

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
        footer={<><Button type="button" variant="secondary" disabled={busy} onClick={() => setEditSection(null)}>Закрыть</Button>{editSection !== 'results' && <Button type="button" disabled={busy} onClick={async () => { const saved = await save(); if (saved) setEditSection(null); }}>Сохранить</Button>}</>}
      >
        {editSection === 'general' && <div className="space-y-5"><ProtocolGeneralForm protocol={protocol} readOnly={false} onChange={patchProtocol} /><ProtocolTestingForm templateId={protocol.templateId} value={protocol.testing} measurementDate={protocol.measurementDate || protocol.testing.samplingDate} readOnly={false} onMeasurementDateChange={(measurementDate) => patchProtocol({ measurementDate })} onChange={(testing) => patchProtocol({ testing })} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} /></div>}
        {editSection === 'organization' && <div className="space-y-5"><ProtocolOrganizationForm value={protocol.organization} readOnly={false} onChange={(organization) => patchProtocol({ organization })} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} /></div>}
        {editSection === 'laboratory' && <ProtocolLaboratoryForm value={protocol.laboratory} employees={laboratoryEmployees} readOnly={false} loading={busy} canOpenSettings={['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'].includes(String(user?.role || ''))} onExecutorChange={(employee) => patchProtocol({ executorId: String(employee.id), executor: employee.fullName, laboratory: { ...protocol.laboratory, executorId: String(employee.id), executor: employee.fullName } })} onRefresh={refreshLaboratorySnapshot} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} />}
        {editSection === 'environment' && <ProtocolEnvironmentForm value={protocol.environment || {}} measurementDate={protocol.measurementDate || protocol.testing.samplingDate || protocol.protocolDate} measurementTime={protocol.measurementTime || ''} objectId={String(protocol.objectId || '')} objectName={companyObjects.find((item) => item.id === String(protocol.objectId))?.name || protocol.companySnapshot.objectName || ''} objectOptions={companyObjects.map((item) => ({ id: item.id, name: item.name }))} readOnly={false} loading={busy} onSelectionChange={changeWeatherSelection} onRequestConditions={refreshWeather} onChange={(environment) => patchProtocol({ environment })} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} />}
        {editSection === 'methods' && <ProtocolTestingForm templateId={protocol.templateId} value={protocol.testing} measurementDate={protocol.measurementDate || protocol.testing.samplingDate} readOnly={false} onMeasurementDateChange={(measurementDate) => patchProtocol({ measurementDate })} onChange={(testing) => patchProtocol({ testing })} printVisibility={protocol.printVisibility} onPrintVisibilityChange={(printVisibility) => patchProtocol({ printVisibility })} />}
        {editSection === 'results' && <ProtocolResultsTable protocolId={protocol.id} templateId={protocol.templateId} subtype={protocol.subtype} rows={protocol.results} devices={protocol.measurementDevices} readOnly={false} busy={busy} objectId={protocol.objectId} measurementPlace={protocol.measurementPlace || ''} testingDate={protocol.testing.testingEndDate || protocol.testing.testingDate || protocol.protocolDate} waterType={String((protocol.testing as Record<string, unknown>).waterType || protocol.results[0]?.values.waterType || '')} waterUseCategory={String((protocol.testing as Record<string, unknown>).waterUseCategory || protocol.results[0]?.values.waterUseCategory || '')} onChange={applyServerResults} onCheckNormatives={checkSavedNormatives} onImported={reloadProtocolResults} onNotify={notify} />}
      </Modal>

      <ProtocolPreviewModal open={previewOpen} loading={previewLoading} previewUrl={previewUrl} protocol={protocol} draft={false} onClose={() => setPreviewOpen(false)} />
      <Modal open={readyOpen} onClose={() => setReadyOpen(false)} title="Передать протокол на проверку?">
        <p className="text-sm text-slate-600">После отправки руководитель проверит данные и результаты измерений.</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setReadyOpen(false)}>Отменить</Button>
          <Button type="button" disabled={busy} onClick={async () => {
            const current = await ensureSavedProtocol('Сохраняем изменения перед отправкой на проверку.');
            if (!current) return;
            if (await run(() => protocolService.markReadyForApproval(current.id), 'Протокол передан на проверку')) setReadyOpen(false);
          }}>Отправить</Button>
        </div>
      </Modal>
      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Утвердить протокол">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Компания</dt><dd className="font-semibold">{protocol.companySnapshot.companyName || '—'}</dd></div>
          <div><dt className="text-slate-500">Объект</dt><dd className="font-semibold">{protocol.companySnapshot.objectName || '—'}</dd></div>
          <div><dt className="text-slate-500">Исполнитель</dt><dd className="font-semibold">{protocol.executor || protocol.laboratory.executor || '—'}</dd></div>
          <div><dt className="text-slate-500">Результаты</dt><dd className="font-semibold">{protocol.results.length}</dd></div>
          <div><dt className="text-slate-500">Приборы</dt><dd className="font-semibold">{protocol.measurementDevices.length}</dd></div>
          <div><dt className="text-slate-500">Аттестат до</dt><dd className="font-semibold">{protocol.laboratory.accreditationValidUntil || '—'}</dd></div>
        </dl>
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setApproveOpen(false)}>Отменить</Button>
          <Button type="button" disabled={busy} onClick={async () => { if (await run(() => protocolService.approveProtocol(protocol.id), 'Протокол утверждён')) setApproveOpen(false); }}>Утвердить</Button>
        </div>
      </Modal>
      <Modal open={conflictOpen} onClose={() => setConflictOpen(false)} title="Протокол был изменён другим сотрудником">
        <p className="text-sm text-slate-600">Текущие локальные изменения не отправлены повторно. Обновите данные, чтобы продолжить с последней версией протокола.</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setConflictOpen(false)}>Отменить</Button>
          <Button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!protocolId) return;
              setBusy(true);
              try {
                applyServerProtocol(await protocolService.getProtocol(protocolId));
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
      <SignProtocolModal open={signOpen} loading={busy} protocol={protocol} onClose={() => setSignOpen(false)} onConfirm={signCurrentProtocol} />
      <ReplaceProtocolModal
        open={replaceOpen}
        loading={busy}
        onClose={() => setReplaceOpen(false)}
        onConfirm={async (reason) => {
          setBusy(true);
          try {
            const replacement = await protocolService.createCorrection(protocol.id, reason);
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
        open={returnOpen}
        loading={busy}
        onClose={() => setReturnOpen(false)}
        onConfirm={async (reason) => {
          if (await run(() => protocolService.returnForRevision(protocol.id, reason), 'Протокол возвращён на доработку')) setReturnOpen(false);
        }}
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
