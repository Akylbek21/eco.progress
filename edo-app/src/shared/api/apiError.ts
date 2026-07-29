import axios from 'axios';
import type { ApiErrorShape } from '../types/domain';

const safeMessage = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text || /<html|stack trace|nullpointer|sql|java\./i.test(text)) return undefined;
  return text.replace(/<[^>]*>/g, '').slice(0, 500);
};

export const mapApiError = (error: unknown, fallback = 'Не удалось выполнить запрос. Повторите попытку.') => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : fallback } satisfies ApiErrorShape;
  }
  const payload = error.response?.data as ApiErrorShape | undefined;
  return {
    code: payload?.code,
    message: safeMessage(payload?.message) || (error.response ? fallback : 'Нет соединения с сервером ЭДО.'),
    fieldErrors: payload?.fieldErrors,
    requestId: payload?.requestId || error.response?.headers?.['x-request-id'],
    status: error.response?.status,
  } satisfies ApiErrorShape;
};
