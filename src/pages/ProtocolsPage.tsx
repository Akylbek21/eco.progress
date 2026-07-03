import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import ProtocolList from '../components/protocols/ProtocolList';
import ProtocolPreviewModal from '../components/protocols/ProtocolPreviewModal';
import { protocolStatusLabels } from '../components/protocols/ProtocolStatusBadge';
import protocolService from '../services/protocolService';
import { getApiErrorMessage } from '../services/apiHelpers';
import { physicalFactorTypes, protocolTemplates, templateName } from '../data/protocolTemplates';
import { useToast } from '../hooks/useToast';
import type { Protocol, ProtocolStatus, ProtocolTemplate } from '../types/protocols';

const statuses: ProtocolStatus[] = ['DRAFT', 'CALCULATED', 'READY', 'READY_FOR_APPROVAL', 'APPROVED', 'SIGNED', 'ARCHIVED', 'CANCELLED', 'REPLACED'];

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

const ProtocolsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [templates, setTemplates] = useState<ProtocolTemplate[]>(protocolTemplates);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [subtype, setSubtype] = useState('');
  const [compliance, setCompliance] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProtocolId, setPreviewProtocolId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const items = await protocolService.getProtocols();
      setProtocols(items);
      setTemplates(protocolTemplates);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить протоколы');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => protocols.filter((protocol) => {
    const needle = query.trim().toLowerCase();
    const haystack = `${protocol.protocolNumber} ${protocol.companySnapshot.companyName} ${protocol.companySnapshot.bin || ''} ${protocol.companySnapshot.objectName || ''}`.toLowerCase();
    return (!needle || haystack.includes(needle))
      && (!status || protocol.status === status)
      && (!templateId || protocol.templateId === templateId)
      && (!subtype || protocol.subtype === subtype)
      && (!compliance || protocol.complianceResult === compliance);
  }), [protocols, query, status, templateId, subtype, compliance]);

  const preview = async (protocol: Protocol) => {
    setPreviewProtocolId(protocol.id);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      await protocolService.previewProtocol(protocol.id);
    } catch (previewError) {
      toast.error('Не удалось открыть предпросмотр', previewError instanceof Error ? previewError.message : undefined);
    } finally {
      setPreviewLoading(false);
    }
  };

  const remove = async (protocol: Protocol) => {
    if (!window.confirm('Удалить протокол? Данные будут скрыты из списка.')) return;
    try {
      await protocolService.deleteProtocol(protocol.id);
      toast.success('Протокол удалён');
      await load();
    } catch (deleteError) {
      toast.error(getApiErrorMessage(deleteError, 'Не удалось удалить протокол'));
    }
  };

  const copy = async (protocol: Protocol) => {
    try {
      const duplicate = await protocolService.createProtocol({
        companyId: protocol.companyId || '',
        objectId: protocol.objectId || '',
        templateId: protocol.templateId,
        subtype: protocol.subtype,
        protocolDate: protocol.protocolDate,
        sampleDate: protocol.testing.samplingDate || protocol.measurementDate,
        samplingDate: protocol.testing.samplingDate,
        testingStartDate: protocol.testing.testingStartDate,
        testingEndDate: protocol.testing.testingEndDate,
        productName: protocol.organization.productName,
        testingBasis: protocol.organization.testingBasis,
        productNormativeDocument: protocol.testing.productNormativeDocument,
        samplingMethodDocument: protocol.testing.samplingMethodDocument,
        testingMethodDocument: protocol.testing.testingMethodDocument,
        purpose: protocol.testing.testingPurpose,
        environment: protocol.environment,
      });
      toast.success('Создана копия протокола');
      navigate(`/staff/protocols/${duplicate.id}`);
    } catch (copyError) {
      toast.error('Не удалось скопировать протокол', copyError instanceof Error ? copyError.message : undefined);
    }
  };

  const replace = async (protocol: Protocol) => {
    const reason = window.prompt('Укажите причину создания исправленной версии:');
    if (!reason?.trim()) return;
    try {
      const replacement = await protocolService.replaceProtocol(protocol.id, reason.trim());
      navigate(`/staff/protocols/${replacement.id}`);
    } catch (replaceError) {
      toast.error('Не удалось создать исправленную версию', replaceError instanceof Error ? replaceError.message : undefined);
    }
  };

  const download = async (protocol: Protocol, kind: 'pdf' | 'docx') => {
    try {
      if (kind === 'pdf') await protocolService.generatePdf(protocol.id);
      else await protocolService.generateDocx(protocol.id);
      const file = kind === 'pdf' ? await protocolService.downloadPdf(protocol.id) : await protocolService.downloadDocx(protocol.id);
      if (!file.blob.size) throw new Error('Файл пуст.');
      saveBlob(file.blob, file.fileName || `${protocol.protocolNumber}.${kind}`);
    } catch (downloadError) {
      toast.error(`Не удалось скачать ${kind.toUpperCase()}`, downloadError instanceof Error ? downloadError.message : undefined);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-eco-700">Испытательная лаборатория</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Протоколы испытаний</h1>
          <p className="mt-2 text-sm text-slate-500">Создание, проверка нормативов, утверждение и официальный предпросмотр.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => navigate('/staff/protocols/create')}><Plus className="h-4 w-4" /> Создать протокол</Button>
          <Button type="button" variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Обновить</Button>
        </div>
      </header>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
        <label className="relative xl:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Номер, компания, БИН или объект" className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100" /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-3 text-sm"><option value="">Все статусы</option>{statuses.map((item) => <option key={item} value={item}>{protocolStatusLabels[item]}</option>)}</select>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-3 text-sm"><option value="">Все типы</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name || templateName(item.id)}</option>)}</select>
        <select value={subtype} onChange={(e) => setSubtype(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-3 text-sm"><option value="">Все подтипы</option>{physicalFactorTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <select value={compliance} onChange={(e) => setCompliance(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-3 text-sm"><option value="">Любое соответствие</option><option value="COMPLIES">Соответствует</option><option value="DOES_NOT_COMPLY">Не соответствует</option><option value="NEEDS_REVIEW">Требует проверки</option></select>
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
      <ProtocolList protocols={filtered} loading={loading} onOpen={(protocol) => navigate(`/staff/protocols/${protocol.id}`)} onPreview={preview} onCopy={copy} onDelete={remove} onReplace={replace} onDownloadPdf={(protocol) => download(protocol, 'pdf')} onDownloadDocx={(protocol) => download(protocol, 'docx')} />
      <ProtocolPreviewModal open={previewOpen} loading={previewLoading} protocol={protocols.find((item) => item.id === previewProtocolId) || null} draft={protocols.find((item) => item.id === previewProtocolId)?.status === 'DRAFT'} onClose={() => setPreviewOpen(false)} />
    </div>
  );
};

export default ProtocolsPage;
