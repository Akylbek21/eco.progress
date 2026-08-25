import type { ComparisonType, PekActionStatus, PekControlType, PekPeriodicity, PekReportStatus } from '../api/pekContracts';

export const comparisonTypeLabels: Record<ComparisonType, string> = {
  LESS_OR_EQUAL: 'Не более',
  GREATER_OR_EQUAL: 'Не менее',
  RANGE: 'Диапазон',
  BETWEEN: 'Между значениями',
  EQUAL: 'Равно',
  ABSENT: 'Не допускается',
  INFO: 'Информационный показатель',
};

export const pekControlTypeLabels: Record<PekControlType, string> = {
  EMISSION: 'Выбросы в атмосферу',
  AMBIENT_AIR: 'Атмосферный воздух',
  WATER_INTAKE: 'Забор воды',
  WASTEWATER: 'Сточные воды',
  WASTE: 'Отходы',
  SOIL: 'Почва',
  PHYSICAL_FACTOR: 'Физические факторы',
  BIODIVERSITY: 'Биоразнообразие',
};

export const pekPeriodicityLabels: Record<PekPeriodicity, string> = {
  DAILY: 'Ежедневно',
  WEEKLY: 'Еженедельно',
  MONTHLY: 'Ежемесячно',
  QUARTERLY: 'Ежеквартально',
  SEMIANNUAL: 'Один раз в полугодие',
  ANNUAL: 'Ежегодно',
  PER_EVENT: 'При наступлении события',
};

export const pekActionStatusLabels: Record<PekActionStatus, string> = {
  PLANNED: 'Запланировано',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Выполнено',
  OVERDUE: 'Просрочено',
  CANCELLED: 'Отменено',
};

export const pekReportStatusLabels: Record<PekReportStatus, string> = {
  DRAFT: 'Черновик',
  COLLECTING: 'Сбор данных',
  READY_FOR_REVIEW: 'На проверке',
  RETURNED: 'Возвращён на доработку',
  APPROVED: 'Утверждён',
  SUBMITTED: 'Сдан',
  ACCEPTED: 'Принят',
  REJECTED: 'Отклонён',
  SIGNED: 'Подписан',
  ARCHIVED: 'В архиве',
};

export const dictionaryOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({ value, label }));

export const comparisonTypeOptions = dictionaryOptions(comparisonTypeLabels);
export const pekControlTypeOptions = dictionaryOptions(pekControlTypeLabels);
export const pekPeriodicityOptions = dictionaryOptions(pekPeriodicityLabels);
export const pekActionStatusOptions = dictionaryOptions(pekActionStatusLabels);

export const migrateComparisonType = (value: unknown): ComparisonType | null => {
  if (value === 'MAX') return 'LESS_OR_EQUAL';
  if (value === 'MIN') return 'GREATER_OR_EQUAL';
  if (value === 'INFORMATIONAL') return 'INFO';
  return typeof value === 'string' && value in comparisonTypeLabels ? value as ComparisonType : null;
};
