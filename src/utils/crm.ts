import type { BusinessCompany, ClientContract, EcologyStatus, LaboratoryStatus, MockUser, Order, OrderStatus, OrderStatusCategory, OrderStatusDefinition, PaymentStatus } from '../types';
import { ecologyStatusLabels, laboratoryStatusLabels } from '../types/crm';

export const orderStatusDefinitions: OrderStatusDefinition[] = [
  { id: 'Консультация', label: 'Консультация', description: 'Менеджер связывается с клиентом, уточняет задачу и первичные данные.', order: 1, category: 'client', clientVisibleLabel: 'Консультация', employeeActionLabel: 'Провести консультацию' },
  { id: 'Анализ', label: 'Анализ', description: 'Специалист анализирует услугу, объект, исходные документы, сроки и риски.', order: 2, category: 'client', clientVisibleLabel: 'Анализ заявки', employeeActionLabel: 'Выполнить анализ' },
  { id: 'КП', label: 'КП', description: 'Команда готовит коммерческое предложение с составом работ, сроками и стоимостью.', order: 3, category: 'commercial', clientVisibleLabel: 'Коммерческое предложение', employeeActionLabel: 'Подготовить КП' },
  { id: 'Договор', label: 'Договор', description: 'Договор согласован или отправлен клиенту на подписание.', order: 4, category: 'legal', clientVisibleLabel: 'Договор', employeeActionLabel: 'Подготовить договор' },
  { id: 'Счет на оплату', label: 'Счет на оплату', description: 'Счет выставлен, заявка ожидает оплату или проверку оплаты.', order: 5, category: 'finance', clientVisibleLabel: 'Счет на оплату', employeeActionLabel: 'Выставить счет' },
  { id: 'annual_active', label: 'Активна по годовому договору', description: 'Заявка обслуживается по годовому договору с квартальными работами.', order: 6, category: 'work', clientVisibleLabel: 'Активна по годовому договору', employeeActionLabel: 'Вести квартальное обслуживание' },
  { id: 'Проектирование', label: 'Проектирование', description: 'Экологи выполняют проектирование, разрешительную документацию, отчеты.', order: 6, category: 'work', clientVisibleLabel: 'Выполнение работ', employeeActionLabel: 'Передать в проектирование' },
  { id: 'Лаборатория', label: 'Лаборатория', description: 'Лаборатория выполняет анализы, замеры, работу с пробами.', order: 6, category: 'work', clientVisibleLabel: 'Выполнение работ', employeeActionLabel: 'Передать в лабораторию' },
  { id: 'Вывоз', label: 'Вывоз', description: 'Команда организует вывоз или транспортировку отходов.', order: 6, category: 'work', clientVisibleLabel: 'Выполнение работ', employeeActionLabel: 'Организовать вывоз' },
  { id: 'Утилизация', label: 'Утилизация', description: 'Команда выполняет утилизацию, размещение, переработку.', order: 6, category: 'work', clientVisibleLabel: 'Выполнение работ', employeeActionLabel: 'Передать на утилизацию' },
  { id: 'Проверка результата', label: 'Проверка результата', description: 'Готовые материалы проходят внутреннюю проверку.', order: 7, category: 'quality', clientVisibleLabel: 'Проверка результата', employeeActionLabel: 'Проверить результат' },
  { id: 'Готово', label: 'Готово', description: 'Результат готов и доступен клиенту.', order: 8, category: 'done', clientVisibleLabel: 'Готово', employeeActionLabel: 'Передать клиенту' },
  { id: 'Завершено', label: 'Завершено', description: 'Заявка полностью закрыта.', order: 9, category: 'done', clientVisibleLabel: 'Завершено', employeeActionLabel: 'Завершить заявку' },
  { id: 'Отменено', label: 'Отменено', description: 'Заявка отменена.', order: 99, category: 'cancelled', clientVisibleLabel: 'Отменено', employeeActionLabel: 'Вернуть в работу' },
];

export const statusDescriptions: Record<OrderStatus, string> = Object.fromEntries(
  orderStatusDefinitions.map((s) => [s.id, s.description])
) as Record<OrderStatus, string>;

export const businessCompanies: BusinessCompany[] = [
  { id: 'eco-docs', name: 'ECOPROGRESS Documents', shortName: 'Documents', description: 'Экологическое проектирование, разрешительная документация, отчетность и сопровождение предприятий.', serviceCategories: ['Проектирование', 'Разрешения', 'Предприятия'] },
  { id: 'eco-lab', name: 'ECOPROGRESS Laboratory', shortName: 'Laboratory', description: 'Лабораторные исследования, замеры, протоколы и работа с образцами.', serviceCategories: ['Лаборатория'] },
  { id: 'eco-waste', name: 'ECOPROGRESS Waste', shortName: 'Waste', description: 'Вывоз, транспортировка, утилизация и размещение отходов.', serviceCategories: ['Отходы'] },
];

export const getBusinessCompanyById = (id?: string): BusinessCompany =>
  businessCompanies.find((c) => c.id === id) || businessCompanies[0];

export const getBusinessCompanyByServiceId = (serviceId?: string): BusinessCompany => {
  if (!serviceId) return businessCompanies[0];
  if (/lab|лаборатор/i.test(serviceId)) return businessCompanies.find((c) => c.id === 'eco-lab') || businessCompanies[0];
  if (/waste|транспорт|вывоз|утилиз|полигон/i.test(serviceId)) return businessCompanies.find((c) => c.id === 'eco-waste') || businessCompanies[0];
  return businessCompanies[0];
};

export const orderStatuses: OrderStatus[] = orderStatusDefinitions.map((status) => status.id);

export const workOrderStatuses: OrderStatus[] = ['Проектирование', 'Лаборатория', 'Вывоз', 'Утилизация'];

export const paymentStatuses: PaymentStatus[] = ['not_sent', 'pending', 'partial', 'paid'];

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  not_sent: 'Не оплачено',
  pending: 'Ожидает оплаты',
  partial: 'Частично оплачено',
  paid: 'Оплачено',
};

export const fallbackPaymentStatus = (status?: PaymentStatus): PaymentStatus => status || 'not_sent';

type CompanyField = 'organization' | 'company' | 'clientCompany' | 'customerCompany' | 'legalName';

export const getOrderCompanyName = (order: Order) => {
  const extraFields = order as Order & Partial<Record<CompanyField, string>>;
  const company = [
    order.companyName,
    extraFields.organization,
    extraFields.company,
    extraFields.clientCompany,
    extraFields.customerCompany,
    extraFields.legalName,
  ].find((value) => value && value.trim().length > 0);

  if (company) return company.trim();
  if (order.clientType === 'individual') return 'Физические лица';
  return order.clientName || 'Компания не указана';
};

export const companyKey = (name: string) => name.trim().toLowerCase();

export const getOrderBusinessCompany = (order: Order) =>
  order.businessCompanyId ? getBusinessCompanyById(order.businessCompanyId) : getBusinessCompanyByServiceId(order.serviceId);

export const getOrderBusinessCompanyName = (order: Order) =>
  order.businessCompanyName || getOrderBusinessCompany(order).name;

export const getOrderStatusDefinition = (status: OrderStatus): OrderStatusDefinition =>
  orderStatusDefinitions.find((item) => item.id === status) || orderStatusDefinitions[0];

export const getOrderStatusOrder = (status: OrderStatus) => getOrderStatusDefinition(status).order;

export const getWorkStageByService = (service: { service?: string; serviceId?: string; businessCompanyId?: string }): OrderStatus => {
  const source = `${service.serviceId || ''} ${service.service || ''} ${service.businessCompanyId || ''}`.toLowerCase();

  if (/лаборатор|анализ|исслед|lab/.test(source)) return 'Лаборатория';
  if (/транспорт|вывоз|transport/.test(source)) return 'Вывоз';
  if (/эколог|проект|документ|разреш|отчет|отч[её]т|овос|пдв|ндв|пноолр|роос|пдс|сзз|пэк|ппм|permit|design/.test(source)) return 'Проектирование';
  if (/утилиз|переработ|полигон|размещ|захорон|waste|recycl|landfill|poligon/.test(source)) return 'Утилизация';

  return 'Проектирование';
};

export const getWorkStageLabel = getWorkStageByService;

export const getOrderWorkStageLabel = (order: Order) => getWorkStageLabel(order);

export const isWorkOrderStatus = (status: OrderStatus) => workOrderStatuses.includes(status);

export const getWorkflowForOrder = (order: Order): OrderStatus[] => [
  'Консультация',
  'Анализ',
  'КП',
  'Договор',
  'Счет на оплату',
  ...(order.contractType === 'annual_quarterly' ? ['annual_active' as OrderStatus] : [getOrderWorkStageLabel(order)]),
  'Проверка результата',
  'Готово',
  'Завершено',
];

export const normalizeOrderStatus = (status: string | undefined, order: Pick<Order, 'service' | 'serviceId' | 'businessCompanyId'>): OrderStatus => {
  if (orderStatuses.includes(status as OrderStatus)) return status as OrderStatus;
  if (status === 'Активна по годовому договору') return 'annual_active';

  if (status === 'Новая') return 'Консультация';
  if (status === 'В обработке' || status === 'Ожидает документы') return 'Анализ';
  if (status === 'В работе') return getWorkStageByService(order);
  if (status === 'На проверке') return 'Проверка результата';
  if (status === 'Готово') return 'Готово';
  if (status === 'Завершено') return 'Завершено';
  if (status === 'Отменено') return 'Отменено';

  return 'Консультация';
};

export const getNextOrderStatus = (order: Order): OrderStatus | undefined => {
  if (order.status === 'Отменено' || order.status === 'Завершено') return undefined;
  if (order.contractType === 'annual_quarterly' && order.status === 'annual_active') return undefined;
  if (order.status === 'Счет на оплату' && fallbackPaymentStatus(order.paymentStatus) !== 'paid') return undefined;

  const workflow = getWorkflowForOrder(order);
  const currentIndex = workflow.indexOf(order.status);
  if (currentIndex < 0) return 'Консультация';
  return workflow[currentIndex + 1];
};

const dayMs = 24 * 60 * 60 * 1000;

export const getContractDaysLeft = (contract: Pick<ClientContract, 'endsAt'>) => {
  const today = new Date();
  const end = new Date(`${contract.endsAt}T23:59:59`);
  return Math.ceil((end.getTime() - today.getTime()) / dayMs);
};

export const getContractProgress = (contract: Pick<ClientContract, 'startedAt' | 'endsAt'>) => {
  const start = new Date(`${contract.startedAt}T00:00:00`).getTime();
  const end = new Date(`${contract.endsAt}T23:59:59`).getTime();
  const today = new Date().getTime();
  if (end <= start) return 100;
  return Math.min(100, Math.max(0, Math.round(((today - start) / (end - start)) * 100)));
};

export const getContractDisplayStatus = (contract: Pick<ClientContract, 'status' | 'endsAt'>) => {
  const daysLeft = getContractDaysLeft(contract);
  if (daysLeft < 0 || contract.status === 'expired') return 'Истек';
  if (daysLeft <= 90 || contract.status === 'expiring') return 'Скоро истекает';
  if (contract.status === 'draft') return 'Черновик';
  return 'Активен';
};

export const contractStatusClass = (contract: Pick<ClientContract, 'status' | 'endsAt'>) => {
  const daysLeft = getContractDaysLeft(contract);
  if (daysLeft < 0 || contract.status === 'expired') return 'bg-rose-50 text-rose-800 ring-rose-100';
  if (daysLeft <= 90 || contract.status === 'expiring') return 'bg-amber-50 text-amber-800 ring-amber-100';
  return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
};

export const formatIsoDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

export const formatContractDaysLeft = (contract: Pick<ClientContract, 'endsAt'>) => {
  const daysLeft = getContractDaysLeft(contract);
  if (daysLeft < 0) return `Истек ${Math.abs(daysLeft)} дн. назад`;
  if (daysLeft === 0) return 'Истекает сегодня';
  return `Осталось ${daysLeft} дн.`;
};

export const getContractsForClient = (user?: MockUser | null, contracts: ClientContract[] = []) => {
  if (!user) return [];
  return contracts.filter((contract) =>
    contract.clientId === user.id ||
    (user.companyName && contract.companyName === user.companyName)
  );
};

export const getContractsForOrder = (order: Order, contracts: ClientContract[] = []) =>
  contracts.filter((contract) =>
    (contract.clientId === order.clientId || contract.companyName === getOrderCompanyName(order)) &&
    contract.businessCompanyId === getOrderBusinessCompany(order).id
  );

export const getPrimaryContractForOrder = (order: Order, contracts: ClientContract[] = []) =>
  getContractsForOrder(order, contracts).sort((a, b) => getContractDaysLeft(a) - getContractDaysLeft(b))[0];

export const isCompletedOrder = (order: Order) => ['Готово', 'Завершено'].includes(order.status);

export const isWaitingOrder = (order: Order) =>
  order.status === 'Счет на оплату' || order.contractStatus === 'sent' || fallbackPaymentStatus(order.paymentStatus) === 'pending';

export const isActiveOrder = (order: Order) => !['Готово', 'Завершено', 'Отменено'].includes(order.status);

export const getNextCrmStep = (order: Order) => {
  const paymentStatus = fallbackPaymentStatus(order.paymentStatus);
  if (order.status === 'Отменено') return 'Заявка отменена';
  if (order.status === 'Завершено') return 'Заявка завершена';
  if (order.status === 'annual_active') return 'Вести квартальное обслуживание по годовому договору';
  if (order.status === 'Счет на оплату') {
    if (paymentStatus === 'paid') return `Передать на этап: ${getOrderWorkStageLabel(order)}`;
    if (paymentStatus === 'partial') return 'Проверить остаток оплаты';
    return 'Ожидать оплату счета';
  }
  if (order.status === 'Готово') return 'Завершить заявку';

  const nextStatus = getNextOrderStatus(order);
  if (nextStatus) return `Перейти к этапу: ${nextStatus}`;

  return getOrderStatusDefinition(order.status).employeeActionLabel;
};

export const ecologyStatusClass = (status?: EcologyStatus) => {
  if (status === 'done') return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (status === 'in_progress') return 'bg-eco-50 text-eco-800 ring-eco-100';
  if (status === 'waiting_client_data') return 'bg-amber-50 text-amber-800 ring-amber-100';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

export const laboratoryStatusClass = (status?: LaboratoryStatus) => {
  if (status === 'result_ready') return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (status === 'analysis_in_progress') return 'bg-eco-50 text-eco-800 ring-eco-100';
  if (status === 'waiting_samples') return 'bg-amber-50 text-amber-800 ring-amber-100';
  if (status === 'samples_received') return 'bg-indigo-50 text-indigo-800 ring-indigo-100';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

export const ecologyLabel = (status?: EcologyStatus) => ecologyStatusLabels[status || 'not_started'];

export const laboratoryLabel = (status?: LaboratoryStatus) => laboratoryStatusLabels[status || 'not_assigned'];

export const statusClass = (status: string) => {
  if (status === 'Консультация' || status === 'Анализ') return 'bg-sky-50 text-sky-800 ring-sky-100';
  if (status === 'КП' || status === 'Договор') return 'bg-indigo-50 text-indigo-800 ring-indigo-100';
  if (status === 'Счет на оплату') return 'bg-amber-50 text-amber-800 ring-amber-100';
  if (status === 'annual_active') return 'bg-cyan-50 text-cyan-800 ring-cyan-100';
  if (status === 'Проектирование' || status === 'Лаборатория' || status === 'Вывоз' || status === 'Утилизация') return 'bg-eco-50 text-eco-800 ring-eco-100';
  if (status === 'Проверка результата') return 'bg-violet-50 text-violet-800 ring-violet-100';
  if (status === 'Готово' || status === 'Завершено') return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (status === 'Отменено') return 'bg-rose-50 text-rose-800 ring-rose-100';
  return 'bg-eco-50 text-eco-800 ring-eco-100';
};

export const paymentStatusClass = (status?: PaymentStatus) => {
  const paymentStatus = fallbackPaymentStatus(status);
  if (paymentStatus === 'paid') return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (paymentStatus === 'partial') return 'bg-indigo-50 text-indigo-800 ring-indigo-100';
  if (paymentStatus === 'pending') return 'bg-amber-50 text-amber-800 ring-amber-100';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

export type CompanySummary = {
  key: string;
  name: string;
  total: number;
  active: number;
  waiting: number;
  completed: number;
  paid: number;
  pendingPayment: number;
  partialPayment: number;
  amount?: string;
};

export type BusinessCompanySummary = CompanySummary & {
  id: string;
  description: string;
};

export const buildCompanySummaries = (orders: Order[]): CompanySummary[] => {
  const map = new Map<string, CompanySummary>();

  orders.forEach((order) => {
    const name = getOrderCompanyName(order);
    const key = companyKey(name);
    const current = map.get(key) ?? {
      key,
      name,
      total: 0,
      active: 0,
      waiting: 0,
      completed: 0,
      paid: 0,
      pendingPayment: 0,
      partialPayment: 0,
    };
    const paymentStatus = fallbackPaymentStatus(order.paymentStatus);

    current.total += 1;
    current.active += isActiveOrder(order) ? 1 : 0;
    current.waiting += isWaitingOrder(order) ? 1 : 0;
    current.completed += isCompletedOrder(order) ? 1 : 0;
    current.paid += paymentStatus === 'paid' ? 1 : 0;
    current.pendingPayment += paymentStatus === 'pending' ? 1 : 0;
    current.partialPayment += paymentStatus === 'partial' ? 1 : 0;
    current.amount = current.amount || order.paymentAmount;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
};

export const buildBusinessCompanySummaries = (orders: Order[]): BusinessCompanySummary[] => {
  const map = new Map<string, BusinessCompanySummary>();

  businessCompanies.forEach((company) => {
    map.set(company.id, {
      id: company.id,
      key: company.id,
      name: company.name,
      description: company.description,
      total: 0,
      active: 0,
      waiting: 0,
      completed: 0,
      paid: 0,
      pendingPayment: 0,
      partialPayment: 0,
    });
  });

  orders.forEach((order) => {
    const company = getOrderBusinessCompany(order);
    const current = map.get(company.id) ?? {
      id: company.id,
      key: company.id,
      name: company.name,
      description: company.description,
      total: 0,
      active: 0,
      waiting: 0,
      completed: 0,
      paid: 0,
      pendingPayment: 0,
      partialPayment: 0,
    };
    const paymentStatus = fallbackPaymentStatus(order.paymentStatus);

    current.total += 1;
    current.active += isActiveOrder(order) ? 1 : 0;
    current.waiting += isWaitingOrder(order) ? 1 : 0;
    current.completed += isCompletedOrder(order) ? 1 : 0;
    current.paid += paymentStatus === 'paid' ? 1 : 0;
    current.pendingPayment += paymentStatus === 'pending' ? 1 : 0;
    current.partialPayment += paymentStatus === 'partial' ? 1 : 0;
    current.amount = current.amount || order.paymentAmount;
    map.set(company.id, current);
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
};
