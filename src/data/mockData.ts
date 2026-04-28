export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  details: string;
  highlights: string[];
  target: string[];
  documents: string[];
  duration: string;
  icon: string;
};

export type Employee = {
  id: string;
  name: string;
  position: string;
  experience: string;
  specialty: string;
  summary: string;
  avatar: string;
  certificates: string[];
};

export type TariffItem = {
  id: string;
  name: string;
  price: string;
  features: string[];
  popular?: boolean;
};

export type NewsItem = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  image: string;
};

export type OrderStatus =
  | 'Новая'
  | 'В обработке'
  | 'Ожидает документы'
  | 'В работе'
  | 'Готово'
  | 'Отменено';

export type Order = {
  id: string;
  service: string;
  createdAt: string;
  status: OrderStatus;
  manager: string;
  company: string;
};

export type DocumentItem = {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  status: string;
};

export type PaymentItem = {
  id: string;
  invoice: string;
  service: string;
  amount: string;
  date: string;
  status: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  date: string;
};

export type ClientProfile = {
  companyName: string;
  tin: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
};

export const services: ServiceItem[] = [
  {
    id: 'reporting',
    title: 'Экологическая отчетность',
    description: 'Подготовка и подача регулярной отчетности для бизнеса.',
    details:
      'Анализ требований, сбор данных, оформление отчетов и взаимодействие с контролирующими органами.',
    highlights: ['Регулярные отчеты', 'Сдача в срок', 'Полное сопровождение'],
    target: ['Производственные компании', 'Сельское хозяйство', 'Торговля'],
    documents: ['Отчет по отходам', 'Форма 2-ТП (водхоз)', 'Отчет по выбросам'],
    duration: 'от 7 рабочих дней',
    icon: '🌿',
  },
  {
    id: 'documentation',
    title: 'Разработка экологической документации',
    description: 'Создаем документы для управления отходами, выбросами и природопользованием.',
    details:
      'Готовим регламенты, карты опасных отходов, инструкции и записки для экспертной оценки.',
    highlights: ['Полный пакет документов', 'Актуальные стандарты', 'Проектная поддержка'],
    target: ['Производство', 'Складские комплексы', 'Пищевое производство'],
    documents: ['Паспорт отходов', 'План мероприятий', 'Экологический паспорт'],
    duration: 'от 10 рабочих дней',
    icon: '📄',
  },
  {
    id: 'control',
    title: 'Производственный экологический контроль',
    description: 'Проверка соблюдения экологических норм на предприятии.',
    details:
      'Инспекция объектов, оценка рисков, рекомендации по улучшению и устранению нарушений.',
    highlights: ['Проверка на объекте', 'Отчет с выводами', 'План корректировок'],
    target: ['Заводы', 'Энергетика', 'Складские площадки'],
    documents: ['Акт контроля', 'Отчет ЦОК', 'Рекомендации'],
    duration: 'от 5 рабочих дней',
    icon: '🔎',
  },
  {
    id: 'audit',
    title: 'Экологический аудит',
    description: 'Глубокая оценка состояния экологии и соблюдения нормативов.',
    details:
      'Проверка процессов деятельности, анализ документации и разработка плана по снижению рисков.',
    highlights: ['Полный аудит', 'Аналитический отчёт', 'Дорожная карта'],
    target: ['Промышленные предприятия', 'Транспортные компании', 'Ритейл'],
    documents: ['Аудиторское заключение', 'Программа аудита', 'Рекомендации'],
    duration: 'от 12 рабочих дней',
    icon: '🧭',
  },
  {
    id: 'consulting',
    title: 'Консультации по экологии',
    description: 'Экспертные советы по экологии и разрешительной документации.',
    details:
      'Анализ ситуации, ответы на вопросы, подготовка рекомендаций и стратегий для команды.',
    highlights: ['Онлайн / оффлайн', 'Отчет с выводами', 'Персональные решения'],
    target: ['Стартапы', 'Малый бизнес', 'Региональные операторы'],
    documents: ['Протокол консультации', 'План действий'],
    duration: 'от 2 рабочих дней',
    icon: '💬',
  },
  {
    id: 'waste-management',
    title: 'Разработка программ управления отходами',
    description: 'Создаем программы переработки, хранения и утилизации отходов.',
    details:
      'Проектируем систему контроля, документооборот и правила работы с отходами на предприятии.',
    highlights: ['Утилизация', 'Сортировка', 'Экологический контроль'],
    target: ['Промышленные площадки', 'Торговые сети', 'ЖКХ'],
    documents: ['Программа обращения с отходами', 'Схема сортировки'],
    duration: 'от 8 рабочих дней',
    icon: '♻️',
  },
  {
    id: 'permits',
    title: 'Подготовка разрешительной документации',
    description: 'Помогаем получить разрешения для выбросов и сбросов.',
    details:
      'Сбор данных, подготовка заявок и сопровождение получения разрешений от контролирующих органов.',
    highlights: ['Все этапы оформления', 'Контроль сроков', 'Уведомление о статусе'],
    target: ['Производители', 'Строительные площадки', 'Энергетика'],
    documents: ['Заявление на разрешение', 'Технико-экономическое обоснование'],
    duration: 'от 14 рабочих дней',
    icon: '🧾',
  },
];

export const employees: Employee[] = [
  {
    id: 'emp-chief',
    name: 'Главный эколог',
    position: 'Главный эколог',
    experience: '12 лет',
    specialty: 'Стратегия экологической безопасности',
    summary:
      'Ведущий эксперт по экологическому сопровождению крупных проектов и разрешительной документации.',
    avatar: 'https://images.unsplash.com/photo-1557800636-894a64c1696f?auto=format&fit=crop&w=300&q=60',
    certificates: ['Сертификат ISO 14001', 'Лицензия эксперта'],
  },
  {
    id: 'emp-consultant',
    name: 'Эколог-консультант',
    position: 'Эколог-консультант',
    experience: '8 лет',
    specialty: 'Аудит и экологический контроль',
    summary:
      'Специалист по анализу нормативной базы и сопровождению проверок на предприятиях.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=60',
    certificates: ['Сертификат эколога', 'Диплом аудита'],
  },
  {
    id: 'emp-reporting',
    name: 'Специалист по отчетности',
    position: 'Специалист по отчетности',
    experience: '6 лет',
    specialty: 'Отчеты по выбросам и отходам',
    summary:
      'Готовит экологическую отчетность для государственных органов и внутренних процессов.',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=60',
    certificates: ['Сертификат отчетности', 'Лицензия специалиста'],
  },
  {
    id: 'emp-docs',
    name: 'Специалист по документации',
    position: 'Специалист по документации',
    experience: '7 лет',
    specialty: 'Разработка регламентов и паспортов',
    summary:
      'Составляет экологическую документацию для предприятий и инвестплощадок.',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=60',
    certificates: ['Сертификат документации', 'Диплом эксперта'],
  },
  {
    id: 'emp-manager',
    name: 'Менеджер по работе с клиентами',
    position: 'Менеджер по работе с клиентами',
    experience: '5 лет',
    specialty: 'Клиентское сопровождение и согласование',
    summary:
      'Обеспечивает коммуникацию, сроки и оперативную связь с клиентами Eco.Progress.',
    avatar: 'https://images.unsplash.com/photo-1520986606214-8b456906c813?auto=format&fit=crop&w=300&q=60',
    certificates: ['Сертификат менеджмента', 'Диплом клиента'],
  },
];

export const news: NewsItem[] = [
  {
    id: 'news-1',
    title: 'Изменения в экологическом законодательстве 2026 года',
    excerpt:
      'Новые требования к обращению с отходами и подготовке отчетности. Как подготовиться к изменениям заранее.',
    category: 'Законодательство',
    date: '15 апреля 2026',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=60',
  },
  {
    id: 'news-2',
    title: ': успешное сопровождение экологических проверок',
    excerpt:
      'Как наша компания помогает клиентам пройти проверки без нарушений и с минимальными рисками.',
    category: 'Новости компании',
    date: '2 апреля 2026',
    image: 'https://images.unsplash.com/photo-1521702818651-0b6a5c3152ec?auto=format&fit=crop&w=800&q=60',
  },
  {
    id: 'news-3',
    title: 'Обязательные документы для получения экологической лицензии',
    excerpt:
      'Полный список документов и рекомендации по подготовке пакета для получения разрешений.',
    category: 'Полезные материалы',
    date: '28 марта 2026',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=60',
  },
  {
    id: 'news-4',
    title: 'Экологическая отчетность: новые формы и сроки сдачи',
    excerpt:
      'Обзор изменений в формах отчетности и сроках их предоставления в контролирующие органы.',
    category: 'Экологическая отчетность',
    date: '20 марта 2026',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=60',
  },
  {
    id: 'news-5',
    title: 'Подготовка к плановым экологическим проверкам',
    excerpt:
      'Рекомендации по подготовке предприятия к проверкам и необходимые документы.',
    category: 'Проверки',
    date: '10 марта 2026',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=60',
  },
];

export const orders: Order[] = [
  {
    id: 'ORD-1012',
    service: 'Экологическая отчетность',
    createdAt: '12 апреля 2026',
    status: 'В работе',
    manager: 'Эколог-консультант',
    company: 'ТОО «ТехноСнаб»',
  },
  {
    id: 'ORD-1009',
    service: 'Разработка экологической документации',
    createdAt: '4 апреля 2026',
    status: 'Ожидает документы',
    manager: 'Специалист по документации',
    company: 'ТОО «ЛесПром»',
  },
  {
    id: 'ORD-1004',
    service: 'Подготовка разрешительной документации',
    createdAt: '21 марта 2026',
    status: 'Готово',
    manager: 'Главный эколог',
    company: 'ТОО «ЭкоСервис»',
  },
  {
    id: 'ORD-1001',
    service: 'Производственный экологический контроль',
    createdAt: '15 марта 2026',
    status: 'В работе',
    manager: 'Эколог-консультант',
    company: 'АО «ПромТех»',
  },
  {
    id: 'ORD-0998',
    service: 'Экологический аудит',
    createdAt: '8 марта 2026',
    status: 'Готово',
    manager: 'Главный эколог',
    company: 'ТОО «СтройИнвест»',
  },
];

export const documents: DocumentItem[] = [
  {
    id: 'DOC-01',
    name: 'Отчет по отходам.pdf',
    type: 'Отчет',
    uploadedAt: '10 апреля 2026',
    status: 'Принят',
  },
  {
    id: 'DOC-02',
    name: 'Паспорт отходов.docx',
    type: 'Документация',
    uploadedAt: '2 апреля 2026',
    status: 'На проверке',
  },
];

export const payments: PaymentItem[] = [
  {
    id: 'PAY-2201',
    invoice: 'Счет #2201',
    service: 'Экологическая отчетность',
    amount: '220 000 ₸',
    date: '11 апреля 2026',
    status: 'Оплачен',
  },
  {
    id: 'PAY-2190',
    invoice: 'Счет #2190',
    service: 'Аудит экологической безопасности',
    amount: '350 000 ₸',
    date: '27 марта 2026',
    status: 'Ожидает',
  },
];

export const tariffs: TariffItem[] = [
  {
    id: 'basic',
    name: 'Старт',
    price: '150 000 ₸',
    features: ['Базовая консультация', 'Подготовка 1 отчета', 'Сопровождение 1 проверки', 'Документация для малого бизнеса'],
  },
  {
    id: 'standard',
    name: 'Стандарт',
    price: '350 000 ₸',
    features: ['Расширенная консультация', 'Подготовка до 3 отчетов', 'Сопровождение проверок', 'Полная документация', 'Экологический аудит'],
    popular: true,
  },
  {
    id: 'premium',
    name: 'PRO',
    price: '650 000 ₸',
    features: ['Полное сопровождение', 'Неограниченные отчеты', 'Приоритетная поддержка', 'Комплексная документация', 'Ежемесячный мониторинг', 'Срочные услуги'],
  },
];

export const notifications: NotificationItem[] = [
  {
    id: 'NOT-01',
    title: 'Новый комментарий по заявке ORD-1012',
    description: 'Специалист добавил уточнение по данным для отчета.',
    date: 'Сегодня, 09:22',
  },
  {
    id: 'NOT-02',
    title: 'Статус заявки ORD-1009 изменён',
    description: 'Заявка перешла в статус «Ожидает документы».',
    date: '12 апреля 2026',
  },
  {
    id: 'NOT-03',
    title: 'Новая заявка ORD-1015',
    description: 'Поступила новая заявка на экологический аудит.',
    date: '11 апреля 2026',
  },
  {
    id: 'NOT-04',
    title: 'Отчет готов',
    description: 'Отчет по заявке ORD-1004 готов к скачиванию.',
    date: '10 апреля 2026',
  },
];

export const clientProfile: ClientProfile = {
  companyName: 'ТОО «ТехноСнаб»',
  tin: '123456789012',
  address: 'Республика Казахстан, г. Астана',
  phone: '+7 (___) ___-__-__',
  email: 'info@technosnab.kz',
  contactPerson: 'Менеджер по закупкам',
};

export const clients = [
  {
    id: 'client-01',
    name: 'ТОО «ТехноСнаб»',
    contact: 'Менеджер по закупкам',
    orders: 6,
    status: 'Активный',
  },
  {
    id: 'client-02',
    name: 'ТОО «ЛесПром»',
    contact: 'Директор',
    orders: 3,
    status: 'На сопровождении',
  },
  {
    id: 'client-03',
    name: 'АО «ПромТех»',
    contact: 'Главный инженер',
    orders: 8,
    status: 'Активный',
  },
];
