import { orders, type Order, notifications, type NotificationItem } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let currentOrders = [...orders];

export const getOrders = async (): Promise<Order[]> => {
  await delay(300);
  return currentOrders;
};

export const createOrder = async (order: Order): Promise<Order> => {
  await delay(300);
  currentOrders = [order, ...currentOrders];
  return order;
};

export const changeOrderStatus = async (orderId: string, status: Order['status']) => {
  await delay(200);
  currentOrders = currentOrders.map((item) =>
    item.id === orderId ? { ...item, status } : item
  );
  return currentOrders.find((item) => item.id === orderId);
};

export const getNotifications = async (): Promise<NotificationItem[]> => {
  await delay(200);
  return notifications;
};
