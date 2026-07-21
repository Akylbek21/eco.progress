import { parseApiError } from '../services/apiHelpers';

const messages: Record<string, string> = {
  LABORATORY_NOT_FOUND: 'Лаборатория не найдена',
  LABORATORY_ARCHIVED: 'Лаборатория находится в архиве',
  DEFAULT_LABORATORY_NOT_CONFIGURED: 'Лаборатория по умолчанию не настроена',
  DEFAULT_LABORATORY_CANNOT_BE_ARCHIVED: 'Сначала назначьте другую лабораторию по умолчанию',
  LABORATORY_EMPLOYEE_ALREADY_EXISTS: 'Сотрудник уже добавлен в эту лабораторию',
  LABORATORY_ACCREDITATION_EXPIRED: 'Срок действия аттестата лаборатории истёк',
  INVALID_ACCREDITATION_PERIOD: 'Дата начала действия аттестата должна быть не позже даты окончания',
  UNSUPPORTED_LOGO_FORMAT: 'Поддерживаются только логотипы PNG и JPEG',
  LOGO_FILE_TOO_LARGE: 'Размер логотипа превышает допустимый',
};

export const parseLaboratoryApiError = (error: unknown) => {
  const parsed = parseApiError(error);
  return { ...parsed, message: parsed.code && messages[parsed.code] ? messages[parsed.code] : parsed.message };
};
