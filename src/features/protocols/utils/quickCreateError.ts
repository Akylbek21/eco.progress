import type { ApiError } from '../../../services/apiHelpers';
import type { QuickCreateProtocolRequest } from '../api/protocolContracts';

export type QuickCreateErrorResolution = {
  message: string;
  field?: 'objectId' | 'executorId';
  resetIdempotencyKey: boolean;
  existingProtocolId?: string;
  serverFailure?: boolean;
};

const sortedKeys = (value: object | null | undefined): string[] =>
  value ? Object.keys(value).sort() : [];

export const buildQuickCreateTechnicalReport = (
  error: ApiError,
  payload?: QuickCreateProtocolRequest | null,
  idempotencyKey?: string | null,
) => ({
  endpoint: 'POST /api/protocols/quick-create',
  status: error.status,
  code: error.code,
  traceId: error.requestCode || error.traceId || error.requestId,
  clientContract: 'quick-create-canonical-2026-07-30',
  idempotencyKeyPrefix: idempotencyKey ? `${idempotencyKey.slice(0, 8)}…` : undefined,
  payloadShape: payload
    ? {
        templateId: payload.templateId,
        requiredDatesPresent: {
          protocolDate: Boolean(payload.protocolDate),
          sampleDate: Boolean(payload.sampleDate),
          measurementDate: Boolean(payload.measurementDate),
          testingStartDate: Boolean(payload.testingStartDate),
          testingEndDate: Boolean(payload.testingEndDate),
        },
        requiredIdsPresent: {
          companyId: Number.isFinite(payload.companyId),
          objectId: Number.isFinite(payload.objectId),
          laboratoryId: Number.isFinite(payload.laboratoryId),
          laboratoryEmployeeId: Number.isFinite(payload.laboratoryEmployeeId),
        },
        sourceNumberPresent: Boolean(payload.sourceNumber),
        measurementCount: payload.measurements.length,
        measurementKeys: [...new Set(payload.measurements.flatMap(sortedKeys))].sort(),
        conditionsKeys: sortedKeys(payload.conditions),
        printVisibilityKeys: sortedKeys(payload.printVisibility),
        linkageKeys: payload.orderId === undefined ? [] : ['orderId'],
      }
    : undefined,
});

export const resolveQuickCreateApiError = (error: ApiError): QuickCreateErrorResolution => {
  if (error.resourceId) {
    return {
      message: error.message,
      resetIdempotencyKey: false,
      existingProtocolId: error.resourceId,
    };
  }

  if (error.code === 'INTERNAL_SCHEMA_ERROR') {
    return {
      message: 'Backend не смог записать протокол из-за несогласованной схемы данных. Форма сохранена во временном черновике. Повторите отправку с тем же запросом после исправления backend и передайте разработчикам код обращения.',
      resetIdempotencyKey: false,
      serverFailure: true,
    };
  }

  if (error.status === 500) {
    return {
      message: 'Сервер не завершил создание протокола. Данные формы сохранены во временном черновике. Повторите операцию после устранения ошибки на сервере.',
      resetIdempotencyKey: false,
      serverFailure: true,
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
