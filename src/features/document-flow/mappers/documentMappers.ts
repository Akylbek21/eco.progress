import type { CreateDocumentRequest, DocumentFilters, DocumentType, DocumentDirection } from '../model/types';

const optionalNumber = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const mapSearchParamsToDocumentFilters = (params: URLSearchParams): DocumentFilters => ({
  organizationId: optionalNumber(params.get('organizationId')),
  direction: (params.get('direction') || undefined) as DocumentFilters['direction'],
  type: (params.get('type') || undefined) as DocumentFilters['type'],
  status: (params.get('status') || undefined) as DocumentFilters['status'],
  counterpartyId: optionalNumber(params.get('counterpartyId')),
  authorId: optionalNumber(params.get('authorId')),
  signerId: optionalNumber(params.get('signerId')),
  overdue: params.get('overdue') === 'true' || undefined,
  createdFrom: params.get('createdFrom') || undefined,
  createdTo: params.get('createdTo') || undefined,
  deadlineFrom: params.get('deadlineFrom') || undefined,
  deadlineTo: params.get('deadlineTo') || undefined,
  query: params.get('query')?.trim() || undefined,
  page: Math.max(0, Number(params.get('page')) || 0),
  size: [10, 20, 50, 100].includes(Number(params.get('size'))) ? Number(params.get('size')) : 20,
  sort: params.get('sort') || 'createdAt,desc',
  // TODO backend gap: do not send requiresMySignature until SQL filtering and list counters are implemented.
});

export const mapCreateDocumentPayload = (value: {
  documentType: DocumentType;
  direction: DocumentDirection;
  title: string;
  description?: string;
  counterpartyId?: string;
  signingDeadline?: string;
  organizationId?: string;
}): CreateDocumentRequest => ({
  documentType: value.documentType,
  direction: value.direction,
  title: value.title.trim(),
  description: value.description?.trim() || undefined,
  counterpartyId: optionalNumber(value.counterpartyId || null),
  signingDeadline: value.signingDeadline || undefined,
  organizationId: optionalNumber(value.organizationId || null),
});
