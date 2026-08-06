import type { UsageMetric } from '../../document-flow/model/types';

export const usageMetricLabels: Record<UsageMetric, string> = {
  ACTIVE_MEMBERS: 'Активные пользователи',
  DOCUMENTS_CREATED: 'Созданные документы',
  STORAGE_BYTES: 'Объём хранилища, байт',
  EXTERNAL_SIGNATURES_CREATED: 'Внешние подписания',
  SIGNATURES_CREATED: 'Подписания',
};
