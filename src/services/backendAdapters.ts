import type {
  CommentItem,
  DocumentItem,
  Order,
  OrderHistoryItem,
  RequestQuarter,
} from '../types';

type AnyRecord = Record<string, any>;

const asString = (value: unknown, fallback = '') => (value === undefined || value === null ? fallback : String(value));

const mapDocumentType = (type: unknown): DocumentItem['type'] => {
  const raw = asString(type, 'client');
  if (raw === 'invoice') return 'invoice';
  if (['result', 'contract', 'act'].includes(raw)) return 'result';
  if (raw === 'internal') return 'internal';
  return 'client';
};

export const mapDocument = (doc: AnyRecord = {}, orderId?: string): DocumentItem => ({
  id: asString(doc.id || doc.documentId),
  orderId,
  name: asString(doc.name || doc.title || doc.fileName, 'Документ'),
  type: mapDocumentType(doc.type),
  uploadedAt: asString(doc.uploadedAt || doc.createdAt),
  status: asString(doc.status, 'uploaded'),
  fileUrl: doc.fileUrl,
  sentToClient: doc.sentToClient,
  needsSignature: doc.needsSignature,
  needsClientResponse: doc.needsClientResponse,
  staffComment: doc.staffComment,
  dueDate: doc.dueDate,
});

const mapComment = (comment: AnyRecord = {}, orderId: string): CommentItem => ({
  id: asString(comment.id),
  orderId,
  author: asString(comment.author || comment.authorName, 'Пользователь'),
  text: asString(comment.text),
  visibility: comment.visibility === 'internal' ? 'internal' : 'client',
  createdAt: asString(comment.createdAt),
});

const mapHistory = (history: AnyRecord = {}, orderId: string): OrderHistoryItem => ({
  id: asString(history.id),
  orderId,
  text: asString(history.text || history.action || history.actionType),
  createdAt: asString(history.createdAt),
  actionType: history.actionType,
  actor: history.actor,
  actorName: history.actorName,
  actorRole: history.actorRole,
  oldValue: history.oldValue,
  newValue: history.newValue,
  comment: history.comment,
});

const mapQuarter = (quarter: AnyRecord = {}, orderId: string): RequestQuarter => ({
  id: asString(quarter.id),
  requestId: asString(quarter.requestId || orderId),
  contractId: asString(quarter.contractId || quarter.contractInfo?.id),
  quarter: Number(quarter.quarter || 1) as RequestQuarter['quarter'],
  quarterLabel: asString(quarter.quarterLabel, `${quarter.quarter || 1} квартал`) as RequestQuarter['quarterLabel'],
  periodStart: asString(quarter.periodStart),
  periodEnd: asString(quarter.periodEnd),
  serviceName: asString(quarter.serviceName),
  workStage: asString(quarter.workStage, 'Проектирование') as RequestQuarter['workStage'],
  workStatus: asString(quarter.workStatus, 'planned') as RequestQuarter['workStatus'],
  paymentStatus: asString(quarter.paymentStatus, 'unpaid') as RequestQuarter['paymentStatus'],
  plannedAmount: Number(quarter.plannedAmount || 0),
  paidAmount: Number(quarter.paidAmount || 0),
  remainingAmount: Number(quarter.remainingAmount || 0),
  invoiceNumber: quarter.invoiceNumber,
  invoiceDate: quarter.invoiceDate,
  dueDate: quarter.dueDate,
  lastPaymentDate: quarter.lastPaymentDate,
  documents: (quarter.documents || []).map((doc: AnyRecord) => ({
    id: asString(doc.id),
    quarterId: asString(doc.quarterId || quarter.id),
    requestId: asString(doc.requestId || orderId),
    contractId: asString(doc.contractId || quarter.contractId),
    name: asString(doc.name || doc.fileName, 'Документ квартала'),
    fileName: asString(doc.fileName || doc.name, 'Документ квартала'),
    fileUrl: doc.fileUrl,
    fileType: asString(doc.fileType || doc.mimeType, 'application/pdf'),
    fileSize: doc.fileSize,
    documentType: asString(doc.documentType || doc.type, 'other') as never,
    uploadedByRole: asString(doc.uploadedByRole, 'employee') as never,
    uploadedByName: asString(doc.uploadedByName || doc.uploadedByRole, 'Сотрудник'),
    uploadedAt: asString(doc.uploadedAt),
  })),
  results: quarter.results || [],
  comments: (quarter.comments || []).map((comment: AnyRecord) => ({
    id: asString(comment.id),
    quarterId: asString(comment.quarterId || quarter.id),
    requestId: asString(comment.requestId || orderId),
    author: asString(comment.author || comment.authorName, 'Пользователь'),
    text: asString(comment.text),
    visibility: comment.visibility === 'internal' ? 'internal' : 'client',
    createdAt: asString(comment.createdAt),
  })),
  responsibleEmployeeId: quarter.responsibleEmployeeId,
  responsibleEmployeeName: quarter.responsibleEmployeeName,
  startedAt: quarter.startedAt,
  completedAt: quarter.completedAt,
  createdAt: asString(quarter.createdAt),
  updatedAt: asString(quarter.updatedAt),
});

export const mapOrder = (raw: AnyRecord): Order => {
  if (!raw) return raw as Order;
  if (raw.clientId || raw.service) return raw as Order;

  const client = raw.clientInfo || {};
  const contract = raw.contractInfo || {};
  const totalAmount = raw.totalAmount || contract.totalAmount || contract.amounts?.totalAmount;
  const paidAmount = raw.paidAmount || contract.paidAmount || contract.amounts?.paidAmount;
  const remainingAmount = raw.remainingAmount || contract.remainingAmount || contract.amounts?.remainingAmount;
  const orderId = asString(raw.id);
  const agreementDocuments = raw.agreementDocuments || [];
  const resultDocuments = raw.resultDocuments || [];

  return {
    id: orderId,
    businessCompanyId: raw.businessCompanyId,
    businessCompanyName: raw.businessCompanyName,
    clientId: asString(client.id),
    clientType: client.clientType || 'company',
    clientName: asString(client.contactPerson || raw.contactPerson || client.companyName),
    companyName: asString(client.companyName),
    bin: asString(client.binIin || client.bin),
    organizationType: asString(client.organizationType),
    legalAddress: asString(client.legalAddress),
    objectAddress: raw.objectAddress,
    contactPerson: asString(raw.contactPerson || client.contactPerson),
    whatsapp: raw.whatsapp,
    phone: asString(raw.phone || client.phone),
    email: asString(client.email || raw.email),
    serviceId: asString(raw.serviceId),
    service: asString(raw.serviceName || raw.service),
    urgency: asString(raw.urgency),
    comment: asString(raw.comment),
    createdAt: asString(raw.createdAt),
    status: asString(raw.statusLabel || raw.status) as Order['status'],
    contractType: raw.contractType,
    contractId: asString(contract.id || raw.contractId),
    annualPeriodStart: raw.annualPeriodStart,
    annualPeriodEnd: raw.annualPeriodEnd,
    quarters: (raw.quarters || []).map((quarter: AnyRecord) => mapQuarter(quarter, orderId)),
    manager: asString(raw.managerName),
    contractStatus: raw.contractStatus || contract.status,
    crmContractStatus: raw.crmContractStatus || contract.crmStatus,
    paymentStatus: raw.paymentStatus,
    signatureProvider: raw.signatureProvider,
    paymentMethod: raw.paymentMethod,
    paymentAmount: raw.paymentAmount ? String(raw.paymentAmount) : undefined,
    offerAmount: raw.offerAmount,
    contractAmount: raw.contractAmount || totalAmount,
    totalAmount,
    paidAmount,
    remainingAmount,
    invoiceNumber: raw.invoiceNumber,
    assignedAccountant: raw.accountantName,
    assignedEcologist: raw.ecologistName,
    assignedLaboratory: raw.laboratoryUserName,
    ecologyStatus: raw.ecologyStatus,
    laboratoryStatus: raw.laboratoryStatus,
    laboratoryPrimaryDocuments: raw.laboratoryPrimaryDocuments || [],
    laboratoryMeasurementAgreement: raw.laboratoryMeasurementAgreement,
    laboratorySections: raw.laboratorySections,
    laboratoryResultDocuments: raw.laboratoryResultDocuments || [],
    notifications: raw.notifications,
    deadline: raw.deadline,
    updatedAt: raw.updatedAt,
    signedAt: raw.signedAt,
    paidAt: raw.paidAt,
    completedAt: raw.completedAt,
    documents: (raw.documents || []).map((doc: AnyRecord) => mapDocument(doc, orderId)),
    primaryDocuments: raw.primaryDocuments || [],
    resultDocuments: [...agreementDocuments, ...resultDocuments].map((doc: AnyRecord) => mapDocument(doc, orderId)),
    comments: (raw.comments || []).map((comment: AnyRecord) => mapComment(comment, orderId)),
    history: (raw.history || []).map((history: AnyRecord) => mapHistory(history, orderId)),
  } as Order;
};

export const mapOrders = (orders: AnyRecord[] = []) => orders.map(mapOrder);
