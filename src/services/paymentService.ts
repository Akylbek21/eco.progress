import {
  paymentRecords,
  type Contract,
  type Debt,
  type Payment,
  type PaymentMethod,
  type PaymentRecordStatus,
  type PaymentTransaction,
  type QuarterlyContractItem,
  type QuarterWorkStatus,
} from '../data/mockData';
import { syncAnnualQuarterFromFinance, updatePaymentStatus } from './orderService';
import {
  applyQuarterPaymentSync,
  normalizeFinanceContract as normalizeContract,
  normalizeFinanceQuarter as normalizeQuarter,
  refreshFinanceDebtsFromContractsSync,
  readFinanceContractsSync as readContractsSync,
  readFinanceDebtsSync as readDebtsSync,
  readFinanceTransactionsSync as readTransactionsSync,
  stampFinanceDate as stampDate,
  writeFinanceContractsSync as writeContractsSync,
  writeFinanceDebtsSync as writeDebtsSync,
  writeFinanceTransactionsSync as writeTransactionsSync,
} from './financeStore';
import { calculateRemainingAmount, formatCurrency, getPaymentStatusByAmounts } from '../utils/payments';

const PAYMENTS_KEY = 'eco-progress-finance-payments';
const delay = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePayment = (payment: Payment): Payment => {
  const paidAmount = Math.min(payment.paidAmount || 0, payment.totalAmount);
  const remainingAmount = calculateRemainingAmount(payment.totalAmount, paidAmount);
  return {
    ...payment,
    paidAmount,
    remainingAmount,
    paymentStatus: getPaymentStatusByAmounts(payment.totalAmount, paidAmount, payment.dueDate),
  };
};

const readPaymentsSync = () => {
  const raw = localStorage.getItem(PAYMENTS_KEY);
  if (!raw) {
    const initial = paymentRecords.map(normalizePayment);
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = (JSON.parse(raw) as Payment[]).map(normalizePayment);
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    const initial = paymentRecords.map(normalizePayment);
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(initial));
    return initial;
  }
};

const writePaymentsSync = (items: Payment[]) => {
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(items.map(normalizePayment)));
};

const syncOrderPayment = async (payment: Payment) => {
  const orderStatus = payment.paymentStatus === 'paid' ? 'paid' : payment.paymentStatus === 'partial' || payment.paymentStatus === 'overdue' ? 'partial' : 'pending';
  await updatePaymentStatus(payment.requestId, orderStatus, {
    amount: formatCurrency(payment.totalAmount),
    paidAt: payment.lastPaymentDate,
    comment: payment.comment,
    method: payment.paymentMethod,
    invoiceNumber: payment.invoiceNumber,
  });
};

const getContractIdForPayment = (payment: Payment) =>
  readContractsSync().find((contract) => contract.requestId === payment.requestId)?.id || payment.contractNumber || payment.requestId;

export const getFinancePayments = async () => {
  await delay();
  return readPaymentsSync();
};

export const getFinanceTransactions = async () => {
  await delay();
  return readTransactionsSync();
};

export const getFinanceContracts = async () => {
  await delay();
  return readContractsSync();
};

export const getFinanceDebts = async () => {
  await delay();
  return readDebtsSync();
};

export const markFinancePaymentPaid = async (paymentId: string) => {
  await delay();
  const paidAt = stampDate();
  let updatedPayment: Payment | undefined;
  let transactionAmount = 0;
  const items = readPaymentsSync().map((payment) => {
    if (payment.id !== paymentId) return payment;
    transactionAmount = calculateRemainingAmount(payment.totalAmount, payment.paidAmount);
    updatedPayment = normalizePayment({
      ...payment,
      paidAmount: payment.totalAmount,
      remainingAmount: 0,
      paymentStatus: 'paid',
      lastPaymentDate: paidAt,
      updatedAt: paidAt,
    });
    return updatedPayment;
  });

  writePaymentsSync(items);
  if (updatedPayment) {
    const transaction: PaymentTransaction = {
      id: `TRX-${Date.now()}`,
      paymentId,
      contractId: getContractIdForPayment(updatedPayment),
      amount: transactionAmount || updatedPayment.totalAmount,
      date: paidAt,
      method: updatedPayment.paymentMethod || 'bank_transfer',
      comment: 'Отмечено как полностью оплачено',
      createdBy: 'Бухгалтер ECOPROGRESS GROUP',
      createdAt: paidAt,
    };
    writeTransactionsSync([transaction, ...readTransactionsSync()]);
    await syncOrderPayment(updatedPayment);
  }
  return updatedPayment;
};

export type AddPartialPaymentPayload = {
  amount: number;
  date: string;
  method: PaymentMethod;
  comment?: string;
};

export const addPartialFinancePayment = async (paymentId: string, payload: AddPartialPaymentPayload) => {
  await delay();
  let updatedPayment: Payment | undefined;
  const transaction: PaymentTransaction = {
    id: `TRX-${Date.now()}`,
    paymentId,
    contractId: '',
    amount: payload.amount,
    date: payload.date,
    method: payload.method,
    comment: payload.comment,
    createdBy: 'Бухгалтер ECOPROGRESS GROUP',
    createdAt: stampDate(),
  };

  const items = readPaymentsSync().map((payment) => {
    if (payment.id !== paymentId) return payment;
    transaction.contractId = getContractIdForPayment(payment);
    const paidAmount = Math.min(payment.totalAmount, payment.paidAmount + payload.amount);
    const remainingAmount = calculateRemainingAmount(payment.totalAmount, paidAmount);
    const paymentStatus: PaymentRecordStatus = getPaymentStatusByAmounts(payment.totalAmount, paidAmount, payment.dueDate);
    updatedPayment = normalizePayment({
      ...payment,
      paidAmount,
      remainingAmount,
      paymentStatus,
      lastPaymentDate: payload.date,
      paymentMethod: payload.method,
      comment: payload.comment || payment.comment,
      updatedAt: stampDate(),
    });
    return updatedPayment;
  });

  writePaymentsSync(items);
  writeTransactionsSync([transaction, ...readTransactionsSync()]);
  if (updatedPayment) await syncOrderPayment(updatedPayment);
  return updatedPayment;
};

export const updateFinancePaymentDetails = async (
  paymentId: string,
  payload: { comment?: string; lastPaymentDate?: string; paymentMethod?: PaymentMethod }
) => {
  await delay();
  let updatedPayment: Payment | undefined;
  const items = readPaymentsSync().map((payment) => {
    if (payment.id !== paymentId) return payment;
    updatedPayment = normalizePayment({
      ...payment,
      comment: payload.comment ?? payment.comment,
      lastPaymentDate: payload.lastPaymentDate || payment.lastPaymentDate,
      paymentMethod: payload.paymentMethod || payment.paymentMethod,
      updatedAt: stampDate(),
    });
    return updatedPayment;
  });

  writePaymentsSync(items);
  if (updatedPayment) await syncOrderPayment(updatedPayment);
  return updatedPayment;
};

export const addQuarterPayment = async (
  contractId: string,
  quarterItemId: string,
  payload: AddPartialPaymentPayload,
  createdBy = 'ECOPROGRESS GROUP accountant'
) => {
  await delay();
  const { updatedContract, updatedQuarter } = applyQuarterPaymentSync(contractId, quarterItemId, payload, createdBy);
  if (updatedQuarter) {
    await syncAnnualQuarterFromFinance(contractId, updatedQuarter);
  }
  return updatedContract;
};

export const markQuarterPaid = async (contractId: string, quarterItemId: string, method: PaymentMethod = 'bank_transfer') => {
  const contract = readContractsSync().find((item) => item.id === contractId);
  const quarter = contract?.quarterlySchedule?.find((item) => item.id === quarterItemId);
  if (!quarter) return undefined;
  const amount = calculateRemainingAmount(quarter.plannedAmount, quarter.paidAmount);
  return addQuarterPayment(contractId, quarterItemId, {
    amount,
    date: stampDate(),
    method,
    comment: 'Квартал отмечен как полностью оплаченный',
  });
};

export const updateQuarterDetails = async (
  contractId: string,
  quarterItemId: string,
  payload: { dueDate?: string; comment?: string; workStatus?: QuarterWorkStatus; completedAt?: string }
) => {
  await delay();
  let updatedContract: Contract | undefined;
  const contracts = readContractsSync().map((contract) => {
    if (contract.id !== contractId) return contract;
    const quarterlySchedule = (contract.quarterlySchedule || []).map((quarter) =>
      quarter.id === quarterItemId
        ? normalizeQuarter({
            ...quarter,
            dueDate: payload.dueDate || quarter.dueDate,
            comment: payload.comment ?? quarter.comment,
            workStatus: payload.workStatus || quarter.workStatus,
            completedAt: payload.completedAt || quarter.completedAt,
          })
        : quarter
    );
    updatedContract = normalizeContract({ ...contract, quarterlySchedule, updatedAt: stampDate() });
    return updatedContract;
  });
  writeContractsSync(contracts);
  if (updatedContract) {
    const quarter = updatedContract.quarterlySchedule?.find((item) => item.id === quarterItemId);
    if (quarter) await syncAnnualQuarterFromFinance(contractId, quarter);
  }
  refreshFinanceDebtsFromContractsSync();
  return updatedContract;
};

export const closeDebt = async (debtId: string, comment?: string) => {
  await delay();
  const currentDebt = readDebtsSync().find((debt) => debt.id === debtId);
  if (currentDebt?.contractId && currentDebt.quarterItemId && currentDebt.remainingAmount > 0) {
    await markQuarterPaid(currentDebt.contractId, currentDebt.quarterItemId, 'bank_transfer');
    const closedDebt: Debt = {
      ...currentDebt,
      paidAmount: currentDebt.amount,
      remainingAmount: 0,
      status: 'closed',
      comment: comment || currentDebt.comment,
      updatedAt: stampDate(),
    };
    writeDebtsSync([closedDebt, ...readDebtsSync().filter((debt) => debt.id !== debtId)]);
    return closedDebt;
  }

  const debts = readDebtsSync().map((debt) =>
    debt.id === debtId
      ? { ...debt, status: 'closed' as const, remainingAmount: 0, comment: comment || debt.comment, updatedAt: stampDate() }
      : debt
  );
  writeDebtsSync(debts);
  return debts.find((debt) => debt.id === debtId);
};

export const updateDebtComment = async (debtId: string, comment: string) => {
  await delay();
  const debts = readDebtsSync().map((debt) =>
    debt.id === debtId ? { ...debt, comment, updatedAt: stampDate() } : debt
  );
  writeDebtsSync(debts);
  return debts.find((debt) => debt.id === debtId);
};
