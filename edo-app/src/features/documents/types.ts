import type { Permission } from '../../shared/types/domain';

export interface DocumentType {
  id: string;
  code: string;
  name: string;
  direction: 'INCOMING' | 'OUTGOING' | string;
  total?: number;
  awaitingSignature?: number;
}

export interface DocumentSummary {
  id: string;
  number?: string;
  title: string;
  type: DocumentType;
  direction: string;
  status: string;
  counterparty?: { id: string; name: string; binMasked?: string };
  author?: { id: string; name: string };
  createdAt: string;
  dueAt?: string;
  version: number;
  signatureProgress?: { signed: number; total: number };
  availableActions: string[];
}

export interface DocumentDetails extends DocumentSummary {
  description?: string;
  hash: string;
  lockedAt?: string;
  sender?: { name: string; binMasked?: string };
  recipient?: { name: string; binMasked?: string };
  permissions: Permission[];
  sourceSystem?: string;
  externalEntityType?: string;
  externalEntityId?: string;
  externalUrl?: string;
  files: Array<{ id: string; name: string; size: number; mimeType: string; sha256: string; version: number }>;
  signingRoute: Array<{
    id: string;
    order: number;
    mode: 'SEQUENTIAL' | 'PARALLEL' | string;
    status: string;
    assignments: Array<{
      id: string;
      signerName: string;
      iinMasked?: string;
      organization?: string;
      position?: string;
      required: boolean;
      status: string;
      signedAt?: string;
    }>;
  }>;
}

export interface DashboardData {
  incoming: number;
  outgoing: number;
  requiresMySignature: number;
  partiallySigned: number;
  signed: number;
  rejected: number;
  overdue: number;
  drafts: number;
  documentTypes: DocumentType[];
}

export interface DocumentFilters {
  direction?: string;
  type?: string;
  status?: string;
  counterpartyId?: string;
  authorId?: string;
  signerId?: string;
  createdFrom?: string;
  createdTo?: string;
  dueFrom?: string;
  dueTo?: string;
  requiresMySignature?: boolean;
  overdue?: boolean;
  archived?: boolean;
  draft?: boolean;
  search?: string;
  page: number;
  size: number;
  sort: string;
}
