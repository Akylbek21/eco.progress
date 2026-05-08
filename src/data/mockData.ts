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
  | 'Консультация'
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

export type PaymentStatus = 'not_sent' | 'pending' | 'partial' | 'paid';
export type EcologyStatus = 'not_started' | 'in_progress' | 'waiting_client_data' | 'done';
export type LaboratoryStatus = 'not_assigned' | 'waiting_samples' | 'samples_received' | 'analysis_in_progress' | 'result_ready';
export type StaffContractStatus = 'not_created' | 'prepared' | 'sent_to_client' | 'waiting_signature' | 'signed' | 'rejected';
export type PaymentRecordStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'other';
export type ContractType = 'one_time' | 'annual_quarterly';
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
  contactPerson: string;
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
  paymentUrl?: string;
  paymentComment?: string;
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
  deadline?: string;
  updatedAt?: string;
  signedAt?: string;
  paidAt?: string;
  documents: DocumentItem[];
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
    id: 'Консультация',
    label: 'Консультация',
    description: 'Менеджер связывается с клиентом, уточняет задачу и первичные данные.',
    order: 1,
    category: 'client',
    clientVisibleLabel: 'Консультация',
    employeeActionLabel: 'Провести консультацию',
  },
  {
    id: 'Анализ',
    label: 'Анализ',
    description: 'Специалист анализирует услугу, объект, исходные документы, сроки и риски.',
    order: 2,
    category: 'client',
    clientVisibleLabel: 'Анализ заявки',
    employeeActionLabel: 'Выполнить анализ',
  },
  {
    id: 'КП',
    label: 'КП',
    description: 'Команда готовит коммерческое предложение с составом работ, сроками и стоимостью.',
    order: 3,
    category: 'commercial',
    clientVisibleLabel: 'Коммерческое предложение',
    employeeActionLabel: 'Подготовить КП',
  },
  {
    id: 'Договор',
    label: 'Договор',
    description: 'Договор согласован или отправлен клиенту на подписание.',
    order: 4,
    category: 'legal',
    clientVisibleLabel: 'Договор',
    employeeActionLabel: 'Подготовить договор',
  },
  {
    id: 'Счет на оплату',
    label: 'Счет на оплату',
    description: 'Счет выставлен, заявка ожидает оплату или проверку оплаты.',
    order: 5,
    category: 'finance',
    clientVisibleLabel: 'Счет на оплату',
    employeeActionLabel: 'Выставить счет',
  },
  {
    id: 'annual_active',
    label: 'Активна по годовому договору',
    description: 'Заявка обслуживается по годовому договору с квартальными работами, оплатами, документами и результатами.',
    order: 6,
    category: 'work',
    clientVisibleLabel: 'Активна по годовому договору',
    employeeActionLabel: 'Вести квартальное обслуживание',
  },
  {
    id: 'Проектирование',
    label: 'Проектирование',
    description: 'Экологи выполняют проектирование, разрешительную документацию, отчеты или экологические документы.',
    order: 6,
    category: 'work',
    clientVisibleLabel: 'Выполнение работ',
    employeeActionLabel: 'Передать в проектирование',
  },
  {
    id: 'Лаборатория',
    label: 'Лаборатория',
    description: 'Лаборатория выполняет анализы, замеры, работу с пробами и протоколами.',
    order: 6,
    category: 'work',
    clientVisibleLabel: 'Выполнение работ',
    employeeActionLabel: 'Передать в лабораторию',
  },
  {
    id: 'Вывоз',
    label: 'Вывоз',
    description: 'Команда организует вывоз или транспортировку отходов.',
    order: 6,
    category: 'work',
    clientVisibleLabel: 'Выполнение работ',
    employeeActionLabel: 'Организовать вывоз',
  },
  {
    id: 'Утилизация',
    label: 'Утилизация',
    description: 'Команда выполняет утилизацию, размещение, переработку или работу с полигоном.',
    order: 6,
    category: 'work',
    clientVisibleLabel: 'Выполнение работ',
    employeeActionLabel: 'Передать на утилизацию',
  },
  {
    id: 'Проверка результата',
    label: 'Проверка результата',
    description: 'Готовые материалы, протоколы, акты или закрывающие документы проходят внутреннюю проверку.',
    order: 7,
    category: 'quality',
    clientVisibleLabel: 'Проверка результата',
    employeeActionLabel: 'Проверить результат',
  },
  {
    id: 'Готово',
    label: 'Готово',
    description: 'Результат готов и доступен клиенту.',
    order: 8,
    category: 'done',
    clientVisibleLabel: 'Готово',
    employeeActionLabel: 'Передать клиенту',
  },
  {
    id: 'Завершено',
    label: 'Завершено',
    description: 'Заявка полностью закрыта после передачи результата и закрывающих документов.',
    order: 9,
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
    id: 'ORD-1012',
    businessCompanyId: 'eco-docs',
    businessCompanyName: 'ECOPROGRESS Documents',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Контактное лицо',
    companyName: 'ТОО "Клиент Eco"',
    bin: '000000000000',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Астана',
    contactPerson: 'Контактное лицо',
    phone: '+7 (___) ___-__-__',
    email: 'client@ecoprogress.kz',
    serviceId: 'eco-design',
    service: 'Экологическое проектирование: экологическая отчетность',
    urgency: 'Стандартная',
    comment: 'Нужно подготовить отчетность за текущий период.',
    createdAt: '12 апреля 2026',
    status: 'Проектирование',
    manager: 'Менеджер ECOPROGRESS GROUP',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'paid',
    ecologyStatus: 'in_progress',
    paymentAmount: '220 000 ₸',
    paidAt: '14 апреля 2026',
    documents: [{ id: 'DOC-1', orderId: 'ORD-1012', name: 'Исходные данные.xlsx', type: 'client', uploadedAt: '12 апреля 2026', status: 'Принят' }],
    resultDocuments: [{ id: 'DOC-2', orderId: 'ORD-1012', name: 'Черновик отчета.pdf', type: 'result', uploadedAt: '16 апреля 2026', status: 'На проверке' }],
    comments: [{ id: 'COM-1', orderId: 'ORD-1012', author: 'Менеджер ECOPROGRESS GROUP', text: 'Документы получили, специалист начал подготовку.', visibility: 'client', createdAt: '12 апреля 2026, 16:20' }],
    history: [
      { id: 'H-1', orderId: 'ORD-1012', text: 'Заявка создана', createdAt: '12 апреля 2026, 10:15' },
      { id: 'H-2', orderId: 'ORD-1012', text: 'Статус изменен на "Проектирование"', createdAt: '13 апреля 2026, 09:30' },
    ],
  },
  {
    id: 'ORD-1009',
    businessCompanyId: 'eco-docs',
    businessCompanyName: 'ECOPROGRESS Documents',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Контактное лицо',
    companyName: 'ТОО "Клиент Eco"',
    bin: '000000000000',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Астана',
    contactPerson: 'Контактное лицо',
    phone: '+7 (___) ___-__-__',
    email: 'client@ecoprogress.kz',
    serviceId: 'eco-design',
    service: 'Разработка экологической документации',
    urgency: 'Не срочно',
    comment: 'Нужен комплект документов для площадки.',
    createdAt: '4 апреля 2026',
    status: 'Анализ',
    manager: 'Менеджер ECOPROGRESS GROUP',
    documents: [],
    resultDocuments: [],
    comments: [{ id: 'COM-2', orderId: 'ORD-1009', author: 'Менеджер ECOPROGRESS GROUP', text: 'Пожалуйста, загрузите схему площадки и список отходов.', visibility: 'client', createdAt: '5 апреля 2026, 11:10' }],
    history: [{ id: 'H-3', orderId: 'ORD-1009', text: 'Заявка находится на этапе анализа, запрошены исходные данные', createdAt: '5 апреля 2026, 11:10' }],
  },
  {
    id: 'ORD-1004',
    businessCompanyId: 'eco-docs',
    businessCompanyName: 'ECOPROGRESS Documents',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Контактное лицо',
    companyName: 'ТОО "Клиент Eco"',
    bin: '000000000000',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Астана',
    contactPerson: 'Контактное лицо',
    phone: '+7 (___) ___-__-__',
    email: 'client@ecoprogress.kz',
    serviceId: 'permits',
    service: 'Подготовка разрешительной документации',
    urgency: 'Срочно',
    comment: 'Нужно проверить пакет разрешений.',
    createdAt: '21 марта 2026',
    status: 'Проверка результата',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'paid',
    ecologyStatus: 'done',
    manager: 'Менеджер ECOPROGRESS GROUP',
    documents: [],
    resultDocuments: [{ id: 'DOC-3', orderId: 'ORD-1004', name: 'Готовый пакет документов.zip', type: 'result', uploadedAt: '2 апреля 2026', status: 'Готово' }],
    comments: [],
    history: [{ id: 'H-4', orderId: 'ORD-1004', text: 'Готовый документ загружен', createdAt: '2 апреля 2026, 15:40' }],
  },
  {
    id: 'ORD-1015',
    businessCompanyId: 'eco-lab',
    businessCompanyName: 'ECOPROGRESS Laboratory',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Контактное лицо',
    companyName: 'ТОО "Клиент Eco"',
    bin: '000000000000',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Астана',
    contactPerson: 'Контактное лицо',
    phone: '+7 (___) ___-__-__',
    email: 'client@ecoprogress.kz',
    serviceId: 'laboratory',
    service: 'Лабораторные исследования',
    urgency: 'Стандартная',
    comment: 'Нужно провести анализ воды и подготовить протокол.',
    createdAt: '18 апреля 2026',
    status: 'Лаборатория',
    manager: 'Менеджер ECOPROGRESS GROUP',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'paid',
    paymentAmount: '180 000 ₸',
    laboratoryStatus: 'analysis_in_progress',
    documents: [{ id: 'DOC-4', orderId: 'ORD-1015', name: 'Точки отбора проб.pdf', type: 'client', uploadedAt: '18 апреля 2026', status: 'Принят' }],
    resultDocuments: [],
    comments: [{ id: 'COM-4', orderId: 'ORD-1015', author: 'Лаборатория ECOPROGRESS GROUP', text: 'Образцы получены, анализ начат.', visibility: 'client', createdAt: '19 апреля 2026, 10:40' }],
    history: [{ id: 'H-5', orderId: 'ORD-1015', text: 'Лабораторная заявка передана в работу', createdAt: '19 апреля 2026, 10:40' }],
  },
  {
    id: 'ORD-1016',
    businessCompanyId: 'eco-waste',
    businessCompanyName: 'ECOPROGRESS Waste',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Контактное лицо',
    companyName: 'ТОО "Клиент Eco"',
    bin: '000000000000',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Астана',
    contactPerson: 'Контактное лицо',
    phone: '+7 (___) ___-__-__',
    email: 'client@ecoprogress.kz',
    serviceId: 'waste-transportation',
    service: 'Транспортировка отходов',
    urgency: 'Срочно',
    comment: 'Нужен вывоз строительных отходов с объекта.',
    createdAt: '20 апреля 2026',
    status: 'Вывоз',
    manager: 'Не назначен',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'paid',
    paymentAmount: '95 000 ₸',
    documents: [],
    resultDocuments: [],
    comments: [],
    history: [{ id: 'H-6', orderId: 'ORD-1016', text: 'Заявка направлена в ECOPROGRESS Waste', createdAt: '20 апреля 2026, 09:05' }],
  },
  {
    id: 'ORD-1017',
    businessCompanyId: 'eco-poligon',
    businessCompanyName: 'ECOPROGRESS Poligon',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Контактное лицо',
    companyName: 'ТОО "Клиент Eco"',
    bin: '000000000000',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Астана',
    contactPerson: 'Контактное лицо',
    phone: '+7 (___) ___-__-__',
    email: 'client@ecoprogress.kz',
    serviceId: 'landfill',
    service: 'Полигон и размещение отходов',
    urgency: 'Стандартная',
    comment: 'Нужно согласовать прием отходов на полигон.',
    createdAt: '22 апреля 2026',
    status: 'Утилизация',
    manager: 'Менеджер ECOPROGRESS GROUP',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'paid',
    paymentAmount: '145 000 ₸',
    documents: [],
    resultDocuments: [],
    comments: [{ id: 'COM-5', orderId: 'ORD-1017', author: 'Менеджер ECOPROGRESS GROUP', text: 'Проверяем возможность приема указанного вида отходов.', visibility: 'client', createdAt: '22 апреля 2026, 12:15' }],
    history: [{ id: 'H-7', orderId: 'ORD-1017', text: 'Заявка направлена в ECOPROGRESS Poligon', createdAt: '22 апреля 2026, 12:15' }],
  },
  {
    id: 'ORD-2001',
    businessCompanyId: 'eco-docs',
    businessCompanyName: 'ECOPROGRESS Documents',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Айгуль Сапарова',
    companyName: 'ТОО “Green Market”',
    bin: '160740011223',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Шымкент',
    contactPerson: 'Айгуль Сапарова',
    phone: '+7 (___) ___-__-__',
    email: 'green.market@example.kz',
    serviceId: 'eco-design',
    service: 'Годовое экологическое сопровождение и проектирование',
    urgency: 'Годовое обслуживание',
    comment: 'Годовой договор на квартальное экологическое сопровождение.',
    createdAt: '1 января 2026',
    status: 'annual_active',
    contractType: 'annual_quarterly',
    contractId: 'FCON-001',
    annualPeriodStart: '2026-01-01',
    annualPeriodEnd: '2026-12-31',
    manager: 'Менеджер ECOPROGRESS GROUP',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'partial',
    ecologyStatus: 'in_progress',
    paymentAmount: '1 200 000 ₸',
    documents: [],
    resultDocuments: [],
    comments: [{ id: 'COM-2001', orderId: 'ORD-2001', author: 'Менеджер ECOPROGRESS GROUP', text: 'Заявка активна по годовому договору, кварталы ведутся отдельно.', visibility: 'client', createdAt: '1 января 2026, 10:00' }],
    history: [{ id: 'H-2001', orderId: 'ORD-2001', text: 'Годовая заявка активирована по договору EPG-GM-2026-Q', createdAt: '1 января 2026, 10:00' }],
    quarters: [
      {
        id: 'RQ-GM-1',
        requestId: 'ORD-2001',
        contractId: 'FCON-001',
        quarter: 1,
        quarterLabel: '1 квартал',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        serviceName: 'Экологическое сопровождение и проектирование',
        workStage: 'Проектирование',
        workStatus: 'completed',
        paymentStatus: 'paid',
        plannedAmount: 300000,
        paidAmount: 300000,
        remainingAmount: 0,
        invoiceNumber: 'INV-GM-2026-Q1',
        invoiceDate: '2026-01-05',
        dueDate: '2026-01-20',
        documents: [{ id: 'QDOC-GM-1-ACT', quarterId: 'RQ-GM-1', requestId: 'ORD-2001', contractId: 'FCON-001', name: 'Акт 1 квартал Green Market.pdf', fileName: 'Акт 1 квартал Green Market.pdf', fileType: 'application/pdf', fileSize: 248000, documentType: 'act', uploadedByRole: 'manager', uploadedByName: 'Менеджер ECOPROGRESS GROUP', uploadedAt: '2026-03-28' }],
        results: [{ id: 'QRES-GM-1', quarterId: 'RQ-GM-1', requestId: 'ORD-2001', title: 'Отчет по экологическому сопровождению за 1 квартал', resultType: 'project_document', attachedDocumentIds: ['QDOC-GM-1-ACT'], createdByName: 'Эколог ECOPROGRESS GROUP', createdAt: '2026-03-28' }],
        comments: [],
        responsibleEmployeeId: 'staff-3',
        responsibleEmployeeName: 'Эколог ECOPROGRESS GROUP',
        startedAt: '2026-01-10',
        completedAt: '2026-03-28',
        createdAt: '2026-01-01',
        updatedAt: '2026-03-28',
      },
      {
        id: 'RQ-GM-2',
        requestId: 'ORD-2001',
        contractId: 'FCON-001',
        quarter: 2,
        quarterLabel: '2 квартал',
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        serviceName: 'Экологическое сопровождение и проектирование',
        workStage: 'Проектирование',
        workStatus: 'in_progress',
        paymentStatus: 'partial',
        plannedAmount: 300000,
        paidAmount: 150000,
        remainingAmount: 150000,
        invoiceNumber: 'INV-GM-2026-Q2',
        invoiceDate: '2026-04-05',
        dueDate: '2026-04-20',
        documents: [{ id: 'QDOC-GM-2-DATA', quarterId: 'RQ-GM-2', requestId: 'ORD-2001', contractId: 'FCON-001', name: 'Исходные данные 2 квартал.xlsx', fileName: 'Исходные данные 2 квартал.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileSize: 96000, documentType: 'client_data', uploadedByRole: 'client', uploadedByName: 'ТОО “Green Market”', uploadedAt: '2026-04-03' }],
        results: [],
        comments: [{ id: 'QCOM-GM-2', quarterId: 'RQ-GM-2', requestId: 'ORD-2001', author: 'Бухгалтер ECOPROGRESS GROUP', text: 'Есть остаток оплаты за 2 квартал 150 000 ₸.', visibility: 'internal', createdAt: '2026-04-21' }],
        responsibleEmployeeId: 'staff-3',
        responsibleEmployeeName: 'Эколог ECOPROGRESS GROUP',
        startedAt: '2026-04-05',
        createdAt: '2026-04-01',
        updatedAt: '2026-05-08',
      },
      {
        id: 'RQ-GM-3',
        requestId: 'ORD-2001',
        contractId: 'FCON-001',
        quarter: 3,
        quarterLabel: '3 квартал',
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        serviceName: 'Экологическое сопровождение и проектирование',
        workStage: 'Проектирование',
        workStatus: 'planned',
        paymentStatus: 'unpaid',
        plannedAmount: 300000,
        paidAmount: 0,
        remainingAmount: 300000,
        invoiceNumber: 'INV-GM-2026-Q3',
        invoiceDate: '2026-07-05',
        dueDate: '2026-07-20',
        documents: [],
        results: [],
        comments: [],
        responsibleEmployeeId: 'staff-3',
        responsibleEmployeeName: 'Эколог ECOPROGRESS GROUP',
        createdAt: '2026-07-01',
        updatedAt: '2026-07-01',
      },
      {
        id: 'RQ-GM-4',
        requestId: 'ORD-2001',
        contractId: 'FCON-001',
        quarter: 4,
        quarterLabel: '4 квартал',
        periodStart: '2026-10-01',
        periodEnd: '2026-12-31',
        serviceName: 'Экологическое сопровождение и проектирование',
        workStage: 'Проектирование',
        workStatus: 'planned',
        paymentStatus: 'unpaid',
        plannedAmount: 300000,
        paidAmount: 0,
        remainingAmount: 300000,
        invoiceNumber: 'INV-GM-2026-Q4',
        invoiceDate: '2026-10-05',
        dueDate: '2026-10-20',
        documents: [],
        results: [],
        comments: [],
        responsibleEmployeeId: 'staff-3',
        responsibleEmployeeName: 'Эколог ECOPROGRESS GROUP',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
    ],
  },
  {
    id: 'ORD-2002',
    businessCompanyId: 'eco-lab',
    businessCompanyName: 'ECOPROGRESS Laboratory',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Руслан Абдиев',
    companyName: 'ТОО “Shymkent Plast”',
    bin: '120540018765',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Шымкент',
    contactPerson: 'Руслан Абдиев',
    phone: '+7 (___) ___-__-__',
    email: 'shymkent.plast@example.kz',
    serviceId: 'laboratory',
    service: 'Годовой лабораторный контроль',
    urgency: 'Годовое обслуживание',
    comment: 'Квартальный лабораторный контроль по годовому договору.',
    createdAt: '1 января 2026',
    status: 'annual_active',
    contractType: 'annual_quarterly',
    contractId: 'FCON-002',
    annualPeriodStart: '2026-01-01',
    annualPeriodEnd: '2026-12-31',
    manager: 'Менеджер ECOPROGRESS GROUP',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'partial',
    laboratoryStatus: 'analysis_in_progress',
    paymentAmount: '1 600 000 ₸',
    documents: [],
    resultDocuments: [],
    comments: [],
    history: [{ id: 'H-2002', orderId: 'ORD-2002', text: 'Годовая лабораторная заявка активирована', createdAt: '1 января 2026, 10:10' }],
    quarters: [
      {
        id: 'RQ-SP-1',
        requestId: 'ORD-2002',
        contractId: 'FCON-002',
        quarter: 1,
        quarterLabel: '1 квартал',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        serviceName: 'Квартальный лабораторный контроль',
        workStage: 'Лаборатория',
        workStatus: 'completed',
        paymentStatus: 'paid',
        plannedAmount: 400000,
        paidAmount: 400000,
        remainingAmount: 0,
        invoiceNumber: 'INV-SP-2026-Q1',
        invoiceDate: '2026-01-05',
        dueDate: '2026-01-20',
        documents: [{ id: 'QDOC-SP-1-PROTOCOL', quarterId: 'RQ-SP-1', requestId: 'ORD-2002', contractId: 'FCON-002', name: 'Протокол лаборатории 1 квартал.pdf', fileName: 'Протокол лаборатории 1 квартал.pdf', fileType: 'application/pdf', fileSize: 430000, documentType: 'protocol', uploadedByRole: 'employee', uploadedByName: 'Лаборатория ECOPROGRESS GROUP', uploadedAt: '2026-03-24' }],
        results: [{ id: 'QRES-SP-1', quarterId: 'RQ-SP-1', requestId: 'ORD-2002', title: 'Лабораторный протокол за 1 квартал', resultType: 'laboratory_protocol', attachedDocumentIds: ['QDOC-SP-1-PROTOCOL'], createdByName: 'Лаборатория ECOPROGRESS GROUP', createdAt: '2026-03-24' }],
        comments: [],
        responsibleEmployeeId: 'staff-4',
        responsibleEmployeeName: 'Лаборатория ECOPROGRESS GROUP',
        startedAt: '2026-01-12',
        completedAt: '2026-03-24',
        createdAt: '2026-01-01',
        updatedAt: '2026-03-24',
      },
      {
        id: 'RQ-SP-2',
        requestId: 'ORD-2002',
        contractId: 'FCON-002',
        quarter: 2,
        quarterLabel: '2 квартал',
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        serviceName: 'Квартальный лабораторный контроль',
        workStage: 'Лаборатория',
        workStatus: 'in_progress',
        paymentStatus: 'partial',
        plannedAmount: 400000,
        paidAmount: 220000,
        remainingAmount: 180000,
        invoiceNumber: 'INV-SP-2026-Q2',
        invoiceDate: '2026-04-05',
        dueDate: '2026-04-20',
        documents: [],
        results: [],
        comments: [],
        responsibleEmployeeId: 'staff-4',
        responsibleEmployeeName: 'Лаборатория ECOPROGRESS GROUP',
        startedAt: '2026-04-05',
        createdAt: '2026-04-01',
        updatedAt: '2026-05-08',
      },
      {
        id: 'RQ-SP-3',
        requestId: 'ORD-2002',
        contractId: 'FCON-002',
        quarter: 3,
        quarterLabel: '3 квартал',
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        serviceName: 'Квартальный лабораторный контроль',
        workStage: 'Лаборатория',
        workStatus: 'waiting_payment',
        paymentStatus: 'unpaid',
        plannedAmount: 400000,
        paidAmount: 0,
        remainingAmount: 400000,
        invoiceNumber: 'INV-SP-2026-Q3',
        invoiceDate: '2026-07-05',
        dueDate: '2026-07-20',
        documents: [],
        results: [],
        comments: [],
        responsibleEmployeeId: 'staff-4',
        responsibleEmployeeName: 'Лаборатория ECOPROGRESS GROUP',
        createdAt: '2026-07-01',
        updatedAt: '2026-07-01',
      },
      {
        id: 'RQ-SP-4',
        requestId: 'ORD-2002',
        contractId: 'FCON-002',
        quarter: 4,
        quarterLabel: '4 квартал',
        periodStart: '2026-10-01',
        periodEnd: '2026-12-31',
        serviceName: 'Квартальный лабораторный контроль',
        workStage: 'Лаборатория',
        workStatus: 'planned',
        paymentStatus: 'unpaid',
        plannedAmount: 400000,
        paidAmount: 0,
        remainingAmount: 400000,
        invoiceNumber: 'INV-SP-2026-Q4',
        invoiceDate: '2026-10-05',
        dueDate: '2026-10-20',
        documents: [],
        results: [],
        comments: [],
        responsibleEmployeeId: 'staff-4',
        responsibleEmployeeName: 'Лаборатория ECOPROGRESS GROUP',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
    ],
  },
  {
    id: 'ORD-2003',
    businessCompanyId: 'eco-waste',
    businessCompanyName: 'ECOPROGRESS Waste',
    clientId: 'client-1',
    clientType: 'company',
    clientName: 'Ерлан Омаров',
    companyName: 'ТОО “Eco Build KZ”',
    bin: '190340025114',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Алматы',
    contactPerson: 'Ерлан Омаров',
    phone: '+7 (___) ___-__-__',
    email: 'ecobuild@example.kz',
    serviceId: 'waste-transportation',
    service: 'Годовой вывоз и утилизация отходов',
    urgency: 'Годовое обслуживание',
    comment: 'Квартальный вывоз и утилизация отходов по годовому договору.',
    createdAt: '1 января 2026',
    status: 'annual_active',
    contractType: 'annual_quarterly',
    contractId: 'FCON-004',
    annualPeriodStart: '2026-01-01',
    annualPeriodEnd: '2026-12-31',
    manager: 'Менеджер ECOPROGRESS GROUP',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'pending',
    paymentAmount: '960 000 ₸',
    documents: [],
    resultDocuments: [],
    comments: [],
    history: [{ id: 'H-2003', orderId: 'ORD-2003', text: 'Годовая заявка по вывозу и утилизации активирована', createdAt: '1 января 2026, 10:20' }],
    quarters: [1, 2, 3, 4].map((quarter) => ({
      id: `RQ-EB-${quarter}`,
      requestId: 'ORD-2003',
      contractId: 'FCON-004',
      quarter: quarter as QuarterNumber,
      quarterLabel: `${quarter} квартал` as QuarterLabel,
      periodStart: quarter === 1 ? '2026-01-01' : quarter === 2 ? '2026-04-01' : quarter === 3 ? '2026-07-01' : '2026-10-01',
      periodEnd: quarter === 1 ? '2026-03-31' : quarter === 2 ? '2026-06-30' : quarter === 3 ? '2026-09-30' : '2026-12-31',
      serviceName: 'Годовой вывоз и утилизация отходов',
      workStage: quarter % 2 === 0 ? 'Утилизация' : 'Вывоз',
      workStatus: quarter === 1 ? 'completed' : quarter === 2 ? 'ready_to_start' : 'planned',
      paymentStatus: quarter === 1 ? 'paid' : 'unpaid',
      plannedAmount: 240000,
      paidAmount: quarter === 1 ? 240000 : 0,
      remainingAmount: quarter === 1 ? 0 : 240000,
      invoiceNumber: `INV-EB-2026-Q${quarter}`,
      invoiceDate: quarter === 1 ? '2026-01-05' : quarter === 2 ? '2026-04-05' : quarter === 3 ? '2026-07-05' : '2026-10-05',
      dueDate: quarter === 1 ? '2026-01-20' : quarter === 2 ? '2026-04-20' : quarter === 3 ? '2026-07-20' : '2026-10-20',
      documents: quarter === 1 ? [{ id: 'QDOC-EB-1-ACT', quarterId: 'RQ-EB-1', requestId: 'ORD-2003', contractId: 'FCON-004', name: 'Акт вывоза отходов 1 квартал.pdf', fileName: 'Акт вывоза отходов 1 квартал.pdf', fileType: 'application/pdf', fileSize: 310000, documentType: 'act', uploadedByRole: 'employee', uploadedByName: 'ECOPROGRESS Waste', uploadedAt: '2026-03-25' }] : [],
      results: quarter === 1 ? [{ id: 'QRES-EB-1', quarterId: 'RQ-EB-1', requestId: 'ORD-2003', title: 'Акт вывоза и утилизации за 1 квартал', resultType: 'waste_removal_act', attachedDocumentIds: ['QDOC-EB-1-ACT'], createdByName: 'ECOPROGRESS Waste', createdAt: '2026-03-25' }] : [],
      comments: [],
      responsibleEmployeeId: 'staff-1',
      responsibleEmployeeName: 'Менеджер ECOPROGRESS GROUP',
      startedAt: quarter === 1 ? '2026-01-12' : undefined,
      completedAt: quarter === 1 ? '2026-03-25' : undefined,
      createdAt: '2026-01-01',
      updatedAt: '2026-05-08',
    })),
  },
];

export const documents: DocumentItem[] = orders.flatMap((order) => [...order.documents, ...order.resultDocuments]);

export const payments: PaymentItem[] = [
  { id: 'PAY-2201', invoice: 'Счет #2201', service: 'Экологическая отчетность', amount: '220 000 ₸', date: '11 апреля 2026', status: 'Оплачен' },
  { id: 'PAY-2190', invoice: 'Счет #2190', service: 'Экологический аудит', amount: '350 000 ₸', date: '27 марта 2026', status: 'Ожидает оплаты' },
];

export const ourPaymentCompanies: OurPaymentCompany[] = [
  { id: 'ecoprogress-group', name: 'ТОО “ECOPROGRESS GROUP”' },
  { id: 'ecoprogress-lab', name: 'ТОО “ECOPROGRESS LAB”' },
  { id: 'ecoprogress-utilization', name: 'ТОО “ECOPROGRESS UTILIZATION”' },
];

export const clientPaymentCompanies: ClientPaymentCompany[] = [
  { id: 'shymkent-plast', name: 'ТОО “Shymkent Plast”', bin: '120540018765' },
  { id: 'green-market', name: 'ТОО “Green Market”', bin: '160740011223' },
  { id: 'asylbek-ip', name: 'ИП “Асылбек”', bin: '880512350987' },
  { id: 'eco-build-kz', name: 'ТОО “Eco Build KZ”', bin: '190340025114' },
];

export const paymentRecords: Payment[] = [
  {
    id: 'PAY-FIN-001',
    requestId: 'ORD-1012',
    requestNumber: 'ORD-1012',
    invoiceNumber: 'INV-2026-001',
    contractNumber: 'EPG-DOC-2026-001',
    ourCompanyId: 'ecoprogress-group',
    ourCompanyName: 'ТОО “ECOPROGRESS GROUP”',
    clientCompanyId: 'shymkent-plast',
    clientCompanyName: 'ТОО “Shymkent Plast”',
    clientBin: '120540018765',
    serviceName: 'Экологическое проектирование',
    totalAmount: 1250000,
    paidAmount: 1250000,
    remainingAmount: 0,
    paymentStatus: 'paid',
    invoiceDate: '2026-04-10',
    dueDate: '2026-04-20',
    lastPaymentDate: '2026-04-14',
    paymentMethod: 'bank_transfer',
    responsibleManager: 'Менеджер ECOPROGRESS GROUP',
    comment: 'Оплата поступила одним платежом.',
    createdAt: '2026-04-10',
    updatedAt: '2026-04-14',
  },
  {
    id: 'PAY-FIN-002',
    requestId: 'ORD-1015',
    requestNumber: 'ORD-1015',
    invoiceNumber: 'INV-2026-014',
    contractNumber: 'EPG-LAB-2025-018',
    ourCompanyId: 'ecoprogress-lab',
    ourCompanyName: 'ТОО “ECOPROGRESS LAB”',
    clientCompanyId: 'green-market',
    clientCompanyName: 'ТОО “Green Market”',
    clientBin: '160740011223',
    serviceName: 'Лабораторные исследования воды',
    totalAmount: 350000,
    paidAmount: 150000,
    remainingAmount: 200000,
    paymentStatus: 'partial',
    invoiceDate: '2026-04-18',
    dueDate: '2026-05-15',
    lastPaymentDate: '2026-04-22',
    paymentMethod: 'card',
    responsibleManager: 'Менеджер ECOPROGRESS GROUP',
    comment: 'Клиент обещал закрыть остаток после получения протокола.',
    createdAt: '2026-04-18',
    updatedAt: '2026-04-22',
  },
  {
    id: 'PAY-FIN-003',
    requestId: 'ORD-1016',
    requestNumber: 'ORD-1016',
    invoiceNumber: 'INV-2026-021',
    contractNumber: 'EPG-WST-2026-011',
    ourCompanyId: 'ecoprogress-utilization',
    ourCompanyName: 'ТОО “ECOPROGRESS UTILIZATION”',
    clientCompanyId: 'asylbek-ip',
    clientCompanyName: 'ИП “Асылбек”',
    clientBin: '880512350987',
    serviceName: 'Вывоз строительных отходов',
    totalAmount: 240000,
    paidAmount: 0,
    remainingAmount: 240000,
    paymentStatus: 'unpaid',
    invoiceDate: '2026-05-02',
    dueDate: '2026-05-20',
    paymentMethod: 'bank_transfer',
    responsibleManager: 'Менеджер ECOPROGRESS GROUP',
    comment: 'Счет отправлен клиенту.',
    createdAt: '2026-05-02',
    updatedAt: '2026-05-02',
  },
  {
    id: 'PAY-FIN-004',
    requestId: 'ORD-1017',
    requestNumber: 'ORD-1017',
    invoiceNumber: 'INV-2026-009',
    contractNumber: 'EPG-PLG-2024-004',
    ourCompanyId: 'ecoprogress-utilization',
    ourCompanyName: 'ТОО “ECOPROGRESS UTILIZATION”',
    clientCompanyId: 'eco-build-kz',
    clientCompanyName: 'ТОО “Eco Build KZ”',
    clientBin: '190340025114',
    serviceName: 'Утилизация и размещение отходов',
    totalAmount: 780000,
    paidAmount: 300000,
    remainingAmount: 480000,
    paymentStatus: 'overdue',
    invoiceDate: '2026-03-25',
    dueDate: '2026-04-15',
    lastPaymentDate: '2026-04-01',
    paymentMethod: 'bank_transfer',
    responsibleManager: 'Менеджер ECOPROGRESS GROUP',
    comment: 'Просрочен остаток по счету.',
    createdAt: '2026-03-25',
    updatedAt: '2026-04-16',
  },
  {
    id: 'PAY-FIN-005',
    requestId: 'ORD-1004',
    requestNumber: 'ORD-1004',
    invoiceNumber: 'INV-2026-006',
    contractNumber: 'EPG-DOC-2026-001',
    ourCompanyId: 'ecoprogress-group',
    ourCompanyName: 'ТОО “ECOPROGRESS GROUP”',
    clientCompanyId: 'green-market',
    clientCompanyName: 'ТОО “Green Market”',
    clientBin: '160740011223',
    serviceName: 'Разрешительная документация',
    totalAmount: 520000,
    paidAmount: 520000,
    remainingAmount: 0,
    paymentStatus: 'paid',
    invoiceDate: '2026-03-28',
    dueDate: '2026-04-05',
    lastPaymentDate: '2026-04-02',
    paymentMethod: 'cash',
    responsibleManager: 'Менеджер ECOPROGRESS GROUP',
    comment: 'Закрыто наличной оплатой.',
    createdAt: '2026-03-28',
    updatedAt: '2026-04-02',
  },
];

export const financeContracts: Contract[] = [
  {
    id: 'FCON-001',
    contractNumber: 'EPG-GM-2026-Q',
    requestId: 'ORD-2001',
    clientCompanyId: 'green-market',
    clientCompanyName: 'ТОО “Green Market”',
    clientBin: '160740011223',
    ourCompanyId: 'ecoprogress-group',
    ourCompanyName: 'ТОО “ECOPROGRESS GROUP”',
    contractType: 'annual_quarterly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    totalAmount: 1200000,
    status: 'active',
    serviceName: 'Экологическое сопровождение и проектирование',
    responsibleManager: 'Менеджер ECOPROGRESS GROUP',
    createdAt: '2026-01-01',
    updatedAt: '2026-05-01',
    quarterlySchedule: [
      {
        id: 'Q-GM-1',
        contractId: 'FCON-001',
        requestId: 'ORD-2001',
        quarter: 1,
        quarterLabel: '1 квартал',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        serviceName: 'Экологическое сопровождение и проектирование',
        workStage: 'Проектирование',
        plannedAmount: 300000,
        invoiceNumber: 'INV-GM-2026-Q1',
        invoiceDate: '2026-01-05',
        dueDate: '2026-01-20',
        paidAmount: 300000,
        remainingAmount: 0,
        paymentStatus: 'paid',
        workStatus: 'completed',
        lastPaymentDate: '2026-01-16',
        completedAt: '2026-03-28',
      },
      {
        id: 'Q-GM-2',
        contractId: 'FCON-001',
        requestId: 'ORD-2001',
        quarter: 2,
        quarterLabel: '2 квартал',
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        serviceName: 'Экологическое сопровождение и проектирование',
        workStage: 'Проектирование',
        plannedAmount: 300000,
        invoiceNumber: 'INV-GM-2026-Q2',
        invoiceDate: '2026-04-05',
        dueDate: '2026-04-20',
        paidAmount: 0,
        remainingAmount: 300000,
        paymentStatus: 'overdue',
        workStatus: 'blocked_by_debt',
        comment: 'Есть долг за 2 квартал, выполнение следующего этапа требует проверки оплаты.',
      },
      {
        id: 'Q-GM-3',
        contractId: 'FCON-001',
        requestId: 'ORD-2001',
        quarter: 3,
        quarterLabel: '3 квартал',
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        serviceName: 'Экологическое сопровождение и проектирование',
        workStage: 'Проектирование',
        plannedAmount: 300000,
        invoiceNumber: 'INV-GM-2026-Q3',
        invoiceDate: '2026-07-05',
        dueDate: '2026-07-20',
        paidAmount: 150000,
        remainingAmount: 150000,
        paymentStatus: 'partial',
        workStatus: 'waiting_payment',
        lastPaymentDate: '2026-07-12',
        comment: 'Частичная оплата за 3 квартал.',
      },
      {
        id: 'Q-GM-4',
        contractId: 'FCON-001',
        requestId: 'ORD-2001',
        quarter: 4,
        quarterLabel: '4 квартал',
        periodStart: '2026-10-01',
        periodEnd: '2026-12-31',
        serviceName: 'Экологическое сопровождение и проектирование',
        workStage: 'Проектирование',
        plannedAmount: 300000,
        invoiceNumber: 'INV-GM-2026-Q4',
        invoiceDate: '2026-10-05',
        dueDate: '2026-10-20',
        paidAmount: 0,
        remainingAmount: 300000,
        paymentStatus: 'unpaid',
        workStatus: 'planned',
      },
    ],
  },
  {
    id: 'FCON-002',
    contractNumber: 'EPG-SP-2026-LAB-Q',
    requestId: 'ORD-2002',
    clientCompanyId: 'shymkent-plast',
    clientCompanyName: 'ТОО “Shymkent Plast”',
    clientBin: '120540018765',
    ourCompanyId: 'ecoprogress-lab',
    ourCompanyName: 'ТОО “ECOPROGRESS LAB”',
    contractType: 'annual_quarterly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    totalAmount: 1600000,
    status: 'active',
    serviceName: 'Квартальный лабораторный контроль',
    responsibleManager: 'Менеджер ECOPROGRESS GROUP',
    createdAt: '2026-01-01',
    updatedAt: '2026-05-01',
    quarterlySchedule: [
      {
        id: 'Q-SP-1',
        contractId: 'FCON-002',
        requestId: 'ORD-2002',
        quarter: 1,
        quarterLabel: '1 квартал',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        serviceName: 'Квартальный лабораторный контроль',
        workStage: 'Лаборатория',
        plannedAmount: 400000,
        invoiceNumber: 'INV-SP-2026-Q1',
        invoiceDate: '2026-01-05',
        dueDate: '2026-01-20',
        paidAmount: 400000,
        remainingAmount: 0,
        paymentStatus: 'paid',
        workStatus: 'completed',
        lastPaymentDate: '2026-01-18',
        completedAt: '2026-03-24',
      },
      {
        id: 'Q-SP-2',
        contractId: 'FCON-002',
        requestId: 'ORD-2002',
        quarter: 2,
        quarterLabel: '2 квартал',
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        serviceName: 'Квартальный лабораторный контроль',
        workStage: 'Лаборатория',
        plannedAmount: 400000,
        invoiceNumber: 'INV-SP-2026-Q2',
        invoiceDate: '2026-04-05',
        dueDate: '2026-04-20',
        paidAmount: 220000,
        remainingAmount: 180000,
        paymentStatus: 'partial',
        workStatus: 'in_progress',
        lastPaymentDate: '2026-04-17',
      },
      {
        id: 'Q-SP-3',
        contractId: 'FCON-002',
        requestId: 'ORD-2002',
        quarter: 3,
        quarterLabel: '3 квартал',
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        serviceName: 'Квартальный лабораторный контроль',
        workStage: 'Лаборатория',
        plannedAmount: 400000,
        invoiceNumber: 'INV-SP-2026-Q3',
        invoiceDate: '2026-07-05',
        dueDate: '2026-07-20',
        paidAmount: 0,
        remainingAmount: 400000,
        paymentStatus: 'unpaid',
        workStatus: 'waiting_payment',
      },
      {
        id: 'Q-SP-4',
        contractId: 'FCON-002',
        requestId: 'ORD-2002',
        quarter: 4,
        quarterLabel: '4 квартал',
        periodStart: '2026-10-01',
        periodEnd: '2026-12-31',
        serviceName: 'Квартальный лабораторный контроль',
        workStage: 'Лаборатория',
        plannedAmount: 400000,
        invoiceNumber: 'INV-SP-2026-Q4',
        invoiceDate: '2026-10-05',
        dueDate: '2026-10-20',
        paidAmount: 0,
        remainingAmount: 400000,
        paymentStatus: 'unpaid',
        workStatus: 'planned',
      },
    ],
  },
  {
    id: 'FCON-003',
    contractNumber: 'EPG-EB-2026-ONE',
    requestId: 'ORD-1017',
    clientCompanyId: 'eco-build-kz',
    clientCompanyName: 'ТОО “Eco Build KZ”',
    clientBin: '190340025114',
    ourCompanyId: 'ecoprogress-utilization',
    ourCompanyName: 'ТОО “ECOPROGRESS UTILIZATION”',
    contractType: 'one_time',
    startDate: '2026-03-25',
    endDate: '2026-04-30',
    totalAmount: 780000,
    status: 'active',
    serviceName: 'Утилизация и размещение отходов',
    responsibleManager: 'Менеджер ECOPROGRESS GROUP',
    createdAt: '2026-03-25',
    updatedAt: '2026-04-16',
  },
  {
    id: 'FCON-004',
    contractNumber: 'EPG-EB-2026-WASTE-Q',
    requestId: 'ORD-2003',
    clientCompanyId: 'eco-build-kz',
    clientCompanyName: 'ТОО “Eco Build KZ”',
    clientBin: '190340025114',
    ourCompanyId: 'ecoprogress-utilization',
    ourCompanyName: 'ТОО “ECOPROGRESS UTILIZATION”',
    contractType: 'annual_quarterly',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    totalAmount: 960000,
    status: 'active',
    serviceName: 'Годовой вывоз и утилизация отходов',
    responsibleManager: 'Менеджер ECOPROGRESS GROUP',
    createdAt: '2026-01-01',
    updatedAt: '2026-05-08',
    quarterlySchedule: [1, 2, 3, 4].map((quarter) => ({
      id: `Q-EB-${quarter}`,
      contractId: 'FCON-004',
      requestId: 'ORD-2003',
      quarter: quarter as QuarterNumber,
      quarterLabel: `${quarter} квартал` as QuarterLabel,
      periodStart: quarter === 1 ? '2026-01-01' : quarter === 2 ? '2026-04-01' : quarter === 3 ? '2026-07-01' : '2026-10-01',
      periodEnd: quarter === 1 ? '2026-03-31' : quarter === 2 ? '2026-06-30' : quarter === 3 ? '2026-09-30' : '2026-12-31',
      serviceName: 'Годовой вывоз и утилизация отходов',
      workStage: quarter % 2 === 0 ? 'Утилизация' : 'Вывоз',
      plannedAmount: 240000,
      invoiceNumber: `INV-EB-2026-Q${quarter}`,
      invoiceDate: quarter === 1 ? '2026-01-05' : quarter === 2 ? '2026-04-05' : quarter === 3 ? '2026-07-05' : '2026-10-05',
      dueDate: quarter === 1 ? '2026-01-20' : quarter === 2 ? '2026-04-20' : quarter === 3 ? '2026-07-20' : '2026-10-20',
      paidAmount: quarter === 1 ? 240000 : 0,
      remainingAmount: quarter === 1 ? 0 : 240000,
      paymentStatus: quarter === 1 ? 'paid' : 'unpaid',
      workStatus: quarter === 1 ? 'completed' : quarter === 2 ? 'ready_to_start' : 'planned',
      lastPaymentDate: quarter === 1 ? '2026-01-18' : undefined,
      completedAt: quarter === 1 ? '2026-03-25' : undefined,
    })),
  },
];

export const financeDebts: Debt[] = [
  {
    id: 'DEBT-GM-Q2',
    clientCompanyId: 'green-market',
    clientCompanyName: 'ТОО “Green Market”',
    contractId: 'FCON-001',
    contractNumber: 'EPG-GM-2026-Q',
    requestId: 'ORD-2001',
    quarterItemId: 'Q-GM-2',
    quarterLabel: '2 квартал',
    invoiceNumber: 'INV-GM-2026-Q2',
    amount: 300000,
    paidAmount: 0,
    remainingAmount: 300000,
    dueDate: '2026-04-20',
    overdueDays: 18,
    status: 'overdue',
    reason: 'overdue_payment',
    comment: 'Просрочена оплата за 2 квартал.',
    createdAt: '2026-04-21',
    updatedAt: '2026-05-08',
  },
  {
    id: 'DEBT-GM-Q3',
    clientCompanyId: 'green-market',
    clientCompanyName: 'ТОО “Green Market”',
    contractId: 'FCON-001',
    contractNumber: 'EPG-GM-2026-Q',
    requestId: 'ORD-2001',
    quarterItemId: 'Q-GM-3',
    quarterLabel: '3 квартал',
    invoiceNumber: 'INV-GM-2026-Q3',
    amount: 300000,
    paidAmount: 150000,
    remainingAmount: 150000,
    dueDate: '2026-07-20',
    status: 'partial',
    reason: 'partial_payment',
    comment: 'Остаток по частичной оплате.',
    createdAt: '2026-07-12',
    updatedAt: '2026-07-12',
  },
  {
    id: 'DEBT-SP-Q2',
    clientCompanyId: 'shymkent-plast',
    clientCompanyName: 'ТОО “Shymkent Plast”',
    contractId: 'FCON-002',
    contractNumber: 'EPG-SP-2026-LAB-Q',
    requestId: 'ORD-2002',
    quarterItemId: 'Q-SP-2',
    quarterLabel: '2 квартал',
    invoiceNumber: 'INV-SP-2026-Q2',
    amount: 400000,
    paidAmount: 220000,
    remainingAmount: 180000,
    dueDate: '2026-04-20',
    overdueDays: 18,
    status: 'partial',
    reason: 'partial_payment',
    comment: 'Есть остаток по лабораторному контролю за 2 квартал.',
    createdAt: '2026-04-17',
    updatedAt: '2026-05-08',
  },
];

export const paymentTransactions: PaymentTransaction[] = [
  { id: 'TRX-001', paymentId: 'PAY-FIN-001', contractId: 'FCON-001', amount: 1250000, date: '2026-04-14', method: 'bank_transfer', comment: 'Полная оплата по счету INV-2026-001', createdBy: 'Бухгалтер ECOPROGRESS GROUP', createdAt: '2026-04-14' },
  { id: 'TRX-002', paymentId: 'PAY-FIN-002', contractId: 'FCON-002', amount: 150000, date: '2026-04-22', method: 'card', comment: 'Первый платеж', createdBy: 'Бухгалтер ECOPROGRESS GROUP', createdAt: '2026-04-22' },
  { id: 'TRX-003', paymentId: 'PAY-FIN-004', contractId: 'FCON-003', amount: 300000, date: '2026-04-01', method: 'bank_transfer', comment: 'Аванс по утилизации', createdBy: 'Бухгалтер ECOPROGRESS GROUP', createdAt: '2026-04-01' },
  { id: 'TRX-004', paymentId: 'PAY-FIN-005', contractId: 'FCON-001', amount: 520000, date: '2026-04-02', method: 'cash', comment: 'Оплата в кассу', createdBy: 'Бухгалтер ECOPROGRESS GROUP', createdAt: '2026-04-02' },
  { id: 'TRX-Q-001', contractId: 'FCON-001', quarterItemId: 'Q-GM-1', amount: 300000, date: '2026-01-16', method: 'bank_transfer', comment: 'Оплата 1 квартала Green Market', createdBy: 'Бухгалтер ECOPROGRESS GROUP', createdAt: '2026-01-16' },
  { id: 'TRX-Q-002', contractId: 'FCON-001', quarterItemId: 'Q-GM-3', amount: 150000, date: '2026-07-12', method: 'bank_transfer', comment: 'Частичная оплата 3 квартала Green Market', createdBy: 'Бухгалтер ECOPROGRESS GROUP', createdAt: '2026-07-12' },
  { id: 'TRX-Q-003', contractId: 'FCON-002', quarterItemId: 'Q-SP-1', amount: 400000, date: '2026-01-18', method: 'bank_transfer', comment: 'Оплата 1 квартала Shymkent Plast', createdBy: 'Бухгалтер ECOPROGRESS GROUP', createdAt: '2026-01-18' },
  { id: 'TRX-Q-004', contractId: 'FCON-002', quarterItemId: 'Q-SP-2', amount: 220000, date: '2026-04-17', method: 'card', comment: 'Частичная оплата 2 квартала Shymkent Plast', createdBy: 'Бухгалтер ECOPROGRESS GROUP', createdAt: '2026-04-17' },
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
  { id: 'NOT-1', title: 'Комментарий по заявке ORD-1012', description: 'Специалист добавил уточнение по исходным данным.', date: 'Сегодня, 09:22', role: 'CLIENT' },
  { id: 'NOT-2', title: 'Заявка ожидает консультации', description: 'Проверьте входящие заявки в CRM сотрудника.', date: 'Сегодня, 10:00', role: 'MANAGER' },
  { id: 'NOT-3', title: 'Документ готов', description: 'По заявке ORD-1004 загружен готовый пакет.', date: '2 апреля 2026', role: 'CLIENT' },
];

export const clients = [
  { id: 'client-1', name: 'ТОО "Клиент Eco"', contact: 'Контактное лицо', orders: 3, status: 'Активный' },
  { id: 'client-2', name: 'ИП "Производственная площадка"', contact: 'Владелец', orders: 1, status: 'Новый' },
];
