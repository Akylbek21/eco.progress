import api, { ApiResponse } from './api';
import type {
  CreateProtocolPayload,
  NormativeSearchResult,
  Protocol,
  ProtocolResultRow,
  ProtocolTemplate,
  UpdateProtocolPayload,
} from '../types/protocols';

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export async function getProtocols(params?: Record<string, string>): Promise<Protocol[]> {
  const response = await api.get<ApiResponse<Protocol[]>>('/protocols', { params });
  return unwrap(response);
}

export async function getProtocolTemplates(): Promise<ProtocolTemplate[]> {
  const response = await api.get<ApiResponse<ProtocolTemplate[]>>('/protocols/templates');
  return unwrap(response);
}

export async function createProtocol(payload: CreateProtocolPayload): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>('/protocols', payload);
  return unwrap(response);
}

export async function getProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.get<ApiResponse<Protocol>>(`/protocols/${protocolId}`);
  return unwrap(response);
}

export async function updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol> {
  const response = await api.patch<ApiResponse<Protocol>>(`/protocols/${protocolId}`, payload);
  return unwrap(response);
}

export async function deleteProtocol(protocolId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocols/${protocolId}`);
}

export async function addProtocolResult(protocolId: string, payload: Partial<ProtocolResultRow>): Promise<ProtocolResultRow> {
  const response = await api.post<ApiResponse<ProtocolResultRow>>(`/protocols/${protocolId}/results`, payload);
  return unwrap(response);
}

export async function updateProtocolResult(resultId: string, payload: Partial<ProtocolResultRow>): Promise<ProtocolResultRow> {
  const response = await api.patch<ApiResponse<ProtocolResultRow>>(`/protocol-results/${resultId}`, payload);
  return unwrap(response);
}

export async function deleteProtocolResult(resultId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocol-results/${resultId}`);
}

export async function checkNormatives(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/check-normatives`);
  return unwrap(response);
}

export async function readyForApproval(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/ready-for-approval`);
  return unwrap(response);
}

export async function approveProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/approve`);
  return unwrap(response);
}

export async function signProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/sign`);
  return unwrap(response);
}

export async function replaceProtocol(protocolId: string, reason: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/replace`, { reason });
  return unwrap(response);
}

export async function cancelProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/cancel`);
  return unwrap(response);
}

export async function previewProtocol(protocolId: string): Promise<Blob> {
  const response = await api.get<Blob>(`/protocols/${protocolId}/preview`, { responseType: 'blob' });
  return response.data;
}

export async function generateDocx(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/generate-docx`);
  return unwrap(response);
}

export async function generatePdf(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/generate-pdf`);
  return unwrap(response);
}

export async function downloadDocx(protocolId: string): Promise<Blob> {
  const response = await api.get<Blob>(`/protocols/${protocolId}/download-docx`, { responseType: 'blob' });
  return response.data;
}

export async function downloadPdf(protocolId: string): Promise<Blob> {
  const response = await api.get<Blob>(`/protocols/${protocolId}/download-pdf`, { responseType: 'blob' });
  return response.data;
}

export async function importExcel(protocolId: string, file: File): Promise<Protocol> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/import-excel`, formData);
  return unwrap(response);
}

export async function searchNormative(params: Record<string, string>): Promise<NormativeSearchResult> {
  const response = await api.get<ApiResponse<NormativeSearchResult>>('/normatives/search', { params });
  return unwrap(response);
}
