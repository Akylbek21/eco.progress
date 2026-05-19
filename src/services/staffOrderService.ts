import api from './api';
import type {
  ClientPrimaryDocumentStatus,
  CommentItem,
  DocumentItem,
  EcologyStatus,
  LaboratoryMeasurementAgreement,
  LaboratoryPrimaryDocument,
  LaboratoryMeasurementAgreementStatus,
  LaboratoryPrimaryDocumentStatus,
  LaboratoryResultDocument,
  LaboratoryResultDocumentStatus,
  LaboratoryStatus,
  Order,
  OrderStatus,
  PaymentStatus,
  QuarterDocument,
  QuarterResult,
  QuarterWorkStatus,
  StaffContractStatus,
} from '../types';
import { createLaboratoryPrimaryDocuments } from '../utils/laboratory';

export type StaffOrderFilters = {
  q?: string;
  businessCompanyId?: string;
  status?: string;
  paymentStatus?: string;
  contractType?: string;
  managerId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const DEMO_ORDER_IDS = ['REQ-DESIGN-001', 'REQ-LAB-001'] as const;
const DEMO_ORDERS_KEY = 'eco-progress-demo-orders';

const nowDate = () => new Date().toISOString().slice(0, 10);
const nowDateTime = () => new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);
const isDemoOrderId = (orderId: string) => DEMO_ORDER_IDS.includes(orderId as typeof DEMO_ORDER_IDS[number]);

const demoHistory = (orderId: string, text: string, actionType: Order['history'][number]['actionType'] = 'order_created', comment = '') => ({
  id: `${orderId}-history-${text}`,
  orderId,
  text,
  actionType,
  comment,
  createdAt: nowDateTime(),
  actorName: 'ECOPROGRESS CRM',
  actorRole: 'ADMIN' as const,
});

const buildDemoLaboratoryDocuments = (orderId: string): LaboratoryPrimaryDocument[] => {
  const docs = createLaboratoryPrimaryDocuments(orderId);
  return docs.map((doc, index) => {
    if (index > 3) return doc;
    return {
      ...doc,
      status: index === 3 ? 'in_review' : 'uploaded',
      fileName: `${doc.name}.pdf`,
      uploadedAt: '2026-05-19',
      uploadedBy: 'ТОО Green Lab Client',
      employeeComment: index === 3 ? 'Проверить актуальность документа' : 'Документ загружен клиентом',
      history: [demoHistory(orderId, `${doc.name}: документ получен`, 'document_uploaded')],
    };
  });
};

const seedDemoOrders = (): Order[] => {
  const designOrderId = 'REQ-DESIGN-001';
  const labOrderId = 'REQ-LAB-001';
  const designOrder: Order = {
    id: designOrderId,
    businessCompanyId: 'eco-docs',
    businessCompanyName: 'ECOPROGRESS Documents',
    clientId: 'demo-client-design',
    clientType: 'company',
    clientName: 'Айжан Нурланова',
    companyName: 'ТОО Green Project KZ',
    bin: '240519000111',
    organizationType: 'ТОО',
    legalAddress: 'г. Алматы, пр. Абая, 120',
    objectAddress: 'Алматинская область, производственная площадка N1',
    contactPerson: 'Айжан Нурланова',
    whatsapp: '+7 701 111 22 33',
    phone: '+7 701 111 22 33',
    email: 'design.client@example.kz',
    serviceId: 'ecological-documents',
    service: 'Экологическое проектирование: ОВОС, инвентаризация и согласование ОС',
    urgency: 'Стандартно',
    comment: 'Нужно подготовить проектные материалы и разрешительный пакет для нового объекта.',
    createdAt: '2026-05-19',
    status: 'Проектирование',
    manager: 'Менеджер ECOPROGRESS',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'transferred_to_specialist',
    paymentAmount: '850000',
    offerAmount: 850000,
    contractAmount: 850000,
    totalAmount: 850000,
    paidAmount: 850000,
    remainingAmount: 0,
    paymentTerms: 'full_prepayment',
    minPrepaymentPercent: 100,
    assignedEcologist: 'Эколог ECOPROGRESS GROUP',
    ecologyStatus: 'in_progress',
    ecologyComment: 'Документы клиента получены, проектирование начато.',
    documents: [
      { id: `${designOrderId}-doc-1`, orderId: designOrderId, name: 'Карточка компании.pdf', type: 'client', uploadedAt: '2026-05-19', status: 'Принято' },
      { id: `${designOrderId}-doc-2`, orderId: designOrderId, name: 'Правоустанавливающие документы.pdf', type: 'client', uploadedAt: '2026-05-19', status: 'На проверке' },
    ],
    primaryDocuments: [
      { id: `${designOrderId}-primary-1`, orderId: designOrderId, name: 'Карточка компании', required: true, status: 'accepted', fileName: 'Карточка компании.pdf', uploadedAt: '2026-05-19' },
      { id: `${designOrderId}-primary-2`, orderId: designOrderId, name: 'Адрес объекта', required: true, status: 'in_review', fileName: 'Адрес объекта.pdf', uploadedAt: '2026-05-19', managerComment: 'Проверить соответствие адресу площадки' },
      { id: `${designOrderId}-primary-3`, orderId: designOrderId, name: 'Предыдущие экологические документы', required: false, status: 'need_upload', managerComment: 'Если есть действующие документы, загрузите их в заявку' },
    ],
    resultDocuments: [
      { id: `${designOrderId}-result-1`, orderId: designOrderId, name: 'Черновик инвентаризации.pdf', type: 'result', uploadedAt: '2026-05-19', status: 'Черновик' },
    ],
    comments: [
      { id: `${designOrderId}-comment-1`, orderId: designOrderId, author: 'Клиент', text: 'Просим учесть запуск объекта в июне.', visibility: 'client', createdAt: '2026-05-19' },
      { id: `${designOrderId}-comment-2`, orderId: designOrderId, author: 'Эколог ECOPROGRESS GROUP', text: 'Приняли документы, начинаем проверку исходных данных.', visibility: 'client', createdAt: '2026-05-19' },
    ],
    history: [
      demoHistory(designOrderId, 'Заявка передана экологу на проектирование'),
      demoHistory(designOrderId, 'Клиент загрузил первичные документы', 'document_uploaded'),
    ],
  };

  const labOrder: Order = {
    id: labOrderId,
    businessCompanyId: 'eco-lab',
    businessCompanyName: 'ECOPROGRESS Laboratory',
    clientId: 'demo-client-lab',
    clientType: 'company',
    clientName: 'Руслан Сагындык',
    companyName: 'ТОО EcoLab Partner',
    bin: '240519000222',
    organizationType: 'ТОО',
    legalAddress: 'г. Астана, ул. Кабанбай батыра, 45',
    objectAddress: 'г. Астана, промзона, участок 7',
    contactPerson: 'Руслан Сагындык',
    whatsapp: '+7 702 222 33 44',
    phone: '+7 702 222 33 44',
    email: 'lab.client@example.kz',
    serviceId: 'laboratory',
    service: 'Лабораторные исследования: замеры выбросов, протокол и 870 форма',
    urgency: 'Срочно',
    comment: 'Нужны замеры на объекте и готовый протокол для отчетности.',
    createdAt: '2026-05-19',
    status: 'Лаборатория',
    manager: 'Менеджер ECOPROGRESS',
    contractStatus: 'signed',
    crmContractStatus: 'signed',
    paymentStatus: 'transferred_to_specialist',
    paymentAmount: '420000',
    offerAmount: 420000,
    contractAmount: 420000,
    totalAmount: 420000,
    paidAmount: 420000,
    remainingAmount: 0,
    paymentTerms: 'full_prepayment',
    minPrepaymentPercent: 100,
    assignedLaboratory: 'Лаборатория ECOPROGRESS',
    laboratoryStatus: 'analysis_in_progress',
    laboratoryComment: 'Документы частично проверены, замер согласован.',
    samplesReceivedAt: '2026-05-19',
    laboratoryPrimaryDocuments: buildDemoLaboratoryDocuments(labOrderId),
    laboratoryMeasurementAgreement: {
      id: `LAB-MEASURE-${labOrderId}`,
      orderId: labOrderId,
      measurementDate: '2026-05-22',
      measurementTime: '10:30',
      address: 'г. Астана, промзона, участок 7',
      companyName: 'ECOPROGRESS LABORATORY',
      contactPerson: 'Руслан Сагындык',
      phone: '+7 702 222 33 44',
      measurementScope: 'Замеры выбросов, отбор проб и подготовка протокола.',
      comment: 'Клиент подтвердил готовность площадки.',
      status: 'confirmed',
      sentAt: '2026-05-19',
      acceptedAt: '2026-05-19',
    },
    laboratorySections: ['overview', 'primary_documents', 'measurement', 'protocol', 'form_870', 'base_report', 'quarter_report'],
    laboratoryResultDocuments: [
      { id: `${labOrderId}-lab-result-1`, orderId: labOrderId, name: 'План замеров', section: 'measurement', status: 'published_to_client', fileName: 'План замеров.pdf', uploadedAt: '2026-05-19', uploadedBy: 'Лаборатория ECOPROGRESS', publishedAt: '2026-05-19', history: [demoHistory(labOrderId, 'План замеров отправлен клиенту', 'document_uploaded')] },
      { id: `${labOrderId}-lab-result-2`, orderId: labOrderId, name: 'Черновик протокола', section: 'protocol', status: 'ready', fileName: 'Черновик протокола.pdf', uploadedAt: '2026-05-19', uploadedBy: 'Лаборатория ECOPROGRESS', readyAt: '2026-05-19', history: [demoHistory(labOrderId, 'Черновик протокола подготовлен', 'document_uploaded')] },
    ],
    documents: [
      { id: `${labOrderId}-doc-1`, orderId: labOrderId, name: 'Заявка на лабораторные исследования.pdf', type: 'client', uploadedAt: '2026-05-19', status: 'Принято' },
    ],
    primaryDocuments: [
      { id: `${labOrderId}-primary-1`, orderId: labOrderId, name: 'Адрес объекта', required: true, status: 'accepted', fileName: 'Адрес объекта.pdf', uploadedAt: '2026-05-19' },
    ],
    resultDocuments: [],
    comments: [
      { id: `${labOrderId}-comment-1`, orderId: labOrderId, author: 'Лаборатория ECOPROGRESS', text: 'Замер согласован на 22.05.2026 10:30.', visibility: 'client', createdAt: '2026-05-19' },
    ],
    history: [
      demoHistory(labOrderId, 'Заявка передана лаборатории'),
      demoHistory(labOrderId, 'Согласование замера отправлено клиенту', 'client_message_added'),
    ],
  };

  return [designOrder, labOrder];
};

export const readDemoOrders = (): Order[] => {
  if (!isBrowser()) return seedDemoOrders();
  const raw = window.localStorage.getItem(DEMO_ORDERS_KEY);
  if (!raw) {
    const seeded = seedDemoOrders();
    window.localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const stored = JSON.parse(raw) as Order[];
    const missing = seedDemoOrders().filter((seed) => !stored.some((order) => order.id === seed.id));
    const merged = [...stored, ...missing];
    if (missing.length) window.localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    const seeded = seedDemoOrders();
    window.localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(seeded));
    return seeded;
  }
};

const writeDemoOrders = (orders: Order[]) => {
  if (isBrowser()) window.localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(orders));
};

const appendHistory = (order: Order, text: string, actionType: Order['history'][number]['actionType'], comment = ''): Order => ({
  ...order,
  updatedAt: nowDate(),
  history: [
    {
      id: `${order.id}-history-${Date.now()}`,
      orderId: order.id,
      text,
      actionType,
      comment,
      createdAt: nowDateTime(),
      actorName: 'Сотрудник ECOPROGRESS',
      actorRole: 'ADMIN',
    },
    ...(order.history || []),
  ],
});

const updateDemoOrder = (orderId: string, updater: (order: Order) => Order): Order | undefined => {
  const orders = readDemoOrders();
  const nextOrders = orders.map((order) => order.id === orderId ? updater(order) : order);
  writeDemoOrders(nextOrders);
  return nextOrders.find((order) => order.id === orderId);
};

const mergeDemoOrders = (orders: Order[]) => {
  const demoOrders = readDemoOrders();
  const realIds = new Set(orders.map((order) => order.id));
  return [...orders, ...demoOrders.filter((order) => !realIds.has(order.id))];
};

const applyStaffFilters = (orders: Order[], filters?: StaffOrderFilters) => {
  if (!filters) return orders;
  return orders
    .filter((order) => !filters.q || `${order.id} ${order.companyName} ${order.clientName} ${order.service}`.toLowerCase().includes(filters.q.toLowerCase()))
    .filter((order) => !filters.businessCompanyId || order.businessCompanyId === filters.businessCompanyId)
    .filter((order) => !filters.status || order.status === filters.status)
    .filter((order) => !filters.paymentStatus || order.paymentStatus === filters.paymentStatus)
    .filter((order) => !filters.contractType || order.contractType === filters.contractType);
};

export const getOrders = async (filters?: StaffOrderFilters): Promise<Order[]> => {
  const params = filters ? Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) : undefined;
  try {
    const { data } = await api.get<{ data: Order[]; message: string | null }>('/staff/orders', { params });
    return applyStaffFilters(mergeDemoOrders(data.data), filters);
  } catch {
    return applyStaffFilters(readDemoOrders(), filters);
  }
};

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  if (isDemoOrderId(id)) return readDemoOrders().find((order) => order.id === id);
  const { data } = await api.get<{ data: Order; message: string | null }>(`/staff/orders/${id}`);
  return data.data;
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({ ...order, status }, `Статус заявки изменен: ${status}`, 'status_changed'));
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { status });
  return data.data;
};

export const assignManager = async (orderId: string, role: string, userId?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/assign`, { role, userId });
  return data.data;
};

export const addComment = async (orderId: string, text: string, visibility: 'client' | 'internal' = 'client'): Promise<CommentItem> => {
  if (isDemoOrderId(orderId)) {
    const comment: CommentItem = { id: `${orderId}-comment-${Date.now()}`, orderId, author: 'Сотрудник ECOPROGRESS', text, visibility, createdAt: nowDateTime() };
    updateDemoOrder(orderId, (order) => appendHistory({ ...order, comments: [comment, ...(order.comments || [])] }, visibility === 'client' ? 'Добавлен комментарий клиенту' : 'Добавлена внутренняя заметка', visibility === 'client' ? 'client_message_added' : 'internal_note_added', text));
    return comment;
  }
  const { data } = await api.post<{ data: CommentItem; message: string | null }>(`/staff/orders/${orderId}/comments`, { text, visibility });
  return data.data;
};

export const uploadDocument = async (orderId: string, file: File, type?: string): Promise<DocumentItem> => {
  if (isDemoOrderId(orderId)) {
    const document: DocumentItem = { id: `${orderId}-document-${Date.now()}`, orderId, name: file.name, type: type === 'result' ? 'result' : 'internal', uploadedAt: nowDate(), status: 'Загружено' };
    updateDemoOrder(orderId, (order) => {
      const nextOrder = type === 'result'
        ? { ...order, resultDocuments: [document, ...(order.resultDocuments || [])] }
        : { ...order, documents: [document, ...(order.documents || [])] };
      return appendHistory(nextOrder, `Загружен документ: ${file.name}`, 'document_uploaded');
    });
    return document;
  }
  const formData = new FormData();
  formData.append('file', file);
  if (type) formData.append('type', type);
  const { data } = await api.post<{ data: DocumentItem; message: string | null }>(`/staff/orders/${orderId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};

export const sendContractAndInvoice = async (
  orderId: string,
  payload: { amount: string; paymentMethod?: string; signatureProvider?: string; contractFileName?: string; contractPeriodStart?: string; contractPeriodEnd?: string; contractServiceNote?: string; contractNote?: string },
) => {
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/contract-and-invoice`, payload);
  return data.data;
};

export const updateContractStatus = async (orderId: string, status: StaffContractStatus | string, comment?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/contract-status`, { status, comment });
  return data.data;
};

export const updatePaymentStatus = async (
  orderId: string,
  status: PaymentStatus,
  payload: {
    amount?: string;
    totalAmount?: string | number;
    paidAmount?: string | number;
    paidAt?: string;
    comment?: string;
    method?: string;
    invoiceNumber?: string;
    actNumber?: string;
    invoiceFileName?: string;
    paymentTerms?: Order['paymentTerms'];
    minPrepaymentPercent?: string | number;
  } = {},
) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { paymentStatus: status, ...payload });
  return data.data;
};

export const updateEcologyStatus = async (orderId: string, status: EcologyStatus, comment?: string) => {
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({ ...order, ecologyStatus: status, ecologyComment: comment, ecologyReadyAt: status === 'done' ? nowDate() : order.ecologyReadyAt }, `Статус экологии изменен: ${status}`, 'status_changed', comment));
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { ecologyStatus: status, ecologyComment: comment });
  return data.data;
};

export const updateLaboratoryStatus = async (orderId: string, status: LaboratoryStatus, comment?: string) => {
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({ ...order, laboratoryStatus: status, laboratoryComment: comment, laboratoryReadyAt: status === 'result_ready' ? nowDate() : order.laboratoryReadyAt }, `Статус лаборатории изменен: ${status}`, 'status_changed', comment));
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { laboratoryStatus: status, laboratoryComment: comment });
  return data.data;
};

export const requestPrimaryDocument = async (orderId: string, documentName: string, requiredOrComment: boolean | string = true, managerComment = '') => {
  const required = typeof requiredOrComment === 'boolean' ? requiredOrComment : true;
  const comment = typeof requiredOrComment === 'string' ? requiredOrComment : managerComment;
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({
    ...order,
    primaryDocuments: [
      { id: `${orderId}-primary-${Date.now()}`, orderId, name: documentName, required, status: 'need_upload', managerComment: comment, requestedAt: nowDate() },
      ...(order.primaryDocuments || []),
    ],
  }, `Запрошен документ: ${documentName}`, 'document_uploaded', comment));
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/primary-documents`, { name: documentName, required, comment });
  return data.data;
};

export const updatePrimaryDocumentStatus = async (orderId: string, documentId: string, status: ClientPrimaryDocumentStatus, managerComment = '') => {
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({
    ...order,
    primaryDocuments: (order.primaryDocuments || []).map((doc) => doc.id === documentId ? { ...doc, status, managerComment, updatedAt: nowDate() } : doc),
  }, `Статус первичного документа изменен: ${status}`, 'document_uploaded', managerComment));
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/primary-documents/${documentId}`,
    { status, managerComment },
  );
  return data.data;
};

export const updateLaboratoryPrimaryDocumentStatus = async (
  orderId: string,
  documentId: string,
  status: LaboratoryPrimaryDocumentStatus,
  comment?: string,
) => {
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({
    ...order,
    laboratoryPrimaryDocuments: (order.laboratoryPrimaryDocuments || []).map((doc) => doc.id === documentId ? {
      ...doc,
      status,
      employeeComment: comment,
      statusChangedAt: nowDate(),
      statusChangedBy: 'Сотрудник ECOPROGRESS',
      history: [demoHistory(orderId, `Статус документа "${doc.name}" изменен: ${status}`, 'document_uploaded', comment), ...(doc.history || [])],
    } : doc),
  }, `Статус лабораторного документа изменен: ${status}`, 'document_uploaded', comment));
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/primary-documents/${documentId}`,
    { status, comment },
  );
  return data.data;
};

export const saveLaboratoryMeasurementAgreement = async (
  orderId: string,
  payload: Partial<Omit<LaboratoryMeasurementAgreement, 'id' | 'orderId' | 'status'>>,
) => {
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({
    ...order,
    laboratoryMeasurementAgreement: {
      ...(order.laboratoryMeasurementAgreement || {
        id: `LAB-MEASURE-${orderId}`,
        orderId,
        status: 'draft',
      } as LaboratoryMeasurementAgreement),
      ...payload,
      updatedAt: nowDate(),
    },
  }, 'Согласование замера сохранено', 'status_changed', payload.comment));
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/laboratory/measurement`, payload);
  return data.data;
};

export const sendLaboratoryMeasurementAgreement = async (orderId: string) => {
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({
    ...order,
    laboratoryMeasurementAgreement: order.laboratoryMeasurementAgreement ? { ...order.laboratoryMeasurementAgreement, status: 'sent_to_client', sentAt: nowDate() } : undefined,
  }, 'Согласование замера отправлено клиенту', 'client_message_added'));
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/laboratory/measurement/send`);
  return data.data;
};

export const updateLaboratoryMeasurementAgreementStatus = async (
  orderId: string,
  status: LaboratoryMeasurementAgreementStatus,
  comment?: string,
) => {
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({
    ...order,
    laboratoryMeasurementAgreement: order.laboratoryMeasurementAgreement ? {
      ...order.laboratoryMeasurementAgreement,
      status,
      completedAt: status === 'completed' ? nowDate() : order.laboratoryMeasurementAgreement.completedAt,
      comment: comment || order.laboratoryMeasurementAgreement.comment,
    } : undefined,
  }, `Статус замера изменен: ${status}`, 'status_changed', comment));
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/measurement/status`,
    { status, comment },
  );
  return data.data;
};

export const uploadLaboratoryResultDocument = async (
  orderId: string,
  payload: { name: string; section: LaboratoryResultDocument['section']; fileName: string; status?: LaboratoryResultDocumentStatus; comment?: string; quarter?: number },
) => {
  if (isDemoOrderId(orderId)) {
    const document: LaboratoryResultDocument = {
      id: `${orderId}-lab-result-${Date.now()}`,
      orderId,
      name: payload.name,
      section: payload.section,
      quarter: payload.quarter as LaboratoryResultDocument['quarter'],
      fileName: payload.fileName,
      status: payload.status || 'ready',
      comment: payload.comment,
      uploadedAt: nowDate(),
      uploadedBy: 'Лаборатория ECOPROGRESS',
      readyAt: ['ready', 'published_to_client'].includes(payload.status || 'ready') ? nowDate() : undefined,
      publishedAt: payload.status === 'published_to_client' ? nowDate() : undefined,
      publishedBy: payload.status === 'published_to_client' ? 'Лаборатория ECOPROGRESS' : undefined,
      history: [demoHistory(orderId, `Загружен лабораторный документ: ${payload.name}`, 'document_uploaded', payload.comment)],
    };
    const order = updateDemoOrder(orderId, (current) => appendHistory({
      ...current,
      laboratoryResultDocuments: [document, ...(current.laboratoryResultDocuments || [])],
    }, `Загружен лабораторный документ: ${payload.name}`, 'document_uploaded', payload.comment));
    return { order: order as Order, document };
  }
  const { data } = await api.post<{ data: { order: Order; document: LaboratoryResultDocument }; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/results`,
    payload,
  );
  return data.data;
};

export const updateLaboratoryResultDocumentStatus = async (
  orderId: string,
  documentId: string,
  status: LaboratoryResultDocumentStatus,
  comment?: string,
) => {
  if (isDemoOrderId(orderId)) return updateDemoOrder(orderId, (order) => appendHistory({
    ...order,
    laboratoryResultDocuments: (order.laboratoryResultDocuments || []).map((doc) => doc.id === documentId ? {
      ...doc,
      status,
      readyAt: status === 'ready' ? nowDate() : doc.readyAt,
      publishedAt: status === 'published_to_client' ? nowDate() : doc.publishedAt,
      publishedBy: status === 'published_to_client' ? 'Лаборатория ECOPROGRESS' : doc.publishedBy,
      history: [demoHistory(orderId, `Статус документа "${doc.name}" изменен: ${status}`, 'document_uploaded', comment), ...(doc.history || [])],
    } : doc),
  }, `Статус лабораторного результата изменен: ${status}`, 'document_uploaded', comment));
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/results/${documentId}`,
    { status, comment },
  );
  return data.data;
};

export const updateAnnualQuarterWorkStatus = async (orderId: string, quarterId: string, workStatus: QuarterWorkStatus, comment?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/quarters/${quarterId}/work-status`, { workStatus, comment });
  return data.data;
};

export const uploadAnnualQuarterDocument = async (
  orderId: string,
  quarterId: string,
  payload: { fileName: string; fileType: string; fileSize?: number; documentType: QuarterDocument['documentType']; uploadedByName?: string; uploadedByRole?: QuarterDocument['uploadedByRole'] },
) => {
  const { data } = await api.post<{ data: { order: Order; document: QuarterDocument }; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/documents`,
    payload,
  );
  return data.data;
};

export const addAnnualQuarterResult = async (
  orderId: string,
  quarterId: string,
  payload: { title: string; description?: string; resultType?: QuarterResult['resultType']; attachedDocumentIds?: string[]; createdByName?: string },
) => {
  const { data } = await api.post<{ data: { order: Order; result: QuarterResult }; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/results`,
    payload,
  );
  return data.data;
};

export const addAnnualQuarterComment = async (orderId: string, quarterId: string, text: string, visibility: 'client' | 'internal' = 'internal') => {
  const { data } = await api.post<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/comments`,
    { text, visibility },
  );
  return data.data;
};

export const addAnnualQuarterPayment = async (
  orderId: string,
  quarterId: string,
  payload: { amount: number; paidAt?: string; method?: string; comment?: string },
) => {
  const { data } = await api.post<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/payments`,
    payload,
  );
  return data.data;
};

export const completeAnnualRequest = async (orderId: string) => {
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/complete-annual`);
  return data.data;
};

export const getClients = async () => {
  const { data } = await api.get<{ data: unknown[]; message: string | null }>('/clients');
  return data.data;
};
