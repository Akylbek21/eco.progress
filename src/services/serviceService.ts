import { fetcher } from './api';
import type { ServiceItem } from '../types';

export const getServices = async (): Promise<ServiceItem[]> => {
  return fetcher<ServiceItem[]>('/services');
};

export const getServiceById = async (id: string): Promise<ServiceItem | undefined> => {
  return fetcher<ServiceItem>(`/services/${id}`);
};
