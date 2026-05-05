export type EmployeeRole = 'admin' | 'manager' | 'accountant' | 'ecologist' | 'laboratory';

export type CrmPaymentStatus = 'unpaid' | 'awaiting_payment' | 'partially_paid' | 'paid';

export type EcologyStatus = 'not_started' | 'in_progress' | 'waiting_client_data' | 'done';

export type LaboratoryStatus = 'not_assigned' | 'waiting_samples' | 'samples_received' | 'analysis_in_progress' | 'result_ready';

export type CrmContractStatus = 'not_created' | 'prepared' | 'sent_to_client' | 'waiting_signature' | 'signed' | 'rejected';

export type CrmDocumentStatus = 'draft' | 'review' | 'waiting_signature' | 'signed' | 'ready' | 'rejected';

export type StaffOrderStage = 'manager' | 'accounting' | 'ecology' | 'laboratory' | 'documents' | 'done';

export const ecologyStatusLabels: Record<EcologyStatus, string> = {
  not_started: 'Не начато',
  in_progress: 'В работе',
  waiting_client_data: 'Нужны данные от клиента',
  done: 'Готово',
};

export const laboratoryStatusLabels: Record<LaboratoryStatus, string> = {
  not_assigned: 'Не назначено',
  waiting_samples: 'Ожидаем образцы',
  samples_received: 'Образцы получены',
  analysis_in_progress: 'Анализ в работе',
  result_ready: 'Результат готов',
};

export const contractStatusLabels: Record<CrmContractStatus, string> = {
  not_created: 'Не создан',
  prepared: 'Подготовлен',
  sent_to_client: 'Отправлен клиенту',
  waiting_signature: 'Ждёт подписи',
  signed: 'Подписан',
  rejected: 'Отклонён',
};

export const documentStatusLabels: Record<CrmDocumentStatus, string> = {
  draft: 'Черновик',
  review: 'На проверке',
  waiting_signature: 'Ждёт подписи',
  signed: 'Подписан',
  ready: 'Готов',
  rejected: 'Отклонён',
};
