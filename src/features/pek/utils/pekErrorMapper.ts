import axios from 'axios';
import { normalizeApiError } from '../../../services/apiHelpers';
import type { PekApiErrorDetails, PekAvailableActionCode, PekSectionCode } from '../api/pekContracts';

const messages: Record<string, string> = {
  PEK_REPORT_DUPLICATE: 'Отчёт за этот период уже существует',
  PEK_ACTIVE_PROGRAM_MISSING: 'Для выбранного объекта нет действующей программы ПЭК',
  PEK_OBJECT_COMPANY_MISMATCH: 'Выбранный объект не относится к компании. Обновите список объектов',
  VERSION_CONFLICT: 'Отчёт изменён другим сотрудником',
  PROTOCOL_VERSION_CONFLICT: 'Отчёт изменён другим сотрудником',
  PEK_REPORT_HAS_BLOCKING_ISSUES: 'Сначала исправьте критические ошибки',
  FILE_STORAGE_UNAVAILABLE: 'Файловое хранилище временно недоступно. Повторите позже',
};
export type PekUiError = {
  message: string;
  code?: string;
  status?: number;
  fieldErrors: Record<string, string>;
  traceId?: string;
  resourceId?: string;
  field?: string;
  section?: PekSectionCode;
  entityId?: string | number;
  action?: PekAvailableActionCode | string;
  details?: unknown;
};
export const mapPekError = (error: unknown): PekUiError => {
  const parsed = normalizeApiError(error, 'Не удалось выполнить действие. Повторите попытку.');
  const raw = axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object'
    ? error.response.data as PekApiErrorDetails & { data?: PekApiErrorDetails }
    : {};
  const details = raw.data && typeof raw.data === 'object' ? { ...raw, ...raw.data } : raw;
  const serverFailure = (parsed.status || 0) >= 500;
  return {
    message: parsed.code && messages[parsed.code]
      ? messages[parsed.code]
      : serverFailure
        ? 'Сервис временно недоступен. Повторите позже.'
        : parsed.message,
    code: parsed.code,
    status: parsed.status,
    fieldErrors: parsed.fieldErrors,
    traceId: parsed.requestCode || parsed.traceId || parsed.requestId || details.correlationId,
    resourceId: parsed.resourceId,
    field: details.field,
    section: details.section,
    entityId: details.entityId,
    action: details.action,
    details: import.meta.env.DEV ? details.details : undefined,
  };
};
export const pekIssueMessage = (issue: { code: string; message: string }) => ({
  PEK_REQUIRED_PROTOCOL_MISSING: 'Не найден обязательный протокол для позиции контроля',
  PEK_PROTOCOL_OBJECT_MISMATCH: 'Протокол относится к другому объекту',
  PEK_WASTE_NEGATIVE_BALANCE: 'Передано больше отходов, чем было в наличии',
  PEK_EXCEEDANCE_ACTION_REQUIRED: 'Не заполнены меры по превышению',
  PEK_REQUIRED_DOCUMENT_MISSING: 'Не приложен обязательный документ',
}[issue.code] || issue.message);
