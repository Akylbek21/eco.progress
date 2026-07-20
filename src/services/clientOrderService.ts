import api from './api';
import type { ApiResponse } from './apiHelpers';
import { unwrapApiResponse } from './apiHelpers';
import { mapOrder, mapOrders } from './backendAdapters';
import type { Order } from '../types';

export const getClientOrderDetails = async (orderId: string): Promise<Order | undefined> => {
  const { data } = await api.get<ApiResponse<unknown>>(`/client/orders/${orderId}`);
  const payload = unwrapApiResponse(data);
  return payload == null ? undefined : mapOrder(payload as Record<string, unknown>);
};

export const listClientOrders = async (): Promise<Order[]> => {
  const { data } = await api.get<ApiResponse<unknown[]>>('/client/orders');
  const payload = unwrapApiResponse(data);
  return mapOrders(Array.isArray(payload) ? payload as Record<string, unknown>[] : []);
};
