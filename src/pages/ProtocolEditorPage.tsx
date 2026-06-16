import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, FlaskConical, History, Plus, RotateCw, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ProtocolActionsBar from '../components/protocols/ProtocolActionsBar';
import ProtocolGeneralForm from '../components/protocols/ProtocolGeneralForm';
import ProtocolLaboratoryForm from '../components/protocols/ProtocolLaboratoryForm';
import ProtocolOrganizationForm from '../components/protocols/ProtocolOrganizationForm';
import ProtocolPreviewModal from '../components/protocols/ProtocolPreviewModal';
import ProtocolResultsTable from '../components/protocols/ProtocolResultsTable';
import ProtocolTestingForm from '../components/protocols/ProtocolTestingForm';
import ReplaceProtocolModal from '../components/protocols/ReplaceProtocolModal';
import SignProtocolModal from '../components/protocols/SignProtocolModal';
import { templateName } from '../data/protocolTemplates';
import { useToast } from '../hooks/useToast';
import { getAvailableMeasurementDevices } from '../services/measurementDeviceService';
import {
  addProtocolMeasurementDevice,
  approveProtocol,
  checkNormatives,
  deleteProtocol,
  downloadDocx,
  downloadPdf,
  generateDocx,
  generatePdf,
  getProtocol,
  previewProtocol,
  readyForApproval,
  replaceProtocol,
  returnToDraft,
  signProtocol,
  updateProtocol,
} from '../services/protocolService';
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
  onSelect: (deviceId: string) => void | Promise<void>;
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
              disabled={loading || device.status === 'ARCHIVED'}
              onClick={() => onSelect(device.id)}
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
              {device.status === 'EXPIRED' && <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">Поверка истекла. Использовать прибор рискованно.</p>}
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
}: {
  devices: ProtocolMeasurementDevice[];
  readOnly: boolean;
  onAdd: () => void;
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
  const toast = useToast();
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

  const readOnly = useMemo(() => !protocol || protocol.status !== 'DRAFT', [protocol]);

  const load = async () => {
    if (!protocolId) return;
    setLoading(true);
    setError('');
    try {
      const item = await getProtocol(protocolId);
      setProtocol({
        ...item,
        laboratory: item.laboratory || emptyLaboratory,
        organization: item.organization || emptyOrganization,
        testing: item.testing || emptyTesting,
        results: item.results || [],
        measurementDevices: item.measurementDevices || [],
        history: item.history || [],
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить протокол');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [protocolId]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const patchProtocol = (patch: Partial<Protocol>) => {
    if (!protocol) return;
    setProtocol({ ...protocol, ...patch });
  };

  const notify = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => toast[type](message);

  const save = async () => {
    if (!protocol) return;
    if (protocol.status === 'SIGNED') {
      toast.warning('Нельзя редактировать подписанный протокол');
      return;
    }
    setBusy(true);
    try {
      const updated = await updateProtocol(protocol.id, {
        protocolNumber: protocol.protocolNumber,
        number: protocol.number,
        protocolDate: protocol.protocolDate,
        samplingDate: protocol.samplingDate,
        testingStartDate: protocol.testingStartDate,
        testingEndDate: protocol.testingEndDate,
        purpose: protocol.purpose,
        environmentalConditions: protocol.environmentalConditions,
        executor: protocol.executor,
        approver: protocol.approver,
        laboratory: protocol.laboratory,
        organization: protocol.organization,
        testing: protocol.testing,
        results: protocol.results,
      });
      setProtocol(updated);
      toast.success('Протокол сохранен');
    } catch (saveError) {
      toast.error('Не удалось сохранить протокол', saveError instanceof Error ? saveError.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: () => Promise<Protocol>, success: string) => {
    setBusy(true);
    try {
      const updated = await action();
      setProtocol(updated);
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
      const blob = await previewProtocol(protocol.id);
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
      let blob: Blob;
      try {
        blob = kind === 'pdf' ? await downloadPdf(protocol.id) : await downloadDocx(protocol.id);
      } catch {
        const generated = kind === 'pdf' ? await generatePdf(protocol.id) : await generateDocx(protocol.id);
        setProtocol(generated);
        blob = kind === 'pdf' ? await downloadPdf(protocol.id) : await downloadDocx(protocol.id);
      }
      saveBlob(blob, fileName(protocol, kind));
    } catch (downloadError) {
      toast.error('Не удалось скачать файл', downloadError instanceof Error ? downloadError.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const addDevice = async (deviceId: string) => {
    if (!protocol) return;
    setBusy(true);
    try {
      const updated = await addProtocolMeasurementDevice(protocol.id, deviceId);
      setProtocol(updated);
      setDevicePickerOpen(false);
      toast.success('Средство измерения добавлено');
    } catch (addError) {
      toast.error('Не удалось добавить средство измерения', addError instanceof Error ? addError.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">Загрузка протокола...</div>;
  if (error || !protocol) {
    return (
      <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="font-bold">{error || 'Протокол не найден'}</p>
        <Button type="button" variant="secondary" onClick={() => navigate('/staff/protocols')}>Вернуться к списку</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button type="button" onClick={() => navigate('/staff/protocols')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-eco-700 hover:text-eco-900">
            <ArrowLeft className="h-4 w-4" /> К протоколам
          </button>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">{templateName(protocol.templateId, protocol.templateName)}</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{protocol.protocolNumber || protocol.number || 'Новый протокол'}</h1>
        </div>
        <Button type="button" variant="secondary" onClick={load}><RotateCw className="h-4 w-4" /> Обновить</Button>
      </div>

      {protocol.status === 'SIGNED' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Протокол подписан. Редактирование закрыто, доступны скачивание PDF/DOCX и исправленная версия.
        </div>
      )}

      <ProtocolGeneralForm protocol={protocol} readOnly={readOnly || protocol.status === 'APPROVED'} onChange={patchProtocol} />
      <SnapshotSection snapshot={protocol.companySnapshot} />
      <ProtocolLaboratoryForm value={protocol.laboratory} readOnly={readOnly} onChange={(laboratory) => patchProtocol({ laboratory })} />
      <ProtocolOrganizationForm value={protocol.organization} readOnly={readOnly} onChange={(organization) => patchProtocol({ organization })} />
      <ProtocolTestingForm templateId={protocol.templateId} value={protocol.testing} readOnly={readOnly} onChange={(testing) => patchProtocol({ testing })} />
      <ProtocolResultsTable
        protocolId={protocol.id}
        templateId={protocol.templateId}
        rows={protocol.results}
        readOnly={readOnly}
        onChange={(results) => patchProtocol({ results })}
        onSave={save}
        onCheckNormatives={() => run(() => checkNormatives(protocol.id), 'Нормативы проверены')}
        onImported={load}
        onNotify={notify}
      />
      <MeasurementDevicesSection devices={protocol.measurementDevices || []} readOnly={readOnly} onAdd={() => setDevicePickerOpen(true)} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><FlaskConical className="h-5 w-5 text-eco-700" /> Генерация и подписание</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={preview}>Предпросмотр</Button>
          <Button type="button" variant="secondary" disabled={busy || protocol.status === 'DRAFT' || protocol.status === 'READY_FOR_APPROVAL'} onClick={() => run(() => generatePdf(protocol.id), 'PDF сформирован')}>Сформировать PDF</Button>
          <Button type="button" variant="secondary" disabled={busy || protocol.status === 'DRAFT' || protocol.status === 'READY_FOR_APPROVAL'} onClick={() => run(() => generateDocx(protocol.id), 'DOCX сформирован')}>Сформировать DOCX</Button>
          <Button type="button" variant="secondary" disabled={busy || protocol.status === 'DRAFT' || protocol.status === 'READY_FOR_APPROVAL'} onClick={() => generateAndDownload('pdf')}><Download className="h-4 w-4" /> Скачать PDF</Button>
          <Button type="button" variant="secondary" disabled={busy || protocol.status === 'DRAFT' || protocol.status === 'READY_FOR_APPROVAL'} onClick={() => generateAndDownload('docx')}><Download className="h-4 w-4" /> Скачать DOCX</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
      </section>

      <ProtocolActionsBar
        status={protocol.status}
        busy={busy}
        onSave={save}
        onPreview={preview}
        onCheckNormatives={() => run(() => checkNormatives(protocol.id), 'Нормативы проверены')}
        onReady={() => run(() => readyForApproval(protocol.id), 'Протокол готов к утверждению')}
        onDelete={async () => {
          if (!window.confirm('Удалить черновик протокола?')) return;
          await deleteProtocol(protocol.id);
          toast.success('Протокол удален');
          navigate('/staff/protocols');
          return;
        }}
        onApprove={() => run(() => approveProtocol(protocol.id), 'Протокол утвержден')}
        onReturnDraft={() => run(() => returnToDraft(protocol.id), 'Протокол возвращен в черновик')}
        onGeneratePdf={() => run(() => generatePdf(protocol.id), 'PDF сформирован')}
        onGenerateDocx={() => run(() => generateDocx(protocol.id), 'DOCX сформирован')}
        onSign={() => setSignOpen(true)}
        onDownloadPdf={() => generateAndDownload('pdf')}
        onDownloadDocx={() => generateAndDownload('docx')}
        onReplace={() => setReplaceOpen(true)}
        onOpenReplacement={protocol.replacedByProtocolId ? () => navigate(`/staff/protocols/${protocol.replacedByProtocolId}`) : undefined}
      />

      <ProtocolPreviewModal open={previewOpen} loading={previewLoading} previewUrl={previewUrl} draft={protocol.status !== 'APPROVED' && protocol.status !== 'SIGNED'} onClose={() => setPreviewOpen(false)} />
      <SignProtocolModal open={signOpen} loading={busy} onClose={() => setSignOpen(false)} onConfirm={async () => { await run(() => signProtocol(protocol.id), 'Протокол подписан'); setSignOpen(false); return; }} />
      <ReplaceProtocolModal
        open={replaceOpen}
        loading={busy}
        onClose={() => setReplaceOpen(false)}
        onConfirm={async (reason) => {
          setBusy(true);
          try {
            const replacement = await replaceProtocol(protocol.id, reason);
            toast.success('Создана исправленная версия');
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
