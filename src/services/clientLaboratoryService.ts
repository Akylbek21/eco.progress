import api from './api';
import type { ApiResponse } from './apiHelpers';
import { unwrapApiResponse } from './apiHelpers';
import { validateClientFile } from '../config/clientFiles';
import type { LaboratoryMeasurementAgreement, LaboratoryPrimaryDocument, Order } from '../types';

export const uploadClientLaboratoryPrimaryDocument = async (
  orderId: string,
  documentId: string,
  file: File,
  comment = '',
): Promise<{ order?: Order; document?: LaboratoryPrimaryDocument }> => {
  const fileError = validateClientFile(file);
  if (fileError) throw new Error(fileError);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('comment', comment.trim());
  const { data } = await api.post<ApiResponse<{ order?: Order; document?: LaboratoryPrimaryDocument }>>(
    `/client/orders/${orderId}/laboratory/primary-documents/${documentId}`,
    formData,
  );
  return unwrapApiResponse(data);
};

export interface MeasurementResponsePayload {
  action: 'accept' | 'reschedule';
  rescheduleDate?: string;
  rescheduleTime?: string;
  comment?: string;
}

export const respondClientMeasurementAgreement = async (
  orderId: string,
  payload: MeasurementResponsePayload,
): Promise<LaboratoryMeasurementAgreement | undefined> => {
  if (payload.action === 'reschedule' && (!payload.rescheduleDate || !payload.rescheduleTime || !payload.comment?.trim())) {
    throw new Error('Для переноса укажите новую дату, время и причину.');
  }
  const { data } = await api.post<ApiResponse<LaboratoryMeasurementAgreement>>(
    `/client/orders/${orderId}/laboratory/measurement/respond`,
    {
      status: payload.action === 'reschedule' ? 'RESCHEDULE_REQUESTED' : 'ACCEPTED',
      comment: payload.comment?.trim() || undefined,
      rescheduleDate: payload.rescheduleDate,
      rescheduleTime: payload.rescheduleTime,
    },
  );
  return unwrapApiResponse(data);
};
