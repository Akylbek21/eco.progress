import { notifications, orders, statusDescriptions, type CommentItem, type CRMActionType, type DocumentItem, type EcologyStatus, type LaboratoryStatus, type MockUser, type NotificationItem, type Order, type OrderHistoryItem, type OrderStatus, type PaymentStatus, type StaffContractStatus, type UserRole } from '../data/mockData';

const ORDERS_KEY = 'eco-progress-orders';
const USER_KEY = 'eco-progress-user';
const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeOrder = (order: Order): Order => ({
  ...order,
  contractStatus: order.contractStatus || 'not_sent',
  crmContractStatus: order.crmContractStatus || (order.contractStatus === 'signed' ? 'signed' : order.contractStatus === 'sent' ? 'sent_to_client' : 'not_created'),
  paymentStatus: order.paymentStatus || 'not_sent',
  assignedManagerId: order.assignedManagerId || 'staff-1',
  assignedAccountantId: order.assignedAccountantId || 'staff-2',
  assignedEcologistId: order.assignedEcologistId || 'staff-3',
  assignedLaboratoryId: order.assignedLaboratoryId || 'staff-4',
  assignedAccountant: order.assignedAccountant || 'Бухгалтер ECOPROGRESS GROUP',
  assignedEcologist: order.assignedEcologist || 'Эколог ECOPROGRESS GROUP',
  assignedLaboratory: order.assignedLaboratory || 'Лаборатория ECOPROGRESS GROUP',
  ecologyStatus: order.ecologyStatus || (/(эколог|отчет|документ|разреш)/i.test(order.service) ? 'in_progress' : 'not_started'),
  laboratoryStatus: order.laboratoryStatus || (/(лаборатор|анализ|исслед)/i.test(order.service) ? 'waiting_samples' : 'not_assigned'),
  deadline: order.deadline || '',
  updatedAt: order.updatedAt || order.createdAt,
  comments: order.comments || [],
  documents: order.documents || [],
  resultDocuments: order.resultDocuments || [],
  history: order.history || [],
});

const readOrders = (): Order[] => {
  const raw = localStorage.getItem(ORDERS_KEY);
  if (!raw) {
    const initialOrders = orders.map(normalizeOrder);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(initialOrders));
    return initialOrders;
  }
  try {
    return (JSON.parse(raw) as Order[]).map(normalizeOrder);
  } catch {
    const initialOrders = orders.map(normalizeOrder);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(initialOrders));
    return initialOrders;
  }
};

const writeOrders = (items: Order[]) => {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(items));
};

const stamp = () => new Date().toLocaleString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const paymentLabel = (status: PaymentStatus) => {
  if (status === 'paid') return 'Оплачено';
  if (status === 'partial') return 'Частично оплачено';
  if (status === 'pending') return 'Ожидает оплаты';
  return 'Не оплачено';
};

const currentActor = () => {
  const fallback = { name: 'Сотрудник', role: 'MANAGER' as UserRole };
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return fallback;
  try {
    const user = JSON.parse(raw) as MockUser;
    return { name: user.name || fallback.name, role: user.role || fallback.role };
  } catch {
    return fallback;
  }
};

const historyEntry = (
  orderId: string,
  actionType: CRMActionType,
  text: string,
  comment?: string,
  oldValue?: string,
  newValue?: string
): OrderHistoryItem => {
  const actor = currentActor();
  return {
    id: `H-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    orderId,
    actionType,
    actor: actor.name,
    actorName: actor.name,
    actorRole: actor.role,
    oldValue,
    newValue,
    text,
    comment,
    createdAt: stamp(),
  };
};

const clientHistoryEntry = (orderId: string, actionType: CRMActionType, text: string, comment?: string, oldValue?: string, newValue?: string): OrderHistoryItem => ({
  id: `H-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  orderId,
  actionType,
  actor: 'Клиент',
  actorName: 'Клиент',
  actorRole: 'CLIENT',
  oldValue,
  newValue,
  text,
  comment,
  createdAt: stamp(),
});

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
  signatureProvider?: string;
  paymentMethod?: string;
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
    contractStatus: 'not_sent',
    crmContractStatus: 'not_created',
    paymentStatus: 'not_sent',
    assignedManagerId: 'staff-1',
    assignedAccountantId: 'staff-2',
    assignedEcologistId: 'staff-3',
    assignedLaboratoryId: 'staff-4',
    assignedAccountant: 'Бухгалтер ECOPROGRESS GROUP',
    assignedEcologist: 'Эколог ECOPROGRESS GROUP',
    assignedLaboratory: 'Лаборатория ECOPROGRESS GROUP',
    ecologyStatus: /(эколог|отчет|документ|разреш)/i.test(payload.service) ? 'not_started' : 'not_started',
    laboratoryStatus: /(лаборатор|анализ|исслед)/i.test(payload.service) ? 'waiting_samples' : 'not_assigned',
    signatureProvider: payload.signatureProvider || 'NCALayer / ЭЦП',
    paymentMethod: payload.paymentMethod || 'Банковская карта',
    paymentAmount: '150 000 ₸',
    paymentUrl: `https://pay.ecoprogress.kz/invoice/${id}`,
    deadline: '',
    updatedAt: stamp(),
    documents: doc,
    resultDocuments: [],
    comments: [],
    history: [
      historyEntry(id, 'order_created', 'Заявка ожидает проверки сотрудником перед выставлением договора и счета'),
      historyEntry(id, 'order_created', 'Заявка создана'),
    ],
  };
  writeOrders([order, ...readOrders()]);
  return order;
};

export const sendContractAndInvoice = async (
  orderId: string,
  payload: { amount: string; paymentMethod: string; signatureProvider: string; contractFileName?: string }
) => {
  await delay();
  const sentAt = stamp();
  const items = readOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          contractStatus: 'sent' as const,
          crmContractStatus: 'sent_to_client' as StaffContractStatus,
          paymentStatus: 'pending' as const,
          paymentAmount: payload.amount,
          paymentMethod: payload.paymentMethod,
          signatureProvider: payload.signatureProvider,
          paymentUrl: `https://pay.ecoprogress.kz/invoice/${orderId}`,
          updatedAt: sentAt,
          resultDocuments: [
            {
              id: `DOC-${Date.now()}`,
              orderId,
              name: payload.contractFileName || `Договор ${orderId} для подписания.pdf`,
              type: 'result' as const,
              uploadedAt: sentAt,
              status: 'Ожидает подписи клиента',
            },
            {
              id: `DOC-${Date.now()}-invoice`,
              orderId,
              name: `Счет на оплату ${orderId}.pdf`,
              type: 'invoice' as const,
              uploadedAt: sentAt,
              status: 'Ожидает оплаты',
            },
            ...order.resultDocuments,
          ],
          history: [
            { ...historyEntry(orderId, 'contract_updated', `Сотрудник отправил договор и счет на ${payload.amount}`, undefined, order.crmContractStatus || order.contractStatus || 'not_created', 'sent_to_client'), createdAt: sentAt },
            ...order.history,
          ],
        }
      : order
  );
  writeOrders(items);
  return items.find((order) => order.id === orderId);
};

export const signOrderContract = async (orderId: string, provider: string) => {
  await delay();
  const signedAt = stamp();
  const items = readOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          contractStatus: 'signed' as const,
          crmContractStatus: 'signed' as StaffContractStatus,
          signatureProvider: provider,
          signedAt,
          updatedAt: signedAt,
          documents: [
            {
              id: `DOC-${Date.now()}`,
              orderId,
              name: `Договор ${orderId}, подписан ЭЦП.pdf`,
              type: 'client' as const,
              uploadedAt: signedAt,
              status: 'Подписан онлайн',
            },
            ...order.documents,
          ],
          history: [{ ...clientHistoryEntry(orderId, 'contract_updated', `Договор подписан онлайн через ${provider}`, undefined, order.crmContractStatus || order.contractStatus || 'sent_to_client', 'signed'), createdAt: signedAt }, ...order.history],
        }
      : order
  );
  writeOrders(items);
  return items.find((order) => order.id === orderId);
};

export const payOrderOnline = async (orderId: string, method: string) => {
  await delay();
  const paidAt = stamp();
  const items = readOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          paymentStatus: 'paid' as const,
          paymentMethod: method,
          paidAt,
          updatedAt: paidAt,
          documents: [
            {
              id: `DOC-${Date.now()}`,
              orderId,
              name: `Квитанция об оплате ${orderId}.pdf`,
              type: 'invoice' as const,
              uploadedAt: paidAt,
              status: 'Оплачено онлайн',
            },
            ...order.documents,
          ],
          history: [{ ...clientHistoryEntry(orderId, 'payment_changed', `Счет оплачен онлайн: ${method}`, undefined, paymentLabel(order.paymentStatus || 'not_sent'), paymentLabel('paid')), createdAt: paidAt }, ...order.history],
        }
      : order
  );
  writeOrders(items);
  return items.find((order) => order.id === orderId);
};

export const updatePaymentStatus = async (
  orderId: string,
  status: PaymentStatus,
  payload: { amount?: string; paidAt?: string; comment?: string; method?: string; invoiceNumber?: string; actNumber?: string } = {}
) => {
  await delay();
  const items = readOrders().map((order) => {
    if (order.id !== orderId) return order;
    const paidAt = status === 'paid' ? payload.paidAt || order.paidAt || stamp() : order.paidAt;
    const previousStatus = order.paymentStatus || 'not_sent';
    return {
      ...order,
      paymentStatus: status,
      paymentAmount: payload.amount ?? order.paymentAmount,
      paymentMethod: payload.method ?? order.paymentMethod,
      invoiceNumber: payload.invoiceNumber ?? order.invoiceNumber,
      actNumber: payload.actNumber ?? order.actNumber,
      paymentComment: payload.comment ?? order.paymentComment,
      paidAt,
      updatedAt: stamp(),
      history: [
        historyEntry(orderId, 'payment_changed', `Статус оплаты изменен: ${paymentLabel(previousStatus)} → ${paymentLabel(status)}`, payload.comment, paymentLabel(previousStatus), paymentLabel(status)),
        ...order.history,
      ],
    };
  });
  writeOrders(items);
  return items.find((order) => order.id === orderId);
};

export const updateContractStatus = async (orderId: string, status: StaffContractStatus | NonNullable<Order['contractStatus']>, comment?: string) => {
  await delay();
  const items = readOrders().map((order) => {
    if (order.id !== orderId) return order;
    const crmStatus: StaffContractStatus =
      status === 'not_sent' ? 'not_created' : status === 'sent' ? 'sent_to_client' : status;
    const contractStatus = crmStatus === 'signed' ? 'signed' : crmStatus === 'sent_to_client' || crmStatus === 'waiting_signature' ? 'sent' : order.contractStatus;
    const oldValue = order.crmContractStatus || order.contractStatus || 'not_created';
    return {
      ...order,
      contractStatus,
      crmContractStatus: crmStatus,
      signedAt: crmStatus === 'signed' ? order.signedAt || stamp() : order.signedAt,
      updatedAt: stamp(),
      history: [historyEntry(orderId, 'contract_updated', `Статус договора изменен: ${oldValue} → ${crmStatus}`, comment, oldValue, crmStatus), ...order.history],
    };
  });
  writeOrders(items);
  return items.find((order) => order.id === orderId);
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  await delay();
  const items = readOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          status,
          updatedAt: stamp(),
          history: [historyEntry(orderId, 'status_changed', `Статус изменен: ${order.status} → ${status}`, undefined, order.status, status), ...order.history],
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
      ? { ...order, manager, updatedAt: stamp(), history: [historyEntry(orderId, 'manager_assigned', `Назначен ответственный: ${manager}`, undefined, order.manager, manager), ...order.history] }
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
          updatedAt: stamp(),
          history: [
            historyEntry(
              orderId,
              visibility === 'client' ? 'client_message_added' : 'internal_note_added',
              visibility === 'client' ? 'Добавлено сообщение клиенту' : 'Добавлена внутренняя заметка',
              text
            ),
            ...order.history,
          ],
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
          updatedAt: stamp(),
          history: [historyEntry(orderId, type === 'result' ? 'document_ready' : 'document_uploaded', `Документ загружен: ${name}`), ...order.history],
        }
      : order
  );
  writeOrders(items);
  return doc;
};

export const updateEcologyStatus = async (orderId: string, status: EcologyStatus, comment?: string) => {
  await delay();
  const items = readOrders().map((order) => {
    if (order.id !== orderId) return order;
    const oldValue = order.ecologyStatus || 'not_started';
    return {
      ...order,
      ecologyStatus: status,
      ecologyComment: comment ?? order.ecologyComment,
      ecologyReadyAt: status === 'done' ? order.ecologyReadyAt || stamp() : order.ecologyReadyAt,
      updatedAt: stamp(),
      history: [historyEntry(orderId, 'status_changed', `Экологический статус изменен: ${oldValue} → ${status}`, comment, oldValue, status), ...order.history],
    };
  });
  writeOrders(items);
  return items.find((order) => order.id === orderId);
};

export const updateLaboratoryStatus = async (orderId: string, status: LaboratoryStatus, comment?: string) => {
  await delay();
  const items = readOrders().map((order) => {
    if (order.id !== orderId) return order;
    const oldValue = order.laboratoryStatus || 'not_assigned';
    return {
      ...order,
      laboratoryStatus: status,
      laboratoryComment: comment ?? order.laboratoryComment,
      samplesReceivedAt: status === 'samples_received' ? order.samplesReceivedAt || stamp() : order.samplesReceivedAt,
      laboratoryReadyAt: status === 'result_ready' ? order.laboratoryReadyAt || stamp() : order.laboratoryReadyAt,
      updatedAt: stamp(),
      history: [historyEntry(orderId, 'status_changed', `Лабораторный статус изменен: ${oldValue} → ${status}`, comment, oldValue, status), ...order.history],
    };
  });
  writeOrders(items);
  return items.find((order) => order.id === orderId);
};

export const getNotifications = async (): Promise<NotificationItem[]> => {
  await delay();
  return notifications;
};

export { statusDescriptions };
