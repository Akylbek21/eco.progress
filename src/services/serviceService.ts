import { services } from '../data/mockData';

export const getServices = async () => services;

export const getServiceById = async (id: string) => services.find((service) => service.id === id);
