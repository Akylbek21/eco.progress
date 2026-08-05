import { normalizeApiError, type ApiError } from '../../../services/apiHelpers';

export type DocumentFlowError = ApiError;

const codeMessages: Record<string, string> = {
  ORGANIZATION_REQUIRED: 'Выберите организацию.',
  ORGANIZATION_ACCESS_DENIED: 'У вас нет доступа к выбранной организации.',
  COUNTERPARTY_MANAGE_FORBIDDEN: 'У вас нет права управлять контрагентами.',
  COUNTERPARTY_DUPLICATE_BIN: 'Контрагент с таким БИН уже существует.',
  COUNTERPARTY_INVALID_BIN: 'БИН должен содержать 12 цифр.',
  COUNTERPARTY_NOT_FOUND: 'Контрагент не найден или относится к другой организации.',
  OPTIMISTIC_LOCK_CONFLICT: 'Контрагент был изменён другим пользователем. Обновите данные.',
  SUBSCRIPTION_READ_ONLY: 'Подписка разрешает только просмотр данных.',
  MEMBER_NOT_FOUND: 'Пользователь с таким email не найден.',
  MEMBER_ALREADY_EXISTS: 'Этот сотрудник уже имеет доступ.',
  MEMBER_MANAGE_FORBIDDEN: 'У вас нет права управлять доступом сотрудников.',
  DOCUMENT_FLOW_ACCESS_DENIED: 'У вас нет доступа к документообороту.',
  VERSION_CHANGED: 'Документ был изменён другим пользователем. Обновите данные и повторите действие.',
  ACTIVE_ROUTE_EXISTS: 'Для документа уже создан маршрут подписания.',
  FILE_TOO_LARGE: 'Файл превышает допустимый размер.',
  FILE_TYPE_NOT_ALLOWED: 'Этот тип файла не поддерживается.',
  STORAGE_LIMIT_EXCEEDED: 'Недостаточно места в хранилище организации.',
  VIRUS_DETECTED: 'Файл отклонён: обнаружена угроза.',
  FILE_SCAN_FAILED: 'Не удалось проверить файл. Повторите загрузку позднее.',
  SIGNATURE_HASH_MISMATCH: 'Подпись не соответствует текущей версии документа.',
  SIGNATURE_INVALID: 'NCALayer вернул недействительную подпись.',
  CERTIFICATE_EXPIRED: 'Срок действия сертификата истёк.',
  CHALLENGE_EXPIRED: 'Время подготовки подписи истекло. Подготовьте подпись повторно.',
  CHALLENGE_ALREADY_USED: 'Эта подготовленная подпись уже была использована.',
  ASSIGNMENT_ALREADY_SIGNED: 'Задание уже подписано.',
  NCALAYER_NOT_AVAILABLE: 'NCALayer недоступен. Запустите приложение и повторите подключение.',
};

const statusMessages: Record<number, string> = {
  400: 'Проверьте заполненные данные.',
  401: 'Сессия завершена. Войдите снова.',
  403: 'У вас нет права выполнить это действие.',
  404: 'Документ не найден или недоступен.',
  409: 'Операция конфликтует с текущим состоянием документа.',
  413: 'Файл превышает допустимый размер.',
  415: 'Этот тип файла не поддерживается.',
  422: 'Не удалось проверить данные операции.',
  429: 'Слишком много попыток. Повторите позднее.',
  500: 'Не удалось выполнить операцию.',
};

export function mapDocumentFlowError(error: unknown): DocumentFlowError {
  const normalized = normalizeApiError(error, 'Не удалось выполнить операцию.');
  const fallback = normalized.status ? statusMessages[normalized.status] : undefined;
  let message = (normalized.code && codeMessages[normalized.code]) || normalized.message || fallback || 'Не удалось выполнить операцию.';
  if (normalized.status === 500 && normalized.traceId && !message.includes(normalized.traceId)) {
    message += ` Код обращения: ${normalized.traceId}.`;
  }
  return { ...normalized, message };
}
