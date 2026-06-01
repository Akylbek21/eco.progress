import type {
  ClientPrimaryDocumentStatus,
  LaboratoryMeasurementAgreementStatus,
  LaboratoryPrimaryDocumentStatus,
  LaboratoryResultDocumentStatus,
  LaboratoryStatus,
  OrderStatus,
  PaymentStatus,
} from '../types';

const orderStatusMap: Record<string, string> = {
  'Новая заявка': 'CONSULTATION',
  'Связаться с клиентом': 'CONSULTATION',
  'Консультация': 'CONSULTATION',
  'Ожидаем первичные документы': 'ANALYSIS',
  'Документы на проверке': 'ANALYSIS',
  'Анализ заявки': 'ANALYSIS',
  'Анализ': 'ANALYSIS',
  'Подготовка КП': 'COMMERCIAL_PROPOSAL',
  'КП отправлено': 'COMMERCIAL_PROPOSAL',
  'КП согласовано': 'COMMERCIAL_PROPOSAL',
  'КП': 'COMMERCIAL_PROPOSAL',
  'Подготовка договора': 'CONTRACT',
  'Договор отправлен': 'CONTRACT',
  'Ожидаем подпись договора': 'CONTRACT',
  'Договор подписан': 'CONTRACT',
  'Договор': 'CONTRACT',
  'Передано бухгалтеру': 'INVOICE',
  'Ожидает счет': 'INVOICE',
  'Счет отправлен': 'INVOICE',
  'Ожидаем оплату': 'INVOICE',
  'Частично оплачено': 'INVOICE',
  'Полностью оплачено': 'INVOICE',
  'Передано специалисту': 'DESIGN',
  'Счет на оплату': 'INVOICE',
  'Проектирование': 'DESIGN',
  'Лаборатория': 'LABORATORY',
  'Вывоз': 'WASTE_REMOVAL',
  'Утилизация': 'UTILIZATION',
  'Проверка результата': 'QUALITY_CHECK',
  'Готово': 'READY',
  'Завершено': 'COMPLETED',
  'Отменено': 'CANCELLED',
  annual_active: 'ANNUAL_ACTIVE',
};

const orderStatusEnumValues = new Set([
  'CONSULTATION',
  'ANALYSIS',
  'COMMERCIAL_PROPOSAL',
  'CONTRACT',
  'INVOICE',
  'DESIGN',
  'LABORATORY',
  'WASTE_REMOVAL',
  'UTILIZATION',
  'QUALITY_CHECK',
  'READY',
  'COMPLETED',
  'CANCELLED',
  'ANNUAL_ACTIVE',
]);

export const toBackendOrderStatus = (status: OrderStatus | string) => {
  const raw = String(status);
  return orderStatusEnumValues.has(raw) ? raw : orderStatusMap[raw] || raw;
};

export const toBackendPaymentStatus = (status: PaymentStatus | string) => {
  const map: Record<string, string> = {
    awaiting_invoice: 'unpaid',
    invoice_issued: 'pending',
    invoice_sent: 'pending',
    awaiting_payment: 'pending',
    debt: 'overdue',
    transferred_to_specialist: 'paid',
  };
  return map[String(status)] || String(status);
};

export const toBackendPrimaryDocumentStatus = (status: ClientPrimaryDocumentStatus | string) => {
  const map: Record<string, string> = {
    accepted: 'approved',
    under_review: 'in_review',
    sent: 'in_review',
  };
  return map[String(status)] || String(status);
};

export const toBackendLaboratoryPrimaryStatus = (status: LaboratoryPrimaryDocumentStatus | string) => {
  const map: Record<string, string> = {
    not_uploaded: 'need_upload',
    revision_required: 'needs_fix',
    not_required: 'approved',
  };
  return map[String(status)] || String(status);
};

export const toBackendLaboratoryStatus = (status: LaboratoryStatus | string) => {
  const map: Record<string, string> = {
    result_ready: 'done',
  };
  return map[String(status)] || String(status);
};

export const toBackendMeasurementStatus = (status: LaboratoryMeasurementAgreementStatus | string) => {
  const map: Record<string, string> = {
    sent_to_client: 'sent',
    accepted_by_client: 'accepted',
    reschedule_requested: 'rescheduled',
    cancelled: 'rejected',
  };
  return map[String(status)] || String(status);
};

export const toBackendLaboratoryResultStatus = (status: LaboratoryResultDocumentStatus | string) => {
  const map: Record<string, string> = {
    draft: 'pending',
    in_progress: 'under_review',
    ready: 'uploaded',
    published_to_client: 'approved',
    archived: 'approved',
  };
  return map[String(status)] || String(status);
};
