import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export type ApiResponse<T> = {
  data: T;
  message?: string;
};

export const fetcher = async <T>(url: string): Promise<T> => {
  const response = await apiClient.get<ApiResponse<T>>(url);
  return response.data.data;
};

export default apiClient;
