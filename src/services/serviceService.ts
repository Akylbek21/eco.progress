import { services, type ServiceItem } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getServices = async (): Promise<ServiceItem[]> => {
  await delay(300);
  return services;
};

export const getServiceById = async (serviceId: string): Promise<ServiceItem | undefined> => {
  await delay(300);
  return services.find((item) => item.id === serviceId);
};
