import type { JournalColumn } from '../types/labJournal';

const dateValue = (value: unknown, withTime = false) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value || '—');
  return new Intl.DateTimeFormat('ru-RU', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(date);
};

export const formatJournalValue = (column: JournalColumn, value: unknown): string => {
  if (value === undefined || value === null || value === '') return '—';
  if (column.type === 'date') return dateValue(value);
  if (column.type === 'datetime') return dateValue(value, true);
  if (column.type === 'time') return String(value).slice(0, 5);
  if (column.type === 'boolean') return value ? 'Да' : 'Нет';
  if (column.type === 'number' || column.type === 'calculated') return new Intl.NumberFormat('ru-RU').format(Number(value));
  if (column.type === 'select') return column.options?.find((item) => item.value === String(value))?.label || String(value);
  return String(value);
};
