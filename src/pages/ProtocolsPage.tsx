import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import CreateProtocolModal from '../components/protocols/CreateProtocolModal';
import ProtocolList from '../components/protocols/ProtocolList';
import { protocolStatusLabels } from '../components/protocols/ProtocolStatusBadge';
import { createProtocol, deleteProtocol, getProtocols, getProtocolTemplates } from '../services/protocolService';
import { protocolTemplates, templateName } from '../data/protocolTemplates';
import { useToast } from '../hooks/useToast';
import type { CreateProtocolPayload, Protocol, ProtocolStatus, ProtocolTemplate } from '../types/protocols';

const statuses: ProtocolStatus[] = ['DRAFT', 'READY_FOR_APPROVAL', 'APPROVED', 'SIGNED', 'CANCELLED', 'REPLACED'];

const statCards: Array<{ key: 'total' | ProtocolStatus; label: string }> = [
  { key: 'total', label: 'Всего протоколов' },
  { key: 'DRAFT', label: 'Черновики' },
  { key: 'READY_FOR_APPROVAL', label: 'Готовые к утверждению' },
  { key: 'APPROVED', label: 'Утвержденные' },
  { key: 'SIGNED', label: 'Подписанные' },
];

const ProtocolsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [templates, setTemplates] = useState<ProtocolTemplate[]>(protocolTemplates);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [templateId, setTemplateId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [protocolItems, templateItems] = await Promise.all([
        getProtocols(),
        getProtocolTemplates().catch(() => protocolTemplates),
      ]);
      setProtocols(protocolItems);
      setTemplates(templateItems.length ? templateItems : protocolTemplates);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить протоколы');
      setProtocols([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => protocols.filter((protocol) => {
    const matchesQuery = !query.trim() || protocol.number?.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = !status || protocol.status === status;
    const matchesTemplate = !templateId || protocol.templateId === templateId;
    return matchesQuery && matchesStatus && matchesTemplate;
  }), [protocols, query, status, templateId]);

  const stats = useMemo(() => statCards.map((card) => {
    if (card.key === 'total') return { ...card, value: protocols.length };
    return { ...card, value: protocols.filter((protocol) => protocol.status === card.key).length };
  }), [protocols]);

  const submitCreate = async (payload: CreateProtocolPayload) => {
    setCreating(true);
    try {
      const protocol = await createProtocol(payload);
      toast.success('Протокол успешно создан');
      setModalOpen(false);
      navigate(`/staff/protocols/${protocol.id}`);
    } catch (createError) {
      toast.error('Не удалось создать протокол', createError instanceof Error ? createError.message : undefined);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (protocol: Protocol) => {
    if (!window.confirm(`Удалить протокол ${protocol.number || protocol.id}?`)) return;
    try {
      await deleteProtocol(protocol.id);
      toast.success('Протокол удален');
      await load();
    } catch (deleteError) {
      toast.error('Не удалось удалить протокол', deleteError instanceof Error ? deleteError.message : undefined);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Лаборатория</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Протоколы испытаний</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Создать протокол</Button>
          <Button type="button" variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Обновить</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {stats.map((card) => (
          <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_240px_260px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по номеру протокола"
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100"
          />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100">
          <option value="">Все статусы</option>
          {statuses.map((item) => <option key={item} value={item}>{protocolStatusLabels[item]}</option>)}
        </select>
        <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100">
          <option value="">Все шаблоны</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name || templateName(template.id)}</option>)}
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          {error}
        </div>
      )}

      <ProtocolList
        protocols={filtered}
        loading={loading}
        onOpen={(protocol) => navigate(`/staff/protocols/${protocol.id}`)}
        onDelete={remove}
      />

      <CreateProtocolModal
        open={modalOpen}
        loading={creating}
        templates={templates}
        onClose={() => setModalOpen(false)}
        onCreate={submitCreate}
      />
    </div>
  );
};

export default ProtocolsPage;
