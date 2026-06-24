import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, History, Plus, RotateCw, Search, Trash2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
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
import { getApiStatus } from '../services/apiHelpers';
import { signBase64WithNCALayer } from '../services/ncalayer';
import protocolService, { useProtocolMocks } from '../services/protocolService';
import type { MeasurementDevice, Protocol, ProtocolCompanySnapshot, ProtocolMeasurementDevice } from '../types/protocols';

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
      <h2 className="text-lg font-bold text-slate-900">Средства измерений</h2>
      <Button type="button" variant="secondary" disabled={readOnly} onClick={onAdd}><Plus className="h-4 w-4" /> Добавить средство измерения</Button>
    </div>
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
    {devices.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">Средства измерений не добавлены.</p>}
  </section>
);

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
  const [activeTab, setActiveTab] = useState('general');
  const savedSignatureRef = useRef('');
  const autoPreviewRef = useRef(false);

  const readOnly = useMemo(() => !protocol || protocol.status !== 'DRAFT', [protocol]);
  const dirty = useMemo(() => Boolean(protocol && savedSignatureRef.current && editableSignature(protocol) !== savedSignatureRef.current), [protocol]);
  const canApprove = useProtocolMocks || user?.role === 'ADMIN' || user?.role === 'DIRECTOR' || user?.role === 'HEAD';
  const tabs = [
    { id: 'general', label: 'Общие данные' },
    { id: 'organization', label: 'Организация' },
    { id: 'laboratory', label: 'Лаборатория' },
    { id: 'environment', label: 'Условия среды' },
    { id: 'results', label: 'Результаты' },
    { id: 'devices', label: 'Приборы' },
    { id: 'note', label: 'Пояснительная записка' },
    { id: 'history', label: 'История' },
  ];

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
    setBusy(true);
    try {
      const updated = await protocolService.updateProtocol(protocol.id, {
        number: protocol.protocolNumber || protocol.number || '',
        protocolDate: protocol.protocolDate || '',
        formCode: protocol.formCode,
        application: protocol.application,
        executor: protocol.executor || '',
        approver: protocol.approver || '',
        laboratory: protocol.laboratory,
        organization: protocol.organization,
        testing: protocol.testing,
        environment: protocol.environment,
        explanatoryNote: protocol.explanatoryNote,
      });
      applyServerProtocol(updated);
      toast.success('Протокол сохранен');
      return updated;
    } catch (saveError) {
      toast.error('Не удалось сохранить протокол', saveError instanceof Error ? saveError.message : undefined);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const checkSavedNormatives = async () => {
    if (!protocol) return;
    if (dirty) {
      toast.info('Сначала сохраняю локальные изменения, затем проверяю нормативы.');
      const saved = await save();
      if (!saved) return;
    }
    await run(() => protocolService.checkNormatives(protocol.id), 'Нормативы проверены');
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
    if (!protocol || !window.confirm('Удалить прибор из протокола?')) return;
    setBusy(true);
    try {
      const updated = await protocolService.removeProtocolMeasurementDevice(protocol.id, deviceId);
      applyServerProtocol(updated);
      toast.success('Средство измерения удалено');
    } catch (removeError) {
      toast.error('Не удалось удалить средство измерения', removeError instanceof Error ? removeError.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const signCurrentProtocol = async () => {
    if (!protocol || busy) return;
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
        <Button type="button" variant="secondary" onClick={load}><RotateCw className="h-4 w-4" /> Обновить</Button>
      </div>

      {protocol.status === 'SIGNED' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Протокол подписан. Редактирование закрыто, доступны скачивание PDF/DOCX и исправленная версия.
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${activeTab === tab.id ? 'bg-eco-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'general' && <div className="space-y-6">
        <ProtocolGeneralForm protocol={protocol} readOnly={readOnly || protocol.status === 'APPROVED'} onChange={patchProtocol} />
        <ProtocolTestingForm templateId={protocol.templateId} value={protocol.testing} readOnly={readOnly} onChange={(testing) => patchProtocol({ testing })} />
      </div>}
      {activeTab === 'organization' && <div className="space-y-6">
        <SnapshotSection snapshot={protocol.companySnapshot} />
        <ProtocolOrganizationForm value={protocol.organization} readOnly={readOnly} onChange={(organization) => patchProtocol({ organization })} />
      </div>}
      {activeTab === 'laboratory' && <ProtocolLaboratoryForm value={protocol.laboratory} readOnly={readOnly} onChange={(laboratory) => patchProtocol({ laboratory })} />}
      {activeTab === 'environment' && <ProtocolEnvironmentForm value={protocol.environment || {}} readOnly={readOnly} onChange={(environment) => patchProtocol({ environment })} />}
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
    </div>
  );
};

export default ProtocolEditorPage;
