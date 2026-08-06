import type { AccessContext, SubscriptionStatus, UsageMetric } from '../../document-flow/model/types';
import type { CompanyListItem, PageResponse } from '../../../types/companies';

export type DocumentFlowSubscriptionStatus = SubscriptionStatus;
export type DocumentFlowPaymentMode = 'ADMIN_GRANT';

export interface DocumentFlowAdminPlan {
  id: number;
  code: string;
  name: string;
  active: boolean;
  limits: Partial<Record<UsageMetric, number>>;
}

export interface DocumentFlowAdminSubscription {
  id: number;
  organizationId: number;
  planId: number;
  status: DocumentFlowSubscriptionStatus;
  startsAt: string;
  expiresAt: string | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  paymentMode: string;
  paymentReference: string | null;
  suspensionReason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  version: number | null;
}

export interface AccessGrantRequest {
  organizationId: number;
  planCode: string;
  startsAt: string;
  expiresAt: string | null;
  graceEndsAt: string | null;
  paymentMode: DocumentFlowPaymentMode;
  paymentReference: string | null;
  reason: string;
  limits?: Partial<Record<UsageMetric, number>>;
}

export interface AccessGrantResult {
  subscriptionId: number | null;
  access: AccessContext;
  synchronized: boolean;
}

export interface OrganizationSearchParams {
  query?: string;
  page: number;
  size: number;
  sort: string;
  signal?: AbortSignal;
}

export interface AccessGrantFilters {
  query?: string;
  status?: DocumentFlowSubscriptionStatus | '';
  planCode?: string;
  access?: 'ALL' | 'WITHOUT_ACCESS' | 'EXPIRING_30_DAYS';
  page: number;
  size: number;
  sort: string;
}

export interface OrganizationAccessRow {
  organization: CompanyListItem;
  subscription: DocumentFlowAdminSubscription | null;
  access: AccessContext | null;
}

export type OrganizationPage = PageResponse<CompanyListItem>;

