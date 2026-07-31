import { validateClientFile } from '../config/clientFiles';
import type { PaymentMethod } from '../types';
import { uploadClientDocument } from './clientDocumentService';

export interface PaymentReceiptPayload {
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paymentOrderNumber: string;
  comment?: string;
  file: File;
}

/**
 * NOTE: there is no dedicated payment-receipt-upload endpoint on the backend, and
 * kz.eco.order.ClientOrderController has no field anywhere to store amount/paymentDate/
 * paymentMethod/paymentOrderNumber against an order - the only real primitives are the generic
 * document upload (POST .../documents, which does have a PAYMENT_RECEIPT category) and the
 * order-level pay action (POST .../pay, which only accepts a bare paymentMethod, no amount/date/
 * receipt number, and marks the order paid immediately with no review step).
 *
 * This fix gets the receipt FILE itself safely stored and attached to the order (replacing what
 * was previously a guaranteed 404), folding the structured fields into the document's comment as
 * best-effort text since there is nowhere else to put them. It deliberately does NOT also call
 * /pay automatically - auto-marking an order paid the moment a client attaches a file, with no
 * staff verification of the receipt, is a business-logic decision this fix should not make
 * unilaterally. See the frontend/backend reconciliation report for this gap and the product
 * question it raises (should uploading a receipt request staff review, or should /pay be wired in
 * explicitly once amount/date fields exist on the backend?).
 */
export const uploadClientPaymentReceipt = async (orderId: string, payload: PaymentReceiptPayload): Promise<unknown> => {
  const fileError = validateClientFile(payload.file);
  if (fileError) throw new Error(fileError);
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) throw new Error('Укажите корректную сумму платежа.');
  if (!payload.paymentDate) throw new Error('Укажите дату платежа.');
  const comment = [
    `Сумма: ${payload.amount}`,
    `Дата платежа: ${payload.paymentDate}`,
    `Способ оплаты: ${payload.paymentMethod}`,
    `Номер платёжного поручения: ${payload.paymentOrderNumber.trim()}`,
    payload.comment?.trim(),
  ].filter(Boolean).join('\n');
  return uploadClientDocument(orderId, { file: payload.file, category: 'PAYMENT_RECEIPT', comment });
};
