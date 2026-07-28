import type {
  PekAvailableActionCode,
  PekCollectionRunStatus,
  PekControlEventStatus,
  PekExceedanceStatus,
  PekProgramStatus,
  PekReportStatus,
} from '../api/pekContracts';

export const pekStatusLabels: Record<PekProgramStatus | PekReportStatus, string> = {
  DRAFT: 'Черновик',
  COLLECTING: 'Сбор данных',
  REQUIRES_CORRECTION: 'Требует исправления',
  READY_FOR_REVIEW: 'Готов к проверке',
  UNDER_REVIEW: 'На проверке',
  RETURNED: 'Возвращён',
  READY_FOR_APPROVAL: 'Готов к утверждению',
  APPROVED: 'Утверждён',
  READY_FOR_SIGNING: 'Готов к подписанию',
  SIGNED: 'Подписан',
  SUBMITTED: 'Отправлен',
  ACCEPTED: 'Принят',
  REJECTED: 'Отклонён',
  ACTIVE: 'Действует',
  ARCHIVED: 'Архив',
};

export const pekCollectionLabels: Record<PekCollectionRunStatus, string> = {
  PENDING: 'Ожидает запуска',
  RUNNING: 'Выполняется',
  SUCCESS: 'Завершён',
  PARTIAL_SUCCESS: 'Завершён частично',
  FAILED: 'Ошибка',
};

export const pekControlEventLabels: Record<PekControlEventStatus, string> = {
  NOT_STARTED: 'Не начато',
  PARTIAL: 'Частично',
  COMPLETED: 'Выполнено',
  OVERFULFILLED: 'Перевыполнено',
};

export const pekExceedanceLabels: Record<PekExceedanceStatus, string> = {
  OPEN: 'Обнаружено',
  ACTION_REQUIRED: 'Требуются меры',
  IN_PROGRESS: 'Меры выполняются',
  AWAITING_REPEAT_CONTROL: 'Ожидается повторный контроль',
  RESOLVED: 'Устранено',
  CANCELLED: 'Исключено',
};

export const pekActionLabels: Partial<Record<PekAvailableActionCode, string>> = {
  EDIT: 'Изменить',
  COLLECT: 'Собрать данные',
  VALIDATE: 'Проверить отчёт',
  SUBMIT_REVIEW: 'Отправить на проверку',
  START_REVIEW: 'Начать проверку',
  RETURN: 'Вернуть на исправление',
  ACCEPT_REVIEW: 'Принять проверку',
  APPROVE: 'Утвердить',
  PREPARE_SIGNING: 'Передать на подписание',
  SIGN: 'Подписать',
  REGISTER_SUBMISSION: 'Зарегистрировать отправку',
  REGISTER_RESULT: 'Зарегистрировать результат',
  CREATE_REVISION: 'Создать корректирующий отчёт',
  ARCHIVE: 'Архивировать',
};

export const labelPekStatus = (value?: string | null) =>
  value && value in pekStatusLabels
    ? pekStatusLabels[value as keyof typeof pekStatusLabels]
    : value || '—';
