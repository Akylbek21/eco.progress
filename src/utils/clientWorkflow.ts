import type {
  AgreementStatus,
  ContractStatus,
  PaymentStatus,
  DocumentStatus,
  SafeStatus,
} from '../types/clientWorkflow';

const normalize = <T extends string>(value: unknown, aliases: Record<string, T>, known: readonly T[], kind: string): SafeStatus<T> => {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  const status = aliases[raw] || aliases[raw.toLowerCase()] || (known.includes(upper as T) ? upper as T : undefined);
  if (status) return status;
  if (raw) console.error(`[client-workflow] Unknown ${kind} status`, raw);
  return 'UNKNOWN';
};

const documentStatuses: DocumentStatus[] = ['NEED_UPLOAD', 'UPLOADED', 'IN_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'SIGNED'];
export const normalizeDocumentStatus = (status: unknown): SafeStatus<DocumentStatus> => normalize(status, {
  need_upload: 'NEED_UPLOAD', not_uploaded: 'NEED_UPLOAD', uploaded: 'UPLOADED', sent: 'IN_REVIEW',
  in_review: 'IN_REVIEW', under_review: 'IN_REVIEW', needs_fix: 'REVISION_REQUESTED',
  revision_required: 'REVISION_REQUESTED', accepted: 'APPROVED', approved: 'APPROVED',
  rejected: 'REJECTED', signed: 'SIGNED',
}, documentStatuses, 'document');

const agreementStatuses: AgreementStatus[] = ['PENDING', 'ACCEPTED', 'REVISION_REQUESTED', 'SIGNED', 'REJECTED'];
export const normalizeAgreementStatus = (status: unknown): SafeStatus<AgreementStatus> => normalize(status, {
  pending: 'PENDING', accepted: 'ACCEPTED', revision_requested: 'REVISION_REQUESTED', signed: 'SIGNED', rejected: 'REJECTED',
}, agreementStatuses, 'agreement');

const contractStatuses: ContractStatus[] = ['DRAFT', 'SENT_TO_CLIENT', 'UPLOADED_FOR_REVIEW', 'SIGNED', 'REJECTED'];
export const normalizeContractStatus = (status: unknown): SafeStatus<ContractStatus> => normalize(status, {
  draft: 'DRAFT', not_created: 'DRAFT', prepared: 'DRAFT', sent: 'SENT_TO_CLIENT', sent_to_client: 'SENT_TO_CLIENT',
  waiting_signature: 'SENT_TO_CLIENT', uploaded_for_review: 'UPLOADED_FOR_REVIEW', signed: 'SIGNED', rejected: 'REJECTED',
}, contractStatuses, 'contract');

const paymentStatuses: PaymentStatus[] = ['NOT_INVOICED', 'INVOICE_SENT', 'WAITING_PAYMENT', 'RECEIPT_UPLOADED', 'PARTIALLY_PAID', 'PAID', 'REJECTED', 'OVERDUE'];
export const normalizeClientPaymentStatus = (status: unknown): SafeStatus<PaymentStatus> => normalize(status, {
  not_sent: 'NOT_INVOICED', awaiting_invoice: 'NOT_INVOICED', invoice_issued: 'INVOICE_SENT', invoice_sent: 'INVOICE_SENT',
  pending: 'WAITING_PAYMENT', awaiting_payment: 'WAITING_PAYMENT', receipt_uploaded: 'RECEIPT_UPLOADED',
  partial: 'PARTIALLY_PAID', partially_paid: 'PARTIALLY_PAID', paid: 'PAID', transferred_to_specialist: 'PAID',
  debt: 'OVERDUE', overdue: 'OVERDUE', rejected: 'REJECTED',
}, paymentStatuses, 'payment');

const documentLabels: Record<DocumentStatus, string> = {
  NEED_UPLOAD: 'Не загружен', UPLOADED: 'Загружен', IN_REVIEW: 'На проверке',
  REVISION_REQUESTED: 'Требуется исправление', APPROVED: 'Принят', REJECTED: 'Отклонён', SIGNED: 'Подписан',
};
export const getDocumentStatusLabel = (status: unknown) => {
  const normalized = normalizeDocumentStatus(status);
  return normalized === 'UNKNOWN' ? 'Неизвестный статус' : documentLabels[normalized];
};
export const getDocumentStatusColor = (status: unknown) => {
  const normalized = normalizeDocumentStatus(status);
  if (['APPROVED', 'SIGNED'].includes(normalized)) return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (['REVISION_REQUESTED', 'REJECTED'].includes(normalized)) return 'bg-rose-50 text-rose-800 ring-rose-100';
  if (normalized === 'IN_REVIEW') return 'bg-indigo-50 text-indigo-800 ring-indigo-100';
  if (normalized === 'UPLOADED') return 'bg-sky-50 text-sky-800 ring-sky-100';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

export const getPaymentStatusLabel = (status: unknown) => {
  const normalized = normalizeClientPaymentStatus(status);
  const labels: Record<PaymentStatus, string> = { NOT_INVOICED: 'Счёт не выставлен', INVOICE_SENT: 'Счёт отправлен', WAITING_PAYMENT: 'Ожидаем оплату', RECEIPT_UPLOADED: 'Подтверждение на проверке', PARTIALLY_PAID: 'Оплачено частично', PAID: 'Оплачено', REJECTED: 'Подтверждение отклонено', OVERDUE: 'Просрочено' };
  return normalized === 'UNKNOWN' ? 'Неизвестный статус' : labels[normalized];
};
export const getContractStatusLabel = (status: unknown) => {
  const normalized = normalizeContractStatus(status);
  const labels: Record<ContractStatus, string> = { DRAFT: 'Черновик', SENT_TO_CLIENT: 'Ожидает подписи', UPLOADED_FOR_REVIEW: 'Подпись на проверке', SIGNED: 'Подписан', REJECTED: 'Отклонён' };
  return normalized === 'UNKNOWN' ? 'Неизвестный статус' : labels[normalized];
};
export const getAgreementStatusLabel = (status: unknown) => {
  const normalized = normalizeAgreementStatus(status);
  const labels: Record<AgreementStatus, string> = { PENDING: 'Ожидает ответа', ACCEPTED: 'Принят', REVISION_REQUESTED: 'Запрошено исправление', SIGNED: 'Подписан', REJECTED: 'Отклонён' };
  return normalized === 'UNKNOWN' ? 'Неизвестный статус' : labels[normalized];
};

export const canUploadDocument = (status: unknown) => ['NEED_UPLOAD', 'UPLOADED', 'REVISION_REQUESTED'].includes(normalizeDocumentStatus(status));
export const canDeleteDocument = (status: unknown) => normalizeDocumentStatus(status) === 'UPLOADED';
export const canRespondToAgreement = (status: unknown) => normalizeAgreementStatus(status) === 'PENDING';
export const canSignContract = (status: unknown) => normalizeContractStatus(status) === 'SENT_TO_CLIENT';
