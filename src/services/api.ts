import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { clients, financeContracts, financeDebts, notifications, paymentRecords, paymentTransactions, services } from '../data/mockData';
import {
  addMockComment,
  addMockDocument,
  addMockQuarterComment,
  addMockQuarterDocument,
  addMockQuarterPayment,
  addMockQuarterResult,
  assignMockOrder,
  completeMockAnnualRequest,
  createMockOrder,
  getMockOrderById,
  getMockOrders,
  getMockQuarters,
  replaceMockOrder,
  requestMockPrimaryDocument,
  saveMockLaboratoryMeasurementAgreement,
  sendMockContractAndInvoice,
  sendMockPrimaryDocumentForReview,
  signMockOrderContract,
  updateMockContract,
  updateMockEcologyStatus,
  updateMockLaboratoryMeasurementAgreementStatus,
  updateMockLaboratoryPrimaryDocumentStatus,
  updateMockLaboratoryResultDocumentStatus,
  updateMockLaboratoryStatus,
  updateMockOrderStatus,
  updateMockPayment,
  updateMockPrimaryDocumentStatus,
  updateMockQuarterWorkStatus,
  uploadMockLaboratoryPrimaryDocument,
  uploadMockLaboratoryResultDocument,
  uploadMockPrimaryDocument,
} from './mockOrderStore';
import type { DocumentItem, Order, OrderStatus } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eco-progress-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (import.meta.env.DEV && token?.startsWith('mock-session')) {
    config.adapter = async (mockConfig) => mockResponse(mockConfig);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) {
      error.message = message;
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('eco-progress-token');
      localStorage.removeItem('eco-progress-user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;

const parsePayload = (data: unknown): Record<string, unknown> => {
  if (!data) return {};
  if (typeof FormData !== 'undefined' && data instanceof FormData) return Object.fromEntries(data.entries());
  if (typeof data === 'string') {
    try { return JSON.parse(data) as Record<string, unknown>; } catch { return {}; }
  }
  if (typeof data === 'object') return data as Record<string, unknown>;
  return {};
};

const fileNameFrom = (value: unknown, fallback: string) => {
  if (value && typeof value === 'object' && 'name' in value) return String((value as { name?: string }).name || fallback);
  return typeof value === 'string' && value ? value : fallback;
};

const boolFrom = (value: unknown) => value === true || value === 'true' || value === 'on' || value === '1';

const ok = <T,>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<{ data: T; message: string | null }> => ({
  data: { data, message: null },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

const mockResponse = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  const method = (config.method || 'get').toLowerCase();
  const url = String(config.url || '').replace(/^\/api/, '');
  const path = url.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  const payload = parsePayload(config.data);

  if (method === 'get' && path === '/services') return ok(config, services);
  if (method === 'get' && parts[0] === 'services' && parts[1]) return ok(config, services.find((service) => service.id === parts[1]));

  if (method === 'get' && path === '/notifications') return ok(config, notifications);
  if (method === 'get' && path === '/clients') return ok(config, clients);
  if (method === 'get' && path === '/staff/calendar') return ok(config, buildMockCalendar());
  if (method === 'get' && path === '/staff/tasks') return ok(config, []);
  if (method === 'post' && path === '/staff/tasks') return ok(config, { id: `TASK-${Date.now()}`, status: 'new', createdAt: new Date().toISOString(), ...payload });

  if (method === 'get' && ['/staff/payments', '/client/payments'].includes(path)) return ok(config, paymentRecords);
  if (method === 'get' && ['/staff/contracts', '/client/contracts'].includes(path)) return ok(config, financeContracts);
  if (method === 'get' && ['/staff/debts', '/client/debts'].includes(path)) return ok(config, financeDebts);
  if (method === 'get' && path === '/staff/payment-transactions') return ok(config, paymentTransactions);

  if (parts[1] === 'payments' && method !== 'get') {
    const paymentId = parts[2];
    const record = paymentRecords.find((item) => item.id === paymentId);
    const requestId = String(record?.requestId || paymentId || '');
    const order = getMockOrderById(requestId);
    if (parts[3] === 'partial' && method === 'post') {
      const amount = Number(payload.amount || 0);
      return ok(config, updateMockPayment(requestId, 'partial' as never, {
        totalAmount: order?.totalAmount || order?.contractAmount || record?.totalAmount || 0,
        paidAmount: (order?.paidAmount || 0) + amount,
        method: payload.method ? String(payload.method) : undefined,
        comment: payload.comment ? String(payload.comment) : undefined,
      }));
    }
    if (parts[3] === 'mark-paid' && method === 'post') {
      const total = order?.totalAmount || order?.contractAmount || record?.totalAmount || 0;
      return ok(config, updateMockPayment(requestId, 'paid' as never, {
        totalAmount: total,
        paidAmount: total,
        method: order?.paymentMethod || record?.paymentMethod,
        comment: 'Оплата закрыта полностью',
      }));
    }
    return ok(config, paymentRecords[0]);
  }
  if (parts[1] === 'debts' && method !== 'get') return ok(config, financeDebts[0]);

  if ((parts[0] === 'staff' || parts[0] === 'client') && parts[1] === 'orders') {
    const scope = parts[0];
    const orderId = parts[2];

    if (!orderId && method === 'get') return ok(config, getMockOrders());
    if (!orderId && method === 'post') return ok(config, createOrderFromPayload(payload));
    if (orderId && method === 'get' && parts.length === 3) return ok(config, getMockOrderById(orderId));

    if (orderId && parts[3] === 'comments' && method === 'post') {
      return ok(config, addMockComment(orderId, String(payload.text || ''), (payload.visibility as 'client' | 'internal') || 'client'));
    }

    if (orderId && parts[3] === 'documents') {
      if (parts[5] === 'send-to-client' && method === 'post') return ok(config, buildCrmDocument(orderId, parts[4], payload));
      if (method === 'post') return ok(config, addMockDocument(orderId, fileNameFrom(payload.file, String(payload.title || 'Документ.pdf')), documentTypeFrom(payload.type), {
        sentToClient: boolFrom(payload.sendToClient),
        needsSignature: boolFrom(payload.needsSignature),
        needsClientResponse: boolFrom(payload.needsClientResponse),
        staffComment: payload.comment ? String(payload.comment) : undefined,
        dueDate: payload.dueDate ? String(payload.dueDate) : undefined,
      }));
    }

    if (scope === 'client' && orderId && parts[3] === 'contract' && parts[4] === 'sign' && method === 'post') {
      return ok(config, signMockOrderContract(orderId, String(payload.signatureProvider || payload.provider || 'NCALayer')));
    }

    if (scope === 'client' && orderId && parts[3] === 'pay' && method === 'post') {
      return ok(config, updateMockPayment(orderId, 'paid', { method: String(payload.paymentMethod || payload.method || 'bank_transfer'), paidAmount: getMockOrderById(orderId)?.totalAmount }));
    }

    if (scope === 'staff' && orderId && parts[3] === 'assign' && method === 'patch') {
      return ok(config, assignMockOrder(orderId, String(payload.role || 'manager'), payload.userId ? String(payload.userId) : undefined));
    }

    if (scope === 'staff' && orderId && parts[3] === 'status' && method === 'patch') {
      const next = updateByStatusPayload(orderId, payload);
      return ok(config, next);
    }

    if (scope === 'staff' && orderId && parts[3] === 'ecology-status' && method === 'patch') {
      return ok(config, updateMockEcologyStatus(orderId, String(payload.ecologyStatus || 'in_progress') as never, payload.comment ? String(payload.comment) : undefined));
    }

    if (scope === 'staff' && orderId && parts[3] === 'laboratory-status' && method === 'patch') {
      return ok(config, updateMockLaboratoryStatus(orderId, String(payload.laboratoryStatus || 'analysis_in_progress') as never, payload.comment ? String(payload.comment) : undefined));
    }

    if (scope === 'staff' && orderId && parts[3] === 'payment' && method === 'patch') {
      return ok(config, updateMockPayment(orderId, String(payload.paymentStatus || 'pending') as never, {
        method: payload.paymentMethod ? String(payload.paymentMethod) : undefined,
        totalAmount: payload.totalAmount ? String(payload.totalAmount) : undefined,
        paidAmount: payload.paidAmount ? String(payload.paidAmount) : undefined,
        paidAt: payload.paidAt ? String(payload.paidAt) : undefined,
        comment: payload.comment ? String(payload.comment) : undefined,
        invoiceNumber: payload.invoiceNumber ? String(payload.invoiceNumber) : undefined,
        invoiceFileName: payload.invoiceFileName ? String(payload.invoiceFileName) : undefined,
        invoiceDate: payload.invoiceDate ? String(payload.invoiceDate) : undefined,
        dueDate: payload.dueDate ? String(payload.dueDate) : undefined,
      }));
    }

    if (scope === 'staff' && orderId && parts[3] === 'contract-and-invoice' && method === 'post') {
      return ok(config, sendMockContractAndInvoice(orderId, {
        amount: String(payload.amount || payload.totalAmount || '0'),
        paymentMethod: payload.paymentMethod ? String(payload.paymentMethod) : undefined,
        signatureProvider: payload.signatureProvider ? String(payload.signatureProvider) : undefined,
        contractFileName: payload.contractFileName ? String(payload.contractFileName) : undefined,
        contractPeriodStart: payload.contractPeriodStart ? String(payload.contractPeriodStart) : undefined,
        contractPeriodEnd: payload.contractPeriodEnd ? String(payload.contractPeriodEnd) : undefined,
        contractServiceNote: payload.contractServiceNote ? String(payload.contractServiceNote) : undefined,
        contractNote: payload.contractNote ? String(payload.contractNote) : undefined,
      }));
    }

    if (scope === 'staff' && orderId && parts[3] === 'contract-status' && method === 'patch') {
      return ok(config, updateMockContract(orderId, String(payload.crmContractStatus || payload.status || 'prepared'), payload.comment ? String(payload.comment) : undefined));
    }

    if (orderId && parts[3] === 'primary-documents') {
      const documentId = parts[4];
      if (!documentId && method === 'post') return ok(config, requestMockPrimaryDocument(orderId, String(payload.name || 'Документ'), Boolean(payload.required ?? true), String(payload.comment || '')));
      if (documentId && parts[5] === 'upload' && method === 'post') return ok(config, uploadMockPrimaryDocument(orderId, documentId, fileNameFrom(payload.file, 'Документ.pdf'), String(payload.comment || payload.clientComment || '')));
      if (documentId && parts[5] === 'review' && method === 'post') return ok(config, sendMockPrimaryDocumentForReview(orderId, documentId, String(payload.clientComment || '')));
      if (documentId && method === 'patch') return ok(config, updateMockPrimaryDocumentStatus(orderId, documentId, String(payload.status || 'in_review'), String(payload.managerComment || '')));
      if (documentId && method === 'delete') return ok(config, replaceMockOrder(orderId, (order) => ({
        ...order,
        primaryDocuments: (order.primaryDocuments ?? []).map((doc) => doc.id === documentId ? { ...doc, status: 'need_upload' as never, fileName: undefined, uploadedAt: undefined } : doc),
      })));
      if (parts[4] === 'review' && method === 'post') return ok(config, replaceMockOrder(orderId, (order) => ({
        ...order,
        primaryDocuments: (order.primaryDocuments ?? []).map((doc) => ['sent', 'uploaded', 'needs_fix'].includes(doc.status) ? { ...doc, status: 'in_review' as never, clientComment: String(payload.clientComment || '') } : doc),
      })));
    }

    if (orderId && parts[3] === 'laboratory') {
      if (parts[4] === 'primary-documents' && parts[5]) {
        if (scope === 'client' && method === 'post') return ok(config, uploadMockLaboratoryPrimaryDocument(orderId, parts[5], String(payload.fileName || 'Лабораторный документ.pdf')));
        if (scope === 'staff' && method === 'patch') return ok(config, updateMockLaboratoryPrimaryDocumentStatus(orderId, parts[5], String(payload.status || 'in_review') as never, payload.comment ? String(payload.comment) : undefined));
      }
      if (parts[4] === 'measurement') {
        if (method === 'patch' && parts.length === 5) return ok(config, saveMockLaboratoryMeasurementAgreement(orderId, payload));
        if (method === 'post' && parts[5] === 'send') return ok(config, updateMockLaboratoryMeasurementAgreementStatus(orderId, 'sent_to_client'));
        if (method === 'patch' && parts[5] === 'status') return ok(config, updateMockLaboratoryMeasurementAgreementStatus(orderId, String(payload.status || 'confirmed') as never, payload.comment ? String(payload.comment) : undefined));
        if (method === 'post' && parts[5] === 'respond') {
          const responseStatus = payload.status === 'rescheduled' || payload.action === 'reschedule' ? 'reschedule_requested' : 'accepted_by_client';
          return ok(config, updateMockLaboratoryMeasurementAgreementStatus(orderId, responseStatus, payload.comment ? String(payload.comment) : undefined)?.laboratoryMeasurementAgreement);
        }
      }
      if (parts[4] === 'results') {
        if (method === 'post' && !parts[5]) return ok(config, uploadMockLaboratoryResultDocument(orderId, {
          name: String(payload.name || 'Результат.pdf'),
          section: String(payload.section || 'protocol') as never,
          fileName: String(payload.fileName || payload.name || 'Результат.pdf'),
          status: payload.status ? String(payload.status) as never : undefined,
          comment: payload.comment ? String(payload.comment) : undefined,
          quarter: payload.quarter ? Number(payload.quarter) : undefined,
        }));
        if (method === 'patch' && parts[5]) return ok(config, updateMockLaboratoryResultDocumentStatus(orderId, parts[5], String(payload.status || 'ready') as never, payload.comment ? String(payload.comment) : undefined));
      }
    }

    if (orderId && parts[3] === 'quarters') {
      const quarterId = parts[4];
      if (!quarterId && method === 'get') return ok(config, getMockQuarters(orderId));
      if (quarterId && method === 'get' && parts.length === 5) return ok(config, getMockQuarters(orderId).find((quarter) => quarter.id === quarterId));
      if (quarterId && parts[5] === 'work-status' && method === 'patch') return ok(config, updateMockQuarterWorkStatus(orderId, quarterId, String(payload.workStatus || 'in_progress') as never, payload.comment ? String(payload.comment) : undefined));
      if (quarterId && parts[5] === 'documents' && method === 'post') return ok(config, addMockQuarterDocument(orderId, quarterId, {
        fileName: fileNameFrom(payload.file, String(payload.fileName || 'Документ квартала.pdf')),
        fileType: String(payload.fileType || 'application/pdf'),
        fileSize: payload.fileSize ? Number(payload.fileSize) : undefined,
        documentType: String(payload.documentType || payload.type || 'client_data') as never,
        uploadedByName: payload.uploadedByName ? String(payload.uploadedByName) : undefined,
        uploadedByRole: payload.uploadedByRole ? String(payload.uploadedByRole) as never : undefined,
      }));
      if (quarterId && parts[5] === 'results' && method === 'post') return ok(config, addMockQuarterResult(orderId, quarterId, {
        title: String(payload.title || 'Результат квартала'),
        description: payload.description ? String(payload.description) : undefined,
        resultType: payload.resultType ? String(payload.resultType) as never : undefined,
        attachedDocumentIds: Array.isArray(payload.attachedDocumentIds) ? payload.attachedDocumentIds.map(String) : [],
        createdByName: payload.createdByName ? String(payload.createdByName) : undefined,
      }));
      if (quarterId && parts[5] === 'comments' && method === 'post') return ok(config, addMockQuarterComment(orderId, quarterId, String(payload.text || ''), String(payload.visibility || 'client') as never));
      if (quarterId && parts[5] === 'payments' && method === 'post') return ok(config, addMockQuarterPayment(orderId, quarterId, {
        amount: Number(payload.amount || 0),
        paidAt: payload.paidAt ? String(payload.paidAt) : undefined,
        method: payload.method ? String(payload.method) : undefined,
        comment: payload.comment ? String(payload.comment) : undefined,
      }));
    }

    if (scope === 'staff' && orderId && parts[3] === 'complete-annual' && method === 'post') return ok(config, completeMockAnnualRequest(orderId));

    if (scope === 'staff' && orderId && parts[3] === 'commercial-offers' && method === 'post') return ok(config, {
      id: `CO-${Date.now()}`,
      orderId,
      amount: Number(payload.amount || 0),
      deadline: String(payload.deadline || ''),
      status: String(payload.status || 'preparing'),
      comment: payload.comment ? String(payload.comment) : undefined,
      createdBy: 'Local demo',
      createdAt: new Date().toISOString(),
    });

    if (scope === 'staff' && orderId && parts[3] === 'invoice-payment' && method === 'post') return ok(config, {
      id: `INV-PAY-${Date.now()}`,
      orderId,
      invoiceStatus: 'invoice_created',
      paymentStatus: 'awaiting_payment',
      ...payload,
    });

    if (scope === 'staff' && orderId && parts[3] === 'waste-removal' && method === 'post') return ok(config, {
      id: `WASTE-${Date.now()}`,
      orderId,
      status: String(payload.status || 'data_check'),
      ...payload,
    });
  }

  return ok(config, null);
};

const documentTypeFrom = (type: unknown): DocumentItem['type'] => {
  const raw = String(type || 'client');
  if (raw === 'invoice') return 'invoice';
  if (raw === 'result' || raw === 'protocol' || raw === 'work_result') return 'result';
  if (raw === 'internal') return 'internal';
  return 'client';
};

const createOrderFromPayload = (payload: Record<string, unknown>) => createMockOrder({
  clientId: String(payload.clientId || 'client-1'),
  clientType: 'company',
  clientName: String(payload.clientName || payload.contactPerson || 'Demo Client'),
  companyName: String(payload.companyName || 'ТОО "Demo Client Eco"'),
  bin: String(payload.bin || '000000000000'),
  organizationType: 'ТОО',
  legalAddress: String(payload.legalAddress || ''),
  objectAddress: payload.objectAddress ? String(payload.objectAddress) : undefined,
  contactPerson: String(payload.contactPerson || payload.clientName || 'Demo Client'),
  phone: String(payload.phone || '+7 700 000 00 00'),
  whatsapp: payload.whatsapp ? String(payload.whatsapp) : undefined,
  email: String(payload.email || 'client@demo.kz'),
  serviceId: String(payload.serviceId || 'complex-eco-support'),
  service: String(payload.service || payload.serviceName || 'Комплексное экологическое сопровождение'),
  urgency: String(payload.urgency || 'Планово'),
  comment: String(payload.comment || ''),
  businessCompanyId: payload.businessCompanyId ? String(payload.businessCompanyId) : 'eco-docs',
  contractType: payload.contractType === 'annual_quarterly' ? 'annual_quarterly' : 'one_time',
});

const updateByStatusPayload = (orderId: string, payload: Record<string, unknown>) => {
  if (payload.status) return updateMockOrderStatus(orderId, mockOrderStatusFromBackend(String(payload.status)));
  if (payload.paymentStatus) return updateMockPayment(orderId, String(payload.paymentStatus) as never, payload);
  if (payload.ecologyStatus) return updateMockEcologyStatus(orderId, String(payload.ecologyStatus) as never, payload.ecologyComment ? String(payload.ecologyComment) : undefined);
  if (payload.laboratoryStatus) return updateMockLaboratoryStatus(orderId, String(payload.laboratoryStatus) as never, payload.laboratoryComment ? String(payload.laboratoryComment) : undefined);
  return getMockOrderById(orderId);
};

const mockOrderStatusFromBackend = (status: string): OrderStatus => {
  const map: Record<string, OrderStatus> = {
    CONSULTATION: 'Консультация',
    ANALYSIS: 'Анализ',
    COMMERCIAL_PROPOSAL: 'КП',
    CONTRACT: 'Договор',
    INVOICE: 'Счет на оплату',
    DESIGN: 'Проектирование',
    LABORATORY: 'Лаборатория',
    WASTE_REMOVAL: 'Вывоз',
    UTILIZATION: 'Утилизация',
    QUALITY_CHECK: 'Проверка результата',
    READY: 'Готово',
    COMPLETED: 'Завершено',
    CANCELLED: 'Отменено',
    ANNUAL_ACTIVE: 'annual_active',
  };
  return map[status] || status as OrderStatus;
};

const buildCrmDocument = (orderId: string, documentId: string, payload: Record<string, unknown>) => ({
  id: documentId,
  orderId,
  clientId: getMockOrderById(orderId)?.clientId || 'client-1',
  title: String(payload.title || 'Документ клиенту'),
  type: 'other',
  status: 'sent_to_client',
  needsSignature: boolFrom(payload.needsSignature),
  needsClientResponse: boolFrom(payload.needsClientResponse),
  sentToClient: true,
  staffComment: payload.comment ? String(payload.comment) : undefined,
  dueDate: payload.dueDate ? String(payload.dueDate) : undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const buildMockCalendar = () => getMockOrders()
  .flatMap((order: Order) => order.laboratoryMeasurementAgreement ? [{
    id: `${order.id}-measurement`,
    orderId: order.id,
    type: 'laboratory',
    title: `Замер: ${order.service}`,
    date: order.laboratoryMeasurementAgreement.measurementDate,
    time: order.laboratoryMeasurementAgreement.measurementTime,
    address: order.laboratoryMeasurementAgreement.address,
    contactPerson: order.laboratoryMeasurementAgreement.contactPerson,
    measurementType: order.laboratoryMeasurementAgreement.measurementScope,
    status: 'planned',
  }] : []);

export type ApiResponse<T> = {
  data: T;
  message: string | null;
};

export async function fetcher<T>(url: string): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(url);
  return data.data;
}
