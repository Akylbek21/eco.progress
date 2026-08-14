import { getApiErrorCode, getApiStatus } from '../../../services/apiHelpers';

const VERSION_CONFLICT_CODES = new Set([
  'VERSION_CONFLICT',
  'PROTOCOL_VERSION_CONFLICT',
  'OPTIMISTIC_LOCK_CONFLICT',
]);

export const isProtocolVersionConflict = (error: unknown) =>
  getApiStatus(error) === 409 && VERSION_CONFLICT_CODES.has(getApiErrorCode(error) || 'VERSION_CONFLICT');

export const protocolVersionConflictMessage = 'Протокол изменён другим сотрудником. Данные обновлены с сервера — повторите расчёт.';
