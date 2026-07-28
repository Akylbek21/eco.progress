import type { PekHistoryItem } from '../../api/pekContracts';
import { labelPekStatus } from '../../utils/pekLabels';

const formatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Asia/Almaty',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const PekHistoryTimeline = ({ items }: { items: PekHistoryItem[] }) => <div className="space-y-3">
  {items.map((item) => <article key={item.id} className="rounded-xl border-l-4 border-eco-500 bg-slate-50 p-4">
    <div className="flex flex-wrap justify-between gap-2"><strong>{item.action}</strong><time dateTime={item.occurredAt}>{formatter.format(new Date(item.occurredAt))}</time></div>
    <p className="mt-1 text-sm">{item.user || 'Система'}{item.role ? ` · ${item.role}` : ''}</p>
    {item.comment && <p className="mt-2 text-sm text-slate-600">{item.comment}</p>}
    {(item.oldStatus || item.newStatus) && <p className="mt-2 text-xs text-slate-500">{labelPekStatus(item.oldStatus)} → {labelPekStatus(item.newStatus)}</p>}
    {item.changedFields?.length ? <p className="mt-1 text-xs text-slate-500">Изменено: {item.changedFields.join(', ')}</p> : null}
  </article>)}
  {!items.length && <p className="text-slate-500">История пока пуста</p>}
</div>;

export default PekHistoryTimeline;
