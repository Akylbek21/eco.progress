import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, Edit3, Plus, RefreshCw, Search } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { protocolTemplates, templateName } from '../data/protocolTemplates';
import { useToast } from '../hooks/useToast';
import { archiveNormative, createNormative, getNormatives, updateNormative } from '../services/normativeService';
import type { NormativeComparisonType, NormativeRecord, ProtocolTemplateId } from '../types/protocols';

const comparisonTypes: NormativeComparisonType[] = ['LESS_OR_EQUAL', 'GREATER_OR_EQUAL', 'RANGE', 'EQUAL', 'INFO'];

const emptyNormative: Omit<NormativeRecord, 'id'> = {
  templateId: 'industrial_emissions',
  researchObject: '',
  indicator: '',
  unit: '',
  normativeType: '',
  value: '',
  min: '',
  max: '',
  comparisonType: 'LESS_OR_EQUAL',
  normativeDocument: '',
  testingMethod: '',
  samplingMethod: '',
  validFrom: '',
  validUntil: '',
  active: true,
  archived: false,
};

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';

const NormativeDirectoryPage = () => {
  const toast = useToast();
  const [items, setItems] = useState<NormativeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [researchObject, setResearchObject] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [editing, setEditing] = useState<NormativeRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getNormatives());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить нормативы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = !query.trim() || item.indicator.toLowerCase().includes(query.trim().toLowerCase());
    const matchesResearchObject = !researchObject.trim() || item.researchObject.toLowerCase().includes(researchObject.trim().toLowerCase());
    const matchesTemplate = !templateId || item.templateId === templateId;
    return matchesQuery && matchesResearchObject && matchesTemplate;
  }), [items, query, researchObject, templateId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      templateId: String(form.get('templateId') || emptyNormative.templateId) as ProtocolTemplateId,
      researchObject: String(form.get('researchObject') || ''),
      indicator: String(form.get('indicator') || ''),
      unit: String(form.get('unit') || ''),
      normativeType: String(form.get('normativeType') || ''),
      value: String(form.get('value') || ''),
      min: String(form.get('min') || ''),
      max: String(form.get('max') || ''),
      comparisonType: String(form.get('comparisonType') || 'LESS_OR_EQUAL') as NormativeComparisonType,
      normativeDocument: String(form.get('normativeDocument') || ''),
      testingMethod: String(form.get('testingMethod') || ''),
      samplingMethod: String(form.get('samplingMethod') || ''),
      validFrom: String(form.get('validFrom') || ''),
      validUntil: String(form.get('validUntil') || ''),
      active: form.get('active') === 'on',
      archived: form.get('archived') === 'on',
    };

    try {
      if (editing) await updateNormative(editing.id, payload);
      else await createNormative(payload);
      toast.success(editing ? 'Норматив обновлен' : 'Норматив создан');
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (submitError) {
      toast.error('Не удалось сохранить норматив', submitError instanceof Error ? submitError.message : undefined);
    }
  };

  const archive = async (item: NormativeRecord) => {
    if (!window.confirm(`Архивировать норматив "${item.indicator}"?`)) return;
    try {
      await archiveNormative(item.id);
      toast.success('Норматив архивирован');
      await load();
    } catch (archiveError) {
      toast.error('Не удалось архивировать норматив', archiveError instanceof Error ? archiveError.message : undefined);
    }
  };

  const defaults = editing || emptyNormative;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Справочники</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Нормативы</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Создать норматив</Button>
          <Button type="button" variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Обновить</Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_260px_260px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по показателю" className={`${inputClass} pl-10`} />
        </label>
        <input value={researchObject} onChange={(event) => setResearchObject(event.target.value)} placeholder="Объект исследования" className={inputClass} />
        <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className={inputClass}>
          <option value="">Все шаблоны</option>
          {protocolTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Шаблон</th>
                <th className="px-4 py-3">Объект исследования</th>
                <th className="px-4 py-3">Показатель</th>
                <th className="px-4 py-3">Единица</th>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Значение</th>
                <th className="px-4 py-3">Документ</th>
                <th className="px-4 py-3">Активен</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? Array.from({ length: 4 }).map((_, index) => (
                <tr key={index} className="animate-pulse">{Array.from({ length: 9 }).map((__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td>)}</tr>
              )) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">{templateName(item.templateId)}</td>
                  <td className="px-4 py-4">{item.researchObject || '-'}</td>
                  <td className="px-4 py-4 font-bold text-slate-900">{item.indicator}</td>
                  <td className="px-4 py-4">{item.unit || '-'}</td>
                  <td className="px-4 py-4">{item.normativeType || '-'}</td>
                  <td className="px-4 py-4">{item.value || `${item.min || '-'} / ${item.max || '-'}`}</td>
                  <td className="px-4 py-4">{item.normativeDocument || '-'}</td>
                  <td className="px-4 py-4">{item.active && !item.archived ? 'Да' : 'Нет'}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" className="px-3" onClick={() => { setEditing(item); setModalOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                      <Button type="button" variant="secondary" className="px-3" onClick={() => archive(item)}><Archive className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <p className="px-6 py-10 text-center text-sm font-semibold text-slate-500">Нормативы не найдены.</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Редактировать норматив' : 'Создать норматив'} size="xl">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Шаблон</span>
            <select name="templateId" defaultValue={defaults.templateId} className={inputClass}>
              {protocolTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          {[
            ['researchObject', 'Объект исследования'],
            ['indicator', 'Показатель'],
            ['unit', 'Единица'],
            ['normativeType', 'Тип норматива'],
            ['value', 'Значение'],
            ['min', 'Min'],
            ['max', 'Max'],
            ['normativeDocument', 'Нормативный документ'],
            ['testingMethod', 'Метод испытаний'],
            ['samplingMethod', 'Метод отбора'],
          ].map(([name, label]) => (
            <label key={name} className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>{label}</span>
              <input name={name} defaultValue={String(defaults[name as keyof typeof defaults] || '')} className={inputClass} />
            </label>
          ))}
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Тип сравнения</span>
            <select name="comparisonType" defaultValue={defaults.comparisonType} className={inputClass}>
              {comparisonTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Дата начала действия</span>
            <input name="validFrom" type="date" defaultValue={defaults.validFrom} className={inputClass} />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Дата окончания действия</span>
            <input name="validUntil" type="date" defaultValue={defaults.validUntil} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input name="active" type="checkbox" defaultChecked={defaults.active} className="h-4 w-4 rounded border-slate-300 text-eco-700" /> Активен
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input name="archived" type="checkbox" defaultChecked={defaults.archived} className="h-4 w-4 rounded border-slate-300 text-eco-700" /> Архивный
          </label>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit">Сохранить</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default NormativeDirectoryPage;
