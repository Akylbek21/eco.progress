import { getApiStatus, parseApiError } from '../services/apiHelpers';

const messages: Record<string, string> = {
  UNSUPPORTED_FILE_FORMAT: 'Формат файла не поддерживается. Выберите .xlsx, .xls или поддерживаемый backend файл .csv.',
  INVALID_HEADERS: 'Заголовки таблицы не соответствуют шаблону выбранного документа.',
  NO_DATA_ROWS: 'Файл не содержит распознаваемых строк нормативов.',
  IMPORT_NOT_FOUND: 'Сессия предварительного импорта не найдена. Загрузите файл повторно.',
  IMPORT_EXPIRED: 'Сессия предварительного импорта завершена. Загрузите файл повторно.',
  IMPORT_ALREADY_CONFIRMED: 'Этот импорт уже был подтверждён.',
  DOCUMENT_VERSION_CONFLICT: 'Редакция документа была изменена другим сотрудником. Обновите данные.',
};

export const parseNormativeApiError = (error: unknown) => {
  const parsed = parseApiError(error);
  const statusMessage = getApiStatus(error) === 415 ? messages.UNSUPPORTED_FILE_FORMAT : undefined;
  return { ...parsed, message: parsed.code && messages[parsed.code] ? messages[parsed.code] : statusMessage || parsed.message };
};
