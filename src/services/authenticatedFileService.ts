import api from './api';

export const getAuthenticatedBlob = async (path: string, signal?: AbortSignal): Promise<Blob> => {
  const response = await api.get<Blob>(path, { responseType: 'blob', signal });
  return response.data;
};
