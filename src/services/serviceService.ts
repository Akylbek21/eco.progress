import { fetcher } from './api';
import type { ServiceItem } from '../types';

export const getServices = async (): Promise<ServiceItem[]> => fetcher<ServiceItem[]>('/services');

export const getServiceById = async (id: string): Promise<ServiceItem | undefined> => fetcher<ServiceItem>(`/services/${id}`);
