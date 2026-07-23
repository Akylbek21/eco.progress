import type {
  CommentItem,
  DocumentItem,
  Order,
  OrderHistoryItem,
  RequestQuarter,
} from '../types';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const asRecords = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.map(asRecord) : [];

const asString = (value: unknown, fallback = '') => (value === undefined || value === null ? fallback : String(value));

const mapDocumentType = (type: unknown): DocumentItem['type'] => {
  const raw = asString(type, 'client');
  if (raw === 'invoice') return 'invoice';
  if (raw === 'contract') return 'contract';
  if (raw === 'act') return 'act';
  if (raw === 'result') return 'result';
  if (raw === 'internal') return 'internal';
  return 'client';
};

const mapPaymentStatus = (status: unknown): Order['paymentStatus'] => {
  const raw = asString(status);
  if (raw === 'not_paid') return 'not_sent';
  if (raw === 'overdue') return 'debt';
  return raw as Order['paymentStatus'];
};

export const mapDocument = (doc: UnknownRecord = {}, orderId?: string): DocumentItem => ({
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
  clientResponseStatus: doc.clientResponseStatus,
  clientComment: doc.clientComment,
  staffComment: doc.staffComment,
  dueDate: doc.dueDate,
  category: doc.category || doc.type,
  visibility: doc.visibility,
  fileName: doc.fileName || doc.name,
  fileSize: typeof doc.fileSize === 'number' ? doc.fileSize : Number(doc.fileSize || 0) || undefined,
  mimeType: doc.mimeType || doc.fileType,
  sentAt: doc.sentAt || doc.sentToClientAt,
  version: Number(doc.version || 1),
  uploadedBy: doc.uploadedByName || doc.uploadedBy,
  revisionComment: doc.revisionComment || doc.rejectionReason,
} as unknown as DocumentItem);

const isClientDocument = (doc: DocumentItem) => doc.type !== 'internal' && String(doc.visibility || 'CLIENT').toUpperCase() !== 'INTERNAL';

const clientTimelineActions = new Set([
  'order_created', 'document_requested', 'document_uploaded', 'document_sent_for_review',
  'document_revision_requested', 'document_approved', 'contract_sent', 'contract_signed',
  'invoice_sent', 'payment_receipt_uploaded', 'payment_confirmed', 'measurement_agreed',
  'result_ready', 'order_completed', 'status_changed', 'document_ready',
]);

const mapComment = (comment: UnknownRecord = {}, orderId: string): CommentItem => ({
  id: asString(comment.id),
  orderId,
  author: asString(comment.author || comment.authorName, 'Пользователь'),
  text: asString(comment.text),
  visibility: comment.visibility === 'internal' ? 'internal' : 'client',
  createdAt: asString(comment.createdAt),
} as unknown as CommentItem);

const mapHistory = (history: UnknownRecord = {}, orderId: string): OrderHistoryItem => ({
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
} as unknown as OrderHistoryItem);

const mapQuarter = (quarter: UnknownRecord = {}, orderId: string): RequestQuarter => ({
  id: asString(quarter.id),
  requestId: asString(quarter.requestId || orderId),
  contractId: asString(quarter.contractId || asRecord(quarter.contractInfo).id),
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
  documents: asRecords(quarter.documents).map((doc) => ({
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
  comments: asRecords(quarter.comments).map((comment) => ({
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
} as unknown as RequestQuarter);

export const mapOrder = (raw: UnknownRecord): Order => {
  if (!raw) return raw as unknown as Order;

  const client = asRecord(raw.clientInfo);
  const contract = asRecord(raw.contractInfo);
  const contractAmounts = asRecord(contract.amounts);
  const totalAmount = raw.totalAmount || contract.totalAmount || contractAmounts.totalAmount;
  const paidAmount = raw.paidAmount || contract.paidAmount || contractAmounts.paidAmount;
  const remainingAmount = raw.remainingAmount || contract.remainingAmount || contractAmounts.remainingAmount;
  const orderId = asString(raw.id);
  const agreementDocuments = asRecords(raw.agreementDocuments);
  const resultDocuments = asRecords(raw.resultDocuments);
  const payment = asRecord(raw.payment);
  const paymentRecord = asRecord(raw.paymentRecord);
  const paymentInfo = asRecord(raw.paymentInfo);

  return {
    id: orderId,
    businessCompanyId: raw.businessCompanyId,
    businessCompanyName: raw.businessCompanyName,
    clientId: asString(client.id || raw.clientId),
    clientType: (client.clientType || raw.clientType || 'company') as Order['clientType'],
    clientName: asString(client.contactPerson || raw.contactPerson || client.companyName),
    companyName: asString(client.companyName || raw.companyName),
    bin: asString(client.binIin || client.bin || raw.bin),
    organizationType: asString(client.organizationType || raw.organizationType),
    legalAddress: asString(client.legalAddress || raw.legalAddress),
    objectAddress: raw.objectAddress,
    contactPerson: asString(raw.contactPerson || client.contactPerson),
    whatsapp: raw.whatsapp,
    phone: asString(raw.phone || client.phone),
    email: asString(client.email || raw.email),
    serviceId: asString(raw.serviceId),
    service: asString(raw.serviceName || raw.service || raw.serviceType),
    urgency: asString(raw.urgency),
    comment: asString(raw.comment),
    createdAt: asString(raw.createdAt),
    status: asString(raw.statusLabel || raw.status) as Order['status'],
    contractType: raw.contractType,
    contractId: asString(contract.id || raw.contractId),
    annualPeriodStart: raw.annualPeriodStart,
    annualPeriodEnd: raw.annualPeriodEnd,
    quarters: asRecords(raw.quarters).map((quarter) => mapQuarter(quarter, orderId)),
    manager: asString(raw.managerName || raw.manager),
    contractStatus: raw.contractStatus || contract.status,
    crmContractStatus: raw.crmContractStatus || contract.crmStatus,
    paymentStatus: mapPaymentStatus(raw.paymentStatus),
    paymentId: asString(raw.paymentId || payment.id || paymentRecord.id || paymentInfo.id),
    signatureProvider: raw.signatureProvider,
    paymentMethod: raw.paymentMethod,
    paymentAmount: raw.paymentAmount ? String(raw.paymentAmount) : undefined,
    offerAmount: raw.offerAmount,
    contractAmount: raw.contractAmount || totalAmount,
    totalAmount,
    paidAmount,
    remainingAmount,
    invoiceNumber: raw.invoiceNumber,
    invoiceFileName: raw.invoiceFileName,
    invoiceSentAt: raw.invoiceSentAt,
    invoiceDate: raw.invoiceDate || payment.invoiceDate || paymentRecord.invoiceDate,
    dueDate: raw.dueDate || payment.dueDate || paymentRecord.dueDate,
    paymentComment: raw.paymentComment || payment.comment || paymentRecord.comment,
    accountantComment: raw.accountantComment,
    assignedAccountant: raw.accountantName,
    assignedEcologist: raw.ecologistName,
    assignedLaboratory: raw.laboratoryUserName,
    ecologyStatus: raw.ecologyStatus,
    laboratoryStatus: raw.laboratoryStatus,
    laboratoryPrimaryDocuments: Array.isArray(raw.laboratoryPrimaryDocuments) ? raw.laboratoryPrimaryDocuments : [],
    laboratoryMeasurementAgreement: raw.laboratoryMeasurementAgreement,
    laboratorySections: raw.laboratorySections,
    laboratoryResultDocuments: asRecords(raw.laboratoryResultDocuments).filter((document) => document.clientVisible === true || String(document.status).toUpperCase() === 'PUBLISHED_TO_CLIENT') as unknown as Order['laboratoryResultDocuments'],
    linkedProtocol: (() => {
      const protocol = asRecord(raw.linkedProtocol || raw.protocol);
      const id = asString(protocol.id || raw.protocolId);
      return id ? { id, number: asString(protocol.number || protocol.protocolNumber || raw.protocolNumber), status: asString(protocol.status || raw.protocolStatus) } : undefined;
    })(),
    canComplete: raw.canComplete === true,
    blockingReasons: Array.isArray(raw.blockingReasons) ? raw.blockingReasons.map(String) : [],
    notifications: raw.notifications,
    deadline: raw.deadline,
    updatedAt: raw.updatedAt,
    signedAt: raw.signedAt,
    paidAt: raw.paidAt,
    completedAt: raw.completedAt,
    documents: asRecords(raw.documents).map((doc) => mapDocument(doc, orderId)).filter(isClientDocument),
    agreementDocuments: agreementDocuments.map((doc) => mapDocument(doc, orderId)).filter(isClientDocument),
    primaryDocuments: Array.isArray(raw.primaryDocuments) ? raw.primaryDocuments : [],
    resultDocuments: [...agreementDocuments, ...resultDocuments].map((doc) => mapDocument(doc, orderId)).filter(isClientDocument),
    comments: asRecords(raw.comments).map((comment) => mapComment(comment, orderId)),
    history: asRecords(raw.timeline || raw.history)
      .filter((history) => String(history.visibility || 'CLIENT').toUpperCase() === 'CLIENT' && clientTimelineActions.has(asString(history.actionType || history.type, 'status_changed').toLowerCase()))
      .map((history) => mapHistory(history, orderId)),
  } as unknown as Order;
};

export const mapOrders = (orders: UnknownRecord[] = []) => orders.map(mapOrder);
