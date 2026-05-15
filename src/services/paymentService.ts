import api from './api';
import { financeContracts, financeDebts, paymentRecords, paymentTransactions } from '../data/mockData';
import type { Contract, Debt, Payment, PaymentMethod, PaymentTransaction } from '../types';

const isLocalDemo = () => localStorage.getItem('eco-progress-token')?.startsWith('local-demo-token');

export const getFinancePayments = async (): Promise<Payment[]> => {
  if (isLocalDemo()) return paymentRecords as Payment[];
  const { data } = await api.get<{ data: Payment[]; message: string | null }>('/staff/payments');
  return data.data;
};

export const getClientPayments = async (): Promise<Payment[]> => {
  if (isLocalDemo()) return paymentRecords as Payment[];
  const { data } = await api.get<{ data: Payment[]; message: string | null }>('/client/payments');
  return data.data;
};

export const getFinanceTransactions = async (): Promise<PaymentTransaction[]> => {
  if (isLocalDemo()) return paymentTransactions as PaymentTransaction[];
  const { data } = await api.get<{ data: PaymentTransaction[]; message: string | null }>('/staff/payments');
  return data.data;
};

export const getFinanceContracts = async (): Promise<Contract[]> => {
  if (isLocalDemo()) return financeContracts as Contract[];
  const { data } = await api.get<{ data: Contract[]; message: string | null }>('/staff/payments');
  return data.data;
};

export const getFinanceDebts = async (): Promise<Debt[]> => {
  if (isLocalDemo()) return financeDebts as Debt[];
  const { data } = await api.get<{ data: Debt[]; message: string | null }>('/staff/debts');
  return data.data;
};

export const getClientDebts = async (): Promise<Debt[]> => {
  if (isLocalDemo()) return financeDebts as Debt[];
  const { data } = await api.get<{ data: Debt[]; message: string | null }>('/client/debts');
  return data.data;
};

export type AddPartialPaymentPayload = {
  amount: number;
  date: string;
  method: PaymentMethod;
  comment?: string;
};

export const markFinancePaymentPaid = async (paymentId: string): Promise<Payment | undefined> => {
  const { data } = await api.post<{ data: Payment; message: string | null }>(`/staff/payments/${paymentId}/mark-paid`);
  return data.data;
};

export const addPartialFinancePayment = async (paymentId: string, payload: AddPartialPaymentPayload): Promise<Payment | undefined> => {
  const { data } = await api.post<{ data: Payment; message: string | null }>(`/staff/payments/${paymentId}/partial`, payload);
  return data.data;
};

export const updateFinancePaymentDetails = async (
  paymentId: string,
  payload: { comment?: string; lastPaymentDate?: string; paymentMethod?: PaymentMethod },
): Promise<Payment | undefined> => {
  const { data } = await api.patch<{ data: Payment; message: string | null }>(`/staff/payments/${paymentId}`, payload);
  return data.data;
};

export const addQuarterPayment = async (
  contractId: string,
  quarterItemId: string,
  payload: AddPartialPaymentPayload,
) => {
  const { data } = await api.post<{ data: Contract; message: string | null }>(
    `/staff/payments/contracts/${contractId}/quarters/${quarterItemId}/pay`,
    payload,
  );
  return data.data;
};

export const markQuarterPaid = async (contractId: string, quarterItemId: string, method: PaymentMethod = 'bank_transfer') => {
  const { data } = await api.post<{ data: Contract; message: string | null }>(
    `/staff/payments/contracts/${contractId}/quarters/${quarterItemId}/mark-paid`,
    { method },
  );
  return data.data;
};

export const updateQuarterDetails = async (
  contractId: string,
  quarterItemId: string,
  payload: { dueDate?: string; comment?: string; workStatus?: string; completedAt?: string },
) => {
  const { data } = await api.patch<{ data: Contract; message: string | null }>(
    `/staff/payments/contracts/${contractId}/quarters/${quarterItemId}`,
    payload,
  );
  return data.data;
};

export const closeDebt = async (debtId: string, comment?: string): Promise<Debt | undefined> => {
  const { data } = await api.post<{ data: Debt; message: string | null }>(`/staff/debts/${debtId}/close`, { comment });
  return data.data;
};

export const updateDebtComment = async (debtId: string, comment: string): Promise<Debt | undefined> => {
  const { data } = await api.patch<{ data: Debt; message: string | null }>(`/staff/debts/${debtId}/comment`, { comment });
  return data.data;
};
