const KAZAKHSTAN_TIME_ZONE = 'Asia/Almaty';

const russianMonths: Record<string, number> = {
  января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5,
  июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11,
};

const legacyRussianDateTime = /^(\d{1,2})\s+([\p{L}ё]+)\s+(\d{4}),\s+(\d{1,2}):(\d{2})$/iu;
const zoneSuffix = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Legacy lead values are server-formatted UTC LocalDateTime strings without an offset. */
export const parseLeadCreatedAt = (value: string): Date | null => {
  const normalized = value.trim();
  const legacy = normalized.match(legacyRussianDateTime);
  if (legacy) {
    const [, day, monthName, year, hour, minute] = legacy;
    const month = russianMonths[monthName.toLocaleLowerCase('ru-RU')];
    if (month === undefined) return null;
    const date = new Date(Date.UTC(Number(year), month, Number(day), Number(hour), Number(minute)));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const isoValue = /^\d{4}-\d{2}-\d{2}T/.test(normalized) && !zoneSuffix.test(normalized) ? `${normalized}Z` : normalized;
  const date = new Date(isoValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatLeadCreatedAt = (value: string): string => {
  const date = parseLeadCreatedAt(value);
  if (!date) return value || '—';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: KAZAKHSTAN_TIME_ZONE,
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

export const leadCreatedAtDateKey = (value: string): string => {
  const date = parseLeadCreatedAt(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KAZAKHSTAN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
