import type { SubscriptionStatus, UsageMetric } from '../../document-flow/model/types';
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

export interface AdminOrganizationAccess {
  organizationId: number; hasSubscription: boolean; subscriptionId: number | null; subscriptionVersion: number | null;
  subscriptionStatus: DocumentFlowSubscriptionStatus | null; planId: number | null; planCode: string | null; planName: string | null;
  available: boolean; readOnly: boolean; reason: string | null; startsAt: string | null; expiresAt: string | null;
  limits: Partial<Record<UsageMetric, number>>; usage: Partial<Record<UsageMetric, number>>;
  activeMemberCount: number; hasOwner: boolean; availableAdminActions: string[];
}

export interface AdminOrganizationAccessListItem {
  organizationId: number; organizationName: string; organizationBin: string; hasSubscription: boolean;
  subscriptionId: number | null; subscriptionStatus: DocumentFlowSubscriptionStatus | null; planCode: string | null;
  planName: string | null; available: boolean; readOnly: boolean; startsAt: string | null; expiresAt: string | null;
  activeMemberCount: number; hasOwner: boolean; availableAdminActions: string[];
}

export interface SubscriptionEventAdmin {
  id: number; subscriptionId: number; organizationId: number; eventType: string; oldStatus: string | null;
  newStatus: string | null; reason: string | null; actorUserId: number | null; createdAt: string;
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
  access: AdminOrganizationAccess;
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
  access: AdminOrganizationAccess | null;
}

export type OrganizationPage = PageResponse<CompanyListItem>;
