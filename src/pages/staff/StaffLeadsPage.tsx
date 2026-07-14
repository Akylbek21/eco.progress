import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import BackendFeatureUnavailable from '../../components/ui/BackendFeatureUnavailable';
import { useToast } from '../../hooks/useToast';
import { getApiErrorMessage } from '../../services/apiHelpers';
import { getLeads, updateLeadStatus, type LeadStatus } from '../../services/leadService';

const statuses: LeadStatus[] = ['new', 'contacted', 'in_progress', 'closed'];

const StaffLeadsPage = () => {
  const toast = useToast();
  const [leads, setLeads] = useState<Awaited<ReturnType<typeof getLeads>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | LeadStatus>('all');
  const [source, setSource] = useState('all');
  const [date, setDate] = useState('');
  const [updatingId, setUpdatingId] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setLeads(await getLeads()); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const sources = useMemo(() => [...new Set(leads.map((lead) => lead.source).filter(Boolean))], [leads]);
  const filtered = useMemo(() => leads.filter((lead) => {
    const text = `${lead.name} ${lead.phone} ${lead.city} ${lead.serviceType} ${lead.comment}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (status === 'all' || lead.status === status)
      && (source === 'all' || lead.source === source)
      && (!date || lead.createdAt.slice(0, 10) === date);
  }), [leads, query, status, source, date]);

  const changeStatus = async (id: string, nextStatus: LeadStatus) => {
    if (updatingId) return;
    setUpdatingId(id);
    try {
      const updated = await updateLeadStatus(id, nextStatus);
      if (!updated) throw new Error('Сервер не вернул обновленный лид.');
      setLeads((items) => items.map((item) => item.id === id ? updated : item));
      toast.success('Статус лида обновлен');
    } catch (err) { toast.error('Лид не обновлен', getApiErrorMessage(err)); }
    finally { setUpdatingId(''); }
  };

  return (
    <div className="space-y-5 rounded-[22px] bg-white p-6 shadow-sm">
      <div><h2 className="text-3xl font-bold text-eco-900">Лиды</h2><p className="mt-1 text-sm text-slate-600">Обращения с сайта и других каналов.</p></div>
      <div className="grid gap-3 md:grid-cols-4">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" className="rounded-2xl border border-slate-200 px-4 py-3" />
        <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | LeadStatus)} className="rounded-2xl border border-slate-200 px-4 py-3"><option value="all">Все статусы</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={source} onChange={(event) => setSource(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3"><option value="all">Все источники</option>{sources.map((item) => <option key={item}>{item}</option>)}</select>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" />
      </div>
      {loading && <p className="rounded-2xl bg-slate-50 p-4 text-sm">Загрузка лидов…</p>}
      {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800"><p>{error}</p><Button type="button" variant="secondary" className="mt-3" onClick={load}>Повторить</Button></div>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="p-3">Дата</th><th className="p-3">Контакт</th><th className="p-3">Город / услуга</th><th className="p-3">Источник</th><th className="p-3">Комментарий</th><th className="p-3">Статус</th></tr></thead>
          <tbody>{filtered.map((lead) => <tr key={lead.id} className="border-b border-slate-100"><td className="p-3">{lead.createdAt}</td><td className="p-3"><p className="font-bold">{lead.name}</p><p>{lead.phone}</p></td><td className="p-3">{lead.city}<br />{lead.serviceType}</td><td className="p-3">{lead.source}</td><td className="max-w-xs p-3">{lead.comment}</td><td className="p-3"><select value={lead.status} disabled={updatingId === lead.id} onChange={(event) => changeStatus(lead.id, event.target.value as LeadStatus)} className="rounded-xl border border-slate-200 px-3 py-2">{statuses.map((item) => <option key={item}>{item}</option>)}</select></td></tr>)}</tbody>
        </table>
      </div>
      {!loading && !error && !filtered.length && <BackendFeatureUnavailable title="Лидов не найдено" description="Измените фильтры или дождитесь новых обращений." />}
    </div>
  );
};

export default StaffLeadsPage;
