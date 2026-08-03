import axios from 'axios';

export interface DocumentFlowError {
  message: string;
  code?: string;
  traceId?: string;
  fieldErrors: Record<string, string>;
  status?: number;
}

const codeMessages: Record<string, string> = {
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
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : 'Не удалось выполнить операцию.', fieldErrors: {} };
  }
  const status = error.response?.status;
  const body = (error.response?.data && typeof error.response.data === 'object'
    ? error.response.data : {}) as Record<string, unknown>;
  const nested = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : body;
  const code = typeof nested.code === 'string' ? nested.code : undefined;
  const traceId = typeof nested.traceId === 'string' ? nested.traceId : undefined;
  const rawFields = nested.fieldErrors && typeof nested.fieldErrors === 'object'
    ? nested.fieldErrors as Record<string, unknown> : {};
  const fieldErrors = Object.fromEntries(Object.entries(rawFields).map(([key, value]) => [key, String(value)]));
  const fallback = status ? statusMessages[status] : undefined;
  let message = (code && codeMessages[code]) || fallback || 'Не удалось выполнить операцию.';
  if (status === 500 && traceId) message += ` Код обращения: ${traceId}.`;
  return { message, code, traceId, fieldErrors, status };
}
