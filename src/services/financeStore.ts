import {
  financeContracts,
  financeDebts,
  paymentTransactions,
  type Contract,
  type Debt,
  type PaymentMethod,
  type PaymentRecordStatus,
  type PaymentTransaction,
  type QuarterlyContractItem,
} from '../data/mockData';
import {
  calculateDebtForQuarter,
  calculateRemainingAmount,
  createQuarterlySchedule,
  getOverdueDays,
  getPaymentStatusByAmounts,
} from '../utils/payments';

const TRANSACTIONS_KEY = 'eco-progress-finance-transactions';
const CONTRACTS_KEY = 'eco-progress-finance-contracts';
const DEBTS_KEY = 'eco-progress-finance-debts';

export const stampFinanceDate = () => new Date().toISOString().slice(0, 10);

export const normalizeFinanceQuarter = (quarter: QuarterlyContractItem): QuarterlyContractItem => {
  const paidAmount = Math.min(quarter.paidAmount || 0, quarter.plannedAmount);
  const remainingAmount = calculateRemainingAmount(quarter.plannedAmount, paidAmount);
  const paymentStatus = getPaymentStatusByAmounts(quarter.plannedAmount, paidAmount, quarter.dueDate);
  return {
    ...quarter,
    paidAmount,
    remainingAmount,
    paymentStatus,
    workStatus: remainingAmount > 0 && getOverdueDays(quarter.dueDate) > 0 && quarter.workStatus !== 'completed'
      ? 'blocked_by_debt'
      : quarter.workStatus,
  };
};

export const normalizeFinanceContract = (contract: Contract): Contract => {
  if (contract.contractType === 'annual_quarterly') {
    const schedule = contract.quarterlySchedule?.length ? contract.quarterlySchedule : createQuarterlySchedule(contract);
    return {
      ...contract,
      contractType: 'annual_quarterly',
      quarterlySchedule: schedule.map(normalizeFinanceQuarter),
    };
  }
  return { ...contract, contractType: contract.contractType || 'one_time' };
};

export const readFinanceContractsSync = (): Contract[] => {
  const raw = localStorage.getItem(CONTRACTS_KEY);
  if (!raw) {
    const initial = financeContracts.map(normalizeFinanceContract);
    localStorage.setItem(CONTRACTS_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = (JSON.parse(raw) as Contract[]).map((contract) =>
      normalizeFinanceContract({ ...contract, contractType: contract.contractType || 'one_time' })
    );
    localStorage.setItem(CONTRACTS_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    const initial = financeContracts.map(normalizeFinanceContract);
    localStorage.setItem(CONTRACTS_KEY, JSON.stringify(initial));
    return initial;
  }
};

export const writeFinanceContractsSync = (items: Contract[]) => {
  localStorage.setItem(CONTRACTS_KEY, JSON.stringify(items.map(normalizeFinanceContract)));
};

export const readFinanceTransactionsSync = (): PaymentTransaction[] => {
  const raw = localStorage.getItem(TRANSACTIONS_KEY);
  if (!raw) {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(paymentTransactions));
    return paymentTransactions;
  }

  try {
    return JSON.parse(raw) as PaymentTransaction[];
  } catch {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(paymentTransactions));
    return paymentTransactions;
  }
};

export const writeFinanceTransactionsSync = (items: PaymentTransaction[]) => {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(items));
};

export const appendFinanceTransactionSync = (transaction: PaymentTransaction) => {
  writeFinanceTransactionsSync([transaction, ...readFinanceTransactionsSync()]);
};

const debtBusinessKey = (debt: Pick<Debt, 'contractId' | 'quarterItemId' | 'invoiceNumber' | 'id'>) => {
  if (debt.contractId && debt.quarterItemId) return `${debt.contractId}::quarter::${debt.quarterItemId}`;
  if (debt.contractId && debt.invoiceNumber) return `${debt.contractId}::invoice::${debt.invoiceNumber}`;
  return debt.id;
};

export const dedupeFinanceDebts = (items: Debt[]): Debt[] => {
  const result = new Map<string, Debt>();
  items.forEach((debt) => {
    const key = debtBusinessKey(debt);
    const existing = result.get(key);
    if (!existing) {
      result.set(key, debt);
      return;
    }

    if (existing.status === 'closed' && debt.status !== 'closed') {
      result.set(key, debt);
      return;
    }

    if (existing.status !== 'closed' && debt.status === 'closed') return;
    result.set(key, { ...existing, ...debt, comment: debt.comment || existing.comment });
  });
  return [...result.values()];
};

export const buildFinanceDebtsFromContracts = (contracts: Contract[]): Debt[] =>
  contracts.flatMap((contract) =>
    (contract.quarterlySchedule || []).flatMap((quarter) => {
      const debt = calculateDebtForQuarter(quarter);
      if (!debt) return [];
      return [{
        ...debt,
        id: `DEBT-${contract.id}-${quarter.id}`,
        clientCompanyId: contract.clientCompanyId,
        clientCompanyName: contract.clientCompanyName,
        contractNumber: contract.contractNumber,
        comment: quarter.comment || debt.comment,
      }];
    })
  );

export const readFinanceDebtsSync = (): Debt[] => {
  const contracts = readFinanceContractsSync();
  const generated = buildFinanceDebtsFromContracts(contracts);
  const generatedKeys = new Set(generated.map(debtBusinessKey));
  const raw = localStorage.getItem(DEBTS_KEY);

  if (!raw) {
    const initial = dedupeFinanceDebts([
      ...generated,
      ...financeDebts.filter((debt) => !generatedKeys.has(debtBusinessKey(debt))),
    ]);
    localStorage.setItem(DEBTS_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const stored = JSON.parse(raw) as Debt[];
    const storedByKey = new Map(stored.map((debt) => [debtBusinessKey(debt), debt]));
    const mergedGenerated = generated.map((debt) => {
      const storedDebt = storedByKey.get(debtBusinessKey(debt));
      return {
        ...debt,
        comment: storedDebt?.comment || debt.comment,
      };
    });
    const closedHistory = stored.filter((debt) => debt.status === 'closed' && !generatedKeys.has(debtBusinessKey(debt)));
    const manualDebts = stored.filter((debt) => debt.status !== 'closed' && !generatedKeys.has(debtBusinessKey(debt)));
    const merged = dedupeFinanceDebts([...mergedGenerated, ...closedHistory, ...manualDebts]);
    localStorage.setItem(DEBTS_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    const generatedOnly = dedupeFinanceDebts(generated);
    localStorage.setItem(DEBTS_KEY, JSON.stringify(generatedOnly));
    return generatedOnly;
  }
};

export const writeFinanceDebtsSync = (items: Debt[]) => {
  localStorage.setItem(DEBTS_KEY, JSON.stringify(dedupeFinanceDebts(items)));
};

export const refreshFinanceDebtsFromContractsSync = () => {
  const generated = buildFinanceDebtsFromContracts(readFinanceContractsSync());
  const generatedKeys = new Set(generated.map(debtBusinessKey));
  const preserved = readFinanceDebtsSync().filter((debt) => !generatedKeys.has(debtBusinessKey(debt)));
  const merged = dedupeFinanceDebts([...generated, ...preserved]);
  writeFinanceDebtsSync(merged);
  return merged;
};

export type AddQuarterPaymentPayload = {
  amount: number;
  date: string;
  method: PaymentMethod;
  comment?: string;
};

export const applyQuarterPaymentSync = (
  contractId: string,
  quarterItemId: string,
  payload: AddQuarterPaymentPayload,
  createdBy = 'ECOPROGRESS GROUP accountant'
) => {
  let updatedContract: Contract | undefined;
  let updatedQuarter: QuarterlyContractItem | undefined;

  const contracts = readFinanceContractsSync().map((contract) => {
    if (contract.id !== contractId) return contract;
    const quarterlySchedule = (contract.quarterlySchedule || []).map((quarter) => {
      if (quarter.id !== quarterItemId) return quarter;
      const paidAmount = Math.min(quarter.plannedAmount, quarter.paidAmount + payload.amount);
      updatedQuarter = normalizeFinanceQuarter({
        ...quarter,
        paidAmount,
        remainingAmount: calculateRemainingAmount(quarter.plannedAmount, paidAmount),
        paymentStatus: getPaymentStatusByAmounts(quarter.plannedAmount, paidAmount, quarter.dueDate) as PaymentRecordStatus,
        lastPaymentDate: payload.date,
        comment: payload.comment || quarter.comment,
      });
      return updatedQuarter;
    });
    updatedContract = normalizeFinanceContract({ ...contract, quarterlySchedule, updatedAt: stampFinanceDate() });
    return updatedContract;
  });

  writeFinanceContractsSync(contracts);

  if (updatedQuarter) {
    appendFinanceTransactionSync({
      id: `TRX-Q-${Date.now()}`,
      contractId,
      quarterItemId,
      amount: payload.amount,
      date: payload.date,
      method: payload.method,
      comment: payload.comment,
      createdBy,
      createdAt: stampFinanceDate(),
    });
  }

  refreshFinanceDebtsFromContractsSync();
  return { updatedContract, updatedQuarter };
};
