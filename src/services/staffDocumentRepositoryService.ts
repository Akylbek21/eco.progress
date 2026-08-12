import api from './api';
import { extractList, unwrapApiResponse, type ApiResponse } from './apiHelpers';

export interface StaffRepositoryDocument {
  id: string;
  name: string;
  category: string;
  comment: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number | null;
  uploadedAt: string;
  uploadedBy: string;
  downloadUrl: string | null;
  canDelete: boolean;
}

export interface UploadStaffRepositoryDocument {
  file: File;
  name?: string;
  category?: string;
  comment?: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const text = (...values: unknown[]): string => {
  const value = values.find((item) => typeof item === 'string' && item.trim());
  return typeof value === 'string' ? value.trim() : '';
};

const mapStaffRepositoryDocument = (value: unknown): StaffRepositoryDocument => {
  const source = asRecord(value);
  const uploader = asRecord(source.uploadedBy ?? source.createdBy ?? source.author);
  const actions = Array.isArray(source.availableActions) ? source.availableActions.map(String) : [];
  const explicitCanDelete = source.canDelete ?? asRecord(source.permissions).canDelete;
  return {
    id: String(source.id ?? source.documentId ?? ''),
    name: text(source.name, source.title, source.originalFileName, source.fileName) || 'Документ',
    category: text(source.category, source.type, source.documentType) || 'other',
    comment: text(source.comment, source.description),
    originalFileName: text(source.originalFileName, source.fileName, source.name, source.title) || 'document',
    mimeType: text(source.mimeType, source.contentType) || 'application/octet-stream',
    fileSize: Number.isFinite(Number(source.fileSize ?? source.size)) ? Number(source.fileSize ?? source.size) : null,
    uploadedAt: text(source.uploadedAt, source.createdAt, source.updatedAt),
    uploadedBy: text(uploader.fullName, uploader.name, source.uploadedByName, source.createdByName) || 'Сотрудник',
    downloadUrl: text(source.downloadUrl, source.fileUrl, source.url) || null,
    canDelete: typeof explicitCanDelete === 'boolean'
      ? explicitCanDelete
      : actions.length === 0 || actions.includes('DELETE'),
  };
};

export const getStaffRepositoryDocuments = async (): Promise<StaffRepositoryDocument[]> => {
  const response = await api.get('/staff/documents');
  return extractList(response.data, ['documents']).map(mapStaffRepositoryDocument).filter((item) => item.id);
};

export const uploadStaffRepositoryDocument = async (
  payload: UploadStaffRepositoryDocument,
): Promise<StaffRepositoryDocument> => {
  const form = new FormData();
  form.append('file', payload.file);
  form.append('name', payload.name?.trim() || payload.file.name);
  form.append('category', payload.category?.trim() || 'other');
  if (payload.comment?.trim()) form.append('comment', payload.comment.trim());
  const response = await api.post<ApiResponse<unknown>>('/staff/documents', form);
  return mapStaffRepositoryDocument(unwrapApiResponse(response.data));
};

export const deleteStaffRepositoryDocument = async (documentId: string): Promise<void> => {
  await api.delete(`/staff/documents/${encodeURIComponent(documentId)}`);
};

export const staffRepositoryDocumentDownloadUrl = (document: StaffRepositoryDocument): string =>
  document.downloadUrl || `/api/staff/documents/${encodeURIComponent(document.id)}/download`;

