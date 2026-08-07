import api from '../../../services/api';
import type { ApiResponse } from '../../../services/apiHelpers';
import type { UsageMetric } from '../../document-flow/model/types';
import { getCompanies } from '../../../services/companyService';
import type {
  AccessGrantRequest, AdminOrganizationAccess, AdminOrganizationAccessListItem, DocumentFlowAdminPlan,
  DocumentFlowAdminSubscription, OrganizationSearchParams, SubscriptionEventAdmin,
} from '../model/types';
import type { PageResponse } from '../../../types/companies';
import { accessGrantRequestSchema, accessGrantResponseSchema, plansResponseSchema, subscriptionResponseSchema, subscriptionsResponseSchema } from './documentFlowAdminSchemas';

const unwrap = <T>(response: { data: ApiResponse<T> | T }): T => {
  const envelope = response.data;
  if (!envelope || typeof envelope !== 'object' || !('success' in envelope) || !('data' in envelope)) throw new Error('Не удалось обработать ответ сервера. Код: CONTRACT_MISMATCH');
  if (envelope.success !== true) throw new Error(envelope.message || 'Backend отклонил запрос.');
  return envelope.data;
};
const parse = <T>(schema: { parse(value: unknown): unknown }, value: unknown): T => schema.parse(value) as T;

export const documentFlowAdminApi = {
  searchOrganizations: ({ query, page, size, sort, signal }: OrganizationSearchParams) => getCompanies({
    page, size, search: query?.trim() || undefined, status: 'ACTIVE', sort,
  }, signal),
  plans: async (signal?: AbortSignal) => parse<DocumentFlowAdminPlan[]>(plansResponseSchema,
    unwrap<unknown>(await api.get('/admin/document-flow/plans', { signal }))),
  subscriptions: async (signal?: AbortSignal) => parse<DocumentFlowAdminSubscription[]>(subscriptionsResponseSchema,
    unwrap<unknown>(await api.get('/admin/document-flow/subscriptions', { signal }))),
  subscription: async (organizationId: number, signal?: AbortSignal) => parse<DocumentFlowAdminSubscription>(subscriptionResponseSchema,
    unwrap<unknown>(await api.get(`/admin/document-flow/subscriptions/${organizationId}`, { signal }))),
  accessList: async (params: { search?: string; status?: string; planCode?: string; accessState?: string; hasSubscription?: boolean; expiresBefore?: string; page: number; size: number; sort: string; direction: string }, signal?: AbortSignal) =>
    unwrap<PageResponse<AdminOrganizationAccessListItem>>(await api.get('/admin/document-flow/access', { params, signal })),
  organizationAccess: async (organizationId: number, signal?: AbortSignal) =>
    unwrap<AdminOrganizationAccess>(await api.get(`/admin/document-flow/access/${organizationId}`, { signal })),
  createAccessGrant: async (request: AccessGrantRequest, idempotencyKey: string) => {
    const payload = accessGrantRequestSchema.parse(request);
    const raw = unwrap<unknown>(await api.post('/admin/document-flow/access-grants', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }));
    return accessGrantResponseSchema.parse(raw);
  },
  extend: async (organizationId: number, newExpiresAt: string, reason: string, expectedVersion: number) =>
    unwrap<AdminOrganizationAccess>(await api.post(`/admin/document-flow/subscriptions/${organizationId}/extend`, { newExpiresAt, reason, expectedVersion })),
  changePlan: async (organizationId: number, planCode: string, reason: string, expectedVersion: number) =>
    unwrap<AdminOrganizationAccess>(await api.post(`/admin/document-flow/subscriptions/${organizationId}/change-plan`, { planCode, reason, expectedVersion })),
  changeLimits: async (organizationId: number, limits: Partial<Record<UsageMetric, number>>, reason: string, expectedVersion: number, startsAt?: string | null, expiresAt?: string | null) =>
    unwrap<AdminOrganizationAccess>(await api.post(`/admin/document-flow/subscriptions/${organizationId}/limits`, { limits, startsAt, expiresAt, reason, expectedVersion })),
  suspend: async (organizationId: number, reason: string, expectedVersion: number) =>
    unwrap<AdminOrganizationAccess>(await api.post(`/admin/document-flow/subscriptions/${organizationId}/suspend`, { reason, expectedVersion })),
  restore: async (organizationId: number, reason: string, expectedVersion: number) =>
    unwrap<AdminOrganizationAccess>(await api.post(`/admin/document-flow/subscriptions/${organizationId}/restore`, { reason, expectedVersion })),
  revoke: async (organizationId: number, reason: string, expectedVersion: number) =>
    unwrap<AdminOrganizationAccess>(await api.post(`/admin/document-flow/subscriptions/${organizationId}/revoke`, { reason, expectedVersion })),
  subscriptionEvents: async (organizationId: number, page = 0, size = 20, signal?: AbortSignal) =>
    unwrap<PageResponse<SubscriptionEventAdmin>>(await api.get(`/admin/document-flow/subscriptions/${organizationId}/events`, { params: { page, size }, signal })),
};
