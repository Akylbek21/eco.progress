export type ClientType = 'individual' | 'company';
export type UserRole = 'CLIENT' | 'MANAGER' | 'ADMIN' | 'ACCOUNTANT' | 'ECOLOGIST' | 'LABORATORY';

export type ServiceCategory = 'Проектирование' | 'Разрешения' | 'Лаборатория' | 'Отходы' | 'Предприятия';

export type ServiceItem = {
  id: string;
  businessCompanyId: string;
  title: string;
  category: ServiceCategory;
  description: string;
  forWhom: string;
  result: string;
  includes: string[];
  documents: string[];
  workflow: string[];
  duration: string;
  icon?: string;
};

export type BusinessCompany = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  serviceCategories: ServiceCategory[];
};

export type NewsItem = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  image: string;
  content: string[];
};

export type Employee = {
  id: string;
  name: string;
  position: string;
  experience: string;
  specialty: string;
  summary: string;
  avatar: string;
};

export type OrderStatus =
  | 'Новая заявка'
  | 'Связаться с клиентом'
  | 'Консультация'
  | 'Ожидаем первичные документы'
  | 'Анализ заявки'
  | 'Подготовка КП'
  | 'КП отправлено'
  | 'КП согласовано'
  | 'Подготовка договора'
  | 'Договор отправлен'
  | 'Ожидаем подпись договора'
  | 'Договор подписан'
  | 'Передано бухгалтеру'
  | 'Ожидает счет'
  | 'Счет отправлен'
  | 'Ожидаем оплату'
  | 'Частично оплачено'
  | 'Полностью оплачено'
  | 'Передано специалисту'
  | 'Анализ'
  | 'КП'
  | 'Договор'
  | 'Счет на оплату'
  | 'annual_active'
  | 'Проектирование'
  | 'Лаборатория'
  | 'Вывоз'
  | 'Утилизация'
  | 'Проверка результата'
  | 'Документы на проверке'
  | 'На консультации'
  | 'На согласовании'
  | 'На исправлении'
  | 'Оплачено'
  | 'В работе'
  | 'Готово'
  | 'Завершено'
  | 'Отменено';

export type OrderStatusCategory = 'client' | 'commercial' | 'legal' | 'finance' | 'work' | 'quality' | 'done' | 'cancelled';

export type OrderStatusDefinition = {
  id: OrderStatus;
  label: string;
  description: string;
  order: number;
  category: OrderStatusCategory;
  clientVisibleLabel: string;
  employeeActionLabel: string;
};

export type PaymentStatus =
  | 'not_sent'
  | 'awaiting_invoice'
  | 'invoice_issued'
  | 'invoice_sent'
  | 'pending'
  | 'awaiting_payment'
  | 'partial'
  | 'paid'
  | 'debt'
  | 'transferred_to_specialist';
export type EcologyStatus = 'not_started' | 'in_progress' | 'waiting_client_data' | 'done';
export type LaboratoryStatus = 'not_assigned' | 'waiting_samples' | 'samples_received' | 'analysis_in_progress' | 'result_ready';
export type LaboratoryPrimaryDocumentStatus = 'not_uploaded' | 'uploaded' | 'in_review' | 'approved' | 'revision_required' | 'not_required';
export type ClientPrimaryDocumentStatus = 'need_upload' | 'uploaded' | 'sent' | 'in_review' | 'under_review' | 'accepted' | 'approved' | 'needs_fix' | 'rejected';
export type LaboratoryMeasurementAgreementStatus = 'draft' | 'sent_to_client' | 'accepted_by_client' | 'reschedule_requested' | 'confirmed' | 'completed' | 'cancelled';
export type LaboratoryResultDocumentStatus = 'draft' | 'in_progress' | 'ready' | 'published_to_client' | 'archived';
export type StaffContractStatus = 'not_created' | 'prepared' | 'sent_to_client' | 'waiting_signature' | 'signed' | 'rejected';
export type PaymentRecordStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'other';
export type ContractType = 'one_time' | 'annual_quarterly';
export type QuarterScheduleType = 'calendar_quarters' | 'contract_quarters';
export type ContractStatus = 'draft' | 'active' | 'completed' | 'terminated';
export type QuarterNumber = 1 | 2 | 3 | 4;
export type QuarterLabel = '1 квартал' | '2 квартал' | '3 квартал' | '4 квартал';
export type WorkStage = 'Проектирование' | 'Лаборатория' | 'Вывоз' | 'Утилизация';
export type QuarterWorkStatus = 'planned' | 'waiting_client_data' | 'ready_to_start' | 'in_progress' | 'completed' | 'waiting_payment' | 'blocked_by_debt';
export type DebtStatus = 'active' | 'partial' | 'closed' | 'overdue';
export type DebtReason = 'quarter_payment' | 'invoice_unpaid' | 'partial_payment' | 'overdue_payment';

export type CRMActionType =
  | 'status_changed'
  | 'payment_changed'
  | 'internal_note_added'
  | 'client_message_added'
  | 'contract_updated'
  | 'document_ready'
  | 'manager_assigned'
  | 'order_created'
  | 'document_uploaded';

export type DocumentItem = {
  id: string;
  orderId?: string;
  name: string;
  type: 'client' | 'result' | 'invoice' | 'internal';
  uploadedAt: string;
  status: string;
  fileUrl?: string;
};

export type QuarterDocument = {
  id: string;
  quarterId: string;
  requestId: string;
  contractId: string;
  name: string;
  fileName: string;
  fileUrl?: string;
  fileType: string;
  fileSize?: number;
  documentType: 'client_data' | 'invoice' | 'act' | 'protocol' | 'report' | 'result' | 'other';
  uploadedByRole: 'admin' | 'accountant' | 'manager' | 'employee' | 'client';
  uploadedByName: string;
  uploadedAt: string;
};

export type QuarterResult = {
  id: string;
  quarterId: string;
  requestId: string;
  title: string;
  description?: string;
  resultType: 'laboratory_protocol' | 'project_document' | 'waste_removal_act' | 'utilization_act' | 'report' | 'other';
  attachedDocumentIds: string[];
  createdByName: string;
  createdAt: string;
};

export type QuarterComment = {
  id: string;
  quarterId: string;
  requestId: string;
  author: string;
  text: string;
  visibility: 'client' | 'internal';
  createdAt: string;
};

export type RequestQuarter = {
  id: string;
  requestId: string;
  contractId: string;
  quarter: QuarterNumber;
  quarterLabel: QuarterLabel;
  periodStart: string;
  periodEnd: string;
  serviceName: string;
  workStage: WorkStage;
  workStatus: QuarterWorkStatus;
  paymentStatus: PaymentRecordStatus;
  plannedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  lastPaymentDate?: string;
  documents: QuarterDocument[];
  results: QuarterResult[];
  comments: QuarterComment[];
  responsibleEmployeeId?: string;
  responsibleEmployeeName?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CommentItem = {
  id: string;
  orderId: string;
  author: string;
  text: string;
  visibility: 'client' | 'internal';
  createdAt: string;
};

export type OrderHistoryItem = {
  id: string;
  orderId: string;
  text: string;
  createdAt: string;
  actionType?: CRMActionType;
  actor?: string;
  actorName?: string;
  actorRole?: UserRole;
  oldValue?: string;
  newValue?: string;
  comment?: string;
};

export type OrderPaymentHistoryItem = {
  id: string;
  orderId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentPercent: number;
  paymentDate: string;
  status: PaymentStatus;
  comment?: string;
  createdAt: string;
  createdBy?: string;
};

export type LaboratoryPrimaryDocument = {
  id: string;
  orderId: string;
  name: string;
  status: LaboratoryPrimaryDocumentStatus;
  fileName?: string;
  fileUrl?: string;
  employeeComment?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  statusChangedAt?: string;
  statusChangedBy?: string;
  history: OrderHistoryItem[];
};

export type OrderPrimaryDocument = {
  id: string;
  orderId: string;
  name: string;
  required: boolean;
  status: ClientPrimaryDocumentStatus;
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: string;
  managerComment?: string;
  clientComment?: string;
  requestedAt?: string;
  updatedAt?: string;
};

export type LaboratoryMeasurementAgreement = {
  id: string;
  orderId: string;
  measurementDate: string;
  measurementTime: string;
  address: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  measurementScope: string;
  comment: string;
  status: LaboratoryMeasurementAgreementStatus;
  sentAt?: string;
  acceptedAt?: string;
  rescheduleDate?: string;
  rescheduleTime?: string;
  rescheduleComment?: string;
  completedAt?: string;
  updatedAt?: string;
};

export type LaboratoryResultDocument = {
  id: string;
  orderId: string;
  name: string;
  section: 'measurement' | 'protocol' | 'form_870' | 'base_report' | 'quarter_report' | 'annual_report' | 'half_year_report' | 'archive_report';
  quarter?: QuarterNumber;
  status: LaboratoryResultDocumentStatus;
  fileName?: string;
  fileUrl?: string;
  readyAt?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  publishedAt?: string;
  publishedBy?: string;
  comment?: string;
  history: OrderHistoryItem[];
};

export type Order = {
  id: string;
  businessCompanyId?: string;
  businessCompanyName?: string;
  clientId: string;
  clientType: ClientType;
  clientName: string;
  companyName: string;
  bin: string;
  organizationType: string;
  legalAddress: string;
  objectAddress?: string;
  contactPerson: string;
  whatsapp?: string;
  phone: string;
  email: string;
  serviceId: string;
  service: string;
  urgency: string;
  comment: string;
  createdAt: string;
  status: OrderStatus;
  contractType?: ContractType;
  contractId?: string;
  annualPeriodStart?: string;
  annualPeriodEnd?: string;
  quarters?: RequestQuarter[];
  manager: string;
  contractStatus?: 'not_sent' | 'sent' | 'signed';
  crmContractStatus?: StaffContractStatus;
  paymentStatus?: PaymentStatus;
  signatureProvider?: string;
  paymentMethod?: string;
  paymentAmount?: string;
  offerAmount?: number;
  contractAmount?: number;
  contractFileName?: string;
  contractPeriodStart?: string;
  contractPeriodEnd?: string;
  contractServiceNote?: string;
  contractNote?: string;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentTerms?: 'full_prepayment' | 'partial_allowed';
  minPrepaymentPercent?: number;
  paymentUrl?: string;
  paymentComment?: string;
  accountantComment?: string;
  invoiceFileName?: string;
  invoiceSentAt?: string;
  paymentHistory?: OrderPaymentHistoryItem[];
  invoiceNumber?: string;
  actNumber?: string;
  assignedManagerId?: string;
  assignedAccountantId?: string;
  assignedEcologistId?: string;
  assignedLaboratoryId?: string;
  assignedAccountant?: string;
  assignedEcologist?: string;
  assignedLaboratory?: string;
  ecologyStatus?: EcologyStatus;
  ecologyComment?: string;
  ecologyReadyAt?: string;
  laboratoryStatus?: LaboratoryStatus;
  laboratoryComment?: string;
  samplesReceivedAt?: string;
  laboratoryReadyAt?: string;
  laboratoryPrimaryDocuments?: LaboratoryPrimaryDocument[];
  laboratoryMeasurementAgreement?: LaboratoryMeasurementAgreement;
  laboratorySections?: string[];
  laboratoryResultDocuments?: LaboratoryResultDocument[];
  notifications?: NotificationItem[];
  deadline?: string;
  updatedAt?: string;
  signedAt?: string;
  paidAt?: string;
  documents: DocumentItem[];
  primaryDocuments?: OrderPrimaryDocument[];
  resultDocuments: DocumentItem[];
  comments: CommentItem[];
  history: OrderHistoryItem[];
};

export type PaymentItem = {
  id: string;
  invoice: string;
  service: string;
  amount: string;
  date: string;
  status: string;
};

export type OurPaymentCompany = {
  id: string;
  name: string;
};

export type ClientPaymentCompany = {
  id: string;
  name: string;
  bin?: string;
};

export type PaymentTransaction = {
  id: string;
  paymentId?: string;
  contractId: string;
  quarterItemId?: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  comment?: string;
  createdBy?: string;
  createdAt: string;
};

export type QuarterlyContractItem = {
  id: string;
  contractId: string;
  requestId: string;
  quarter: QuarterNumber;
  quarterLabel: QuarterLabel;
  periodStart: string;
  periodEnd: string;
  serviceName: string;
  workStage: WorkStage;
  plannedAmount: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentRecordStatus;
  workStatus: QuarterWorkStatus;
  lastPaymentDate?: string;
  completedAt?: string;
  comment?: string;
};

export type Contract = {
  id: string;
  contractNumber: string;
  requestId: string;
  clientCompanyId: string;
  clientCompanyName: string;
  clientBin?: string;
  ourCompanyId: string;
  ourCompanyName: string;
  contractType: ContractType;
  startDate: string;
  endDate: string;
  totalAmount: number;
  quarterScheduleType?: QuarterScheduleType;
  quarterlySchedule?: QuarterlyContractItem[];
  status: ContractStatus;
  serviceName: string;
  responsibleManager?: string;
  createdAt: string;
  updatedAt: string;
};

export type Debt = {
  id: string;
  clientCompanyId: string;
  clientCompanyName: string;
  contractId: string;
  contractNumber: string;
  requestId: string;
  quarterItemId?: string;
  quarterLabel?: string;
  invoiceNumber?: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  overdueDays?: number;
  status: DebtStatus;
  reason: DebtReason;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  requestId: string;
  requestNumber: string;
  invoiceNumber: string;
  contractNumber?: string;
  ourCompanyId: string;
  ourCompanyName: string;
  clientCompanyId: string;
  clientCompanyName: string;
  clientBin?: string;
  serviceName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentRecordStatus;
  invoiceDate: string;
  dueDate?: string;
  lastPaymentDate?: string;
  paymentMethod?: PaymentMethod;
  responsibleManager?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};

export type TariffItem = {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  mode: 'Разовая задача' | 'Ежемесячное сопровождение';
  popular?: boolean;
};

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  role: UserRole | 'ALL';
};

export type ClientContract = {
  id: string;
  clientId: string;
  companyName: string;
  businessCompanyId: string;
  number: string;
  title: string;
  startedAt: string;
  endsAt: string;
  status: 'active' | 'expiring' | 'expired' | 'draft';
  responsibleManagerId: string;
};

export type User = {
  id: string;
  role: UserRole;
  type: ClientType | 'staff' | 'admin';
  email: string;
  name: string;
  phone?: string;
  city?: string;
  companyName?: string;
  bin?: string;
  organizationType?: string;
  legalAddress?: string;
  position?: string;
};

export type LeadStatus = 'new' | 'contacted' | 'in_progress' | 'closed';

export type Lead = {
  id: string;
  name: string;
  phone: string;
  city: string;
  serviceType: string;
  comment: string;
  source: string;
  status: LeadStatus;
  createdAt: string;
};
