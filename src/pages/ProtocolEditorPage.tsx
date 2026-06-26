import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ClipboardCheck, Eye, FileCheck2, History, MoreHorizontal, Plus, RotateCw, Save, Search, SearchCheck, Trash2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/modals/ConfirmModal';
import ProtocolActionsBar from '../components/protocols/ProtocolActionsBar';
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
import SignProtocolModal from '../components/protocols/SignProtocolModal';
import { templateName } from '../data/protocolTemplates';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { getMeasurementDevices } from '../services/measurementDeviceService';
import { getCompanyObjects } from '../services/companyService';
import { accreditationState, getLaboratoryEmployees } from '../services/laboratorySettingsService';
import { getApiStatus } from '../services/apiHelpers';
import { signBase64WithNCALayer } from '../services/ncalayer';
import protocolService, { useProtocolMocks } from '../services/protocolService';
import type { CompanyObject } from '../types/companies';
import type { LaboratoryEmployee, MeasurementDevice, Protocol, ProtocolCompanySnapshot, ProtocolMeasurementDevice, WeatherConditions } from '../types/protocols';

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
  executor: protocol.executor || '',
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
  EXPIRING: 'bg-amber-50 text-amber-800 ring-amber-200',
  EXPIRED: 'bg-rose-50 text-rose-800 ring-rose-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const statusLabels = {
  VALID: 'Поверка действует',
  EXPIRING: 'Скоро истекает',
  EXPIRED: 'Поверка истекла',
  ARCHIVED: 'Архив',
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

const hasText = (value?: string | number | null) => value !== undefined && value !== null && String(value).trim() !== '';
const hasEnvironment = (protocol: Protocol) =>
  ['temperature', 'humidity', 'pressureKpa', 'windSpeed'].every((key) => hasText(protocol.environment?.[key as keyof NonNullable<Protocol['environment']>]));
const hasLaboratory = (protocol: Protocol) =>
  Boolean(protocol.laboratory?.laboratoryName && protocol.laboratory?.laboratoryAddress && protocol.laboratory?.accreditationNumber && protocol.laboratory?.laboratoryHead && (protocol.executor || protocol.laboratory.executor));
const hasCheckedResults = (protocol: Protocol) =>
  protocol.results.length > 0 && protocol.results.every((row) => {
    const status = row.internalStatus || row.checkStatus;
    return status && !['EMPTY_RESULT', 'NEEDS_REVIEW', 'NORMATIVE_NOT_FOUND'].includes(status);
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
  onClose,
  onSelect,
}: {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSelect: (device: MeasurementDevice) => void | Promise<void>;
}) => {
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    getMeasurementDevices()
      .then(setDevices)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить средства измерений'));
  }, [open]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return devices;
    return devices.filter((device) => `${device.name} ${device.model} ${device.serialNumber}`.toLowerCase().includes(value));
  }, [devices, query]);

  return (
    <Modal open={open} onClose={onClose} title="Добавить средство измерения" size="xl">
      <div className="space-y-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию, модели, заводскому номеру" className={`${inputClass} pl-10`} />
        </label>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</div>}
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {filtered.map((device) => (
            <button
              key={device.id}
              type="button"
              disabled={loading || !['VALID', 'EXPIRING'].includes(device.status)}
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
          ))}
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

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

const ProtocolStepFooter = ({
  protocol,
  activeStep,
  busy,
  readOnly,
  canApprove,
  saveStatus,
  missingFields,
  onPrevious,
  onNext,
  onSave,
  onCalculate,
  onPreview,
  onReady,
  onApprove,
  onReturnDraft,
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
  canApprove: boolean;
  saveStatus: SaveStatus;
  missingFields: MissingField[];
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void | Promise<void>;
  onCalculate: () => void | Promise<void>;
  onPreview: () => void | Promise<void>;
  onReady: () => void | Promise<void>;
  onApprove: () => void | Promise<void>;
  onReturnDraft: () => void | Promise<void>;
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
  }[saveStatus];

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:-mx-8 sm:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className={`text-sm font-semibold ${saveStatus === 'error' ? 'text-rose-700' : saveStatus === 'dirty' ? 'text-amber-700' : 'text-slate-500'}`}>{saveText}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {protocol.status === 'DRAFT' && (
            <>
              {activeIndex > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={onPrevious}><ChevronLeft className="h-4 w-4" /> Назад</Button>}
              {activeStep !== 'review' && <Button type="button" variant="secondary" disabled={busy || readOnly} onClick={onSave}><Save className="h-4 w-4" /> Сохранить черновик</Button>}
              {activeStep === 'results' && <Button type="button" variant="secondary" disabled={busy} onClick={onCalculate}><SearchCheck className="h-4 w-4" /> Рассчитать и проверить</Button>}
              {activeStep !== 'review' && <Button type="button" variant={activeStep === 'results' ? 'secondary' : 'primary'} disabled={busy} onClick={onNext}>Далее <ArrowRight className="h-4 w-4" /></Button>}
              {activeStep === 'review' && (
                <>
                  <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={onGenerateDocx}><FileCheck2 className="h-4 w-4" /> Сформировать документ</Button>
                  <Button type="button" disabled={busy || missingFields.length > 0} onClick={onReady}><CheckCircle2 className="h-4 w-4" /> Отправить на утверждение</Button>
                </>
              )}
            </>
          )}
          {protocol.status === 'READY_FOR_APPROVAL' && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
              {canApprove && <Button type="button" variant="secondary" disabled={busy} onClick={onReturnDraft}>Вернуть в черновик</Button>}
              {canApprove && <Button type="button" disabled={busy} onClick={onApprove}><CheckCircle2 className="h-4 w-4" /> Утвердить</Button>}
            </>
          )}
          {protocol.status === 'APPROVED' && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={onGenerateDocx}>DOCX</Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={onGeneratePdf}>PDF</Button>
              <Button type="button" disabled={busy} onClick={onSign}>Подписать</Button>
            </>
          )}
          {protocol.status === 'SIGNED' && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onPreview}><Eye className="h-4 w-4" /> Посмотреть документ</Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadDocx}>Скачать DOCX</Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadPdf}>Скачать PDF</Button>
              <Button type="button" disabled={busy} onClick={onReplace}>Создать исправленную версию</Button>
            </>
          )}
          {protocol.status === 'REPLACED' && (
            <>
              <Button type="button" variant="secondary" disabled={busy} onClick={onDownloadPdf}>Скачать архивный PDF</Button>
              {onOpenReplacement && <Button type="button" onClick={onOpenReplacement}>Открыть новую версию</Button>}
            </>
          )}
          {protocol.status === 'CANCELLED' && <span className="text-sm font-semibold text-slate-500">Протокол аннулирован. Доступен только просмотр.</span>}
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
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [laboratoryEmployees, setLaboratoryEmployees] = useState<LaboratoryEmployee[]>([]);
  const [companyObjects, setCompanyObjects] = useState<CompanyObject[]>([]);
  const [refreshLaboratoryOpen, setRefreshLaboratoryOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<ProtocolStepKey>('general');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteProtocolOpen, setDeleteProtocolOpen] = useState(false);
  const [deviceToRemove, setDeviceToRemove] = useState<string | null>(null);
  const savedSignatureRef = useRef('');
  const autoPreviewRef = useRef(false);

  const readOnly = useMemo(() => !protocol || protocol.status !== 'DRAFT', [protocol]);
  const dirty = useMemo(() => Boolean(protocol && savedSignatureRef.current && editableSignature(protocol) !== savedSignatureRef.current), [protocol]);
  const canApprove = useProtocolMocks || user?.role === 'ADMIN' || user?.role === 'DIRECTOR' || user?.role === 'HEAD';
  const activeTab: string = '__hidden';
  const setActiveTab = (_id: string) => undefined;
  const canUseAdvanced = false;
  const tabs: Array<{ id: string; label: string }> = [];

  const applyServerProtocol = (item: Protocol) => {
    const normalized = {
      ...item,
      laboratory: item.laboratory || emptyLaboratory,
      organization: item.organization || emptyOrganization,
      testing: item.testing || emptyTesting,
      results: item.results || [],
      measurementDevices: item.measurementDevices || [],
      history: item.history || [],
      environment: item.environment || {},
      explanatoryNote: item.explanatoryNote || '',
    };
    savedSignatureRef.current = editableSignature(normalized);
    setSaveStatus('saved');
    setProtocol(normalized);
    return normalized;
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
      .then((items) => setCompanyObjects(items.filter((item) => item.status === 'ACTIVE')))
      .catch(() => undefined);
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
    setProtocol((current) => current ? { ...current, ...patch } : current);
  };

  const navigateSafely = (to: string) => {
    if (dirty && !window.confirm('Есть несохранённые изменения. Уйти со страницы без сохранения?')) return;
    navigate(to);
  };

  const notify = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => toast[type](message);

  const save = async (): Promise<Protocol | null> => {
    if (!protocol) return null;
    if (protocol.status === 'SIGNED') {
      toast.warning('Нельзя редактировать подписанный протокол');
      return null;
    }
    if (protocol.testing.samplingDate && protocol.testing.testingStartDate && protocol.testing.samplingDate > protocol.testing.testingStartDate) {
      toast.warning('Дата отбора не может быть позже начала испытаний.');
      return null;
    }
    if (protocol.testing.testingStartDate && protocol.testing.testingEndDate && protocol.testing.testingStartDate > protocol.testing.testingEndDate) {
      toast.warning('Дата начала испытаний не может быть позже окончания.');
      return null;
    }
    setSaveStatus('saving');
    setBusy(true);
    try {
      const updated = await protocolService.updateProtocol(protocol.id, {
        number: protocol.protocolNumber || protocol.number || '',
        protocolDate: protocol.protocolDate || '',
        objectId: protocol.objectId,
        measurementDate: protocol.measurementDate || protocol.testing.samplingDate || protocol.protocolDate,
        measurementTime: protocol.measurementTime,
        measurementPlace: protocol.measurementPlace,
        formCode: protocol.formCode,
        application: protocol.application,
        executor: protocol.executor || '',
        executorId: protocol.executorId,
        approver: protocol.approver || '',
        laboratory: protocol.laboratory,
        organization: protocol.organization,
        testing: protocol.testing,
        environment: protocol.environment,
        explanatoryNote: protocol.explanatoryNote,
      });
      applyServerProtocol(updated);
      setSaveStatus('saved');
      toast.success('Протокол сохранен');
      return updated;
    } catch (saveError) {
      setSaveStatus('error');
      toast.error('Не удалось сохранить протокол', saveError instanceof Error ? saveError.message : undefined);
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!dirty || readOnly || busy) return;
    const timer = window.setTimeout(() => {
      save().catch(() => undefined);
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
    await run(() => protocolService.calculateProtocol(protocol.id), 'Расчёт выполнен backend');
  };

  const calculateProtocolResults = async () => {
    if (!protocol) return;
    if (dirty) {
      toast.info('Сначала сохраняю черновик, затем запускаю расчет.');
      const saved = await save();
      if (!saved) return;
    }
    setBusy(true);
    try {
      await protocolService.calculateProtocolSummary(protocol.id);
      const updated = await protocolService.getProtocol(protocol.id);
      applyServerProtocol(updated);
      toast.success('Результаты рассчитаны');
    } catch {
      toast.warning('Новый расчет недоступен, запускаю старую проверку нормативов');
      setBusy(false);
      await checkSavedNormatives();
      return;
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
        date: selection.date,
        time: selection.time,
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
      measurementTime: selection.time,
      measurementPlace: object?.name || protocol.measurementPlace,
      testing: {
        ...protocol.testing,
        samplingDate: selection.date,
      },
    });
  };

  const run = async (action: () => Promise<Protocol>, success: string) => {
    setBusy(true);
    try {
      const updated = await action();
      applyServerProtocol(updated);
      toast.success(success);
    } catch (actionError) {
      toast.error('Действие не выполнено', actionError instanceof Error ? actionError.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    if (!protocol) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const blob = await protocolService.previewProtocol(protocol.id);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (previewError) {
      toast.error('Не удалось открыть предпросмотр', previewError instanceof Error ? previewError.message : undefined);
      setPreviewUrl('');
    } finally {
      setPreviewLoading(false);
    }
  };

  const generateAndDownload = async (kind: 'pdf' | 'docx') => {
    if (!protocol) return;
    setBusy(true);
    try {
      const generated = kind === 'pdf' ? await protocolService.generatePdf(protocol.id) : await protocolService.generateDocx(protocol.id);
      applyServerProtocol(generated);
      const downloaded = kind === 'pdf' ? await protocolService.downloadPdf(protocol.id) : await protocolService.downloadDocx(protocol.id);
      if (!downloaded?.blob.size) throw new Error('Backend вернул пустой файл.');
      saveBlob(downloaded.blob, downloaded.fileName || fileName(protocol, kind));
    } catch (downloadError) {
      toast.error('Не удалось скачать файл', downloadError instanceof Error ? downloadError.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const generateDocuments = async () => {
    if (!protocol) return;
    setBusy(true);
    try {
      const docx = await protocolService.generateDocx(protocol.id);
      applyServerProtocol(docx);
      const pdf = await protocolService.generatePdf(protocol.id);
      applyServerProtocol(pdf);
      toast.success('Документы сформированы');
    } catch (generateError) {
      toast.error('Не удалось сформировать документы', generateError instanceof Error ? generateError.message : undefined);
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

  const deleteDraftProtocol = async () => {
    if (!protocol) return;
    setBusy(true);
    try {
      await protocolService.deleteProtocol(protocol.id);
      savedSignatureRef.current = '';
      toast.success('Протокол удален');
      navigate('/staff/protocols');
    } catch (deleteError) {
      toast.error('Не удалось удалить протокол', deleteError instanceof Error ? deleteError.message : undefined);
    } finally {
      setBusy(false);
      setDeleteProtocolOpen(false);
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
      if (useProtocolMocks) {
        const updated = await protocolService.signProtocol(protocol.id, 'mock-signature');
        applyServerProtocol(updated);
        setSignOpen(false);
        toast.success('Протокол подписан в демонстрационном режиме');
        return;
      }
      let document;
      try {
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
      const updated = await protocolService.signProtocol(protocol.id, signedCms);
      applyServerProtocol(updated);
      setSignOpen(false);
      toast.success('Протокол подписан');
    } catch (signError) {
      toast.error('Не удалось подписать протокол', signError instanceof Error ? signError.message : undefined);
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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button type="button" onClick={() => navigateSafely('/staff/protocols')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-eco-700 hover:text-eco-900">
            <ArrowLeft className="h-4 w-4" /> К протоколам
          </button>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">{templateName(protocol.templateId, protocol.templateName)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProtocolStatusBadge status={protocol.status} />
            <NormativeStatusBadge status={protocol.complianceResult as any} />
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{protocol.protocolNumber || protocol.number || 'Новый протокол'}</h1>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={load}><RotateCw className="h-4 w-4" /> Обновить</Button>
          <Button type="button" variant="secondary" onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal className="h-4 w-4" /> Еще</Button>
          {moreOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl">
              <button type="button" className="w-full rounded-lg px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50" onClick={() => { setMoreOpen(false); void load(); }}>Обновить данные</button>
              {protocol.status === 'DRAFT' && <button type="button" className="w-full rounded-lg px-3 py-2 text-left font-semibold text-rose-700 hover:bg-rose-50" onClick={() => { setMoreOpen(false); setDeleteProtocolOpen(true); }}>Удалить черновик</button>}
              {protocol.status !== 'SIGNED' && protocol.status !== 'CANCELLED' && <button type="button" className="w-full rounded-lg px-3 py-2 text-left font-semibold text-rose-700 hover:bg-rose-50" onClick={async () => {
                setMoreOpen(false);
                if (!window.confirm('Отменить протокол? После отмены редактирование будет недоступно.')) return;
                await run(() => protocolService.cancelProtocol(protocol.id), 'Протокол отменен');
              }}>Отменить протокол</button>}
            </div>
          )}
        </div>
      </div>

      {protocol.status === 'SIGNED' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Протокол подписан. Редактирование закрыто, доступны скачивание PDF/DOCX и исправленная версия.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Заполните протокол по шагам</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Заполните данные по шагам. Система сохранит черновик, проверит нормативы и подготовит протокол к утверждению.
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

      <ProtocolStepWizard activeStep={activeStep} protocol={protocol} onSelect={setActiveStep} />

      {activeStep === 'general' && <div className="space-y-6">
        <ProtocolGeneralForm protocol={protocol} readOnly={readOnly || protocol.status === 'APPROVED'} onChange={patchProtocol} />
        <ProtocolTestingForm
          templateId={protocol.templateId}
          value={protocol.testing}
          measurementDate={protocol.measurementDate || protocol.testing.samplingDate}
          readOnly={readOnly}
          onMeasurementDateChange={(measurementDate) => patchProtocol({ measurementDate })}
          onChange={(testing) => patchProtocol({ testing })}
        />
        <ProtocolLaboratoryForm
          value={protocol.laboratory}
          employees={laboratoryEmployees}
          readOnly={readOnly}
          loading={busy}
          canOpenSettings={user?.role === 'ADMIN'}
          onExecutorChange={(employee) => patchProtocol({
            executorId: employee.userId || employee.id,
            executor: employee.fullName,
            laboratory: {
              ...protocol.laboratory,
              executorId: employee.userId || employee.id,
              executor: employee.fullName,
            },
          })}
          onRefresh={protocol.status === 'DRAFT' ? () => setRefreshLaboratoryOpen(true) : undefined}
        />
      </div>}

      {activeStep === 'organization' && <div className="space-y-6">
        <SnapshotSection snapshot={protocol.companySnapshot} />
        <ProtocolOrganizationForm value={protocol.organization} readOnly={readOnly} onChange={(organization) => patchProtocol({ organization })} />
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
      />}

      {activeStep === 'results' && <ProtocolResultsTable
        protocolId={protocol.id}
        templateId={protocol.templateId}
        subtype={protocol.subtype}
        rows={protocol.results}
        devices={protocol.measurementDevices}
        readOnly={readOnly}
        busy={busy}
        testingDate={protocol.testing.testingEndDate || protocol.testing.testingDate || protocol.protocolDate}
        onChange={(results) => patchProtocol({ results })}
        onCheckNormatives={checkSavedNormatives}
        onImported={load}
        onNotify={notify}
      />}

      {activeStep === 'instruments' && <MeasurementDevicesSection devices={protocol.measurementDevices || []} readOnly={readOnly || busy} onAdd={() => setDevicePickerOpen(true)} onRemove={(deviceId) => setDeviceToRemove(deviceId)} />}

      {activeStep === 'review' && <div className="space-y-6">
        <ProtocolExplanatoryNoteForm
          value={protocol.explanatoryNote || ''}
          readOnly={readOnly}
          onChange={(explanatoryNote) => patchProtocol({ explanatoryNote })}
          onGenerate={() => patchProtocol({ explanatoryNote: generatedExplanation })}
        />
        <ReviewChecklist protocol={protocol} missingFields={missingFields} onGoToStep={setActiveStep} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><History className="h-5 w-5 text-eco-700" /> История действий</h2>
          <div className="space-y-3">
            {protocol.history?.length ? protocol.history.slice(0, 5).map((item) => (
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
        canApprove={canApprove}
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
          return run(() => protocolService.readyForApproval(protocol.id), 'Протокол отправлен на утверждение');
        }}
        onApprove={() => run(() => protocolService.approveProtocol(protocol.id), 'Протокол утвержден')}
        onReturnDraft={() => run(() => protocolService.returnToDraft(protocol.id), 'Протокол возвращен в черновик')}
        onGenerateDocx={generateDocuments}
        onGeneratePdf={generateDocuments}
        onSign={() => setSignOpen(true)}
        onDownloadDocx={() => generateAndDownload('docx')}
        onDownloadPdf={() => generateAndDownload('pdf')}
        onReplace={() => setReplaceOpen(true)}
        onOpenReplacement={protocol.replacedByProtocolId ? () => navigateSafely(`/staff/protocols/${protocol.replacedByProtocolId}`) : undefined}
      />

      <div className="hidden">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {tabs.filter((tab) => canUseAdvanced || ['quick', 'history'].includes(tab.id)).map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${activeTab === tab.id ? 'bg-eco-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'quick' && <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Тип протокола', templateName(protocol.templateId, protocol.templateName)],
              ['Компания', protocol.companySnapshot.companyName],
              ['Объект', protocol.companySnapshot.objectName],
              ['Дата', protocol.measurementDate || protocol.testing.samplingDate || protocol.protocolDate],
              ['Время', protocol.measurementTime || '—'],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 font-bold text-slate-800">{value || '—'}</dd></div>)}
          </dl>
        </section>
        <ProtocolEnvironmentForm
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
        />
        <ProtocolResultsTable
          protocolId={protocol.id}
          templateId={protocol.templateId}
          subtype={protocol.subtype}
          rows={protocol.results}
          devices={protocol.measurementDevices}
          readOnly={readOnly}
          busy={busy}
          testingDate={protocol.testing.testingEndDate || protocol.testing.testingDate || protocol.protocolDate}
          onChange={(results) => patchProtocol({ results })}
          onCheckNormatives={checkSavedNormatives}
          onImported={load}
          onNotify={notify}
        />
      </div>}

      {activeTab === 'general' && <div className="space-y-6">
        <ProtocolGeneralForm protocol={protocol} readOnly={readOnly || protocol.status === 'APPROVED'} onChange={patchProtocol} />
        <ProtocolTestingForm
          templateId={protocol.templateId}
          value={protocol.testing}
          measurementDate={protocol.measurementDate || protocol.testing.samplingDate}
          readOnly={readOnly}
          onMeasurementDateChange={(measurementDate) => patchProtocol({ measurementDate })}
          onChange={(testing) => patchProtocol({ testing })}
        />
      </div>}
      {activeTab === 'organization' && <div className="space-y-6">
        <SnapshotSection snapshot={protocol.companySnapshot} />
        <ProtocolOrganizationForm value={protocol.organization} readOnly={readOnly} onChange={(organization) => patchProtocol({ organization })} />
      </div>}
      {activeTab === 'laboratory' && <ProtocolLaboratoryForm
        value={protocol.laboratory}
        employees={laboratoryEmployees}
        readOnly={readOnly}
        loading={busy}
        canOpenSettings={user?.role === 'ADMIN'}
        onExecutorChange={(employee) => patchProtocol({
          executorId: employee.userId || employee.id,
          executor: employee.fullName,
          laboratory: {
            ...protocol.laboratory,
            executorId: employee.userId || employee.id,
            executor: employee.fullName,
          },
        })}
        onRefresh={protocol.status === 'DRAFT' ? () => setRefreshLaboratoryOpen(true) : undefined}
      />}
      {activeTab === 'environment' && <ProtocolEnvironmentForm
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
      />}
      {activeTab === 'results' && <ProtocolResultsTable
        protocolId={protocol.id}
        templateId={protocol.templateId}
        subtype={protocol.subtype}
        rows={protocol.results}
        devices={protocol.measurementDevices}
        readOnly={readOnly}
        busy={busy}
        testingDate={protocol.testing.testingEndDate || protocol.testing.testingDate || protocol.protocolDate}
        onChange={(results) => patchProtocol({ results })}
        onCheckNormatives={checkSavedNormatives}
        onImported={load}
        onNotify={notify}
      />}
      {activeTab === 'devices' && <MeasurementDevicesSection devices={protocol.measurementDevices || []} readOnly={readOnly || busy} onAdd={() => setDevicePickerOpen(true)} onRemove={removeDevice} />}
      {activeTab === 'note' && <ProtocolExplanatoryNoteForm
        value={protocol.explanatoryNote || ''}
        readOnly={readOnly}
        onChange={(explanatoryNote) => patchProtocol({ explanatoryNote })}
        onGenerate={() => patchProtocol({ explanatoryNote: protocol.templateId === 'industrial_emissions'
          ? `В рамках производственного экологического контроля проведены инструментальные замеры на источниках выбросов объекта «${protocol.companySnapshot.objectName}». В период обследования выполнены измерения параметров газовоздушной смеси и концентраций определяемых веществ. Работающие источники: ${Array.from(new Set(protocol.results.map((row) => String(row.values.sourceNumber || row.values.samplingPlace || '')).filter(Boolean))).join(', ') || 'не указаны'}. Неработавшие источники на момент обследования не выявлены. Определяемые вещества: ${Array.from(new Set(protocol.results.map((row) => String(row.values.indicator || '')).filter(Boolean))).join(', ') || 'не указаны'}. Использованные приборы: ${protocol.measurementDevices.map((item) => item.deviceSnapshot.name).join(', ') || 'не указаны'}. Измерения выполнены в соответствии с нормативными документами и областью аккредитации испытательной лаборатории.`
          : `Испытания проведены в соответствии с областью аккредитации лаборатории. Полученные результаты приведены в таблице протокола и относятся только к исследованным пробам и объектам.` })}
      />}

      {activeTab === 'history' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><History className="h-5 w-5 text-eco-700" /> История действий</h2>
        <div className="space-y-3">
          {protocol.history?.length ? protocol.history.map((item) => (
            <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-bold text-slate-900">{item.action}</p>
              <p className="mt-1 text-slate-500">{item.createdAt} · {item.actorName || 'Система'}</p>
              {item.comment && <p className="mt-2 text-slate-700">{item.comment}</p>}
            </div>
          )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">История действий пока пуста.</p>}
        </div>
      </section>}

      <ProtocolActionsBar
        status={protocol.status}
        busy={busy}
        canApprove={canApprove}
        onSave={async () => { await save(); }}
        onPreview={preview}
        onCheckNormatives={checkSavedNormatives}
        onReady={() => run(() => protocolService.readyForApproval(protocol.id), 'Протокол готов к утверждению')}
        onDelete={async () => {
          if (!window.confirm('Удалить черновик протокола?')) return;
          setBusy(true);
          try {
            await protocolService.deleteProtocol(protocol.id);
            savedSignatureRef.current = '';
            toast.success('Протокол удален');
            navigate('/staff/protocols');
          } catch (deleteError) {
            toast.error('Не удалось удалить протокол', deleteError instanceof Error ? deleteError.message : undefined);
          } finally {
            setBusy(false);
          }
        }}
        onApprove={() => run(() => protocolService.approveProtocol(protocol.id), 'Протокол утвержден')}
        onReturnDraft={() => run(() => protocolService.returnToDraft(protocol.id), 'Протокол возвращен в черновик')}
        onCancel={async () => {
          if (!window.confirm('Отменить протокол? После отмены редактирование будет недоступно.')) return;
          await run(() => protocolService.cancelProtocol(protocol.id), 'Протокол отменен');
        }}
        onGeneratePdf={() => run(() => protocolService.generatePdf(protocol.id), 'PDF сформирован')}
        onGenerateDocx={() => run(() => protocolService.generateDocx(protocol.id), 'DOCX сформирован')}
        onSign={() => setSignOpen(true)}
        onDownloadPdf={() => generateAndDownload('pdf')}
        onDownloadDocx={() => generateAndDownload('docx')}
        onReplace={() => setReplaceOpen(true)}
        onOpenReplacement={protocol.replacedByProtocolId ? () => navigateSafely(`/staff/protocols/${protocol.replacedByProtocolId}`) : undefined}
      />
      </div>

      <ProtocolPreviewModal open={previewOpen} loading={previewLoading} previewUrl={previewUrl} protocol={protocol} draft={protocol.status !== 'APPROVED' && protocol.status !== 'SIGNED'} onClose={() => setPreviewOpen(false)} />
      <SignProtocolModal open={signOpen} loading={busy} onClose={() => setSignOpen(false)} onConfirm={signCurrentProtocol} />
      <ReplaceProtocolModal
        open={replaceOpen}
        loading={busy}
        onClose={() => setReplaceOpen(false)}
        onConfirm={async (reason) => {
          setBusy(true);
          try {
            const replacement = await protocolService.replaceProtocol(protocol.id, reason);
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
      <DevicePickerModal open={devicePickerOpen} loading={busy} onClose={() => setDevicePickerOpen(false)} onSelect={addDevice} />
      <ConfirmModal
        isOpen={deleteProtocolOpen}
        title="Удалить протокол?"
        description={`Вы действительно хотите удалить протокол ${protocol.protocolNumber || protocol.number || protocol.id}? Это действие нельзя отменить.`}
        confirmText="Удалить протокол"
        variant="danger"
        loading={busy}
        onClose={() => setDeleteProtocolOpen(false)}
        onConfirm={deleteDraftProtocol}
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
      <ConfirmModal
        isOpen={refreshLaboratoryOpen}
        title="Обновить данные лаборатории?"
        description="Текущий snapshot черновика будет заменён актуальными данными из настроек лаборатории. Результаты и сведения заказчика не изменятся."
        confirmText="Обновить snapshot"
        loading={busy}
        onClose={() => setRefreshLaboratoryOpen(false)}
        onConfirm={async () => {
          await run(() => protocolService.refreshProtocolLaboratoryData(protocol.id), 'Данные лаборатории обновлены');
          setRefreshLaboratoryOpen(false);
        }}
      />
    </div>
  );
};

export default ProtocolEditorPage;
