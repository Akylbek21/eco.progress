import api from './api';
import type { ApiResponse } from './apiHelpers';
import { unwrapApiResponse } from './apiHelpers';
import { validateClientFile } from '../config/clientFiles';
import type { PaymentMethod } from '../types';

export interface PaymentReceiptPayload {
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paymentOrderNumber: string;
  comment?: string;
  file: File;
}

export const uploadClientPaymentReceipt = async (orderId: string, payload: PaymentReceiptPayload): Promise<unknown> => {
  const fileError = validateClientFile(payload.file);
  if (fileError) throw new Error(fileError);
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) throw new Error('Укажите корректную сумму платежа.');
  if (!payload.paymentDate) throw new Error('Укажите дату платежа.');
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('amount', String(payload.amount));
  formData.append('paymentDate', payload.paymentDate);
  formData.append('paymentMethod', payload.paymentMethod);
  formData.append('paymentOrderNumber', payload.paymentOrderNumber.trim());
  formData.append('comment', payload.comment?.trim() || '');
  const { data } = await api.post<ApiResponse<unknown>>(`/client/orders/${orderId}/payments/receipts`, formData);
  return unwrapApiResponse(data);
};
