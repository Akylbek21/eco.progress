import type { ApiError } from '../../../services/apiHelpers';

export type QuickCreateErrorResolution = {
  message: string;
  field?: 'objectId' | 'executorId';
  resetIdempotencyKey: boolean;
  existingProtocolId?: string;
};

export const resolveQuickCreateApiError = (error: ApiError): QuickCreateErrorResolution => {
  if (error.resourceId) {
    return {
      message: error.message,
      resetIdempotencyKey: false,
      existingProtocolId: error.resourceId,
    };
  }

  switch (error.code) {
    case 'PROTOCOL_NUMBER_CONFLICT':
      return {
        message: 'Не удалось зарезервировать номер протокола. Повторите создание.',
        resetIdempotencyKey: false,
      };
    case 'IDEMPOTENCY_KEY_REUSED':
      return {
        message: 'Запрос уже был отправлен с другими данными. Повторите операцию.',
        resetIdempotencyKey: true,
      };
    case 'OBJECT_NOT_FOUND':
      return { message: error.message, field: 'objectId', resetIdempotencyKey: false };
    case 'EXECUTOR_NOT_FOUND':
    case 'EXECUTOR_LABORATORY_MISMATCH':
      return { message: error.message, field: 'executorId', resetIdempotencyKey: false };
    default:
      return {
        message: error.message || 'Не удалось создать протокол',
        resetIdempotencyKey: false,
      };
  }
};
