import type { Contract, Debt, PaymentMethod, PaymentRecordStatus, QuarterlyContractItem, QuarterNumber, QuarterScheduleType, UserRole } from '../types';

const dayMs = 24 * 60 * 60 * 1000;

export const formatCurrency = (amount: number) =>
  `${Math.round(amount).toLocaleString('ru-RU').replace(/\u00a0/g, ' ')} ₸`;

export const calculateRemainingAmount = (totalAmount: number, paidAmount: number) =>
  Math.max(0, totalAmount - paidAmount);

export const getPaymentStatusByAmounts = (
  totalAmount: number,
  paidAmount: number,
  dueDate?: string
): PaymentRecordStatus => {
  if (paidAmount >= totalAmount) return 'paid';
  if (paidAmount > 0) {
    if (dueDate && new Date(`${dueDate}T23:59:59`).getTime() < Date.now()) return 'overdue';
    return 'partial';
  }
  if (dueDate && new Date(`${dueDate}T23:59:59`).getTime() < Date.now()) return 'overdue';
  return 'unpaid';
};

export const getPaymentStatusLabel = (status: PaymentRecordStatus) => {
  const labels: Record<PaymentRecordStatus, string> = {
    paid: 'Полностью оплачено',
    partial: 'Частично оплачено',
    unpaid: 'Не оплачено',
    overdue: 'Просрочено',
  };
  return labels[status];
};

export const getPaymentStatusColor = (status: PaymentRecordStatus) => {
  const colors: Record<PaymentRecordStatus, string> = {
    paid: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    partial: 'bg-amber-50 text-amber-800 ring-amber-100',
    unpaid: 'bg-slate-100 text-slate-700 ring-slate-200',
    overdue: 'bg-rose-50 text-rose-800 ring-rose-100',
  };
  return colors[status];
};

export const paymentMethodLabel = (method?: PaymentMethod) => {
  const labels: Record<PaymentMethod, string> = {
    bank_transfer: 'Банковский перевод',
    cash: 'Наличные',
    card: 'Карта',
    other: 'Другое',
  };
  return method ? labels[method] : 'Не указан';
};

export const canAccessPayments = (role?: UserRole) => role === 'ADMIN' || role === 'ACCOUNTANT';

export const calculateQuarterPeriod = (
  startDate: string,
  quarter: QuarterNumber,
  scheduleType: QuarterScheduleType = 'calendar_quarters',
  endDate?: string
) => {
  const start = new Date(`${startDate}T00:00:00`);
  const periodStart = scheduleType === 'contract_quarters'
    ? new Date(start.getFullYear(), start.getMonth() + (quarter - 1) * 3, start.getDate())
    : new Date(start.getFullYear(), (quarter - 1) * 3, 1);
  const naturalPeriodEnd = scheduleType === 'contract_quarters'
    ? new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, periodStart.getDate() - 1)
    : new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 0);
  const contractEnd = endDate ? new Date(`${endDate}T23:59:59`) : undefined;
  const periodEnd = contractEnd && quarter === 4 && contractEnd < naturalPeriodEnd ? contractEnd : naturalPeriodEnd;
  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  };
};

export const getOverdueDays = (dueDate?: string) => {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T23:59:59`).getTime();
  const diff = Date.now() - due;
  return diff > 0 ? Math.floor(diff / dayMs) : 0;
};

export const isQuarterOverdue = (quarterItem: QuarterlyContractItem) =>
  quarterItem.remainingAmount > 0 && getOverdueDays(quarterItem.dueDate) > 0;

export const getQuarterPaymentStatus = (totalAmount: number, paidAmount: number, dueDate?: string) =>
  getPaymentStatusByAmounts(totalAmount, paidAmount, dueDate);

export const calculateDebtForQuarter = (quarterItem: QuarterlyContractItem): Debt | undefined => {
  const remainingAmount = calculateRemainingAmount(quarterItem.plannedAmount, quarterItem.paidAmount);
  if (remainingAmount <= 0) return undefined;
  const overdueDays = getOverdueDays(quarterItem.dueDate);
  return {
    id: `DEBT-${quarterItem.id}`,
    clientCompanyId: '',
    clientCompanyName: '',
    contractId: quarterItem.contractId,
    contractNumber: '',
    requestId: quarterItem.requestId,
    quarterItemId: quarterItem.id,
    quarterLabel: quarterItem.quarterLabel,
    invoiceNumber: quarterItem.invoiceNumber,
    amount: quarterItem.plannedAmount,
    paidAmount: quarterItem.paidAmount,
    remainingAmount,
    dueDate: quarterItem.dueDate,
    overdueDays,
    status: overdueDays > 0 ? 'overdue' : quarterItem.paidAmount > 0 ? 'partial' : 'active',
    reason: overdueDays > 0 ? 'overdue_payment' : quarterItem.paidAmount > 0 ? 'partial_payment' : 'quarter_payment',
    comment: quarterItem.comment,
    createdAt: quarterItem.invoiceDate || quarterItem.periodStart,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
};

export const createQuarterlySchedule = (contract: Contract): QuarterlyContractItem[] => {
  const amount = Math.round(contract.totalAmount / 4);
  return ([1, 2, 3, 4] as QuarterNumber[]).map((quarter) => {
    const { periodStart, periodEnd } = calculateQuarterPeriod(contract.startDate, quarter, contract.quarterScheduleType || 'calendar_quarters', contract.endDate);
    const quarterLabel = `${quarter} квартал` as QuarterlyContractItem['quarterLabel'];
    return {
      id: `${contract.id}-Q${quarter}`,
      contractId: contract.id,
      requestId: contract.requestId,
      quarter,
      quarterLabel,
      periodStart,
      periodEnd,
      serviceName: contract.serviceName,
      workStage: 'Проектирование',
      plannedAmount: amount,
      invoiceNumber: `${contract.contractNumber}-Q${quarter}`,
      invoiceDate: periodStart,
      dueDate: periodStart,
      paidAmount: 0,
      remainingAmount: amount,
      paymentStatus: 'unpaid',
      workStatus: quarter === 1 ? 'waiting_payment' : 'planned',
    };
  });
};

export const getContractDebtSummary = (contract: Contract) => {
  const items = contract.quarterlySchedule || [];
  const totalDebt = items.reduce((sum, item) => sum + calculateRemainingAmount(item.plannedAmount, item.paidAmount), 0);
  const overdueDebt = items.filter(isQuarterOverdue).reduce((sum, item) => sum + calculateRemainingAmount(item.plannedAmount, item.paidAmount), 0);
  return { totalDebt, overdueDebt, hasDebt: totalDebt > 0 };
};

export const getClientDebtSummary = (clientCompanyId: string, contracts: Contract[]) => {
  const clientContracts = contracts.filter((contract) => contract.clientCompanyId === clientCompanyId);
  return clientContracts.reduce(
    (summary, contract) => {
      const debt = getContractDebtSummary(contract);
      return {
        totalDebt: summary.totalDebt + debt.totalDebt,
        overdueDebt: summary.overdueDebt + debt.overdueDebt,
      };
    },
    { totalDebt: 0, overdueDebt: 0 }
  );
};

export const isDateInPeriod = (dateValue: string, period: string, customFrom = '', customTo = '') => {
  if (period === 'all') return true;
  const date = new Date(`${dateValue}T00:00:00`);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'today') return date.getTime() === startOfDay.getTime();
  if (period === 'week') {
    const day = startOfDay.getDay() || 7;
    const start = new Date(startOfDay.getTime() - (day - 1) * dayMs);
    const end = new Date(start.getTime() + 6 * dayMs);
    return date >= start && date <= end;
  }
  if (period === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (period === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    return date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth() / 3) === quarter;
  }
  if (period === 'year') return date.getFullYear() === now.getFullYear();
  if (period === 'custom') {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : undefined;
    const to = customTo ? new Date(`${customTo}T23:59:59`) : undefined;
    return (!from || date >= from) && (!to || date <= to);
  }
  return true;
};
