import { normalizeApiError } from '../../../services/apiHelpers';

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
};
export const mapPekError = (error: unknown): PekUiError => {
  const parsed = normalizeApiError(error, 'Не удалось выполнить действие. Повторите попытку.');
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
    traceId: parsed.traceId || parsed.requestId,
    resourceId: parsed.resourceId,
  };
};
export const pekIssueMessage = (issue: { code: string; message: string }) => ({
  PEK_REQUIRED_PROTOCOL_MISSING: 'Не найден обязательный протокол для позиции контроля',
  PEK_PROTOCOL_OBJECT_MISMATCH: 'Протокол относится к другому объекту',
  PEK_WASTE_NEGATIVE_BALANCE: 'Передано больше отходов, чем было в наличии',
  PEK_EXCEEDANCE_ACTION_REQUIRED: 'Не заполнены меры по превышению',
  PEK_REQUIRED_DOCUMENT_MISSING: 'Не приложен обязательный документ',
}[issue.code] || issue.message);
