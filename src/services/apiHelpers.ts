import axios from 'axios';

type UnknownRecord = Record<string, unknown>;
const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;

const payloadCandidates = (input: unknown): unknown[] => {
  const candidates: unknown[] = [input];
  let current = input;
  for (let depth = 0; depth < 3; depth += 1) {
    const record = asRecord(current);
    if (!record || !('data' in record)) break;
    current = record.data;
    candidates.unshift(current);
  }
  return candidates;
};

export const extractList = (input: unknown, keys: string[] = []): unknown[] => {
  const candidates = payloadCandidates(input);
  for (const candidate of candidates) if (Array.isArray(candidate)) return candidate;
  const listKeys = [...keys, 'content', 'items', 'protocols', 'companies', 'normatives', 'devices', 'measurementDevices', 'templates', 'results', 'rows'];
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (!record) continue;
    for (const key of listKeys) if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
};

export const extractItem = (input: unknown, keys: string[] = []): unknown => {
  const candidates = payloadCandidates(input);
  const itemKeys = [...keys, 'protocol', 'company', 'normative', 'device', 'measurementDevice', 'result', 'item', 'row'];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate[0];
    const record = asRecord(candidate);
    if (!record) continue;
    for (const key of itemKeys) if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return candidates.find((candidate) => {
    const record = asRecord(candidate);
    return record && !('data' in record && Object.keys(record).every((key) => ['data', 'message'].includes(key)));
  });
};

export const getApiStatus = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined;

export interface ParsedApiError {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  status?: number;
}

export const parseApiError = (error: unknown, fallback = 'Не удалось выполнить запрос.'): ParsedApiError => {
  const status = getApiStatus(error);
  if (!axios.isAxiosError(error)) return { message: error instanceof Error && error.message ? error.message : fallback, status };
  const response = asRecord(error.response?.data);
  const nested = asRecord(response?.data);
  const codeValue = response?.code ?? response?.errorCode ?? nested?.code ?? nested?.errorCode;
  const errors = response?.errors ?? nested?.errors ?? response?.fieldErrors ?? nested?.fieldErrors;
  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(errors)) {
    errors.forEach((item) => {
      const value = asRecord(item);
      const field = String(value?.field ?? value?.property ?? value?.path ?? '').trim();
      const message = String(value?.message ?? value?.defaultMessage ?? '').trim();
      if (field && message) fieldErrors[field] = message;
    });
  } else {
    const values = asRecord(errors);
    if (values) Object.entries(values).forEach(([field, message]) => { if (typeof message === 'string' && message.trim()) fieldErrors[field] = message.trim(); });
  }
  const statusMessages: Record<number, string> = {
    400: 'Проверьте заполнение полей.', 401: 'Сессия истекла. Войдите заново.', 403: 'Недостаточно прав.',
    404: 'Запрошенные данные не найдены.', 409: 'Данные были изменены другим сотрудником.',
    422: 'Исправьте ошибки заполнения.', 503: 'Сервис временно недоступен.',
  };
  const backendMessage = response?.message ?? nested?.message ?? response?.error ?? nested?.error;
  const message = typeof backendMessage === 'string' && backendMessage.trim()
    ? backendMessage.replace(/[<>]/g, '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500)
    : status && statusMessages[status] ? statusMessages[status] : fallback;
  return {
    message,
    code: typeof codeValue === 'string' ? codeValue.trim().toUpperCase() : undefined,
    fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    status,
  };
};

export const getApiErrorCode = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error)) return undefined;
  const responseData = asRecord(error.response?.data);
  const nestedData = asRecord(responseData?.data);
  const code = responseData?.code || responseData?.errorCode || nestedData?.code || nestedData?.errorCode;
  return typeof code === 'string' ? code.trim().toUpperCase() : undefined;
};

export const getApiErrorMessage = (error: unknown, fallback = 'Не удалось выполнить запрос.'): string => {
  if (!axios.isAxiosError(error)) return error instanceof Error && error.message ? error.message : fallback;

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return 'Сервер не ответил вовремя. Проверьте подключение и повторите запрос.';
  }
  if (!error.response) {
    return 'Не удалось подключиться к серверу. Проверьте подключение и повторите запрос.';
  }

  const status = error.response?.status;
  const responseData = asRecord(error.response?.data);
  const nestedData = asRecord(responseData?.data);
  const validationErrors = responseData?.errors || nestedData?.errors;
  if (Array.isArray(validationErrors) && validationErrors.length) {
    const message = validationErrors.map((item) => {
      const record = asRecord(item);
      return typeof item === 'string' ? item : String(record?.message || record?.defaultMessage || '');
    }).filter(Boolean).join(', ');
    if (message) return message;
  }
  const backendMessage = responseData?.message
    || responseData?.error
    || nestedData?.message
    || nestedData?.error
    || (typeof error.response?.data === 'string' ? error.response.data : undefined);
  if (typeof backendMessage === 'string' && backendMessage.trim() && status !== 500) {
    const sanitized = backendMessage.replace(/[<>]/g, '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500);
    if (!/(stack trace|nullpointer|sql(exception|state)?|syntax error|at\s+[\w.$]+\(|org\.|java\.|sequelize|typeorm)/i.test(sanitized)) return sanitized;
  }

  if (status === 400) return 'Проверьте заполнение полей и отправленные данные.';
  if (status === 401) return 'Сессия истекла. Войдите заново.';
  if (status === 403) return 'У вас нет доступа к этому действию.';
  if (status === 404) return 'Запрошенная функция или запись не найдена.';
  if (status === 413) return 'Файл слишком большой для загрузки.';
  if (status === 415) return 'Формат файла не поддерживается.';
  if (status === 409) return 'Операция конфликтует с текущим состоянием данных.';
  if (status && status >= 500) return 'Сервис временно недоступен. Повторите попытку позже.';
  return error.message || fallback;
};

export interface ApiResponse<T> {
  success?: boolean;
  data: T;
  message?: string | null;
  errors?: string[];
}

export const unwrapApiResponse = <T>(response: ApiResponse<T> | T): T => {
  const record = asRecord(response);
  if (!record || !('data' in record)) return response as T;

  const apiResponse = response as ApiResponse<T>;
  if (apiResponse.success === false) {
    throw new Error(apiResponse.message || apiResponse.errors?.join(', ') || 'Ошибка выполнения запроса');
  }
  return apiResponse.data;
};

export const getContentDispositionFileName = (contentDisposition?: string): string | undefined => {
  if (!contentDisposition) return undefined;
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].replace(/["']/g, '').trim());
    } catch {
      return encodedMatch[1].replace(/["']/g, '').trim();
    }
  }
  return contentDisposition.match(/filename="?([^";]+)"?/i)?.[1]?.trim();
};
