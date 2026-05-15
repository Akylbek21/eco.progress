import { fetcher } from './api';
import { services } from '../data/mockData';
import type { ServiceItem } from '../types';

const isLocalDemo = () => localStorage.getItem('eco-progress-token')?.startsWith('local-demo-token');

export const getServices = async (): Promise<ServiceItem[]> => {
  if (isLocalDemo()) return services as ServiceItem[];
  return fetcher<ServiceItem[]>('/services');
};

export const getServiceById = async (id: string): Promise<ServiceItem | undefined> => {
  if (isLocalDemo()) return (services as ServiceItem[]).find((service) => service.id === id);
  return fetcher<ServiceItem>(`/services/${id}`);
};
