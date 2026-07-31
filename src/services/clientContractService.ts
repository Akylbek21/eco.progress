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

export const signClientContract = async (orderId: string, documentId: string | number, fileUrl: string | undefined): Promise<Order | undefined> => {
  if (!fileUrl) throw new Error('Файл договора ещё не загружен.');
  const contract = await getClientDocumentBlob(fileUrl);
  const { signedCms, signerSubject } = await signBase64WithNCALayer(await blobToBase64(contract));
  if (!signedCms?.trim()) throw new Error('NCALayer не вернул электронную подпись.');
  const payload: ContractSignatureRequest = { documentId, cms: signedCms, certificateInfo: certificateInfoFromSubject(signerSubject) };
  const { data } = await api.post<ApiResponse<unknown>>(`/client/orders/${orderId}/contract/sign`, payload);
  return mapOrder(unwrapApiResponse(data) as Record<string, unknown>);
};

// NOTE: there is no backend endpoint that accepts an already-signed contract file upload.
// kz.eco.order.ClientOrderController's only contract-signing route is POST
// /orders/{id}/contract/sign, which takes SignContractRequest (a CMS signature produced in-browser
// via NCALayer - see signClientContract above), not a multipart file. "Upload a PDF you already
// signed elsewhere" is a real, currently-missing backend feature, not a URL typo - do not silently
// point this at a differently-shaped endpoint (e.g. the generic document upload route) since that
// would misfile the document under the wrong category and lose the actual signing metadata. See
// the frontend/backend reconciliation report for this gap.
export const uploadSignedClientContract = async (_orderId: string, file: File, _comment = ''): Promise<unknown> => {
  const fileError = validateClientFile(file);
  if (fileError) throw new Error(fileError);
  if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) throw new Error('Подписанный договор должен быть в формате PDF.');
  throw new Error(
    'Загрузка уже подписанного договора пока не поддерживается сервером - подпишите договор через NCALayer прямо в кабинете.',
  );
};
