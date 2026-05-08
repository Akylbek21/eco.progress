import type {
  Contract,
  Order,
  PaymentRecordStatus,
  QuarterDocument,
  QuarterlyContractItem,
  QuarterNumber,
  QuarterResult,
  QuarterWorkStatus,
  RequestQuarter,
} from '../data/mockData';
import { calculateRemainingAmount, getOverdueDays } from './payments';
import { getWorkStageByService } from './crm';

const todayIso = () => new Date().toISOString().slice(0, 10);

export const getCurrentQuarterByDate = (date: Date | string = new Date()): QuarterNumber => {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  return (Math.floor(value.getMonth() / 3) + 1) as QuarterNumber;
};

export const isDateBetween = (date: Date | string, start?: string, end?: string) => {
  if (!start || !end) return false;
  const value = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  return value >= new Date(`${start}T00:00:00`) && value <= new Date(`${end}T23:59:59`);
};

export const normalizeQuarterPaymentStatus = (quarter: Pick<RequestQuarter, 'plannedAmount' | 'paidAmount' | 'dueDate'>): PaymentRecordStatus => {
  if (quarter.paidAmount >= quarter.plannedAmount) return 'paid';
  if (getOverdueDays(quarter.dueDate) > 0) return 'overdue';
  if (quarter.paidAmount > 0) return 'partial';
  return 'unpaid';
};

export const normalizeRequestQuarter = (quarter: RequestQuarter): RequestQuarter => {
  const paidAmount = Math.min(quarter.paidAmount || 0, quarter.plannedAmount);
  const remainingAmount = calculateRemainingAmount(quarter.plannedAmount, paidAmount);
  const paymentStatus = normalizeQuarterPaymentStatus({ ...quarter, paidAmount });
  const blockedByDebt = remainingAmount > 0 && paymentStatus === 'overdue' && quarter.workStatus !== 'completed';

  return {
    ...quarter,
    paidAmount,
    remainingAmount,
    paymentStatus,
    workStatus: blockedByDebt ? 'blocked_by_debt' : quarter.workStatus,
    documents: quarter.documents || [],
    results: quarter.results || [],
    comments: quarter.comments || [],
    updatedAt: quarter.updatedAt || todayIso(),
  };
};

export const requestQuarterFromContractItem = (
  contract: Contract,
  item: QuarterlyContractItem,
  existing?: Partial<RequestQuarter>
): RequestQuarter => normalizeRequestQuarter({
  id: existing?.id || `RQ-${item.id}`,
  requestId: item.requestId,
  contractId: contract.id,
  quarter: item.quarter,
  quarterLabel: item.quarterLabel,
  periodStart: item.periodStart,
  periodEnd: item.periodEnd,
  serviceName: item.serviceName,
  workStage: item.workStage,
  workStatus: (existing?.workStatus || item.workStatus || 'planned') as QuarterWorkStatus,
  paymentStatus: item.paymentStatus,
  plannedAmount: item.plannedAmount,
  paidAmount: item.paidAmount,
  remainingAmount: item.remainingAmount,
  invoiceNumber: item.invoiceNumber,
  invoiceDate: item.invoiceDate,
  dueDate: item.dueDate,
  documents: existing?.documents || [],
  results: existing?.results || [],
  comments: existing?.comments || [],
  responsibleEmployeeId: existing?.responsibleEmployeeId,
  responsibleEmployeeName: existing?.responsibleEmployeeName || contract.responsibleManager,
  startedAt: existing?.startedAt,
  completedAt: existing?.completedAt || item.completedAt,
  createdAt: existing?.createdAt || item.periodStart,
  updatedAt: existing?.updatedAt || todayIso(),
});

export const createRequestQuartersFromContract = (contract: Contract, existingQuarters: RequestQuarter[] = []) =>
  (contract.quarterlySchedule || []).map((item) =>
    requestQuarterFromContractItem(contract, item, existingQuarters.find((quarter) => quarter.quarter === item.quarter || quarter.id === item.id))
  );

export const createFallbackRequestQuarters = (order: Order): RequestQuarter[] => {
  const year = Number((order.annualPeriodStart || '2026-01-01').slice(0, 4));
  const amount = Number((order.paymentAmount || '').replace(/[^\d]/g, '')) || 0;
  const plannedAmount = amount > 0 ? Math.round(amount / 4) : 0;
  return ([1, 2, 3, 4] as QuarterNumber[]).map((quarter) => {
    const startMonth = (quarter - 1) * 3;
    const periodStart = new Date(year, startMonth, 1).toISOString().slice(0, 10);
    const periodEnd = new Date(year, startMonth + 3, 0).toISOString().slice(0, 10);
    const workStage = getWorkStageByService(order);
    return normalizeRequestQuarter({
      id: `${order.id}-Q${quarter}`,
      requestId: order.id,
      contractId: order.contractId || `${order.id}-CONTRACT`,
      quarter,
      quarterLabel: `${quarter} квартал`,
      periodStart,
      periodEnd,
      serviceName: order.service,
      workStage: workStage === 'Проектирование' || workStage === 'Лаборатория' || workStage === 'Вывоз' || workStage === 'Утилизация' ? workStage : 'Проектирование',
      workStatus: quarter === 1 ? 'waiting_payment' : 'planned',
      paymentStatus: 'unpaid',
      plannedAmount,
      paidAmount: 0,
      remainingAmount: plannedAmount,
      documents: [],
      results: [],
      comments: [],
      responsibleEmployeeName: order.manager,
      createdAt: periodStart,
      updatedAt: todayIso(),
    });
  });
};

export const isAnnualRequest = (request: Order) => request.contractType === 'annual_quarterly';

export const getCurrentQuarterForRequest = (request: Order, date: Date | string = new Date()) => {
  const quarterNumber = getCurrentQuarterByDate(date);
  return request.quarters?.find((quarter) => quarter.quarter === quarterNumber);
};

export const getAnnualRequestProgress = (request: Order) => {
  const quarters = request.quarters || [];
  const completed = quarters.filter((quarter) => quarter.workStatus === 'completed').length;
  return {
    completed,
    total: quarters.length || 4,
    percent: Math.round((completed / (quarters.length || 4)) * 100),
  };
};

export const getAnnualRequestDebtSummary = (request: Order) => {
  const quarters = request.quarters || [];
  const totalDebt = quarters.reduce((sum, quarter) => sum + Math.max(0, quarter.remainingAmount), 0);
  const overdueDebt = quarters
    .filter((quarter) => quarter.remainingAmount > 0 && getOverdueDays(quarter.dueDate) > 0)
    .reduce((sum, quarter) => sum + quarter.remainingAmount, 0);
  const nextDue = quarters
    .filter((quarter) => quarter.remainingAmount > 0 && quarter.dueDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0]?.dueDate;

  return {
    totalDebt,
    overdueDebt,
    hasDebt: totalDebt > 0,
    hasOverdueDebt: overdueDebt > 0,
    nextDue,
  };
};

export const isAnnualRequestActive = (request: Order, date: Date | string = new Date()) =>
  isAnnualRequest(request) &&
  request.status === 'annual_active' &&
  isDateBetween(date, request.annualPeriodStart, request.annualPeriodEnd) &&
  getAnnualRequestProgress(request).completed < 4;

export const canCompleteAnnualRequest = (request: Order) => {
  const quarters = request.quarters || [];
  if (quarters.length < 4) return false;
  const allWorkCompleted = quarters.every((quarter) => quarter.workStatus === 'completed');
  const allResultsUploaded = quarters.every((quarter) => quarter.results.length > 0);
  const noDebt = quarters.every((quarter) => quarter.remainingAmount <= 0);
  return allWorkCompleted && allResultsUploaded && noDebt;
};

export const getAnnualRequestWarnings = (request: Order, date: Date | string = new Date()) => {
  const warnings: string[] = [];
  const quarters = request.quarters || [];
  const currentQuarter = getCurrentQuarterForRequest(request, date);
  const previousDebt = quarters.some((quarter) => currentQuarter && quarter.quarter < currentQuarter.quarter && quarter.remainingAmount > 0);
  if (previousDebt) warnings.push('Есть долг за прошлый квартал');
  if (quarters.some((quarter) => quarter.remainingAmount > 0 && getOverdueDays(quarter.dueDate) > 0)) warnings.push('Срок оплаты истек');
  if (currentQuarter && currentQuarter.documents.filter((doc) => doc.documentType === 'client_data').length === 0 && currentQuarter.workStatus !== 'completed') warnings.push('Не загружены документы клиента');
  if (currentQuarter && currentQuarter.results.length === 0 && currentQuarter.workStatus === 'completed') warnings.push('Результат по кварталу не загружен');
  if (currentQuarter) {
    const daysToEnd = Math.ceil((new Date(`${currentQuarter.periodEnd}T23:59:59`).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysToEnd >= 0 && daysToEnd <= 14) warnings.push('Квартал скоро заканчивается');
  }
  if (canCompleteAnnualRequest(request)) warnings.push('Можно завершить годовую заявку');
  return warnings;
};

export const getQuarterResultTypeByStage = (quarter: RequestQuarter): QuarterResult['resultType'] => {
  if (quarter.workStage === 'Лаборатория') return 'laboratory_protocol';
  if (quarter.workStage === 'Вывоз') return 'waste_removal_act';
  if (quarter.workStage === 'Утилизация') return 'utilization_act';
  if (quarter.workStage === 'Проектирование') return 'project_document';
  return 'other';
};

export const getUploadedByRole = (role?: string): QuarterDocument['uploadedByRole'] => {
  if (role === 'ADMIN') return 'admin';
  if (role === 'ACCOUNTANT') return 'accountant';
  if (role === 'CLIENT') return 'client';
  if (role === 'MANAGER') return 'manager';
  return 'employee';
};
