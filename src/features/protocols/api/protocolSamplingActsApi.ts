import api from '../../../services/api';
import { getContentDispositionFileName, unwrapApiResponse } from '../../../services/apiHelpers';

export interface ProtocolSamplingAct {
  id: number;
  protocolId: number;
  actNumber: string;
  samplingDate: string;
  samplingPlace: string | null;
  sampledBy: string | null;
  customerRepresentative: string | null;
  notes: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  createdBy: number;
  createdAt: string;
}
export type ProtocolSamplingActUpload = Pick<ProtocolSamplingAct, 'actNumber' | 'samplingDate' | 'samplingPlace' | 'sampledBy' | 'customerRepresentative' | 'notes'> & { file: File };

export const protocolSamplingActsApi = {
  list: async (protocolId: string, signal?: AbortSignal) => unwrapApiResponse<ProtocolSamplingAct[]>((await api.get(`/protocols/${protocolId}/sampling-acts`, { signal })).data),
  add: async (protocolId: string, request: ProtocolSamplingActUpload) => {
    const form = new FormData();
    form.append('actNumber', request.actNumber);
    form.append('samplingDate', request.samplingDate);
    if (request.samplingPlace) form.append('samplingPlace', request.samplingPlace);
    if (request.sampledBy) form.append('sampledBy', request.sampledBy);
    if (request.customerRepresentative) form.append('customerRepresentative', request.customerRepresentative);
    if (request.notes) form.append('notes', request.notes);
    form.append('file', request.file);
    return unwrapApiResponse<ProtocolSamplingAct>((await api.post(`/protocols/${protocolId}/sampling-acts`, form)).data);
  },
  remove: async (protocolId: string, actId: number) => { await api.delete(`/protocols/${protocolId}/sampling-acts/${actId}`); },
  download: async (protocolId: string, actId: number) => {
    const response = await api.get<Blob>(`/protocols/${protocolId}/sampling-acts/${actId}/download`, { responseType: 'blob' });
    return { blob: response.data, fileName: getContentDispositionFileName(response.headers['content-disposition']) || `sampling-act-${actId}` };
  },
};
