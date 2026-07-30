import axios from 'axios';

export type MappedApiError = {
  code?: string;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
  status?: number;
  retryAfterSeconds?: number;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseRetryAfterSeconds = (value: unknown, now = Date.now()) => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return Math.max(0, Math.ceil((timestamp - now) / 1000));
  }
  return undefined;
};

const safeMessage = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text || /<html|stack trace|nullpointer|sql|java\./i.test(text)) return undefined;
  return text.replace(/<[^>]*>/g, '').slice(0, 500);
};

export const mapApiError = (error: unknown, fallback = 'Не удалось выполнить запрос. Повторите попытку.') => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : fallback } satisfies MappedApiError;
  }
  const payload = isObject(error.response?.data) ? error.response.data : undefined;
  const rawFields = payload && isObject(payload.fieldErrors) ? payload.fieldErrors : undefined;
  const fieldErrors = rawFields
    ? Object.fromEntries(Object.entries(rawFields).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : undefined;
  const code = typeof payload?.code === 'string' ? payload.code : undefined;
  const requestId = [payload?.requestId, payload?.traceId, error.response?.headers?.['x-request-id']]
    .find((value): value is string => typeof value === 'string');
  const status = error.response?.status;
  const retryAfterSeconds = parseRetryAfterSeconds(error.response?.headers?.['retry-after']);
  return {
    code,
    message: safeMessage(payload?.message)
      || safeMessage(payload?.detail)
      || safeMessage(payload?.title)
      || (status === 429
        ? `Слишком много запросов.${retryAfterSeconds !== undefined ? ` Повторите через ${retryAfterSeconds} сек.` : ' Повторите позже.'}`
        : error.response ? fallback : 'Нет соединения с сервером ЭДО.'),
    fieldErrors,
    requestId,
    status,
    retryAfterSeconds,
  } satisfies MappedApiError;
};
