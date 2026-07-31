import dayjs from 'dayjs';
import type { PekHistoryItem } from '../../api/pekContracts';

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const PekHistoryTimeline = ({ items }: { items: PekHistoryItem[] }) => (
  <ol className="space-y-3">
    {items.map((item, index) => (
      <li key={item.id ?? `${item.createdAt}-${index}`} className="border-l-2 border-eco-300 pl-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong>{item.actionType}</strong>
          <time className="text-xs text-slate-500">{dayjs(item.createdAt).format('DD.MM.YYYY HH:mm')}</time>
        </div>
        <p className="text-sm text-slate-600">{item.actorName || 'Пользователь не указан'}</p>
        {item.comment && <p className="mt-1 text-sm">{item.comment}</p>}
        {(item.oldValue !== undefined || item.newValue !== undefined) && (
          <p className="mt-1 text-xs text-slate-500">{displayValue(item.oldValue)} → {displayValue(item.newValue)}</p>
        )}
      </li>
    ))}
    {!items.length && <li className="text-sm text-slate-500">История пока пуста</li>}
  </ol>
);

export default PekHistoryTimeline;
