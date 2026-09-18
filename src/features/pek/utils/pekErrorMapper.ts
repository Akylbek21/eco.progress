import axios from 'axios';
import { normalizeApiError } from '../../../services/apiHelpers';
import type { PekValidationIssue } from '../api/pekContracts';
import { PekContractError } from '../api/pekContractSchemas';

const messages: Record<string, string> = {
  PEK_PROGRAM_NOT_EDITABLE: 'Программа находится в финальном статусе. Изменение документов запрещено.',
  PEK_PROGRAM_NOT_READY: 'Программа не готова к выполнению действия.',
  MAKER_CHECKER_VIOLATION: 'Автор записи не может самостоятельно её согласовать.',
  PEK_EVIDENCE_FILE_NOT_FOUND: 'Выбранный файл доказательства не найден. Загрузите файл заново.',
  PEK_EVIDENCE_FILE_FORBIDDEN: 'У вас нет доступа к выбранному файлу доказательства.',
  PEK_EVIDENCE_FILE_SCOPE_MISMATCH: 'Файл доказательства относится к другой компании или области доступа.',
  PEK_DOCUMENT_STALE: 'Документ устарел. Сформируйте его заново.',
  PEK_REPORT_DOCUMENT_LOCKED: 'Документы отчёта нельзя формировать после подписания или архивации отчёта.',
  PEK_MONITORING_EMPTY: 'В программе ПЭК нет включённых направлений мониторинга. Добавьте хотя бы одно направление в программу.',
  PEK_PACKAGE_DUPLICATE_ENTRY: 'В комплекте ПЭК обнаружены файлы с одинаковыми именами. Проверьте настройки направлений мониторинга.',
  PEK_PACKAGE_NOT_READY: 'Комплект ПЭК не готов. Исправьте перечисленные замечания и повторите формирование.',
  PEK_DOCUMENT_NOT_READY: 'Документ ПЭК не готов. Заполните указанные разделы отчёта.',
  PEK_SIGNATORY_NOT_CONFIGURED: 'В настройках ПЭК не назначен первый руководитель с ИИН.',
  PEK_SIGNATORY_MISMATCH: 'Сертификат ЭЦП не принадлежит назначенному первому руководителю или организации.',
  PROTOCOL_SAMPLING_ACT_REQUIRED: 'Для протокола необходимо прикрепить акт отбора проб.',
  PROTOCOL_SAMPLING_ACT_LOCKED: 'Акты отбора нельзя изменять после подписания протокола.',
  PEK_REPORT_DUPLICATE: 'Отчёт за этот период уже существует',
  PEK_REPORT_ALREADY_EXISTS: 'Отчёт за этот период уже существует',
  PEK_ACTIVE_PROGRAM_MISSING: 'Для выбранного объекта нет действующей программы ПЭК',
  PEK_OBJECT_COMPANY_MISMATCH: 'Выбранный объект не относится к компании',
  VERSION_REQUIRED: 'Для изменения данных требуется актуальная версия',
  VERSION_CONFLICT: 'Данные были изменены другим сотрудником.\nОбновите страницу и повторите действие.',
  PEK_VERSION_CONFLICT: 'Данные были изменены другим сотрудником.\nОбновите страницу и повторите действие.',
  PEK_PERMIT_VERSION_CONFLICT: 'Разрешение изменено другим сотрудником. Данные списка обновлены.',
  PEK_PERMIT_TRANSITION_INVALID: 'Этот переход статуса разрешения недоступен.',
  PERMIT_INVALID_RANGE: 'Дата окончания разрешения должна быть не раньше даты начала.',
  PEK_PROGRAM_SCOPE_MISMATCH: 'Выбранная программа ПЭК относится к другому объекту.',
  OPTIMISTIC_LOCK_CONFLICT: 'Данные были изменены другим сотрудником.\nОбновите страницу и повторите действие.',
  PEK_REPORT_NOT_EDITABLE: 'Отчёт нельзя изменять в текущем статусе',
  PEK_REPORT_NOT_READY: 'Отчёт содержит блокирующие проблемы',
  PEK_PROTOCOL_NOT_ELIGIBLE: 'Протокол не соответствует условиям отчёта',
  PEK_COMPANY_ACCESS_DENIED: 'Нет доступа к выбранной организации',
  PEK_COMPANY_ID_REQUIRED: 'Выберите компанию для продолжения работы с ПЭК',
  VALIDATION_ERROR: 'Проверьте заполненные данные',
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
  missingFields: string[];
};

const VERSION_CONFLICT_CODES = new Set(['VERSION_CONFLICT', 'PEK_VERSION_CONFLICT', 'PEK_PERMIT_VERSION_CONFLICT', 'OPTIMISTIC_LOCK_CONFLICT']);
const isVersionConflictCode = (code?: string) =>
  Boolean(code && (VERSION_CONFLICT_CODES.has(code) || code.endsWith('_VERSION_CONFLICT')));

export const isPekVersionConflict = (error: Pick<PekUiError, 'code' | 'status'>) =>
  isVersionConflictCode(error.code) || error.status === 412;

export const isPekVersionRequired = (error: Pick<PekUiError, 'code'>) => error.code === 'VERSION_REQUIRED';

export const mapPekError = (error: unknown): PekUiError => {
  if (error instanceof PekContractError) return {
    message: 'Получены неполные данные. Обновите страницу или обратитесь в поддержку.',
    code: error.code,
    fieldErrors: {},
    issues: [],
    missingFields: [],
  };
  const parsed = normalizeApiError(error, 'Не удалось выполнить действие. Повторите попытку.');
  const raw = axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object'
    ? error.response.data as Record<string, unknown>
    : {};
  const nested = raw.data && typeof raw.data === 'object' ? raw.data as Record<string, unknown> : {};
  const details = { ...raw, ...nested };
  const nestedDetails = details.details && typeof details.details === 'object' ? details.details as Record<string, unknown> : {};
  const missingFields = Array.isArray(details.missingFields) ? details.missingFields : Array.isArray(nestedDetails.missingFields) ? nestedDetails.missingFields : [];
  const status = parsed.status;
  const versionConflict = isVersionConflictCode(parsed.code) || status === 412;
  const conflictMessage = versionConflict
    ? 'Данные были изменены другим сотрудником.\nОбновите страницу и повторите действие.'
    : undefined;
  const businessMessage = parsed.code ? messages[parsed.code] : undefined;
  const backendMessage = (status === 409 || status === 412)
    && parsed.message
    && !/^Request failed with status code (409|412)$/.test(parsed.message)
    ? parsed.message
    : undefined;
  const statusMessage = status === 401 ? 'Сессия истекла. Войдите снова.'
    : status === 403 ? 'У вас нет доступа к этой компании или операции ПЭК. Обратитесь к администратору.'
      : status === 404 ? 'Программа или отчёт не найден.'
        : status === 409 || status === 412 ? 'Сущность изменена или действие недоступно в текущем статусе.'
          : status === 413 ? 'Файл превышает допустимый размер.'
          : status === 422 ? 'Данные не прошли бизнес-проверку.'
            : (status || 0) >= 500 ? 'Внутренняя ошибка сервиса. Повторите позже.'
              : undefined;
  return {
    message: businessMessage || conflictMessage || backendMessage || statusMessage || parsed.message,
    code: parsed.code,
    status,
    fieldErrors: parsed.fieldErrors,
    traceId: parsed.requestCode || parsed.traceId || parsed.requestId || String(details.correlationId || ''),
    resourceId: parsed.resourceId || (details.resourceId ? String(details.resourceId) : undefined),
    details: import.meta.env.DEV ? details.details : undefined,
    issues: Array.isArray(details.issues)
      ? details.issues as PekValidationIssue[]
      : Array.isArray(details.errors)
        ? details.errors as PekValidationIssue[]
        : [],
    missingFields: missingFields.map((item) => typeof item === 'string' ? item : String((item as Record<string, unknown>).label ?? (item as Record<string, unknown>).field ?? (item as Record<string, unknown>).message ?? 'обязательные данные')),
  };
};

/** Single UI boundary for PEK API and validation failures. */
export const mapPekApiErrorsToUi = mapPekError;
