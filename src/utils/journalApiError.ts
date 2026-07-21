import axios from 'axios';

export type ParsedJournalApiError = { message: string; code?: string; fieldErrors?: Record<string, string>; status?: number };
type ErrorBody = { message?: string; code?: string; errorCode?: string; fieldErrors?: Record<string, string>; errors?: Record<string, string> | Array<{ field?: string; message?: string }> };

const messages: Record<string, string> = {
  JOURNAL_TYPE_NOT_FOUND: 'Тип журнала не найден', JOURNAL_ENTRY_NOT_FOUND: 'Запись журнала не найдена',
  FIELD_REQUIRED: 'Заполните обязательные поля', UNKNOWN_FIELD: 'Схема журнала изменилась. Обновите данные',
  INVALID_FIELD_TYPE: 'Проверьте формат значения', VALUE_OUT_OF_RANGE: 'Значение выходит за допустимые пределы',
  INSUFFICIENT_REAGENT_BALANCE: 'Недостаточно реактива для указанного расхода', LABORATORY_ACCESS_DENIED: 'Нет доступа к выбранной лаборатории',
  OPTIMISTIC_LOCK_CONFLICT: 'Запись была изменена другим сотрудником', EXPORT_FAILED: 'Не удалось сформировать Excel',
};

export const parseJournalApiError = (error: unknown): ParsedJournalApiError => {
  if (!axios.isAxiosError<ErrorBody>(error)) return { message: error instanceof Error ? error.message : 'Не удалось выполнить операцию' };
  const body = error.response?.data;
  const code = body?.code || body?.errorCode;
  const fieldErrors: Record<string, string> = { ...(body?.fieldErrors || {}) };
  if (Array.isArray(body?.errors)) body.errors.forEach((item) => { if (item.field && item.message) fieldErrors[item.field] = item.message; });
  else Object.assign(fieldErrors, body?.errors || {});
  const generic = error.response?.status === 403 ? 'Недостаточно прав для выполнения действия' : error.response?.status === 409 ? messages.OPTIMISTIC_LOCK_CONFLICT : error.response?.status === 503 ? 'Сервис журналов временно недоступен' : 'Не удалось выполнить операцию';
  return { message: (code && messages[code]) || body?.message || generic, code, fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined, status: error.response?.status };
};

