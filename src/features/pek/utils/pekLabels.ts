import type { PekAvailableActionCode, PekProgramStatus, PekReportStatus } from '../api/pekContracts';

export const pekStatusLabels: Record<PekProgramStatus | PekReportStatus, string> = {
  DRAFT: 'Черновик',
  COLLECTING: 'Сбор данных',
  READY_FOR_REVIEW: 'Готов к проверке',
  UNDER_REVIEW: 'На проверке',
  RETURNED: 'Возвращён',
  APPROVED: 'Утверждён',
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
