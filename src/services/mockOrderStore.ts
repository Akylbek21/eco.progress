import { orders as seedOrders } from '../data/mockData';
import type {
  ClientPrimaryDocumentStatus,
  CommentItem,
  DocumentItem,
  EcologyStatus,
  LaboratoryMeasurementAgreement,
  LaboratoryMeasurementAgreementStatus,
  LaboratoryPrimaryDocumentStatus,
  LaboratoryResultDocument,
  LaboratoryResultDocumentStatus,
  LaboratoryStatus,
  Order,
  OrderHistoryItem,
  OrderPrimaryDocument,
  OrderStatus,
  PaymentStatus,
  QuarterDocument,
  QuarterResult,
  QuarterWorkStatus,
  RequestQuarter,
  StaffContractStatus,
} from '../types';

let mockOrders: Order[] = seedOrders.map((order) => structuredClone(order));

const stamp = () => new Date().toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

const findOrder = (orderId: string) => mockOrders.find((order) => order.id === orderId);

const addHistory = (order: Order, text: string, actionType?: OrderHistoryItem['actionType']): Order => ({
  ...order,
  updatedAt: stamp(),
  history: [
    {
      id: id('H-DEMO'),
      orderId: order.id,
      text,
      actionType,
      actor: 'Local demo',
      actorName: 'Local demo',
      createdAt: stamp(),
    },
    ...order.history,
  ],
});

export const getMockOrders = () => mockOrders;

export const getMockOrderById = (orderId: string) => findOrder(orderId);

export const replaceMockOrder = (orderId: string, updater: (order: Order) => Order): Order | undefined => {
  const current = findOrder(orderId);
  if (!current) return undefined;
  const next = updater(current);
  mockOrders = mockOrders.map((order) => (order.id === orderId ? next : order));
  return next;
};

export const createMockOrder = (payload: Partial<Order>): Order => {
  const base = mockOrders[0];
  const order: Order = {
    ...structuredClone(base),
    ...payload,
    id: id('ORD-DEMO-NEW'),
    createdAt: stamp(),
    updatedAt: stamp(),
    status: 'Новая заявка',
    documents: payload.documents ?? [],
    resultDocuments: payload.resultDocuments ?? [],
    comments: [],
    history: [],
  };
  mockOrders = [order, ...mockOrders];
  return order;
};

export const updateMockOrderStatus = (orderId: string, status: OrderStatus) =>
  replaceMockOrder(orderId, (order) => addHistory({ ...order, status }, `Status changed to ${status}`, 'status_changed'));

export const assignMockOrder = (orderId: string, role: string, userId?: string) =>
  replaceMockOrder(orderId, (order) => {
    const fieldByRole: Record<string, keyof Order> = {
      manager: 'assignedManagerId',
      accountant: 'assignedAccountantId',
      ecologist: 'assignedEcologistId',
      laboratory: 'assignedLaboratoryId',
    };
    const key = fieldByRole[role.toLowerCase()];
    return addHistory(key ? { ...order, [key]: userId } : order, `Assigned ${role}`, 'manager_assigned');
  });

export const addMockComment = (orderId: string, text: string, visibility: 'client' | 'internal', author = 'Local demo'): CommentItem => {
  const comment: CommentItem = { id: id('COM-DEMO'), orderId, author, text, visibility, createdAt: stamp() };
  replaceMockOrder(orderId, (order) => addHistory({ ...order, comments: [comment, ...order.comments] }, 'Comment added', visibility === 'internal' ? 'internal_note_added' : 'client_message_added'));
  return comment;
};

export const addMockDocument = (orderId: string, fileName: string, type: DocumentItem['type'] = 'client'): DocumentItem => {
  const document: DocumentItem = { id: id('DOC-DEMO'), orderId, name: fileName, type, uploadedAt: stamp(), status: 'uploaded' };
  replaceMockOrder(orderId, (order) => {
    const resultDocuments = type === 'result' || type === 'invoice' ? [document, ...order.resultDocuments] : order.resultDocuments;
    const documents = type === 'result' || type === 'invoice' ? order.documents : [document, ...order.documents];
    return addHistory({ ...order, documents, resultDocuments }, `Document uploaded: ${fileName}`, 'document_uploaded');
  });
  return document;
};

export const signMockOrderContract = (orderId: string, provider: string) =>
  replaceMockOrder(orderId, (order) => addHistory({ ...order, contractStatus: 'signed', crmContractStatus: 'signed', signatureProvider: provider, signedAt: stamp() }, 'Contract signed', 'contract_updated'));

export const payMockOrderOnline = (orderId: string, method: string) =>
  replaceMockOrder(orderId, (order) => {
    const total = order.totalAmount ?? order.contractAmount ?? order.offerAmount ?? 0;
    return addHistory({
      ...order,
      paymentStatus: 'paid',
      paymentMethod: method,
      paidAmount: total,
      remainingAmount: 0,
      paidAt: stamp(),
    }, 'Payment completed', 'payment_changed');
  });

export const updateMockContract = (orderId: string, status: StaffContractStatus | string, comment?: string) =>
  replaceMockOrder(orderId, (order) => addHistory({ ...order, crmContractStatus: status as StaffContractStatus, paymentComment: comment ?? order.paymentComment }, `Contract status changed to ${status}`, 'contract_updated'));

export const sendMockContractAndInvoice = (
  orderId: string,
  payload: { amount: string; paymentMethod?: string; signatureProvider?: string; contractFileName?: string; contractPeriodStart?: string; contractPeriodEnd?: string; contractServiceNote?: string; contractNote?: string },
) =>
  replaceMockOrder(orderId, (order) => {
    const amount = Number(payload.amount.replace(/\D/g, '')) || order.totalAmount || 0;
    const contractDoc: DocumentItem = {
      id: id('DOC-DEMO-CONTRACT'),
      orderId,
      name: payload.contractFileName || `Contract ${orderId}.pdf`,
      type: 'result',
      uploadedAt: stamp(),
      status: 'sent',
    };
    const invoiceDoc: DocumentItem = {
      id: id('DOC-DEMO-INVOICE'),
      orderId,
      name: order.invoiceFileName || `Invoice ${orderId}.pdf`,
      type: 'invoice',
      uploadedAt: stamp(),
      status: 'sent',
    };
    return addHistory({
      ...order,
      crmContractStatus: 'sent_to_client',
      contractStatus: 'sent',
      paymentMethod: payload.paymentMethod ?? order.paymentMethod,
      signatureProvider: payload.signatureProvider ?? order.signatureProvider,
      contractFileName: payload.contractFileName ?? order.contractFileName,
      contractPeriodStart: payload.contractPeriodStart ?? order.contractPeriodStart,
      contractPeriodEnd: payload.contractPeriodEnd ?? order.contractPeriodEnd,
      contractServiceNote: payload.contractServiceNote ?? order.contractServiceNote,
      contractNote: payload.contractNote ?? order.contractNote,
      totalAmount: amount,
      contractAmount: amount,
      remainingAmount: amount - (order.paidAmount ?? 0),
      resultDocuments: [contractDoc, invoiceDoc, ...order.resultDocuments],
    }, 'Contract and invoice sent', 'contract_updated');
  });

export const updateMockPayment = (orderId: string, status: PaymentStatus, payload: { paidAmount?: string | number; totalAmount?: string | number; amount?: string; paidAt?: string; comment?: string; method?: string; invoiceFileName?: string; paymentTerms?: Order['paymentTerms']; minPrepaymentPercent?: string | number } = {}) =>
  replaceMockOrder(orderId, (order) => {
    const parseMoney = (value: string | number | undefined, fallback: number) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return Number(value.replace(/\D/g, '')) || fallback;
      return fallback;
    };
    const total = parseMoney(payload.totalAmount, order.totalAmount ?? order.contractAmount ?? 0);
    const paid = parseMoney(payload.paidAmount ?? payload.amount, order.paidAmount ?? 0);
    const remaining = Math.max(total - paid, 0);
    return addHistory({
      ...order,
      paymentStatus: status,
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: remaining,
      paymentMethod: payload.method ?? order.paymentMethod,
      paidAt: payload.paidAt ?? order.paidAt,
      invoiceFileName: payload.invoiceFileName ?? order.invoiceFileName,
      paymentTerms: payload.paymentTerms ?? order.paymentTerms,
      minPrepaymentPercent: payload.minPrepaymentPercent !== undefined ? Number(payload.minPrepaymentPercent) : order.minPrepaymentPercent,
      accountantComment: payload.comment ?? order.accountantComment,
      paymentHistory: [
        {
          id: id('PAY-H-DEMO'),
          orderId,
          totalAmount: total,
          paidAmount: paid,
          remainingAmount: remaining,
          paymentPercent: total ? Math.round((paid / total) * 100) : 0,
          paymentDate: payload.paidAt ?? stamp(),
          status,
          comment: payload.comment,
          createdAt: stamp(),
          createdBy: 'Local demo',
        },
        ...(order.paymentHistory ?? []),
      ],
    }, 'Payment status changed', 'payment_changed');
  });

export const updateMockEcologyStatus = (orderId: string, status: EcologyStatus, comment?: string) =>
  replaceMockOrder(orderId, (order) => addHistory({ ...order, ecologyStatus: status, ecologyComment: comment ?? order.ecologyComment }, `Ecology status changed to ${status}`, 'status_changed'));

export const updateMockLaboratoryStatus = (orderId: string, status: LaboratoryStatus, comment?: string) =>
  replaceMockOrder(orderId, (order) => addHistory({ ...order, laboratoryStatus: status, laboratoryComment: comment ?? order.laboratoryComment }, `Laboratory status changed to ${status}`, 'status_changed'));

export const requestMockPrimaryDocument = (orderId: string, name: string, required: boolean, managerComment = '') =>
  replaceMockOrder(orderId, (order) => addHistory({
    ...order,
    primaryDocuments: [
      { id: id('PD-DEMO'), orderId, name, required, status: 'need_upload', managerComment, requestedAt: stamp() },
      ...(order.primaryDocuments ?? []),
    ],
  }, `Primary document requested: ${name}`, 'document_uploaded'));

export const updateMockPrimaryDocumentStatus = (orderId: string, documentId: string, status: ClientPrimaryDocumentStatus, managerComment = '') =>
  replaceMockOrder(orderId, (order) => addHistory({
    ...order,
    primaryDocuments: (order.primaryDocuments ?? []).map((document) => (document.id === documentId ? { ...document, status, managerComment, updatedAt: stamp() } : document)),
  }, 'Primary document status changed', 'status_changed'));

export const uploadMockPrimaryDocument = (orderId: string, documentId: string, fileName: string, clientComment = ''): OrderPrimaryDocument | undefined => {
  let updatedDocument: OrderPrimaryDocument | undefined;
  replaceMockOrder(orderId, (order) => {
    const primaryDocuments = (order.primaryDocuments ?? []).map((document) => {
      if (document.id !== documentId) return document;
      updatedDocument = { ...document, status: 'sent', fileName, clientComment, uploadedAt: stamp(), updatedAt: stamp() };
      return updatedDocument;
    });
    return addHistory({ ...order, primaryDocuments }, `Primary document uploaded: ${fileName}`, 'document_uploaded');
  });
  return updatedDocument;
};

export const updateMockLaboratoryPrimaryDocumentStatus = (orderId: string, documentId: string, status: LaboratoryPrimaryDocumentStatus, comment?: string) =>
  replaceMockOrder(orderId, (order) => addHistory({
    ...order,
    laboratoryPrimaryDocuments: (order.laboratoryPrimaryDocuments ?? []).map((document) => (document.id === documentId ? { ...document, status, employeeComment: comment ?? document.employeeComment, statusChangedAt: stamp(), statusChangedBy: 'Local demo' } : document)),
  }, 'Laboratory document status changed', 'status_changed'));

export const uploadMockLaboratoryPrimaryDocument = (orderId: string, documentId: string, fileName: string) => {
  let updatedDocument;
  const order = replaceMockOrder(orderId, (current) => {
    const laboratoryPrimaryDocuments = (current.laboratoryPrimaryDocuments ?? []).map((document) => {
      if (document.id !== documentId) return document;
      updatedDocument = { ...document, status: 'uploaded' as const, fileName, uploadedAt: stamp(), uploadedBy: 'Client' };
      return updatedDocument;
    });
    return addHistory({ ...current, laboratoryPrimaryDocuments }, `Laboratory document uploaded: ${fileName}`, 'document_uploaded');
  });
  return { order, document: updatedDocument };
};

export const saveMockLaboratoryMeasurementAgreement = (orderId: string, payload: Partial<Omit<LaboratoryMeasurementAgreement, 'id' | 'orderId' | 'status'>>) =>
  replaceMockOrder(orderId, (order) => addHistory({
    ...order,
    laboratoryMeasurementAgreement: {
      id: `LAB-MEASURE-${orderId}`,
      orderId,
      measurementDate: '',
      measurementTime: '',
      address: '',
      companyName: order.businessCompanyName ?? '',
      contactPerson: order.contactPerson,
      phone: order.phone,
      measurementScope: '',
      comment: '',
      status: 'draft',
      ...(order.laboratoryMeasurementAgreement ?? {}),
      ...payload,
      updatedAt: stamp(),
    },
  }, 'Laboratory measurement agreement saved', 'status_changed'));

export const updateMockLaboratoryMeasurementAgreementStatus = (orderId: string, status: LaboratoryMeasurementAgreementStatus, comment?: string) =>
  replaceMockOrder(orderId, (order) => addHistory({
    ...order,
    laboratoryMeasurementAgreement: order.laboratoryMeasurementAgreement ? { ...order.laboratoryMeasurementAgreement, status, comment: comment ?? order.laboratoryMeasurementAgreement.comment, updatedAt: stamp() } : undefined,
  }, `Laboratory measurement status changed to ${status}`, 'status_changed'));

export const uploadMockLaboratoryResultDocument = (orderId: string, payload: { name: string; section: LaboratoryResultDocument['section']; fileName: string; status?: LaboratoryResultDocumentStatus; comment?: string; quarter?: number }) => {
  let document: LaboratoryResultDocument;
  const order = replaceMockOrder(orderId, (current) => {
    document = {
      id: id('LAB-RES-DEMO'),
      orderId,
      name: payload.name,
      section: payload.section,
      quarter: payload.quarter as LaboratoryResultDocument['quarter'],
      status: payload.status ?? 'ready',
      fileName: payload.fileName,
      uploadedAt: stamp(),
      readyAt: stamp(),
      uploadedBy: 'Local demo',
      comment: payload.comment,
      history: [],
    };
    return addHistory({ ...current, laboratoryResultDocuments: [document, ...(current.laboratoryResultDocuments ?? [])] }, 'Laboratory result uploaded', 'document_ready');
  });
  return { order, document: document! };
};

export const updateMockLaboratoryResultDocumentStatus = (orderId: string, documentId: string, status: LaboratoryResultDocumentStatus, comment?: string) =>
  replaceMockOrder(orderId, (order) => addHistory({
    ...order,
    laboratoryResultDocuments: (order.laboratoryResultDocuments ?? []).map((document) => (document.id === documentId ? { ...document, status, comment: comment ?? document.comment } : document)),
  }, 'Laboratory result status changed', 'status_changed'));

export const getMockQuarters = (orderId: string): RequestQuarter[] => findOrder(orderId)?.quarters ?? [];

export const updateMockQuarter = (orderId: string, quarterId: string, updater: (quarter: RequestQuarter) => RequestQuarter) =>
  replaceMockOrder(orderId, (order) => addHistory({
    ...order,
    quarters: (order.quarters ?? []).map((quarter) => (quarter.id === quarterId ? updater(quarter) : quarter)),
  }, 'Quarter updated', 'status_changed'));

export const updateMockQuarterWorkStatus = (orderId: string, quarterId: string, workStatus: QuarterWorkStatus, comment?: string) =>
  updateMockQuarter(orderId, quarterId, (quarter) => ({ ...quarter, workStatus, comment, updatedAt: stamp() }));

export const addMockQuarterDocument = (orderId: string, quarterId: string, payload: { fileName: string; fileType: string; fileSize?: number; documentType: QuarterDocument['documentType']; uploadedByName?: string; uploadedByRole?: QuarterDocument['uploadedByRole'] }) => {
  let document: QuarterDocument;
  const order = updateMockQuarter(orderId, quarterId, (quarter) => {
    document = {
      id: id('QDOC-DEMO'),
      quarterId,
      requestId: orderId,
      contractId: quarter.contractId,
      name: payload.fileName,
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileSize: payload.fileSize,
      documentType: payload.documentType,
      uploadedByRole: payload.uploadedByRole ?? 'employee',
      uploadedByName: payload.uploadedByName ?? 'Local demo',
      uploadedAt: stamp(),
    };
    return { ...quarter, documents: [document, ...quarter.documents], updatedAt: stamp() };
  });
  return { order, document: document! };
};

export const addMockQuarterResult = (orderId: string, quarterId: string, payload: { title: string; description?: string; resultType?: QuarterResult['resultType']; attachedDocumentIds?: string[]; createdByName?: string }) => {
  let result: QuarterResult;
  const order = updateMockQuarter(orderId, quarterId, (quarter) => {
    result = {
      id: id('QRES-DEMO'),
      quarterId,
      requestId: orderId,
      title: payload.title,
      description: payload.description,
      resultType: payload.resultType ?? 'other',
      attachedDocumentIds: payload.attachedDocumentIds ?? [],
      createdByName: payload.createdByName ?? 'Local demo',
      createdAt: stamp(),
    };
    return { ...quarter, results: [result, ...quarter.results], updatedAt: stamp() };
  });
  return { order, result: result! };
};

export const addMockQuarterComment = (orderId: string, quarterId: string, text: string, visibility: 'client' | 'internal') =>
  updateMockQuarter(orderId, quarterId, (quarter) => ({
    ...quarter,
    comments: [{ id: id('QCOM-DEMO'), quarterId, requestId: orderId, author: 'Local demo', text, visibility, createdAt: stamp() }, ...quarter.comments],
    updatedAt: stamp(),
  }));

export const addMockQuarterPayment = (orderId: string, quarterId: string, payload: { amount: number; paidAt?: string; method?: string; comment?: string }) =>
  updateMockQuarter(orderId, quarterId, (quarter) => {
    const paidAmount = quarter.paidAmount + payload.amount;
    const remainingAmount = Math.max(quarter.plannedAmount - paidAmount, 0);
    return {
      ...quarter,
      paidAmount,
      remainingAmount,
      paymentStatus: remainingAmount === 0 ? 'paid' : 'partial',
      lastPaymentDate: payload.paidAt ?? stamp(),
      updatedAt: stamp(),
    };
  });

export const completeMockAnnualRequest = (orderId: string) =>
  replaceMockOrder(orderId, (order) => addHistory({
    ...order,
    status: 'Завершено',
    quarters: (order.quarters ?? []).map((quarter) => ({ ...quarter, workStatus: 'completed', remainingAmount: 0, paymentStatus: 'paid' })),
  }, 'Annual request completed', 'status_changed'));
