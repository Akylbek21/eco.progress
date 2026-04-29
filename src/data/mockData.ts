export type ClientType = 'individual' | 'company';
export type UserRole = 'CLIENT' | 'MANAGER' | 'ADMIN';

export type ServiceCategory = 'Отчетность' | 'Документация' | 'Контроль и аудит' | 'Проверки' | 'Консультации';

export type ServiceItem = {
  id: string;
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
  | 'Новая'
  | 'В обработке'
  | 'Ожидает документы'
  | 'В работе'
  | 'На проверке'
  | 'Готово'
  | 'Завершено'
  | 'Отменено';

export type DocumentItem = {
  id: string;
  orderId?: string;
  name: string;
  type: 'client' | 'result' | 'invoice' | 'internal';
  uploadedAt: string;
  status: string;
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
};

export type Order = {
  id: string;
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
  manager: string;
  contractStatus?: 'not_sent' | 'sent' | 'signed';
  paymentStatus?: 'not_sent' | 'pending' | 'paid';
  signatureProvider?: string;
  paymentMethod?: string;
  paymentAmount?: string;
  paymentUrl?: string;
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

export type TariffItem = {
  id: string;
  name: string;
  price: string;
  features: string[];
  popular?: boolean;
};

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  role: UserRole | 'ALL';
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

export const statusDescriptions: Record<OrderStatus, string> = {
  Новая: 'Заявка получена и ожидает первичной обработки менеджером.',
  'В обработке': 'Менеджер уточняет задачу, сроки и необходимые данные.',
  'Ожидает документы': 'Для продолжения нужны дополнительные документы от клиента.',
  'В работе': 'Специалисты ECOPROGRESS GROUP выполняют услугу.',
  'На проверке': 'Готовые материалы проходят внутреннюю проверку качества.',
  Готово: 'Результат подготовлен и доступен для скачивания.',
  Завершено: 'Работа по заявке полностью завершена.',
  Отменено: 'Заявка отменена.',
};

export const services: ServiceItem[] = [
  {
    id: 'reporting',
    title: 'Экологическая отчетность',
    category: 'Отчетность',
    description: 'Подготовка и сопровождение регулярной экологической отчетности для бизнеса.',
    forWhom: 'Компаниям, которым нужно вовремя сдавать обязательные отчеты по природоохранным требованиям.',
    result: 'Готовые формы отчетности, проверенные данные и понятный календарь следующих сроков.',
    includes: ['Анализ обязательств', 'Сбор исходных данных', 'Подготовка отчетных форм', 'Проверка комплектности', 'Сопровождение подачи'],
    documents: ['Данные по отходам', 'Сведения по выбросам и сбросам', 'Договоры с подрядчиками', 'Предыдущие отчеты'],
    workflow: ['Определяем перечень отчетов', 'Запрашиваем данные', 'Готовим формы', 'Согласовываем с клиентом', 'Передаем результат'],
    duration: 'от 5 рабочих дней',
  },
  {
    id: 'documentation',
    title: 'Разработка экологической документации',
    category: 'Документация',
    description: 'Документы для управления отходами, выбросами, сбросами и природоохранными процессами.',
    forWhom: 'Предприятиям, складам, производствам, строительным и сервисным компаниям.',
    result: 'Комплект документов под задачи предприятия и требования проверяющих органов.',
    includes: ['Инвентаризация данных', 'Разработка регламентов', 'Подготовка паспортов и программ', 'Редактура и согласование'],
    documents: ['Реквизиты компании', 'Описание деятельности', 'Схемы площадок', 'Данные об отходах'],
    workflow: ['Изучаем деятельность', 'Формируем перечень документов', 'Готовим проекты', 'Вносим правки', 'Передаем финальный комплект'],
    duration: 'от 10 рабочих дней',
  },
  {
    id: 'control',
    title: 'Производственный экологический контроль',
    category: 'Контроль и аудит',
    description: 'Организация и сопровождение внутреннего контроля экологических показателей.',
    forWhom: 'Предприятиям, которым нужен регулярный контроль процессов и доказательная база для проверок.',
    result: 'План контроля, отчеты, рекомендации и понятная система мониторинга.',
    includes: ['План ПЭК', 'Контрольные мероприятия', 'Отчет по результатам', 'Рекомендации по улучшению'],
    documents: ['План производства', 'Перечень источников воздействия', 'Лабораторные данные', 'Журналы учета'],
    workflow: ['Определяем контрольные точки', 'Собираем документы', 'Проводим оценку', 'Формируем отчет', 'Обсуждаем корректировки'],
    duration: 'от 7 рабочих дней',
  },
  {
    id: 'inspections',
    title: 'Сопровождение экологических проверок',
    category: 'Проверки',
    description: 'Подготовка предприятия к проверке и сопровождение взаимодействия с инспекцией.',
    forWhom: 'Компаниям, которым предстоит плановая или внеплановая экологическая проверка.',
    result: 'Снижение рисков, готовый пакет документов и поддержка специалиста на всех этапах.',
    includes: ['Аудит готовности', 'Проверка документов', 'План устранения рисков', 'Сопровождение коммуникаций'],
    documents: ['Уведомление о проверке', 'Действующие разрешения', 'Отчеты и журналы', 'Договоры с подрядчиками'],
    workflow: ['Оцениваем риски', 'Собираем пакет', 'Готовим пояснения', 'Сопровождаем проверку', 'Помогаем закрыть замечания'],
    duration: 'от 3 рабочих дней',
  },
  {
    id: 'audit',
    title: 'Экологический аудит',
    category: 'Контроль и аудит',
    description: 'Комплексная оценка экологических рисков, документов и процессов компании.',
    forWhom: 'Бизнесу перед проверкой, сделкой, запуском площадки или внутренней оптимизацией.',
    result: 'Аудиторский отчет с рисками, приоритетами и дорожной картой корректировок.',
    includes: ['Проверка документов', 'Анализ процессов', 'Оценка рисков', 'Дорожная карта'],
    documents: ['Уставные данные', 'Разрешения', 'Отчеты', 'Производственные схемы'],
    workflow: ['Согласуем цели', 'Анализируем материалы', 'Проводим интервью', 'Готовим выводы', 'Презентуем рекомендации'],
    duration: 'от 12 рабочих дней',
  },
  {
    id: 'consulting',
    title: 'Консультации по экологии',
    category: 'Консультации',
    description: 'Быстрые ответы и экспертная помощь по экологическим требованиям.',
    forWhom: 'Руководителям, юристам, инженерам, ИП и частным клиентам с точечным вопросом.',
    result: 'Понятный план действий, список документов и рекомендации специалиста.',
    includes: ['Разбор ситуации', 'Письменные рекомендации', 'План действий', 'Ответы на вопросы'],
    documents: ['Описание задачи', 'Имеющиеся документы', 'Фото или схемы при необходимости'],
    workflow: ['Получаем вопрос', 'Уточняем контекст', 'Проверяем требования', 'Даем рекомендации'],
    duration: 'от 1 рабочего дня',
  },
  {
    id: 'waste-management',
    title: 'Разработка программ управления отходами',
    category: 'Документация',
    description: 'Программы, инструкции и документы для безопасного обращения с отходами.',
    forWhom: 'Производствам, торговым сетям, складам, сервисным компаниям и объектам ЖКХ.',
    result: 'Система учета, хранения, передачи и контроля отходов на предприятии.',
    includes: ['Классификация отходов', 'Схема движения отходов', 'Инструкции', 'План мероприятий'],
    documents: ['Перечень отходов', 'Договоры на вывоз', 'Схема площадки', 'Журналы учета'],
    workflow: ['Собираем данные', 'Классифицируем отходы', 'Готовим программу', 'Согласовываем финальную версию'],
    duration: 'от 8 рабочих дней',
  },
  {
    id: 'permits',
    title: 'Подготовка разрешительной документации',
    category: 'Документация',
    description: 'Подготовка пакета документов для разрешений, уведомлений и согласований.',
    forWhom: 'Компаниям, которым нужны разрешения для выбросов, сбросов или природопользования.',
    result: 'Подготовленный пакет документов и сопровождение до результата.',
    includes: ['Проверка требований', 'Сбор исходных данных', 'Подготовка заявлений', 'Сопровождение подачи'],
    documents: ['Реквизиты', 'Описание деятельности', 'Проектные данные', 'Предыдущие разрешения'],
    workflow: ['Определяем тип разрешения', 'Собираем пакет', 'Готовим документы', 'Сопровождаем рассмотрение'],
    duration: 'от 14 рабочих дней',
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
  { id: 'staff-1', role: 'MANAGER', type: 'staff', email: 'manager@ecoprogress.kz', name: 'Менеджер ECOPROGRESS GROUP', position: 'Менеджер по работе с клиентами' },
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
    serviceId: 'reporting',
    service: 'Экологическая отчетность',
    urgency: 'Стандартная',
    comment: 'Нужно подготовить отчетность за текущий период.',
    createdAt: '12 апреля 2026',
    status: 'В работе',
    manager: 'Менеджер ECOPROGRESS GROUP',
    documents: [{ id: 'DOC-1', orderId: 'ORD-1012', name: 'Исходные данные.xlsx', type: 'client', uploadedAt: '12 апреля 2026', status: 'Принят' }],
    resultDocuments: [{ id: 'DOC-2', orderId: 'ORD-1012', name: 'Черновик отчета.pdf', type: 'result', uploadedAt: '16 апреля 2026', status: 'На проверке' }],
    comments: [{ id: 'COM-1', orderId: 'ORD-1012', author: 'Менеджер ECOPROGRESS GROUP', text: 'Документы получили, специалист начал подготовку.', visibility: 'client', createdAt: '12 апреля 2026, 16:20' }],
    history: [
      { id: 'H-1', orderId: 'ORD-1012', text: 'Заявка создана', createdAt: '12 апреля 2026, 10:15' },
      { id: 'H-2', orderId: 'ORD-1012', text: 'Статус изменен на "В работе"', createdAt: '13 апреля 2026, 09:30' },
    ],
  },
  {
    id: 'ORD-1009',
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
    serviceId: 'documentation',
    service: 'Разработка экологической документации',
    urgency: 'Не срочно',
    comment: 'Нужен комплект документов для площадки.',
    createdAt: '4 апреля 2026',
    status: 'Ожидает документы',
    manager: 'Менеджер ECOPROGRESS GROUP',
    documents: [],
    resultDocuments: [],
    comments: [{ id: 'COM-2', orderId: 'ORD-1009', author: 'Менеджер ECOPROGRESS GROUP', text: 'Пожалуйста, загрузите схему площадки и список отходов.', visibility: 'client', createdAt: '5 апреля 2026, 11:10' }],
    history: [{ id: 'H-3', orderId: 'ORD-1009', text: 'Запрошены дополнительные документы', createdAt: '5 апреля 2026, 11:10' }],
  },
  {
    id: 'ORD-1004',
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
    status: 'Готово',
    manager: 'Менеджер ECOPROGRESS GROUP',
    documents: [],
    resultDocuments: [{ id: 'DOC-3', orderId: 'ORD-1004', name: 'Готовый пакет документов.zip', type: 'result', uploadedAt: '2 апреля 2026', status: 'Готово' }],
    comments: [],
    history: [{ id: 'H-4', orderId: 'ORD-1004', text: 'Готовый документ загружен', createdAt: '2 апреля 2026, 15:40' }],
  },
];

export const documents: DocumentItem[] = orders.flatMap((order) => [...order.documents, ...order.resultDocuments]);

export const payments: PaymentItem[] = [
  { id: 'PAY-2201', invoice: 'Счет #2201', service: 'Экологическая отчетность', amount: '220 000 ₸', date: '11 апреля 2026', status: 'Оплачен' },
  { id: 'PAY-2190', invoice: 'Счет #2190', service: 'Экологический аудит', amount: '350 000 ₸', date: '27 марта 2026', status: 'Ожидает оплаты' },
];

export const tariffs: TariffItem[] = [
  { id: 'start', name: 'Старт', price: 'от 150 000 ₸', features: ['Первичная консультация', 'Одна заявка', 'Базовый пакет документов'] },
  { id: 'business', name: 'Бизнес', price: 'от 350 000 ₸', features: ['Несколько заявок', 'Сопровождение отчетности', 'Комментарии специалиста'], popular: true },
  { id: 'pro', name: 'PRO', price: 'от 650 000 ₸', features: ['Комплексное сопровождение', 'Проверки и аудит', 'Приоритетная поддержка'] },
];

export const notifications: NotificationItem[] = [
  { id: 'NOT-1', title: 'Комментарий по заявке ORD-1012', description: 'Специалист добавил уточнение по исходным данным.', date: 'Сегодня, 09:22', role: 'CLIENT' },
  { id: 'NOT-2', title: 'Новая заявка ожидает обработки', description: 'Проверьте входящие заявки в CRM сотрудника.', date: 'Сегодня, 10:00', role: 'MANAGER' },
  { id: 'NOT-3', title: 'Документ готов', description: 'По заявке ORD-1004 загружен готовый пакет.', date: '2 апреля 2026', role: 'CLIENT' },
];

export const clients = [
  { id: 'client-1', name: 'ТОО "Клиент Eco"', contact: 'Контактное лицо', orders: 3, status: 'Активный' },
  { id: 'client-2', name: 'ИП "Производственная площадка"', contact: 'Владелец', orders: 1, status: 'Новый' },
];
