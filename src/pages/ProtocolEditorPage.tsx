import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, FlaskConical, History, RotateCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
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
import {
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
  signProtocol,
  updateProtocol,
} from '../services/protocolService';
import type { MeasurementDevice, Protocol } from '../types/protocols';

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

const fileName = (protocol: Protocol, extension: string) => `${protocol.number || `protocol-${protocol.id}`}.${extension}`;

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

const InstrumentsSection = ({
  devices,
  readOnly,
  onChange,
}: {
  devices: MeasurementDevice[];
  readOnly: boolean;
  onChange: (devices: MeasurementDevice[]) => void;
}) => {
  const update = (index: number, field: keyof MeasurementDevice, value: string) => {
    onChange(devices.map((device, itemIndex) => itemIndex === index ? { ...device, [field]: value } : device));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Приборы</h2>
        <Button
          type="button"
          variant="secondary"
          disabled={readOnly}
          onClick={() => onChange([...devices, {
            id: `local-${Date.now()}`,
            name: '',
            model: '',
            serialNumber: '',
            verificationCertificateNumber: '',
            verificationDate: '',
            verificationValidUntil: '',
            units: '',
            status: 'VALID',
          }])}
        >
          Добавить прибор
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Название</th>
              <th className="px-3 py-3">Модель</th>
              <th className="px-3 py-3">Заводской номер</th>
              <th className="px-3 py-3">Свидетельство поверки</th>
              <th className="px-3 py-3">Дата поверки</th>
              <th className="px-3 py-3">Действует до</th>
              <th className="px-3 py-3">Единицы</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((device, index) => (
              <tr key={device.id}>
                {(['name', 'model', 'serialNumber', 'verificationCertificateNumber', 'verificationDate', 'verificationValidUntil', 'units'] as Array<keyof MeasurementDevice>).map((field) => (
                  <td key={field} className="px-3 py-3">
                    <input
                      type={field === 'verificationDate' || field === 'verificationValidUntil' ? 'date' : 'text'}
                      disabled={readOnly}
                      value={String(device[field] || '')}
                      onChange={(event) => update(index, field, event.target.value)}
                      className="min-w-[130px] rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {devices.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">Приборы не добавлены.</p>}
    </section>
  );
};

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
        instruments: item.instruments || [],
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

  const notify = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    toast[type](message);
  };

  const save = async () => {
    if (!protocol) return;
    if (protocol.status === 'SIGNED') {
      toast.warning('Нельзя редактировать подписанный протокол');
      return;
    }
    setBusy(true);
    try {
      const updated = await updateProtocol(protocol.id, {
        number: protocol.number,
        protocolDate: protocol.protocolDate,
        executor: protocol.executor,
        approver: protocol.approver,
        laboratory: protocol.laboratory,
        organization: protocol.organization,
        testing: protocol.testing,
        results: protocol.results,
        instruments: protocol.instruments,
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

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">Загрузка протокола...</div>;
  }

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
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{protocol.number || 'Новый протокол'}</h1>
        </div>
        <Button type="button" variant="secondary" onClick={load}><RotateCw className="h-4 w-4" /> Обновить</Button>
      </div>

      {readOnly && protocol.status === 'SIGNED' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          Протокол подписан. Редактирование закрыто, доступны скачивание PDF/DOCX и исправленная версия.
        </div>
      )}

      <ProtocolGeneralForm protocol={protocol} readOnly={readOnly || protocol.status === 'APPROVED'} onChange={patchProtocol} />
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
      <InstrumentsSection devices={protocol.instruments || []} readOnly={readOnly} onChange={(instruments) => patchProtocol({ instruments })} />

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
        }}
        onApprove={() => run(() => approveProtocol(protocol.id), 'Протокол утвержден')}
        onReturnDraft={() => run(() => updateProtocol(protocol.id, { status: 'DRAFT' }), 'Протокол возвращен в черновик')}
        onGeneratePdf={() => run(() => generatePdf(protocol.id), 'PDF сформирован')}
        onGenerateDocx={() => run(() => generateDocx(protocol.id), 'DOCX сформирован')}
        onSign={() => setSignOpen(true)}
        onDownloadPdf={() => generateAndDownload('pdf')}
        onDownloadDocx={() => generateAndDownload('docx')}
        onReplace={() => setReplaceOpen(true)}
        onOpenReplacement={protocol.replacedByProtocolId ? () => navigate(`/staff/protocols/${protocol.replacedByProtocolId}`) : undefined}
      />

      <ProtocolPreviewModal
        open={previewOpen}
        loading={previewLoading}
        previewUrl={previewUrl}
        draft={protocol.status !== 'APPROVED' && protocol.status !== 'SIGNED'}
        onClose={() => setPreviewOpen(false)}
      />
      <SignProtocolModal
        open={signOpen}
        loading={busy}
        onClose={() => setSignOpen(false)}
        onConfirm={async () => {
          await run(() => signProtocol(protocol.id), 'Протокол подписан');
          setSignOpen(false);
        }}
      />
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
    </div>
  );
};

export default ProtocolEditorPage;
