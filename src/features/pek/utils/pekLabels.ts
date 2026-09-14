import type { PekAvailableActionCode, PekProgramStatus, PekReportStatus, PekReportType } from '../api/pekContracts';

export const pekReportTypeLabels: Record<PekReportType, string> = {
  PEK_QUARTERLY: 'Квартальный отчёт ПЭК',
  PEK_TABLES_7_12_ANNUAL: 'Годовые таблицы ПЭК',
  PEM_CASPIAN_ANNUAL: 'Годовой производственный мониторинг Каспия',
};

export const labelPekReportType = (value?: PekReportType | null) =>
  value ? pekReportTypeLabels[value] : '—';

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
};

export const labelPekStatus = (value?: string | null) =>
  value && value in pekStatusLabels
    ? pekStatusLabels[value as keyof typeof pekStatusLabels]
    : value || '—';
