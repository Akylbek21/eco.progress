import api from './api';
import type { Contract, Debt, Payment, PaymentMethod, PaymentTransaction } from '../types';

export const getFinancePayments = async (): Promise<Payment[]> => {
  const { data } = await api.get<{ data: Payment[]; message: string | null }>('/staff/payments');
  return data.data;
};

export const getClientPayments = async (): Promise<Payment[]> => {
  const { data } = await api.get<{ data: Payment[]; message: string | null }>('/client/payments');
  return data.data;
};

export const getFinanceTransactions = async (): Promise<PaymentTransaction[]> => {
  const { data } = await api.get<{ data: PaymentTransaction[]; message: string | null }>('/staff/payment-transactions');
  return data.data;
};

export const getFinanceContracts = async (): Promise<Contract[]> => {
  const { data } = await api.get<{ data: Contract[]; message: string | null }>('/staff/contracts');
  return data.data;
};

export const getClientContracts = async (): Promise<Contract[]> => {
  const { data } = await api.get<{ data: Contract[]; message: string | null }>('/client/contracts');
  return data.data;
};

export const getFinanceDebts = async (): Promise<Debt[]> => {
  const { data } = await api.get<{ data: Debt[]; message: string | null }>('/staff/debts');
  return data.data;
};

export const getClientDebts = async (): Promise<Debt[]> => {
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
  orderId: string,
  quarterItemId: string,
  payload: AddPartialPaymentPayload,
) => {
  const { data } = await api.post<{ data: Contract; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterItemId}/payments`,
    { amount: payload.amount, method: payload.method, comment: payload.comment },
  );
  return data.data;
};

export const markQuarterPaid = async (orderId: string, quarterItemId: string, amount: number, method: PaymentMethod = 'bank_transfer') => {
  const { data } = await api.post<{ data: Contract; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterItemId}/payments`,
    { amount, method },
  );
  return data.data;
};

export const updateQuarterDetails = async (
  orderId: string,
  quarterItemId: string,
  payload: { dueDate?: string; comment?: string; workStatus?: string; completedAt?: string },
) => {
  const { data } = await api.patch<{ data: Contract; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterItemId}/work-status`,
    {
      workStatus: payload.workStatus,
      comment: payload.comment,
      dueDate: payload.dueDate,
      completedAt: payload.completedAt,
    },
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
