export type DocumentStatus =
  | 'NEED_UPLOAD'
  | 'UPLOADED'
  | 'IN_REVIEW'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SIGNED';

export type DocumentVisibility = 'CLIENT' | 'STAFF' | 'INTERNAL';
export type AgreementStatus = 'PENDING' | 'ACCEPTED' | 'REVISION_REQUESTED' | 'SIGNED' | 'REJECTED';
export type ContractStatus = 'DRAFT' | 'SENT_TO_CLIENT' | 'UPLOADED_FOR_REVIEW' | 'SIGNED' | 'REJECTED';
export type PaymentStatus =
  | 'NOT_INVOICED'
  | 'INVOICE_SENT'
  | 'WAITING_PAYMENT'
  | 'RECEIPT_UPLOADED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'REJECTED'
  | 'OVERDUE';
export type MeasurementAgreementStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'RESCHEDULE_REQUESTED' | 'CONFIRMED' | 'COMPLETED';
export type ClientDocumentCategory = 'CLIENT_DOCUMENT' | 'PAYMENT_RECEIPT' | 'SUPPORTING_DOCUMENT' | 'OTHER_CLIENT_DOCUMENT';

export type SafeStatus<T extends string> = T | 'UNKNOWN';

export interface ClientDocumentMetadata {
  id: string;
  name: string;
  category?: string;
  status: SafeStatus<DocumentStatus>;
  visibility?: SafeStatus<DocumentVisibility>;
  required?: boolean;
  uploadedAt?: string;
  sentAt?: string;
  dueDate?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  staffComment?: string;
  revisionComment?: string;
  version?: number;
  uploadedBy?: string;
}

export interface ClientSummary { id: string; name: string; email?: string; phone?: string }
export interface CompanySummary { id?: string; name: string; bin?: string }
export interface ContractSummary { documentId: string; status: SafeStatus<ContractStatus>; requiresSignature: boolean; signedAt?: string; signerName?: string }
export interface InvoiceSummary { documentId: string; number: string; date?: string; amount?: number; currency?: string; dueDate?: string }
export interface PaymentSummary { status: SafeStatus<PaymentStatus>; paidAmount?: number; remainingAmount?: number }
export interface TimelineEvent { id: string; type: string; title: string; createdAt: string }

export interface ClientOrderDetails {
  id: string;
  number: string;
  status: string;
  serviceType: string;
  createdAt: string;
  client: ClientSummary;
  company?: CompanySummary;
  documents: ClientDocumentMetadata[];
  primaryDocuments: ClientDocumentMetadata[];
  contract?: ContractSummary;
  invoice?: InvoiceSummary;
  payment?: PaymentSummary;
  laboratory?: unknown;
  timeline: TimelineEvent[];
}
