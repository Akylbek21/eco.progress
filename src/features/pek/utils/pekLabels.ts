import type { PekAvailableActionCode, PekProgramStatus, PekReportStatus, PekReportType } from '../api/pekContracts';

export const pekReportTypeLabels: Record<PekReportType, string> = {
  PEK_QUARTERLY: 'Квартальный отчёт ПЭК',
  PEK_TABLES_7_12_ANNUAL: 'Годовые таблицы ПЭК',
  PEM_CASPIAN_ANNUAL: 'Годовой производственный мониторинг Каспия',
};

export const labelPekReportType = (value?: PekReportType | null) =>
  value ? pekReportTypeLabels[value] || unknownEnum('reportType', value) : '—';

const unknownEnum = (kind: string, value: string) => {
  console.warn(`[PEK] Unknown ${kind}:`, value);
  return 'Неизвестный статус';
};

export const pekStatusLabels: Record<PekProgramStatus | PekReportStatus, string> = {
  DRAFT: 'Черновик',
  COLLECTING: 'Сбор данных',
  READY_FOR_REVIEW: 'Готов к проверке',
  UNDER_REVIEW: 'На проверке',
  RETURNED: 'Возвращён',
  APPROVED: 'Утверждён',
  SUBMITTED: 'Сдан',
  ACCEPTED: 'Принят',
  REJECTED: 'Отклонён',
  SIGNED: 'Подписан',
  ACTIVE: 'Действует',
  ARCHIVED: 'Архив',
};

export const pekActionLabels: Record<PekAvailableActionCode, string> = {
  EDIT: 'Изменить',
  SUBMIT_REVIEW: 'Отправить на проверку',
  RETURN: 'Вернуть на исправление',
  APPROVE: 'Утвердить',
  ACTIVATE: 'Активировать',
  ARCHIVE: 'Архивировать',
  CLONE: 'Клонировать',
  RETEMPLATE: 'Актуализировать шаблон',
};

export const labelPekStatus = (value?: string | null) =>
  value && value in pekStatusLabels
    ? pekStatusLabels[value as keyof typeof pekStatusLabels]
    : value ? unknownEnum('status', value) : '—';

export const pekSeverityLabels: Record<string, string> = {
  ERROR: 'Ошибка', WARNING: 'Предупреждение', INFO: 'Информация',
};
export const pekMatchStatusLabels: Record<string, string> = {
  MATCHED: 'Сопоставлен', MANUAL: 'Подтверждён вручную', MANUALLY_MATCHED: 'Подтверждён вручную',
  UNMATCHED: 'Не сопоставлен', AMBIGUOUS: 'Требует выбора', STALE: 'Источник изменён', EXCLUDED: 'Исключён',
};
export const pekPlanFactStatusLabels: Record<string, string> = {
  NOT_STARTED: 'Не выполнено', PARTIALLY_COMPLETED: 'Выполнено частично', COMPLETED: 'Выполнено',
  OVERDUE: 'Просрочено', EXCEEDED: 'Есть превышение', NOT_APPLICABLE: 'Не применяется',
};

export const labelPekSeverity = (value?: string | null) => value ? pekSeverityLabels[value] || unknownEnum('severity', value) : '—';
export const labelPekMatchStatus = (value?: string | null) => value ? pekMatchStatusLabels[value] || unknownEnum('matchStatus', value) : '—';
export const labelPekPlanFactStatus = (value?: string | null) => value ? pekPlanFactStatusLabels[value] || unknownEnum('planFactStatus', value) : '—';
