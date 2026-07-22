import { RotateCcw } from 'lucide-react';
import Button from '../../../components/ui/Button';
import type { LaboratoryListItem } from '../../../types/laboratories';

export type JournalFilterValues = { laboratoryId: number; dateFrom: string; dateTo: string; executorName: string; search: string };
type Props = { values: JournalFilterValues; laboratories: LaboratoryListItem[]; laboratoryLocked: boolean; loading: boolean; onChange: (patch: Partial<JournalFilterValues>) => void; onReset: () => void };
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';

export const JournalFilters = ({ values, laboratories, laboratoryLocked, loading, onChange, onReset }: Props) => {
  if (loading) return <div aria-label="Загрузка фильтров" className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  return <section className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-3">
    <label className="space-y-1 text-sm font-semibold"><span>Лаборатория</span><select aria-label="Лаборатория" value={values.laboratoryId || ''} disabled={laboratoryLocked} onChange={(event) => onChange({ laboratoryId: Number(event.target.value || 0) })} className={inputClass}><option value="">Выберите лабораторию</option>{laboratories.map((laboratory) => <option key={laboratory.id} value={laboratory.id}>{laboratory.name}</option>)}</select></label>
    <label className="space-y-1 text-sm font-semibold"><span>Период от</span><input type="date" value={values.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} className={inputClass} /></label>
    <label className="space-y-1 text-sm font-semibold"><span>Период до</span><input type="date" value={values.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} className={inputClass} /></label>
    <label className="space-y-1 text-sm font-semibold"><span>Исполнитель</span><input value={values.executorName} onChange={(event) => onChange({ executorName: event.target.value })} className={inputClass} /></label>
    <label className="space-y-1 text-sm font-semibold"><span>Поиск</span><input aria-label="Поиск" value={values.search} placeholder="Минимум 2 символа" onChange={(event) => onChange({ search: event.target.value })} className={inputClass} /></label>
    <div className="flex items-end"><Button type="button" variant="secondary" onClick={onReset}><RotateCcw className="h-4 w-4" /> Сбросить фильтры</Button></div>
  </section>;
};
