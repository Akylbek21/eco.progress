import { getOrders, uploadDocument } from './orderService';

export const getDocuments = async () => {
  const orders = await getOrders();
  return orders.flatMap((order) => [...order.documents, ...order.resultDocuments]);
};

export { uploadDocument };
