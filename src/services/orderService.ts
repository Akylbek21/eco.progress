import { notifications, orders, statusDescriptions, type CommentItem, type DocumentItem, type MockUser, type NotificationItem, type Order, type OrderStatus } from '../data/mockData';

const ORDERS_KEY = 'eco-progress-orders';
const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const readOrders = (): Order[] => {
  const raw = localStorage.getItem(ORDERS_KEY);
  if (!raw) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return orders;
  }
  try {
    return JSON.parse(raw) as Order[];
  } catch {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return orders;
  }
};

const writeOrders = (items: Order[]) => {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(items));
};

const stamp = () => new Date().toLocaleString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const getOrders = async (): Promise<Order[]> => {
  await delay();
  return readOrders();
};

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  await delay();
  return readOrders().find((order) => order.id === id);
};

export const getClientOrders = async (user?: MockUser | null): Promise<Order[]> => {
  await delay();
  if (!user) return readOrders();
  return readOrders().filter((order) => order.clientId === user.id || order.email === user.email || order.clientId === 'client-1');
};

export type CreateOrderPayload = {
  user?: MockUser | null;
  contactPerson: string;
  phone: string;
  email: string;
  companyName: string;
  bin: string;
  serviceId: string;
  service: string;
  urgency: string;
  comment: string;
  fileName?: string;
};

export const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
  await delay();
  const id = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const doc: DocumentItem[] = payload.fileName
    ? [{ id: `DOC-${Date.now()}`, orderId: id, name: payload.fileName, type: 'client', uploadedAt: stamp(), status: 'Загружен' }]
    : [];
  const order: Order = {
    id,
    clientId: payload.user?.id ?? 'client-1',
    clientType: payload.user?.type === 'individual' ? 'individual' : 'company',
    clientName: payload.contactPerson,
    companyName: payload.companyName,
    bin: payload.bin,
    organizationType: payload.user?.organizationType ?? '',
    legalAddress: payload.user?.legalAddress ?? '',
    contactPerson: payload.contactPerson,
    phone: payload.phone,
    email: payload.email,
    serviceId: payload.serviceId,
    service: payload.service,
    urgency: payload.urgency,
    comment: payload.comment,
    createdAt: stamp(),
    status: 'Новая',
    manager: 'Не назначен',
    documents: doc,
    resultDocuments: [],
    comments: [],
    history: [{ id: `H-${Date.now()}`, orderId: id, text: 'Заявка создана', createdAt: stamp() }],
  };
  writeOrders([order, ...readOrders()]);
  return order;
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  await delay();
  const items = readOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          status,
          history: [{ id: `H-${Date.now()}`, orderId, text: `Статус изменен на "${status}"`, createdAt: stamp() }, ...order.history],
        }
      : order
  );
  writeOrders(items);
  return items.find((order) => order.id === orderId);
};

export const assignManager = async (orderId: string, manager: string) => {
  await delay();
  const items = readOrders().map((order) =>
    order.id === orderId
      ? { ...order, manager, history: [{ id: `H-${Date.now()}`, orderId, text: `Назначен ответственный: ${manager}`, createdAt: stamp() }, ...order.history] }
      : order
  );
  writeOrders(items);
};

export const addComment = async (orderId: string, text: string, visibility: 'client' | 'internal' = 'client', author = 'Менеджер ECOPROGRESS GROUP') => {
  await delay();
  const comment: CommentItem = { id: `COM-${Date.now()}`, orderId, author, text, visibility, createdAt: stamp() };
  const items = readOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          comments: [comment, ...order.comments],
          history: [{ id: `H-${Date.now()}`, orderId, text: visibility === 'client' ? 'Добавлен комментарий клиенту' : 'Добавлен внутренний комментарий', createdAt: stamp() }, ...order.history],
        }
      : order
  );
  writeOrders(items);
  return comment;
};

export const uploadDocument = async (orderId: string, name: string, type: DocumentItem['type'] = 'client') => {
  await delay();
  const doc: DocumentItem = { id: `DOC-${Date.now()}`, orderId, name, type, uploadedAt: stamp(), status: type === 'result' ? 'Готово' : 'Загружен' };
  const items = readOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          documents: type === 'client' ? [doc, ...order.documents] : order.documents,
          resultDocuments: type === 'result' ? [doc, ...order.resultDocuments] : order.resultDocuments,
          history: [{ id: `H-${Date.now()}`, orderId, text: `Документ загружен: ${name}`, createdAt: stamp() }, ...order.history],
        }
      : order
  );
  writeOrders(items);
  return doc;
};

export const getNotifications = async (): Promise<NotificationItem[]> => {
  await delay();
  return notifications;
};

export { statusDescriptions };
