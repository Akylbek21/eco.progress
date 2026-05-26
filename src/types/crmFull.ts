export type CrmDocumentType =
  | 'primary'
  | 'requisites'
  | 'commercial_offer'
  | 'contract'
  | 'invoice'
  | 'act'
  | 'protocol'
  | 'ecological_project'
  | 'waste_passport'
  | 'permit'
  | 'conclusion'
  | 'letter'
  | 'work_result'
  | 'signature_document'
  | 'other';

export type CrmDocumentStatus =
  | 'draft'
  | 'requested'
  | 'uploaded_by_client'
  | 'under_review'
  | 'accepted'
  | 'revision_required'
  | 'rejected'
  | 'sent_to_client'
  | 'waiting_signature'
  | 'signed_by_client'
  | 'sent_without_signature'
  | 'client_requested_revision'
  | 'archived';

export type ClientResponseStatus = 'pending' | 'accepted' | 'signed' | 'sent_without_signature' | 'revision_requested';

export type CrmDocument = {
  id: string;
  orderId: string;
  clientId: string;
  title: string;
  type: CrmDocumentType;
  status: CrmDocumentStatus;
  fileUrl?: string;
  uploadedBy?: string;
  needsSignature: boolean;
  needsClientResponse: boolean;
  sentToClient: boolean;
  clientResponseStatus?: ClientResponseStatus;
  clientComment?: string;
  staffComment?: string;
  signedFileUrl?: string;
  revisionReason?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type UploadDocumentPayload = {
  file: File;
  type: CrmDocumentType | string;
  title: string;
  comment?: string;
  sendToClient?: boolean;
  needsSignature?: boolean;
  needsClientResponse?: boolean;
  dueDate?: string;
};

export type SendDocumentToClientPayload = {
  comment?: string;
  needsSignature: boolean;
  needsClientResponse: boolean;
  dueDate?: string;
};

export type AgreementAction = 'accept' | 'sign_and_send' | 'send_without_signature' | 'request_revision';
export type AgreementStatus = 'created' | 'accepted' | 'signed' | 'sent_without_signature' | 'revision_requested';

export type AgreementResponse = {
  id: string;
  orderId: string;
  sourceDocumentId: string;
  action: AgreementAction;
  comment?: string;
  fileUrl?: string;
  status: AgreementStatus;
  createdAt: string;
};

export type ClientPrimaryDocumentUploadPayload = {
  file: File;
  comment?: string;
  documentId: string;
};

export type CommercialOfferStatus = 'not_created' | 'preparing' | 'sent_to_client' | 'approved' | 'requires_changes' | 'rejected';

export type CommercialOffer = {
  id: string;
  orderId: string;
  amount: number;
  deadline: string;
  status: CommercialOfferStatus;
  fileUrl?: string;
  comment?: string;
  createdBy: string;
  createdAt: string;
};

export type FullContractType = 'one_time' | 'annual' | 'quarterly' | 'laboratory' | 'projecting' | 'waste' | 'complex';
export type FullContractStatus =
  | 'not_created'
  | 'preparing'
  | 'sent_to_client'
  | 'waiting_signature'
  | 'signed_by_client'
  | 'signed_by_both'
  | 'requires_fix'
  | 'cancelled';

export type FullContract = {
  id: string;
  orderId: string;
  number?: string;
  contractDate?: string;
  amount?: number;
  type: FullContractType;
  startDate?: string;
  endDate?: string;
  fileUrl?: string;
  signedFileUrl?: string;
  status: FullContractStatus;
  comment?: string;
};

export type InvoicePaymentStatus = 'not_created' | 'invoice_created' | 'invoice_sent' | 'awaiting_payment' | 'partial_paid' | 'paid' | 'debt';

export type InvoicePayment = {
  id: string;
  orderId: string;
  contractId?: string;
  contractAmount?: number;
  invoiceNumber?: string;
  invoiceAmount?: number;
  invoiceDate?: string;
  dueDate?: string;
  invoiceFileUrl?: string;
  invoiceStatus?: InvoicePaymentStatus;
  paymentStatus?: InvoicePaymentStatus;
  clientReceiptUrl?: string;
  paymentOrderUrl?: string;
  paidAmount?: number;
  remainingAmount?: number;
  accountantComment?: string;
};

export type WasteRemovalStatus =
  | 'not_assigned'
  | 'data_check'
  | 'date_agreement'
  | 'visit_scheduled'
  | 'removed'
  | 'act_uploaded'
  | 'result_sent'
  | 'completed';

export type WasteRemoval = {
  id: string;
  orderId: string;
  wasteType?: string;
  volume?: string;
  hazardClass?: string;
  pickupAddress?: string;
  pickupDate?: string;
  transport?: string;
  driverOrExecutor?: string;
  status: WasteRemovalStatus;
  actUrl?: string;
  photoUrls?: string[];
  comment?: string;
};

export type StaffCalendarEventType = 'laboratory' | 'waste' | 'task';
export type StaffCalendarEventStatus = 'today' | 'planned' | 'overdue' | 'rescheduled' | 'completed';

export type StaffCalendarEvent = {
  id: string;
  orderId?: string;
  type: StaffCalendarEventType;
  title: string;
  date: string;
  time?: string;
  address?: string;
  contactPerson?: string;
  measurementType?: string;
  transport?: string;
  executor?: string;
  status: StaffCalendarEventStatus;
};

export type TaskStatus = 'new' | 'in_progress' | 'waiting_client' | 'done' | 'overdue' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Task = {
  id: string;
  orderId: string;
  title: string;
  responsibleId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  comment?: string;
  createdAt: string;
};

export type CrmNotificationType =
  | 'document_requested'
  | 'invoice_issued'
  | 'contract_sent'
  | 'signature_required'
  | 'result_ready'
  | 'order_completed'
  | 'new_order'
  | 'client_uploaded_document'
  | 'client_signed_document'
  | 'client_requested_revision'
  | 'client_uploaded_receipt'
  | 'payment_waiting_review'
  | 'assigned_to_specialist'
  | 'result_overdue';

export type CrmNotification = {
  id: string;
  userId: string;
  orderId?: string;
  title: string;
  message: string;
  type: CrmNotificationType;
  isRead: boolean;
  createdAt: string;
  link?: string;
};

export type Client = {
  id: string;
  type: 'individual' | 'company';
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  companyName?: string;
  bin?: string;
  city?: string;
  legalAddress?: string;
};

export type CompanyProfileChangeRequest = {
  companyName: string;
  bin: string;
  legalAddress: string;
  contactPerson: string;
  phone: string;
  email: string;
  whatsapp?: string;
  comment?: string;
};

export type FinalOrderChecklist = {
  resultUploaded: boolean;
  documentSentToClient: boolean;
  clientAcceptedOrSigned: boolean;
  paymentClosed: boolean;
  noActiveDebt: boolean;
  internalTasksDone: boolean;
};

export type Quarter = {
  id: string;
  contractId: string;
  orderId: string;
  quarterLabel: string;
  periodStart: string;
  periodEnd: string;
  workStatus:
    | 'planned'
    | 'documents_needed'
    | 'awaiting_payment'
    | 'paid'
    | 'in_progress'
    | 'on_agreement'
    | 'done'
    | 'overdue'
    | 'blocked_by_debt';
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'debt';
  plannedAmount: number;
  paidAmount: number;
  remainingAmount: number;
};

export type StaffManualOrderPayload = {
  clientId?: string;
  clientName: string;
  companyName: string;
  bin: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  city?: string;
  serviceId?: string;
  service: string;
  serviceType: string;
  urgency: string;
  source: 'site' | 'whatsapp' | 'call' | 'instagram' | 'recommendation' | 'old_client' | 'other';
  comment?: string;
  responsibleManagerId?: string;
  files?: File[];
};
