import axios from 'axios';
import { normalizeApiError } from '../../../services/apiHelpers';
import type { PekValidationIssue } from '../api/pekContracts';
import { PekContractError } from '../api/pekContractSchemas';

const messages: Record<string, string> = {
  PEK_REPORT_DUPLICATE: 'Отчёт за этот период уже существует',
  PEK_REPORT_ALREADY_EXISTS: 'Отчёт за этот период уже существует',
  PEK_ACTIVE_PROGRAM_MISSING: 'Для выбранного объекта нет действующей программы ПЭК',
  PEK_OBJECT_COMPANY_MISMATCH: 'Выбранный объект не относится к компании',
  VERSION_CONFLICT: 'Сущность изменена другим сотрудником',
  PEK_VERSION_CONFLICT: 'Сущность изменена другим сотрудником',
  FILE_STORAGE_UNAVAILABLE: 'Файловое хранилище временно недоступно',
};

export type PekUiError = {
  message: string;
  code?: string;
  status?: number;
  fieldErrors: Record<string, string>;
  traceId?: string;
  resourceId?: string;
  details?: unknown;
  issues: PekValidationIssue[];
};

export const mapPekError = (error: unknown): PekUiError => {
  if (error instanceof PekContractError) return {
    message: error.message,
    code: error.code,
    fieldErrors: {},
    issues: [],
  };
  const parsed = normalizeApiError(error, 'Не удалось выполнить действие. Повторите попытку.');
  const raw = axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object'
    ? error.response.data as Record<string, unknown>
    : {};
  const nested = raw.data && typeof raw.data === 'object' ? raw.data as Record<string, unknown> : {};
  const details = { ...raw, ...nested };
  const status = parsed.status;
  const statusMessage = status === 401 ? 'Сессия истекла. Войдите снова.'
    : status === 403 ? 'Недостаточно прав для выполнения действия.'
      : status === 404 ? 'Программа или отчёт не найден.'
        : status === 409 ? 'Сущность изменена или действие недоступно в текущем статусе.'
          : status === 413 ? 'Файл превышает допустимый размер.'
          : status === 422 ? 'Данные не прошли бизнес-проверку.'
            : (status || 0) >= 500 ? 'Внутренняя ошибка сервиса. Повторите позже.'
              : undefined;
  return {
    message: parsed.code && messages[parsed.code] ? messages[parsed.code] : statusMessage || parsed.message,
    code: parsed.code,
    status,
    fieldErrors: parsed.fieldErrors,
    traceId: parsed.requestCode || parsed.traceId || parsed.requestId || String(details.correlationId || ''),
    resourceId: parsed.resourceId || (details.resourceId ? String(details.resourceId) : undefined),
    details: import.meta.env.DEV ? details.details : undefined,
    issues: Array.isArray(details.issues) ? details.issues as PekValidationIssue[] : [],
  };
};
