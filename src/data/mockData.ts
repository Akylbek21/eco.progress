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
export type ClientPrimaryDocumentStatus = 'need_upload' | 'sent' | 'in_review' | 'accepted' | 'needs_fix';
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
  section: 'protocol' | 'form_870' | 'base_report' | 'quarter_report' | 'annual_report' | 'half_year_report' | 'archive_report';
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
  phone: string;
  whatsapp?: string;
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

export const companyContacts = {
  phone: '+7 (___) ___-__-__',
  whatsapp: '77000000000',
  whatsappDisplay: '+7 (___) ___-__-__',
  email: 'info@ecoprogress.kz',
  address: 'Республика Казахстан, г. Астана',
  schedule: 'Пн-Пт, 09:00-18:00',
  instagram: '@ecoprogress.group',
  mapsUrl: 'https://go.2gis.com/',
};

export type MockUser = {
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

export const orderStatusDefinitions: OrderStatusDefinition[] = [
  {
    id: 'Новая заявка',
    label: 'Новая заявка',
    description: 'Заявка поступила в кабинет менеджера и еще не взята в первичную обработку.',
    order: 1,
    category: 'client',
    clientVisibleLabel: 'Новая заявка',
    employeeActionLabel: 'Связаться с клиентом',
  },
  {
    id: 'Связаться с клиентом',
    label: 'Связаться с клиентом',
    description: 'Менеджеру нужно связаться с клиентом, проверить контакты и подтвердить запрос.',
    order: 2,
    category: 'client',
    clientVisibleLabel: 'Менеджер связывается с вами',
    employeeActionLabel: 'Связаться с клиентом',
  },
  {
    id: 'Консультация',
    label: 'Консультация',
    description: 'Менеджер связывается с клиентом, уточняет задачу и первичные данные.',
    order: 3,
    category: 'client',
    clientVisibleLabel: 'Консультация',
    employeeActionLabel: 'Провести консультацию',
  },
  {
    id: 'Ожидаем первичные документы',
    label: 'Ожидаем первичные документы',
    description: 'Менеджер запросил у клиента первичные документы и ждет загрузку или отправку файлов.',
    order: 4,
    category: 'client',
    clientVisibleLabel: 'Ожидаем первичные документы',
    employeeActionLabel: 'Запросить первичные документы',
  },
  {
    id: 'Анализ заявки',
    label: 'Анализ заявки',
    description: 'Профильный специалист проверяет первичные документы, объект, требования, сроки и риски.',
    order: 5,
    category: 'client',
    clientVisibleLabel: 'Анализ заявки',
    employeeActionLabel: 'Передать специалисту на анализ',
  },
  {
    id: 'Подготовка КП',
    label: 'Подготовка КП',
    description: 'Менеджер готовит коммерческое предложение по составу работ, срокам и условиям.',
    order: 6,
    category: 'commercial',
    clientVisibleLabel: 'Подготовка коммерческого предложения',
    employeeActionLabel: 'Подготовить КП',
  },
  {
    id: 'КП отправлено',
    label: 'КП отправлено',
    description: 'Коммерческое предложение отправлено клиенту на рассмотрение.',
    order: 7,
    category: 'commercial',
    clientVisibleLabel: 'Коммерческое предложение отправлено',
    employeeActionLabel: 'Отправить КП клиенту',
  },
  {
    id: 'КП согласовано',
    label: 'КП согласовано',
    description: 'Клиент согласовал коммерческое предложение, можно готовить договор.',
    order: 8,
    category: 'commercial',
    clientVisibleLabel: 'Коммерческое предложение согласовано',
    employeeActionLabel: 'КП согласовано',
  },
  {
    id: 'Подготовка договора',
    label: 'Подготовка договора',
    description: 'Менеджер готовит договор на основании согласованного КП.',
    order: 9,
    category: 'legal',
    clientVisibleLabel: 'Подготовка договора',
    employeeActionLabel: 'Подготовить договор',
  },
  {
    id: 'Договор отправлен',
    label: 'Договор отправлен',
    description: 'Договор отправлен клиенту для проверки и подписания.',
    order: 10,
    category: 'legal',
    clientVisibleLabel: 'Договор отправлен',
    employeeActionLabel: 'Договор отправлен',
  },
  {
    id: 'Ожидаем подпись договора',
    label: 'Ожидаем подпись договора',
    description: 'Менеджер ожидает подписанный договор от клиента.',
    order: 11,
    category: 'legal',
    clientVisibleLabel: 'Ожидаем подпись договора',
    employeeActionLabel: 'Ожидать подпись договора',
  },
  {
    id: 'Договор подписан',
    label: 'Договор подписан',
    description: 'Клиент подписал договор, заявка готова к передаче бухгалтеру.',
    order: 12,
    category: 'legal',
    clientVisibleLabel: 'Договор подписан',
    employeeActionLabel: 'Договор подписан',
  },
  {
    id: 'Передано бухгалтеру',
    label: 'Передано бухгалтеру',
    description: 'Менеджер передал заявку бухгалтеру. Счет, оплаты и долги ведет бухгалтерия.',
    order: 13,
    category: 'finance',
    clientVisibleLabel: 'Передано в бухгалтерию',
    employeeActionLabel: 'Передать бухгалтеру',
  },
  {
    id: 'Ожидает счет',
    label: 'Ожидает счет',
    description: 'Бухгалтер проверяет договор, сумму, условия оплаты и готовит счет клиенту.',
    order: 14,
    category: 'finance',
    clientVisibleLabel: 'Ожидает счет',
    employeeActionLabel: 'Выставить счет',
  },
  {
    id: 'Счет отправлен',
    label: 'Счет отправлен',
    description: 'Счет выставлен, прикреплен к заявке и отправлен клиенту.',
    order: 15,
    category: 'finance',
    clientVisibleLabel: 'Счет отправлен',
    employeeActionLabel: 'Отправить счет клиенту',
  },
  {
    id: 'Ожидаем оплату',
    label: 'Ожидаем оплату',
    description: 'Бухгалтер ожидает поступление оплаты от клиента.',
    order: 16,
    category: 'finance',
    clientVisibleLabel: 'Ожидаем оплату',
    employeeActionLabel: 'Проверить оплату',
  },
  {
    id: 'Частично оплачено',
    label: 'Частично оплачено',
    description: 'Поступила часть суммы, бухгалтер контролирует остаток и условия старта работ.',
    order: 17,
    category: 'finance',
    clientVisibleLabel: 'Частично оплачено',
    employeeActionLabel: 'Проверить возможность передачи специалисту',
  },
  {
    id: 'Полностью оплачено',
    label: 'Полностью оплачено',
    description: 'Оплата подтверждена полностью, заявка готова к передаче специалисту.',
    order: 18,
    category: 'finance',
    clientVisibleLabel: 'Полностью оплачено',
    employeeActionLabel: 'Передать специалисту',
  },
  {
    id: 'Передано специалисту',
    label: 'Передано специалисту',
    description: 'Бухгалтер передал заявку профильному специалисту после подтверждения оплаты.',
    order: 19,
    category: 'work',
    clientVisibleLabel: 'Передано специалисту',
    employeeActionLabel: 'Специалист получил задачу',
  },
  {
    id: 'Анализ',
    label: 'Анализ',
    description: 'Специалист проверяет первичные документы, объект, исходные данные, сроки и риски.',
    order: 5,
    category: 'client',
    clientVisibleLabel: 'Анализ заявки',
    employeeActionLabel: 'Проверить документы',
  },
  {
    id: 'КП',
    label: 'КП',
    description: 'Команда готовит коммерческое предложение с составом работ, сроками и стоимостью.',
    order: 6,
    category: 'commercial',
    clientVisibleLabel: 'Коммерческое предложение',
    employeeActionLabel: 'Подготовить КП',
  },
  {
    id: 'Договор',
    label: 'Договор',
    description: 'Договор согласован или отправлен клиенту на подписание.',
    order: 9,
    category: 'legal',
    clientVisibleLabel: 'Договор',
    employeeActionLabel: 'Подготовить договор',
  },
  {
    id: 'Счет на оплату',
    label: 'Счет на оплату',
    description: 'Счет выставлен, заявка ожидает оплату или проверку оплаты.',
    order: 15,
    category: 'finance',
    clientVisibleLabel: 'Счет на оплату',
    employeeActionLabel: 'Выставить счет',
  },
  {
    id: 'annual_active',
    label: 'Активна по годовому договору',
    description: 'Заявка обслуживается по годовому договору с квартальными работами, оплатами, документами и результатами.',
    order: 20,
    category: 'work',
    clientVisibleLabel: 'Активна по годовому договору',
    employeeActionLabel: 'Вести квартальное обслуживание',
  },
  {
    id: 'Проектирование',
    label: 'Проектирование',
    description: 'Экологи выполняют проектирование, разрешительную документацию, отчеты или экологические документы.',
    order: 20,
    category: 'work',
    clientVisibleLabel: 'Выполнение работ',
    employeeActionLabel: 'Передать в проектирование',
  },
  {
    id: 'Лаборатория',
    label: 'Лаборатория',
    description: 'Лаборатория выполняет анализы, замеры, работу с пробами и протоколами.',
    order: 20,
    category: 'work',
    clientVisibleLabel: 'Выполнение работ',
    employeeActionLabel: 'Передать в лабораторию',
  },
  {
    id: 'Вывоз',
    label: 'Вывоз',
    description: 'Команда организует вывоз или транспортировку отходов.',
    order: 20,
    category: 'work',
    clientVisibleLabel: 'Выполнение работ',
    employeeActionLabel: 'Организовать вывоз',
  },
  {
    id: 'Утилизация',
    label: 'Утилизация',
    description: 'Команда выполняет утилизацию, размещение, переработку или работу с полигоном.',
    order: 20,
    category: 'work',
    clientVisibleLabel: 'Выполнение работ',
    employeeActionLabel: 'Передать на утилизацию',
  },
  {
    id: 'Проверка результата',
    label: 'Проверка результата',
    description: 'Готовые материалы, протоколы, акты или закрывающие документы проходят внутреннюю проверку.',
    order: 21,
    category: 'quality',
    clientVisibleLabel: 'Проверка результата',
    employeeActionLabel: 'Проверить результат',
  },
  {
    id: 'Готово',
    label: 'Готово',
    description: 'Результат готов и доступен клиенту.',
    order: 22,
    category: 'done',
    clientVisibleLabel: 'Готово',
    employeeActionLabel: 'Передать клиенту',
  },
  {
    id: 'Завершено',
    label: 'Завершено',
    description: 'Заявка полностью закрыта после передачи результата и закрывающих документов.',
    order: 23,
    category: 'done',
    clientVisibleLabel: 'Завершено',
    employeeActionLabel: 'Завершить заявку',
  },
  {
    id: 'Отменено',
    label: 'Отменено',
    description: 'Заявка отменена.',
    order: 99,
    category: 'cancelled',
    clientVisibleLabel: 'Отменено',
    employeeActionLabel: 'Вернуть в работу',
  },
];

export const statusDescriptions: Record<OrderStatus, string> = Object.fromEntries(
  orderStatusDefinitions.map((status) => [status.id, status.description])
) as Record<OrderStatus, string>;

export const businessCompanies: BusinessCompany[] = [
  {
    id: 'eco-docs',
    name: 'ECOPROGRESS Documents',
    shortName: 'Documents',
    description: 'Экологическое проектирование, разрешительная документация, отчетность и сопровождение предприятий.',
    serviceCategories: ['Проектирование', 'Разрешения', 'Предприятия'],
  },
  {
    id: 'eco-lab',
    name: 'ECOPROGRESS Laboratory',
    shortName: 'Laboratory',
    description: 'Лабораторные исследования, замеры, протоколы и работа с образцами.',
    serviceCategories: ['Лаборатория'],
  },
  {
    id: 'eco-waste',
    name: 'ECOPROGRESS Waste',
    shortName: 'Waste',
    description: 'Сбор, вывоз, транспортировка, переработка и утилизация отходов.',
    serviceCategories: ['Отходы'],
  },
  {
    id: 'eco-poligon',
    name: 'ECOPROGRESS Poligon',
    shortName: 'Poligon',
    description: 'Прием, размещение и захоронение отходов на полигоне.',
    serviceCategories: ['Отходы'],
  },
];

export const services: ServiceItem[] = [
  {
    id: 'eco-design',
    businessCompanyId: 'eco-docs',
    title: 'Экологическое проектирование',
    category: 'Проектирование',
    description: 'Разрабатываем экологическую документацию для предприятий, строительных объектов, производственных площадок и организаций.',
    forWhom: 'Предприятиям, строительным объектам, производственным площадкам и организациям, которым нужны экологические проекты и согласования.',
    result: 'Готовая проектная документация, подготовленная в соответствии с требованиями Экологического кодекса Республики Казахстан.',
    includes: [
      'Разработка раздела охраны окружающей среды — РООС',
      'Разработка проекта оценки воздействия на окружающую среду — ОВОС',
      'Подготовка отчета о возможных воздействиях — ОВВ',
      'Подготовка заявления о намечаемой деятельности — ЗОНД',
      'Разработка проектов нормативов допустимых выбросов — НДВ',
      'Разработка нормативов предельно допустимых сбросов — ПДС',
      'Разработка проекта санитарно-защитной зоны — СЗЗ',
      'Разработка проекта утилизации отходов',
      'Разработка программы управления отходами — ПУО',
      'Разработка программы производственного экологического контроля — ПЭК',
      'Разработка плана природоохранных мероприятий — ППМ',
      'Инвентаризация источников выбросов парниковых газов',
    ],
    documents: ['Реквизиты компании', 'Описание деятельности объекта', 'Проектные данные', 'Схемы площадки', 'Сведения об источниках выбросов, сбросов и отходов'],
    workflow: ['Изучаем объект и исходные данные', 'Определяем перечень необходимых проектов', 'Разрабатываем документацию', 'Согласовываем материалы с клиентом', 'Сопровождаем дальнейшие процедуры'],
    duration: 'срок зависит от состава проекта',
  },
  {
    id: 'permits',
    businessCompanyId: 'eco-docs',
    title: 'Разрешительная документация',
    category: 'Разрешения',
    description: 'Помогаем компаниям подготовить и получить необходимую разрешительную экологическую документацию для законной деятельности предприятия.',
    forWhom: 'Компаниям и объектам I, II, III и IV категорий, которым нужно пройти экологические процедуры и получить согласования.',
    result: 'Подготовленный пакет документов и сопровождение до получения нужного разрешения или согласования.',
    includes: [
      'Получение комплексного экологического разрешения — КЭР',
      'Подготовка документов для экологических согласований',
      'Сопровождение при прохождении экологических процедур',
      'Подготовка документов для объектов I, II, III и IV категорий',
      'Консультация по требованиям Экологического кодекса РК',
      'Документальное сопровождение предприятия',
    ],
    documents: ['Реквизиты предприятия', 'Описание деятельности', 'Категория объекта', 'Действующие разрешения при наличии', 'Проектная и производственная информация'],
    workflow: ['Определяем требуемый вид разрешения', 'Собираем исходные данные', 'Готовим пакет документов', 'Сопровождаем подачу', 'Помогаем отвечать на замечания'],
    duration: 'срок зависит от процедуры согласования',
  },
  {
    id: 'laboratory',
    businessCompanyId: 'eco-lab',
    title: 'Лабораторные исследования',
    category: 'Лаборатория',
    description: 'Проводим лабораторные исследования и замеры с выдачей протоколов.',
    forWhom: 'Предприятиям, которым нужно подтвердить экологическую безопасность, пройти проверки или подготовить документацию.',
    result: 'Протоколы лабораторных исследований и замеров для экологических документов, проверок и внутреннего контроля.',
    includes: [
      'Химический анализ воды',
      'Химический анализ почвы и грунта',
      'Анализ атмосферного воздуха',
      'Анализ сточных и природных вод',
      'Замеры промышленных выбросов в атмосферу',
      'Замеры на границе санитарно-защитной зоны — СЗЗ',
      'Замеры факторов производственной среды',
      'Замеры выбросов загрязняющих веществ от автотранспорта',
      'Проведение лабораторных анализов с выдачей протокола',
    ],
    documents: ['Описание объекта исследования', 'Адрес и точки отбора проб', 'Параметры для анализа', 'Данные о производственном процессе при необходимости'],
    workflow: ['Уточняем задачу исследования', 'Согласуем перечень анализов и замеров', 'Проводим отбор проб или замеры', 'Выполняем лабораторный анализ', 'Передаем протоколы клиенту'],
    duration: 'срок зависит от вида анализа',
  },
  {
    id: 'waste-management',
    businessCompanyId: 'eco-waste',
    title: 'Обращение с отходами',
    category: 'Отходы',
    description: 'Организуем полный цикл работы с отходами: прием, сбор, вывоз, транспортировку, переработку, утилизацию и безопасное размещение.',
    forWhom: 'Предприятиям, строительным организациям, коммунальным службам и другим клиентам, которым нужен законный цикл обращения с отходами.',
    result: 'Организованный процесс обращения с отходами с соблюдением экологических и санитарных требований.',
    includes: [
      'Прием отходов',
      'Сбор отходов',
      'Вывоз отходов',
      'Транспортировка отходов с оформлением документов',
      'Переработка отходов',
      'Утилизация отходов',
      'Захоронение отходов на полигоне',
      'Работа с опасными и неопасными отходами',
      'Документальное сопровождение операций с отходами',
    ],
    documents: ['Информация о виде отходов', 'Объем или ориентировочная масса', 'Адрес забора', 'Требования к транспортировке', 'Реквизиты заказчика'],
    workflow: ['Определяем вид и объем отходов', 'Согласуем формат работ', 'Организуем сбор или прием', 'Оформляем сопроводительные документы', 'Выполняем переработку, утилизацию или размещение'],
    duration: 'по согласованному графику',
  },
  {
    id: 'waste-transportation',
    businessCompanyId: 'eco-waste',
    title: 'Транспортировка отходов',
    category: 'Отходы',
    description: 'Обеспечиваем экологически безопасную транспортировку отходов специализированным транспортом.',
    forWhom: 'Производственным, строительным, коммунальным и другим организациям, которым нужен вывоз опасных или неопасных отходов.',
    result: 'Безопасная перевозка отходов с необходимой сопроводительной документацией и соблюдением требований безопасности.',
    includes: [
      'Вывоз производственных отходов',
      'Вывоз строительных отходов',
      'Вывоз бытовых отходов',
      'Транспортировка опасных отходов',
      'Транспортировка неопасных отходов',
      'Оформление сопроводительной документации',
      'Организация безопасного маршрута перевозки',
    ],
    documents: ['Вид отходов', 'Объем партии', 'Адрес погрузки и разгрузки', 'Особые требования к перевозке', 'Контактные данные ответственного лица'],
    workflow: ['Уточняем характеристики отходов', 'Подбираем транспорт', 'Оформляем документы', 'Согласуем маршрут и график', 'Выполняем перевозку'],
    duration: 'по согласованному графику',
  },
  {
    id: 'landfill',
    businessCompanyId: 'eco-poligon',
    title: 'Полигон и размещение отходов',
    category: 'Отходы',
    description: 'Предоставляем услуги по законному и безопасному размещению отходов на лицензированном полигоне.',
    forWhom: 'Предприятиям, строительным организациям, коммунальным службам и населению региона.',
    result: 'Законное размещение или захоронение отходов на полигоне с документальным сопровождением.',
    includes: [
      'Прием отходов на законных основаниях',
      'Размещение отходов на полигоне',
      'Захоронение твердых бытовых отходов — ТБО',
      'Захоронение производственных отходов',
      'Полное документальное сопровождение',
      'Контроль соблюдения экологических требований',
    ],
    documents: ['Сведения о виде отходов', 'Объем или масса', 'Данные отправителя', 'Сопроводительные документы при наличии'],
    workflow: ['Проверяем возможность приема отходов', 'Согласуем условия', 'Принимаем отходы на полигоне', 'Оформляем документы', 'Контролируем соблюдение требований'],
    duration: 'по условиям приема отходов',
  },
  {
    id: 'enterprise-support',
    businessCompanyId: 'eco-docs',
    title: 'Услуги для предприятий',
    category: 'Предприятия',
    description: 'Комплексное экологическое сопровождение для бизнеса, производственных объектов, строительных компаний, промышленных предприятий и организаций.',
    forWhom: 'Бизнесу, производственным объектам, строительным компаниям, промышленным предприятиям и организациям.',
    result: 'Комплексное сопровождение экологических задач: от анализа требований и документации до разрешений, отчетности и работы с отходами.',
    includes: [
      'Анализ экологических требований для объекта',
      'Подготовка проектной документации',
      'Лабораторные замеры и протоколы',
      'Получение разрешений',
      'Организация вывоза и утилизации отходов',
      'Экологическая отчетность',
      'Консультации по проверкам и требованиям законодательства',
    ],
    documents: ['Реквизиты компании', 'Описание объекта и деятельности', 'Имеющиеся экологические документы', 'Данные по отходам, выбросам и сбросам', 'Информация о текущих задачах'],
    workflow: ['Анализируем объект и требования', 'Формируем план экологической работы', 'Готовим документы и организуем замеры', 'Сопровождаем разрешения и операции с отходами', 'Помогаем с отчетностью и проверками'],
    duration: 'индивидуально под задачи предприятия',
  },
];

export const getBusinessCompanyById = (id?: string) =>
  businessCompanies.find((company) => company.id === id) ?? businessCompanies[0];

export const getBusinessCompanyByServiceId = (serviceId?: string) => {
  const service = services.find((item) => item.id === serviceId);
  return getBusinessCompanyById(service?.businessCompanyId);
};

export const clientContracts: ClientContract[] = [
  {
    id: 'CON-2026-001',
    clientId: 'client-1',
    companyName: 'ТОО "Клиент Eco"',
    businessCompanyId: 'eco-docs',
    number: 'EPG-DOC-2026-001',
    title: 'Комплексное экологическое сопровождение',
    startedAt: '2026-01-15',
    endsAt: '2028-01-14',
    status: 'active',
    responsibleManagerId: 'staff-1',
  },
  {
    id: 'CON-2025-018',
    clientId: 'client-1',
    companyName: 'ТОО "Клиент Eco"',
    businessCompanyId: 'eco-lab',
    number: 'EPG-LAB-2025-018',
    title: 'Лабораторные исследования и протоколы',
    startedAt: '2025-08-15',
    endsAt: '2026-08-15',
    status: 'expiring',
    responsibleManagerId: 'staff-1',
  },
  {
    id: 'CON-2026-011',
    clientId: 'client-1',
    companyName: 'ТОО "Клиент Eco"',
    businessCompanyId: 'eco-waste',
    number: 'EPG-WST-2026-011',
    title: 'Вывоз и транспортировка отходов',
    startedAt: '2026-03-01',
    endsAt: '2029-02-28',
    status: 'active',
    responsibleManagerId: 'staff-1',
  },
  {
    id: 'CON-2024-004',
    clientId: 'client-1',
    companyName: 'ТОО "Клиент Eco"',
    businessCompanyId: 'eco-poligon',
    number: 'EPG-PLG-2024-004',
    title: 'Размещение отходов на полигоне',
    startedAt: '2024-09-01',
    endsAt: '2026-06-30',
    status: 'expiring',
    responsibleManagerId: 'staff-1',
  },
];

export const employees: Employee[] = [
  {
    id: 'chief',
    name: 'Главный эколог',
    position: 'Руководитель экспертного направления',
    experience: '12 лет',
    specialty: 'Разрешительная документация и экологическая стратегия',
    summary: 'Ведет комплексные проекты, проверяет финальные документы и помогает клиентам снижать регуляторные риски.',
    avatar: '/pexels-jan-van.jpg',
  },
  {
    id: 'consultant',
    name: 'Эколог-консультант',
    position: 'Специалист по проверкам',
    experience: '8 лет',
    specialty: 'Аудит, контроль, подготовка к инспекциям',
    summary: 'Переводит сложные требования на понятный язык и сопровождает клиентов на этапах проверки.',
    avatar: '/pexels-enginakyurt.jpg',
  },
  {
    id: 'reporting',
    name: 'Специалист по отчетности',
    position: 'Эколог-аналитик',
    experience: '6 лет',
    specialty: 'Экологическая отчетность и данные',
    summary: 'Готовит отчетность, контролирует сроки и помогает выстроить календарь обязательств.',
    avatar: '/pexels-jan-van.jpg',
  },
  {
    id: 'manager',
    name: 'Менеджер ECOPROGRESS GROUP',
    position: 'Менеджер по работе с клиентами',
    experience: '5 лет',
    specialty: 'Клиентское сопровождение',
    summary: 'Координирует заявки, статусы, документы и коммуникацию между клиентом и специалистами.',
    avatar: '/pexels-enginakyurt.jpg',
  },
];

export const news: NewsItem[] = [
  {
    id: 'reporting-calendar',
    title: 'Как подготовиться к экологической отчетности без спешки',
    excerpt: 'Короткий план: какие данные собрать заранее и как не потерять сроки подачи.',
    category: 'Отчетность',
    date: '15 апреля 2026',
    image: '/pexels-jan-van.jpg',
    content: ['Экологическая отчетность становится проще, если вести календарь обязательств и хранить исходные данные в одном месте.', 'ECOPROGRESS GROUP помогает клиентам подготовить формы, проверить комплектность и отслеживать следующий цикл отчетности.'],
  },
  {
    id: 'inspection-ready',
    title: 'Пять шагов подготовки к экологической проверке',
    excerpt: 'Что проверить в документах, журналах и договорах перед визитом инспекции.',
    category: 'Проверки',
    date: '2 апреля 2026',
    image: '/pexels-enginakyurt.jpg',
    content: ['Перед проверкой важно понять перечень обязательных документов и возможные зоны риска.', 'Мы начинаем с экспресс-аудита, затем помогаем закрыть пробелы и подготовить пояснения.'],
  },
  {
    id: 'client-cabinet',
    title: 'Кабинет клиента: зачем отслеживать экологические заявки онлайн',
    excerpt: 'Статусы, документы и комментарии специалиста доступны в одном месте.',
    category: 'Сервис',
    date: '28 марта 2026',
    image: '/pexels-jan-van.jpg',
    content: ['Онлайн-кабинет снижает количество переписок и помогает видеть, что происходит с каждой заявкой.', 'Клиент может загрузить документы, написать комментарий и скачать готовый результат.'],
  },
];

export const staffUsers: MockUser[] = [
  { id: 'staff-1', role: 'MANAGER', type: 'staff', email: 'manager@ecoprogress.kz', name: 'Менеджер ECOPROGRESS GROUP', phone: '+7 (___) ___-__-__', position: 'Менеджер по работе с клиентами' },
  { id: 'staff-2', role: 'ACCOUNTANT', type: 'staff', email: 'accountant@ecoprogress.kz', name: 'Бухгалтер ECOPROGRESS GROUP', phone: '+7 (___) ___-__-__', position: 'Бухгалтер' },
  { id: 'staff-3', role: 'ECOLOGIST', type: 'staff', email: 'ecologist@ecoprogress.kz', name: 'Эколог ECOPROGRESS GROUP', phone: '+7 (___) ___-__-__', position: 'Эколог' },
  { id: 'staff-4', role: 'LABORATORY', type: 'staff', email: 'laboratory@ecoprogress.kz', name: 'Лаборатория ECOPROGRESS GROUP', phone: '+7 (___) ___-__-__', position: 'Лаборатория' },
  { id: 'staff-5', role: 'ADMIN', type: 'admin', email: 'admin@ecoprogress.kz', name: 'Администратор ECOPROGRESS GROUP', phone: '+7 (___) ___-__-__', position: 'Администратор' },
];

export const users: MockUser[] = [
  {
    id: 'client-1',
    role: 'CLIENT',
    type: 'company',
    email: 'client@ecoprogress.kz',
    name: 'Контактное лицо',
    phone: '+7 (___) ___-__-__',
    city: 'Астана',
    companyName: 'ТОО "Клиент Eco"',
    bin: '000000000000',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Астана',
    position: 'Менеджер',
  },
];

export const orders: Order[] = [
  {
    id: 'ORD-DEMO-FULL',
    businessCompanyId: 'eco-docs',
    businessCompanyName: 'ECOPROGRESS Documents + Laboratory',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Контактное лицо',
    companyName: 'ТОО "Клиент Eco"',
    bin: '000000000000',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Астана, ул. Кабанбай батыра, 53',
    objectAddress: 'г. Астана, промышленная зона, участок N1',
    contactPerson: 'Контактное лицо',
    whatsapp: '+7 (700) 000-00-00',
    phone: '+7 (700) 000-00-00',
    email: 'client@ecoprogress.kz',
    serviceId: 'full-crm-laboratory-demo',
    service: 'Экологический проект, разрешения, лабораторные замеры и отчетность',
    urgency: 'Стандартная',
    comment: 'Одна полная демо-заявка для проверки клиентского кабинета, CRM, бухгалтерии, экологии и лаборатории.',
    createdAt: '15 мая 2026',
    updatedAt: '15 мая 2026, 15:30',
    deadline: '30 мая 2026',
    status: 'Счет отправлен',
    contractType: 'annual_quarterly',
    contractId: 'FCON-DEMO-001',
    annualPeriodStart: '2026-05-15',
    annualPeriodEnd: '2027-05-14',
    manager: 'Менеджер ECOPROGRESS GROUP',
    contractStatus: 'sent',
    crmContractStatus: 'sent_to_client',
    paymentStatus: 'invoice_sent',
    signatureProvider: 'NCALayer / ЭЦП',
    paymentMethod: 'bank_transfer',
    paymentAmount: '1 200 000 ₸',
    offerAmount: 1200000,
    contractAmount: 1200000,
    totalAmount: 1200000,
    paidAmount: 300000,
    remainingAmount: 900000,
    paymentTerms: 'partial_allowed',
    minPrepaymentPercent: 25,
    paymentUrl: 'https://pay.ecoprogress.kz/demo/ORD-DEMO-FULL',
    paymentComment: 'Счет отправлен клиенту. Минимальная предоплата 25%, остаток по кварталам.',
    accountantComment: 'Проверить поступление предоплаты и закрывающие документы после подписания договора.',
    invoiceNumber: 'INV-DEMO-2026-001',
    invoiceFileName: 'Счет INV-DEMO-2026-001.pdf',
    invoiceSentAt: '15 мая 2026, 14:10',
    actNumber: 'ACT-DEMO-2026-001',
    assignedManagerId: 'staff-1',
    assignedAccountantId: 'staff-2',
    assignedEcologistId: 'staff-3',
    assignedLaboratoryId: 'staff-4',
    assignedAccountant: 'Бухгалтер ECOPROGRESS GROUP',
    assignedEcologist: 'Эколог ECOPROGRESS GROUP',
    assignedLaboratory: 'Лаборатория ECOPROGRESS GROUP',
    ecologyStatus: 'waiting_client_data',
    ecologyComment: 'Нужна схема источников выбросов и сведения по сырью для проектирования.',
    laboratoryStatus: 'analysis_in_progress',
    laboratoryComment: 'Замер согласован, образцы получены, один протокол опубликован клиенту.',
    samplesReceivedAt: '15 мая 2026, 11:40',
    documents: [
      { id: 'DOC-DEMO-CLIENT-1', orderId: 'ORD-DEMO-FULL', name: 'Заявление клиента.pdf', type: 'client', uploadedAt: '15 мая 2026, 09:30', status: 'Принят' },
      { id: 'DOC-DEMO-CLIENT-2', orderId: 'ORD-DEMO-FULL', name: 'Схема объекта.pdf', type: 'client', uploadedAt: '15 мая 2026, 10:05', status: 'На проверке' },
      { id: 'DOC-DEMO-INTERNAL-1', orderId: 'ORD-DEMO-FULL', name: 'Внутренний расчет стоимости.xlsx', type: 'internal', uploadedAt: '15 мая 2026, 12:10', status: 'Для сотрудников' },
    ],
    primaryDocuments: [
      { id: 'PD-DEMO-1', orderId: 'ORD-DEMO-FULL', name: 'Карточка компании', required: true, status: 'accepted', fileName: 'Карточка компании.pdf', uploadedAt: '15 мая 2026, 09:40', managerComment: 'Документ принят.', clientComment: 'Актуальные реквизиты.', requestedAt: '15 мая 2026, 09:00', updatedAt: '15 мая 2026, 10:00' },
      { id: 'PD-DEMO-2', orderId: 'ORD-DEMO-FULL', name: 'Реквизиты', required: true, status: 'accepted', fileName: 'Реквизиты.pdf', uploadedAt: '15 мая 2026, 09:42', managerComment: 'Принято.', requestedAt: '15 мая 2026, 09:00', updatedAt: '15 мая 2026, 10:02' },
      { id: 'PD-DEMO-3', orderId: 'ORD-DEMO-FULL', name: 'Адрес объекта и схема площадки', required: true, status: 'needs_fix', fileName: 'Адрес объекта.docx', uploadedAt: '15 мая 2026, 10:05', managerComment: 'Нужно добавить точки выбросов и лабораторные точки отбора.', clientComment: 'Схему дозагрузим сегодня.', requestedAt: '15 мая 2026, 09:00', updatedAt: '15 мая 2026, 11:15' },
      { id: 'PD-DEMO-4', orderId: 'ORD-DEMO-FULL', name: 'Договор аренды / право собственности', required: true, status: 'need_upload', managerComment: 'Загрузите документ по объекту.', requestedAt: '15 мая 2026, 09:00' },
      { id: 'PD-DEMO-5', orderId: 'ORD-DEMO-FULL', name: 'Предыдущие экологические документы', required: false, status: 'in_review', fileName: 'Архив документов 2025.zip', uploadedAt: '15 мая 2026, 10:20', clientComment: 'Старые разрешения и отчеты.', requestedAt: '15 мая 2026, 09:00', updatedAt: '15 мая 2026, 10:20' },
    ],
    laboratoryPrimaryDocuments: [
      {
        id: 'LAB-PD-DEMO-1',
        orderId: 'ORD-DEMO-FULL',
        name: 'Разрешение на доступ к объекту',
        status: 'approved',
        fileName: 'Разрешение на доступ.pdf',
        uploadedAt: '15 мая 2026, 10:30',
        uploadedBy: 'Клиент',
        statusChangedAt: '15 мая 2026, 10:55',
        statusChangedBy: 'Лаборатория ECOPROGRESS GROUP',
        history: [
          { id: 'H-DEMO-LAB-PD-1', orderId: 'ORD-DEMO-FULL', actionType: 'document_uploaded', actor: 'Клиент', actorName: 'Клиент', actorRole: 'CLIENT', text: 'Клиент загрузил разрешение на доступ к объекту.', createdAt: '15 мая 2026, 10:30' },
          { id: 'H-DEMO-LAB-PD-2', orderId: 'ORD-DEMO-FULL', actionType: 'status_changed', actor: 'Лаборатория ECOPROGRESS GROUP', actorName: 'Лаборатория ECOPROGRESS GROUP', actorRole: 'LABORATORY', text: 'Лаборатория приняла документ.', createdAt: '15 мая 2026, 10:55' },
        ],
      },
      {
        id: 'LAB-PD-DEMO-2',
        orderId: 'ORD-DEMO-FULL',
        name: 'СЭС заключение / санитарные данные',
        status: 'in_review',
        fileName: 'СЭС заключение.pdf',
        employeeComment: 'Проверяем актуальность заключения.',
        uploadedAt: '15 мая 2026, 10:35',
        uploadedBy: 'Клиент',
        statusChangedAt: '15 мая 2026, 10:35',
        statusChangedBy: 'Клиент',
        history: [
          { id: 'H-DEMO-LAB-PD-3', orderId: 'ORD-DEMO-FULL', actionType: 'document_uploaded', actor: 'Клиент', actorName: 'Клиент', actorRole: 'CLIENT', text: 'Клиент загрузил СЭС заключение.', createdAt: '15 мая 2026, 10:35' },
        ],
      },
      {
        id: 'LAB-PD-DEMO-3',
        orderId: 'ORD-DEMO-FULL',
        name: 'Паспорт вентиляционной системы',
        status: 'revision_required',
        fileName: 'Паспорт вентиляции.pdf',
        employeeComment: 'Не хватает страницы с характеристиками фильтров.',
        uploadedAt: '15 мая 2026, 10:45',
        uploadedBy: 'Клиент',
        statusChangedAt: '15 мая 2026, 11:00',
        statusChangedBy: 'Лаборатория ECOPROGRESS GROUP',
        history: [
          { id: 'H-DEMO-LAB-PD-4', orderId: 'ORD-DEMO-FULL', actionType: 'document_uploaded', actor: 'Клиент', actorName: 'Клиент', actorRole: 'CLIENT', text: 'Клиент загрузил паспорт вентиляции.', createdAt: '15 мая 2026, 10:45' },
          { id: 'H-DEMO-LAB-PD-5', orderId: 'ORD-DEMO-FULL', actionType: 'status_changed', actor: 'Лаборатория ECOPROGRESS GROUP', actorName: 'Лаборатория ECOPROGRESS GROUP', actorRole: 'LABORATORY', text: 'Запрошена корректировка лабораторного документа.', createdAt: '15 мая 2026, 11:00' },
        ],
      },
    ],
    laboratoryMeasurementAgreement: {
      id: 'LAB-MEASURE-DEMO',
      orderId: 'ORD-DEMO-FULL',
      measurementDate: '2026-05-16',
      measurementTime: '10:30',
      address: 'г. Астана, промышленная зона, участок N1',
      companyName: 'ECOPROGRESS Laboratory',
      contactPerson: 'Контактное лицо',
      phone: '+7 (700) 000-00-00',
      measurementScope: 'Замеры воздуха рабочей зоны, шум, вода после очистки, контроль выбросов по схеме объекта.',
      comment: 'Клиент подтвердил дату. Лаборатория подготовила оборудование и маршрутный лист.',
      status: 'confirmed',
      sentAt: '15 мая 2026, 11:10',
      acceptedAt: '15 мая 2026, 11:25',
      updatedAt: '15 мая 2026, 11:25',
    },
    laboratorySections: ['overview', 'primary_documents', 'measurement', 'protocol', 'form_870', 'base_report', 'quarter_report', 'annual_report', 'history'],
    laboratoryResultDocuments: [
      {
        id: 'LAB-RES-DEMO-1',
        orderId: 'ORD-DEMO-FULL',
        name: 'Протокол лабораторных исследований воздуха.pdf',
        section: 'protocol',
        status: 'published_to_client',
        fileName: 'Протокол воздуха ORD-DEMO-FULL.pdf',
        uploadedAt: '15 мая 2026, 12:20',
        readyAt: '15 мая 2026, 12:20',
        uploadedBy: 'Лаборатория ECOPROGRESS GROUP',
        publishedAt: '15 мая 2026, 12:30',
        publishedBy: 'Лаборатория ECOPROGRESS GROUP',
        comment: 'Первый протокол опубликован клиенту.',
        history: [
          { id: 'H-DEMO-LAB-RES-1', orderId: 'ORD-DEMO-FULL', actionType: 'document_ready', actor: 'Лаборатория ECOPROGRESS GROUP', actorName: 'Лаборатория ECOPROGRESS GROUP', actorRole: 'LABORATORY', text: 'Протокол воздуха готов и опубликован клиенту.', createdAt: '15 мая 2026, 12:30' },
        ],
      },
      {
        id: 'LAB-RES-DEMO-2',
        orderId: 'ORD-DEMO-FULL',
        name: 'Базовый отчет по лабораторным замерам.pdf',
        section: 'base_report',
        status: 'ready',
        fileName: 'Базовый отчет ORD-DEMO-FULL.pdf',
        uploadedAt: '15 мая 2026, 13:00',
        readyAt: '15 мая 2026, 13:00',
        uploadedBy: 'Лаборатория ECOPROGRESS GROUP',
        comment: 'Готов к публикации клиенту.',
        history: [
          { id: 'H-DEMO-LAB-RES-2', orderId: 'ORD-DEMO-FULL', actionType: 'document_ready', actor: 'Лаборатория ECOPROGRESS GROUP', actorName: 'Лаборатория ECOPROGRESS GROUP', actorRole: 'LABORATORY', text: 'Базовый отчет подготовлен.', createdAt: '15 мая 2026, 13:00' },
        ],
      },
    ],
    resultDocuments: [
      { id: 'DOC-DEMO-CONTRACT', orderId: 'ORD-DEMO-FULL', name: 'Договор EPG-DEMO-2026-001.pdf', type: 'result', uploadedAt: '15 мая 2026, 14:00', status: 'Ожидает подписи клиента' },
      { id: 'DOC-DEMO-INVOICE', orderId: 'ORD-DEMO-FULL', name: 'Счет INV-DEMO-2026-001.pdf', type: 'invoice', uploadedAt: '15 мая 2026, 14:10', status: 'Ожидает оплаты' },
      { id: 'DOC-DEMO-PROTOCOL', orderId: 'ORD-DEMO-FULL', name: 'Протокол лабораторных исследований воздуха.pdf', type: 'result', uploadedAt: '15 мая 2026, 12:30', status: 'Опубликовано для клиента' },
    ],
    paymentHistory: [
      { id: 'PAY-H-DEMO-1', orderId: 'ORD-DEMO-FULL', totalAmount: 1200000, paidAmount: 300000, remainingAmount: 900000, paymentPercent: 25, paymentDate: '15 мая 2026', status: 'partial', comment: 'Предоплата 25% за запуск работ.', createdAt: '15 мая 2026, 14:40', createdBy: 'Бухгалтер ECOPROGRESS GROUP' },
    ],
    comments: [
      { id: 'COM-DEMO-1', orderId: 'ORD-DEMO-FULL', author: 'Менеджер ECOPROGRESS GROUP', text: 'Договор и счет отправлены. Перед оплатой дозагрузите документ по объекту.', visibility: 'client', createdAt: '15 мая 2026, 14:15' },
      { id: 'COM-DEMO-2', orderId: 'ORD-DEMO-FULL', author: 'Эколог ECOPROGRESS GROUP', text: 'Для проектирования нужны точки выбросов, сырье и график работы оборудования.', visibility: 'client', createdAt: '15 мая 2026, 14:25' },
      { id: 'COM-DEMO-3', orderId: 'ORD-DEMO-FULL', author: 'Бухгалтер ECOPROGRESS GROUP', text: 'После подписания договора подтвердить оплату и выпустить акт.', visibility: 'internal', createdAt: '15 мая 2026, 14:35' },
    ],
    history: [
      { id: 'H-DEMO-1', orderId: 'ORD-DEMO-FULL', actionType: 'order_created', actor: 'Клиент', actorName: 'Клиент', actorRole: 'CLIENT', text: 'Клиент создал заявку.', createdAt: '15 мая 2026, 09:00' },
      { id: 'H-DEMO-2', orderId: 'ORD-DEMO-FULL', actionType: 'manager_assigned', actor: 'Система', actorName: 'Система', actorRole: 'ADMIN', text: 'Назначены менеджер, бухгалтер, эколог и лаборатория.', createdAt: '15 мая 2026, 09:05' },
      { id: 'H-DEMO-3', orderId: 'ORD-DEMO-FULL', actionType: 'document_uploaded', actor: 'Клиент', actorName: 'Клиент', actorRole: 'CLIENT', text: 'Клиент загрузил первичные документы.', createdAt: '15 мая 2026, 10:05' },
      { id: 'H-DEMO-4', orderId: 'ORD-DEMO-FULL', actionType: 'contract_updated', actor: 'Менеджер ECOPROGRESS GROUP', actorName: 'Менеджер ECOPROGRESS GROUP', actorRole: 'MANAGER', text: 'Договор и счет отправлены клиенту.', createdAt: '15 мая 2026, 14:10' },
      { id: 'H-DEMO-5', orderId: 'ORD-DEMO-FULL', actionType: 'payment_changed', actor: 'Бухгалтер ECOPROGRESS GROUP', actorName: 'Бухгалтер ECOPROGRESS GROUP', actorRole: 'ACCOUNTANT', text: 'Зафиксирована предоплата 300 000 ₸.', createdAt: '15 мая 2026, 14:40' },
    ],
    notifications: [
      { id: 'NOT-DEMO-1', title: 'Договор и счет отправлены', description: 'Проверьте договор, счет и загрузите недостающий документ по объекту.', date: '15 мая 2026, 14:15', role: 'CLIENT' },
      { id: 'NOT-DEMO-2', title: 'Нужна проверка оплаты', description: 'По заявке ORD-DEMO-FULL есть предоплата и остаток 900 000 ₸.', date: '15 мая 2026, 14:40', role: 'ACCOUNTANT' },
      { id: 'NOT-DEMO-3', title: 'Лабораторный протокол готов', description: 'Первый протокол опубликован клиенту.', date: '15 мая 2026, 12:30', role: 'LABORATORY' },
    ],
    quarters: [
      {
        id: 'RQ-DEMO-1',
        requestId: 'ORD-DEMO-FULL',
        contractId: 'FCON-DEMO-001',
        quarter: 1,
        quarterLabel: '1 квартал',
        periodStart: '2026-05-15',
        periodEnd: '2026-08-14',
        serviceName: 'Экологический проект и лабораторные замеры',
        workStage: 'Проектирование',
        workStatus: 'in_progress',
        paymentStatus: 'partial',
        plannedAmount: 300000,
        paidAmount: 300000,
        remainingAmount: 0,
        invoiceNumber: 'INV-DEMO-2026-Q1',
        invoiceDate: '2026-05-15',
        dueDate: '2026-05-22',
        lastPaymentDate: '2026-05-15',
        documents: [
          { id: 'QDOC-DEMO-1-DATA', quarterId: 'RQ-DEMO-1', requestId: 'ORD-DEMO-FULL', contractId: 'FCON-DEMO-001', name: 'Исходные данные 1 квартал.xlsx', fileName: 'Исходные данные 1 квартал.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSize: 98000, documentType: 'client_data', uploadedByRole: 'client', uploadedByName: 'ТОО "Клиент Eco"', uploadedAt: '2026-05-15' },
          { id: 'QDOC-DEMO-1-PROTOCOL', quarterId: 'RQ-DEMO-1', requestId: 'ORD-DEMO-FULL', contractId: 'FCON-DEMO-001', name: 'Протокол лаборатории 1 квартал.pdf', fileName: 'Протокол лаборатории 1 квартал.pdf', fileType: 'application/pdf', fileSize: 410000, documentType: 'protocol', uploadedByRole: 'employee', uploadedByName: 'Лаборатория ECOPROGRESS GROUP', uploadedAt: '2026-05-15' },
        ],
        results: [
          { id: 'QRES-DEMO-1', quarterId: 'RQ-DEMO-1', requestId: 'ORD-DEMO-FULL', title: 'Промежуточный отчет и лабораторный протокол', resultType: 'laboratory_protocol', attachedDocumentIds: ['QDOC-DEMO-1-PROTOCOL'], createdByName: 'Лаборатория ECOPROGRESS GROUP', createdAt: '2026-05-15' },
        ],
        comments: [
          { id: 'QCOM-DEMO-1', quarterId: 'RQ-DEMO-1', requestId: 'ORD-DEMO-FULL', author: 'Эколог ECOPROGRESS GROUP', text: 'Первый квартальный этап запущен.', visibility: 'client', createdAt: '2026-05-15' },
        ],
        responsibleEmployeeId: 'staff-3',
        responsibleEmployeeName: 'Эколог ECOPROGRESS GROUP',
        startedAt: '2026-05-15',
        createdAt: '2026-05-15',
        updatedAt: '2026-05-15',
      },
      {
        id: 'RQ-DEMO-2',
        requestId: 'ORD-DEMO-FULL',
        contractId: 'FCON-DEMO-001',
        quarter: 2,
        quarterLabel: '2 квартал',
        periodStart: '2026-08-15',
        periodEnd: '2026-11-14',
        serviceName: 'Лабораторный контроль и отчетность',
        workStage: 'Лаборатория',
        workStatus: 'waiting_client_data',
        paymentStatus: 'unpaid',
        plannedAmount: 300000,
        paidAmount: 0,
        remainingAmount: 300000,
        invoiceNumber: 'INV-DEMO-2026-Q2',
        invoiceDate: '2026-08-15',
        dueDate: '2026-08-25',
        documents: [],
        results: [],
        comments: [],
        responsibleEmployeeId: 'staff-4',
        responsibleEmployeeName: 'Лаборатория ECOPROGRESS GROUP',
        createdAt: '2026-08-15',
        updatedAt: '2026-08-15',
      },
      {
        id: 'RQ-DEMO-3',
        requestId: 'ORD-DEMO-FULL',
        contractId: 'FCON-DEMO-001',
        quarter: 3,
        quarterLabel: '3 квартал',
        periodStart: '2026-11-15',
        periodEnd: '2027-02-14',
        serviceName: 'Экологическая отчетность',
        workStage: 'Проектирование',
        workStatus: 'planned',
        paymentStatus: 'unpaid',
        plannedAmount: 300000,
        paidAmount: 0,
        remainingAmount: 300000,
        invoiceNumber: 'INV-DEMO-2026-Q3',
        invoiceDate: '2026-11-15',
        dueDate: '2026-11-25',
        documents: [],
        results: [],
        comments: [],
        responsibleEmployeeId: 'staff-3',
        responsibleEmployeeName: 'Эколог ECOPROGRESS GROUP',
        createdAt: '2026-11-15',
        updatedAt: '2026-11-15',
      },
      {
        id: 'RQ-DEMO-4',
        requestId: 'ORD-DEMO-FULL',
        contractId: 'FCON-DEMO-001',
        quarter: 4,
        quarterLabel: '4 квартал',
        periodStart: '2027-02-15',
        periodEnd: '2027-05-14',
        serviceName: 'Итоговый отчет и закрывающие документы',
        workStage: 'Проектирование',
        workStatus: 'planned',
        paymentStatus: 'unpaid',
        plannedAmount: 300000,
        paidAmount: 0,
        remainingAmount: 300000,
        invoiceNumber: 'INV-DEMO-2027-Q4',
        invoiceDate: '2027-02-15',
        dueDate: '2027-02-25',
        documents: [],
        results: [],
        comments: [],
        responsibleEmployeeId: 'staff-3',
        responsibleEmployeeName: 'Эколог ECOPROGRESS GROUP',
        createdAt: '2027-02-15',
        updatedAt: '2027-02-15',
      },
    ],
  },
];

export const documents: DocumentItem[] = orders.flatMap((order) => [...order.documents, ...order.resultDocuments]);

export const payments: PaymentItem[] = [
  { id: 'PAY-DEMO-001', invoice: 'Invoice INV-DEMO-2026-001', service: 'Full CRM demo request', amount: '1 200 000 KZT', date: '2026-05-15', status: 'partial' },
];

export const ourPaymentCompanies: OurPaymentCompany[] = [
  { id: 'ecoprogress-group', name: 'ECOPROGRESS GROUP' },
];

export const clientPaymentCompanies: ClientPaymentCompany[] = [
  { id: 'demo-client', name: 'Demo Client Eco', bin: '000000000000' },
];

export const paymentRecords: Payment[] = [
  {
    id: 'PAY-FIN-DEMO-001',
    requestId: 'ORD-DEMO-FULL',
    requestNumber: 'ORD-DEMO-FULL',
    invoiceNumber: 'INV-DEMO-2026-001',
    contractNumber: 'EPG-DEMO-2026-001',
    ourCompanyId: 'ecoprogress-group',
    ourCompanyName: 'ECOPROGRESS GROUP',
    clientCompanyId: 'demo-client',
    clientCompanyName: 'Demo Client Eco',
    clientBin: '000000000000',
    serviceName: 'Full CRM demo request',
    totalAmount: 1200000,
    paidAmount: 300000,
    remainingAmount: 900000,
    paymentStatus: 'partial',
    invoiceDate: '2026-05-15',
    dueDate: '2026-05-22',
    lastPaymentDate: '2026-05-15',
    paymentMethod: 'bank_transfer',
    responsibleManager: 'manager@ecoprogress.kz',
    comment: 'Single demo payment record for ORD-DEMO-FULL.',
    createdAt: '2026-05-15',
    updatedAt: '2026-05-15',
  },
];

export const financeContracts: Contract[] = [
  {
    id: 'FCON-DEMO-001',
    contractNumber: 'EPG-DEMO-2026-001',
    requestId: 'ORD-DEMO-FULL',
    clientCompanyId: 'demo-client',
    clientCompanyName: 'Demo Client Eco',
    clientBin: '000000000000',
    ourCompanyId: 'ecoprogress-group',
    ourCompanyName: 'ECOPROGRESS GROUP',
    contractType: 'annual_quarterly',
    startDate: '2026-05-15',
    endDate: '2027-05-14',
    totalAmount: 1200000,
    quarterScheduleType: 'contract_quarters',
    status: 'active',
    serviceName: 'Full CRM demo request',
    responsibleManager: 'manager@ecoprogress.kz',
    createdAt: '2026-05-15',
    updatedAt: '2026-05-15',
  },
];

export const financeDebts: Debt[] = [
  {
    id: 'DEBT-DEMO-001',
    clientCompanyId: 'demo-client',
    clientCompanyName: 'Demo Client Eco',
    contractId: 'FCON-DEMO-001',
    contractNumber: 'EPG-DEMO-2026-001',
    requestId: 'ORD-DEMO-FULL',
    invoiceNumber: 'INV-DEMO-2026-001',
    amount: 1200000,
    paidAmount: 300000,
    remainingAmount: 900000,
    dueDate: '2026-05-22',
    overdueDays: 0,
    status: 'partial',
    reason: 'partial_payment',
    comment: 'Single demo debt for the remaining amount.',
    createdAt: '2026-05-15',
    updatedAt: '2026-05-15',
  },
];

export const paymentTransactions: PaymentTransaction[] = [
  { id: 'TRX-DEMO-001', contractId: 'FCON-DEMO-001', amount: 300000, date: '2026-05-15', method: 'bank_transfer', comment: 'Demo prepayment for ORD-DEMO-FULL', createdBy: 'accountant@ecoprogress.kz', createdAt: '2026-05-15' },
];

export const tariffs: TariffItem[] = [
  {
    id: 'start',
    name: 'Стартовое сопровождение',
    price: 'от 150 000 ₸',
    description: 'Для ИП, малого бизнеса и разовых экологических задач.',
    features: [
      'Первичная консультация эколога',
      'Анализ вашей ситуации и объекта',
      'Проверка имеющихся документов',
      'Определение обязательных экологических требований',
      'Рекомендации по следующим шагам',
      'Подготовка одной заявки или базового документа',
    ],
    cta: 'Получить консультацию',
    mode: 'Разовая задача',
  },
  {
    id: 'regular',
    name: 'Регулярное сопровождение',
    price: 'от 350 000 ₸ / месяц',
    description: 'Для компаний, которым нужно вести документы, отчетность и несколько экологических задач одновременно.',
    features: [
      'До 3 активных задач в работе',
      'Экологическая отчетность',
      'Проверка и подготовка документов',
      'Сопровождение разрешительной документации',
      'Консультации специалиста',
      'Контроль сроков по экологическим обязательствам',
      'Комментарии специалиста в личном кабинете',
      'Помощь при взаимодействии с подрядчиками',
    ],
    cta: 'Выбрать сопровождение',
    mode: 'Ежемесячное сопровождение',
    popular: true,
  },
  {
    id: 'full',
    name: 'Полное сопровождение',
    price: 'от 650 000 ₸ / месяц',
    description: 'Для предприятий, которым нужно комплексное экологическое сопровождение и контроль рисков.',
    features: [
      'Полный экологический аудит',
      'Разработка экологических документов',
      'Сопровождение разрешений',
      'Контроль экологической отчетности',
      'Организация лабораторных исследований',
      'Организация вывоза и утилизации отходов',
      'Работа с опасными и неопасными отходами',
      'Приоритетная обработка заявок',
      'Подготовка закрывающих документов',
      'Сопровождение при проверках',
      'Персональный менеджер',
    ],
    cta: 'Заказать полное сопровождение',
    mode: 'Ежемесячное сопровождение',
  },
  {
    id: 'corporate',
    name: 'Корпоративный тариф',
    price: 'Индивидуальный расчет',
    description: 'Для крупных предприятий, нескольких объектов, филиалов, строительных и промышленных компаний.',
    features: [
      'Сопровождение нескольких объектов',
      'Экологическое проектирование',
      'Лабораторные замеры по графику',
      'Программа управления отходами',
      'Производственный экологический контроль',
      'Организация транспортировки отходов',
      'Утилизация, переработка и размещение на полигоне',
      'Подготовка отчетности',
      'Сопровождение проверок',
      'Отдельный план работ и SLA',
    ],
    cta: 'Запросить расчет',
    mode: 'Ежемесячное сопровождение',
  },
];

export const notifications: NotificationItem[] = [
  { id: 'NOT-DEMO-CLIENT', title: 'Demo request updated', description: 'ORD-DEMO-FULL has contract, invoice, payment and laboratory data.', date: '2026-05-15 14:15', role: 'CLIENT' },
  { id: 'NOT-DEMO-STAFF', title: 'Demo CRM task', description: 'Use the role switcher to review this one request as each staff role.', date: '2026-05-15 14:30', role: 'ALL' },
];

export const clients = [
  { id: 'client-1', name: 'Demo Client Eco', contact: 'client@ecoprogress.kz', orders: 1, status: 'active' },
];
