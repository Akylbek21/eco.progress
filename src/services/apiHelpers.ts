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

export const getApiErrorCode = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error)) return undefined;
  const responseData = asRecord(error.response?.data);
  const nestedData = asRecord(responseData?.data);
  const code = responseData?.code || responseData?.errorCode || nestedData?.code || nestedData?.errorCode;
  return typeof code === 'string' ? code.trim().toUpperCase() : undefined;
};

export const getApiErrorMessage = (error: unknown, fallback = 'Не удалось выполнить запрос.'): string => {
  if (!axios.isAxiosError(error)) return error instanceof Error && error.message ? error.message : fallback;

  const status = error.response?.status;
  const responseData = asRecord(error.response?.data);
  const nestedData = asRecord(responseData?.data);
  const validationErrors = responseData?.errors || nestedData?.errors;
  if (Array.isArray(validationErrors) && validationErrors.length) {
    const message = validationErrors.map((item) => {
      const record = asRecord(item);
      return typeof item === 'string' ? item : String(record?.message || record?.defaultMessage || '');
    }).filter(Boolean).join('\n');
    if (message) return message;
  }
  const backendMessage = responseData?.message
    || responseData?.error
    || nestedData?.message
    || nestedData?.error
    || (typeof error.response?.data === 'string' ? error.response.data : undefined);
  if (typeof backendMessage === 'string' && backendMessage.trim()) return backendMessage;

  if (status === 400) return 'Проверьте заполнение полей и отправленные данные.';
  if (status === 401) return 'Сессия истекла. Войдите заново.';
  if (status === 403) return 'Нет доступа к операции.';
  if (status === 404) return 'Запись или endpoint не найдены.';
  if (status === 409) return 'Операция конфликтует с текущим состоянием данных.';
  return error.message || fallback;
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
