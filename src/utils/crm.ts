import type { EcologyStatus, LaboratoryStatus, Order, OrderStatus, PaymentStatus } from '../data/mockData';
import { ecologyStatusLabels, laboratoryStatusLabels } from '../types/crm';

export const orderStatuses: OrderStatus[] = ['Новая', 'В обработке', 'Ожидает документы', 'В работе', 'На проверке', 'Готово', 'Завершено', 'Отменено'];

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

export const isCompletedOrder = (order: Order) => ['Готово', 'Завершено'].includes(order.status);

export const isWaitingOrder = (order: Order) =>
  order.status === 'Ожидает документы' || order.contractStatus === 'sent' || fallbackPaymentStatus(order.paymentStatus) === 'pending';

export const isActiveOrder = (order: Order) => !['Готово', 'Завершено', 'Отменено'].includes(order.status);

export const getNextCrmStep = (order: Order) => {
  const paymentStatus = fallbackPaymentStatus(order.paymentStatus);
  if (order.status === 'Новая') return 'Проверить заявку';
  if (!order.contractStatus || order.contractStatus === 'not_sent') return 'Выставить счет';
  if (paymentStatus === 'not_sent') return 'Проверить оплату';
  if (paymentStatus === 'pending') return 'Ждем оплату';
  if (paymentStatus === 'partial') return 'Проверить остаток';
  if (order.ecologyStatus === 'waiting_client_data') return 'Запросить данные';
  if (order.ecologyStatus === 'in_progress') return 'Завершить заключение';
  if (order.laboratoryStatus === 'waiting_samples') return 'Ждем образцы';
  if (order.laboratoryStatus === 'analysis_in_progress') return 'Загрузить результат';
  if (order.laboratoryStatus === 'samples_received') return 'Начать анализ';
  if (order.contractStatus === 'signed' && paymentStatus === 'paid' && order.status !== 'В работе') return 'Передать в работу';
  if (order.status === 'Готово') return 'Закрыть заявку';
  if (paymentStatus === 'paid' && (order.ecologyStatus === 'done' || order.ecologyStatus === 'not_started') && (order.laboratoryStatus === 'result_ready' || order.laboratoryStatus === 'not_assigned')) return 'Закрыть заявку';
  return 'Вести заявку';
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
  if (status === 'Новая') return 'bg-sky-50 text-sky-800 ring-sky-100';
  if (status === 'Ожидает документы') return 'bg-amber-50 text-amber-800 ring-amber-100';
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
