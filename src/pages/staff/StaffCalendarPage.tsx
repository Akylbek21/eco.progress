import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import BackendFeatureUnavailable from '../../components/ui/BackendFeatureUnavailable';
import { getApiErrorMessage } from '../../services/apiHelpers';
import { getStaffCalendar } from '../../services/crmWorkflowService';
import type { StaffCalendarEvent } from '../../types';

type CalendarView = 'today' | 'week' | 'month' | 'all' | 'overdue' | 'rescheduled';

const isoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateOnly = (value: string) => value.slice(0, 10);
const dateLabel = (value: string) => new Date(`${dateOnly(value)}T00:00:00`).toLocaleDateString('ru-RU', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const typeLabels: Record<StaffCalendarEvent['type'], string> = {
  order: 'Срок заявки',
  laboratory: 'Лаборатория',
  waste: 'Вывоз',
  task: 'Задача',
};

const statusLabels: Record<StaffCalendarEvent['status'], string> = {
  today: 'Сегодня',
  planned: 'Запланировано',
  overdue: 'Просрочено',
  rescheduled: 'Перенесено',
  completed: 'Завершено',
};

const statusClasses: Record<StaffCalendarEvent['status'], string> = {
  today: 'bg-sky-100 text-sky-800',
  planned: 'bg-eco-100 text-eco-800',
  overdue: 'bg-rose-100 text-rose-800',
  rescheduled: 'bg-amber-100 text-amber-800',
  completed: 'bg-slate-200 text-slate-700',
};

const views: ReadonlyArray<readonly [CalendarView, string]> = [
  ['today', 'Сегодня'],
  ['week', 'Неделя'],
  ['month', 'Месяц'],
  ['all', 'Все события'],
  ['overdue', 'Просроченные'],
  ['rescheduled', 'Перенесённые'],
];

const StaffCalendarPage = () => {
  const [events, setEvents] = useState<StaffCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<CalendarView>('today');
  const [query, setQuery] = useState('');
  const [eventType, setEventType] = useState<'all' | StaffCalendarEvent['type']>('all');

  const loadCalendar = async () => {
    setLoading(true);
    setError('');
    try {
      setEvents(await getStaffCalendar());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCalendar(); }, []);

  const range = useMemo(() => {
    const now = new Date();
    const today = isoDate(now);
    const mondayOffset = (now.getDay() + 6) % 7;
    return {
      today,
      month: today.slice(0, 7),
      weekStart: isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset)),
      weekEnd: isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6 - mondayOffset)),
    };
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      const date = dateOnly(event.date);
      const matchesPeriod = view === 'today' ? date === range.today
        : view === 'week' ? date >= range.weekStart && date <= range.weekEnd
          : view === 'month' ? date.startsWith(range.month)
            : view === 'overdue' ? event.status === 'overdue'
              : view === 'rescheduled' ? event.status === 'rescheduled'
                : true;
      const searchable = [event.title, event.address, event.contactPerson, event.executor, event.orderId]
        .filter(Boolean).join(' ').toLowerCase();
      return matchesPeriod
        && (eventType === 'all' || event.type === eventType)
        && (!normalizedQuery || searchable.includes(normalizedQuery));
    }).sort((left, right) => `${dateOnly(left.date)} ${left.time || ''}`.localeCompare(`${dateOnly(right.date)} ${right.time || ''}`));
  }, [eventType, events, query, range, view]);

  const groups = useMemo(() => filtered.reduce<Array<{ date: string; items: StaffCalendarEvent[] }>>((result, event) => {
    const date = dateOnly(event.date);
    const last = result[result.length - 1];
    if (last?.date === date) last.items.push(event);
    else result.push({ date, items: [event] });
    return result;
  }, []), [filtered]);

  const counts = useMemo(() => ({
    today: events.filter((event) => dateOnly(event.date) === range.today).length,
    week: events.filter((event) => dateOnly(event.date) >= range.weekStart && dateOnly(event.date) <= range.weekEnd).length,
    planned: events.filter((event) => event.status === 'planned').length,
    overdue: events.filter((event) => event.status === 'overdue').length,
  }), [events, range]);

  return (
    <div className="space-y-5 rounded-[22px] bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-3xl font-bold text-eco-900">Календарь</h2>
        <p className="mt-1 text-sm text-slate-600">Сроки заявок, задачи, лабораторные выезды и вывозы.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Сегодня', counts.today],
          ['На этой неделе', counts.week],
          ['Запланировано', counts.planned],
          ['Просрочено', counts.overdue],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-50 p-4">
            <p className="text-2xl font-black text-eco-900">{value}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {loading && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Загрузка календаря…</p>}
      {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800"><p>{error}</p><Button type="button" variant="secondary" className="mt-3" onClick={loadCalendar}>Повторить</Button></div>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {views.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setView(key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${view === key ? 'bg-eco-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{label}</button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_240px]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по событию, адресу, контакту или заявке" className="rounded-2xl border border-slate-200 px-4 py-3" />
        <select value={eventType} onChange={(event) => setEventType(event.target.value as typeof eventType)} className="rounded-2xl border border-slate-200 px-4 py-3">
          <option value="all">Все типы событий</option>
          {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.date}>
            <h3 className="mb-3 capitalize font-black text-slate-800">{dateLabel(group.date)}</h3>
            <div className="grid gap-3 xl:grid-cols-2">
              {group.items.map((event) => {
                const content = <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{event.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{event.time || 'Время не указано'}</p>
                      <p className="mt-1 text-sm text-slate-500">{event.address || 'Адрес не указан'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{typeLabels[event.type]}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[event.status]}`}>{statusLabels[event.status]}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    {event.orderId && <span>Заявка: {event.orderId}</span>}
                    {event.contactPerson && <span>Контакт: {event.contactPerson}</span>}
                    {event.measurementType && <span>Тип замера: {event.measurementType}</span>}
                    {event.transport && <span>Транспорт: {event.transport}</span>}
                    {event.executor && <span>Исполнитель: {event.executor}</span>}
                  </div>
                </>;
                const className = `block rounded-2xl border p-4 transition ${event.status === 'overdue' ? 'border-rose-200 bg-rose-50/60' : 'border-slate-100 bg-slate-50'} ${event.orderId ? 'hover:border-eco-200 hover:bg-eco-50' : ''}`;
                return event.orderId
                  ? <Link key={event.id} to={`/staff/orders/${event.orderId}`} className={className}>{content}</Link>
                  : <article key={event.id} className={className}>{content}</article>;
              })}
            </div>
          </section>
        ))}
        {!loading && !error && !filtered.length && <BackendFeatureUnavailable title="Событий не найдено" description="Измените период, тип события или строку поиска." />}
      </div>
    </div>
  );
};

export default StaffCalendarPage;
