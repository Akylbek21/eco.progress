import api from './api';
import type { ApiResponse } from './apiHelpers';
import { unwrapApiResponse } from './apiHelpers';
import { validateClientFile } from '../config/clientFiles';
import type { Order } from '../types';
import { mapOrder } from './backendAdapters';
import { getClientDocumentBlob } from './clientDocumentService';
import { signBase64WithNCALayer } from './ncalayer';

export interface CertificateInfo { iin?: string; bin?: string; fullName?: string; serialNumber?: string }
export interface ContractSignatureRequest { documentId: string | number; cms: string; certificateInfo: CertificateInfo }

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Не удалось прочитать файл договора.'));
  reader.onload = () => {
    const result = String(reader.result || '');
    const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
    base64 ? resolve(base64) : reject(new Error('Файл договора пуст.'));
  };
  reader.readAsDataURL(blob);
});

const certificateInfoFromSubject = (subject: string): CertificateInfo => {
  const fields = Object.fromEntries(subject.split(',').map((part) => part.trim().split('=').map((item) => item.trim())).filter((part) => part.length === 2));
  return { iin: fields.SERIALNUMBER?.replace(/^IIN/i, ''), bin: fields.OU?.replace(/^BIN/i, ''), fullName: fields.CN, serialNumber: fields.SERIALNUMBER };
};

export const signClientContract = async (orderId: string, documentId: string | number): Promise<Order | undefined> => {
  const contract = await getClientDocumentBlob(orderId, String(documentId));
  const { signedCms, signerSubject } = await signBase64WithNCALayer(await blobToBase64(contract));
  if (!signedCms?.trim()) throw new Error('NCALayer не вернул электронную подпись.');
  const payload: ContractSignatureRequest = { documentId, cms: signedCms, certificateInfo: certificateInfoFromSubject(signerSubject) };
  const { data } = await api.post<ApiResponse<unknown>>(`/client/orders/${orderId}/contract/sign`, payload);
  return mapOrder(unwrapApiResponse(data) as Record<string, unknown>);
};

export const uploadSignedClientContract = async (orderId: string, file: File, comment = ''): Promise<unknown> => {
  const fileError = validateClientFile(file);
  if (fileError) throw new Error(fileError);
  if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) throw new Error('Подписанный договор должен быть в формате PDF.');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('comment', comment.trim());
  const { data } = await api.post<ApiResponse<unknown>>(`/client/orders/${orderId}/contract/upload-signed`, formData);
  return unwrapApiResponse(data);
};
